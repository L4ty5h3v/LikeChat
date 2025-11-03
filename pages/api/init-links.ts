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
  if (process.env.INIT_LINKS_SECRET_KEY && secretKey !== process.env.INIT_LINKS_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Проверяем, доступна ли функция initializeLinks
  if (!initializeLinks) {
    return res.status(500).json({ 
      success: false,
      error: 'InitializeLinks function not available',
      message: 'Upstash Redis is not configured. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.'
    });
  }

  try {
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
        message: `Инициализировано ${result.count} ссылок`,
        count: result.count
      });
    } else {
      return res.status(400).json({ 
        success: false,
        error: result.error || 'Ошибка при инициализации',
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

