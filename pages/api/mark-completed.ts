// API endpoint для отметки задания как выполненного
import type { NextApiRequest, NextApiResponse } from 'next';
import { markLinkCompleted } from '@/lib/db-config';

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
    const { userFid, linkId } = req.body;

    if (!userFid || !linkId) {
      return res.status(400).json({
        error: 'Missing required fields: userFid, linkId',
      });
    }

    const fid = typeof userFid === 'number' ? userFid : parseInt(userFid, 10);
    if (isNaN(fid)) {
      return res.status(400).json({
        error: 'Invalid userFid parameter',
      });
    }

    console.log(`💾 API /mark-completed: marking link as completed:`, {
      userFid: fid,
      linkId,
      timestamp: new Date().toISOString(),
    });

    await markLinkCompleted(fid, linkId);

    console.log(`✅ API /mark-completed: link marked as completed successfully`);

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error in mark-completed API:', error);
    return res.status(500).json({
      error: 'Failed to mark link as completed',
      message: error.message,
    });
  }
}

