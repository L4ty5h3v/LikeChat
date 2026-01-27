// API endpoint для начальной загрузки ссылок
import type { NextApiRequest, NextApiResponse } from 'next';
import { initializeLinks } from '@/lib/db-config';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Проверяем секретный ключ для безопасности (опционально, если не установлен - пропускаем проверку)
  const secretKey = req.body.secretKey || req.query.secretKey;
  const requiredSecretKey = process.env.INIT_LINKS_SECRET_KEY;
  
  // Если секретный ключ установлен в переменных окружения, проверяем его
  if (requiredSecretKey && requiredSecretKey.trim() !== '') {
    if (!secretKey || secretKey !== requiredSecretKey) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Secret key is missing or invalid. Set INIT_LINKS_SECRET_KEY on Vercel or provide the correct key.'
      });
    }
  }

  try {
    if (!initializeLinks) {
      return res.status(500).json({ 
        error: 'Failed to initialize links',
        message: 'Upstash Redis not configured'
      });
    }
    
    const result = await initializeLinks();

    if (!result) {
      return res.status(500).json({ 
        error: 'Failed to initialize links',
        message: 'No result returned from initializeLinks'
      });
    }

    if (result.success) {
      return res.status(200).json({ 
        success: true,
        message: `Cleared ${result.count} links`,
        count: result.count
      });
    } else {
      return res.status(400).json({ 
        success: false,
        error: result.error || 'Initialization error',
        count: result.count || 0
      });
    }
  } catch (error: any) {
    console.error('Error initializing links:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to initialize links',
      message: error?.message || 'Unknown error'
    });
  }
}

