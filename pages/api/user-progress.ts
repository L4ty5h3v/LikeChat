// API endpoint для получения прогресса пользователя
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserProgress } from '@/lib/db-config';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Отключаем кеширование для получения актуальных данных
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const userFid = req.query.userFid as string | undefined;
    
    if (!userFid) {
      return res.status(400).json({
        error: 'Missing userFid parameter',
      });
    }

    const fid = parseInt(userFid, 10);
    if (isNaN(fid)) {
      return res.status(400).json({
        error: 'Invalid userFid parameter',
      });
    }

    const progress = await getUserProgress(fid);
    
    console.log(`📊 API /user-progress: returning progress for user ${fid}:`, {
      hasProgress: !!progress,
      completedLinksCount: progress?.completed_links?.length || 0,
      completedLinks: progress?.completed_links || [],
      tokenPurchased: progress?.token_purchased || false,
    });
    
    return res.status(200).json({ success: true, progress });
  } catch (error: any) {
    console.error('Error in user-progress API:', error);
    return res.status(500).json({
      error: 'Failed to get user progress',
      message: error.message,
    });
  }
}

