// API endpoint для публикации ссылки
import type { NextApiRequest, NextApiResponse } from 'next';
import { submitLink } from '@/lib/db-config';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Отключаем кеширование
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const { userFid, username, pfpUrl, castUrl, activityType } = req.body;

    if (!userFid || !username || !castUrl || !activityType) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: userFid, username, castUrl, activityType' 
      });
    }

    console.log('📝 API /submit-link: Submitting link:', {
      userFid,
      username,
      castUrl: castUrl.substring(0, 50) + '...',
      activityType,
    });

    const result = await submitLink(
      userFid,
      username,
      pfpUrl || '',
      castUrl,
      activityType
    );

    if (!result) {
      console.error('❌ API /submit-link: submitLink returned null');
      return res.status(500).json({ 
        success: false,
        error: 'Failed to submit link - result is null' 
      });
    }

    console.log(`✅ API /submit-link: Link published successfully:`, {
      id: result.id,
      username: result.username,
      user_fid: result.user_fid,
      created_at: result.created_at,
    });

    return res.status(200).json({ 
      success: true, 
      link: result 
    });
  } catch (error: any) {
    console.error('❌ API /submit-link error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to submit link',
      details: error.toString()
    });
  }
}

