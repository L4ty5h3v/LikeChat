// API endpoint для получения задач
import type { NextApiRequest, NextApiResponse } from 'next';
import { getLastTenLinks } from '@/lib/db-config';

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
    const links = await getLastTenLinks();
    console.log(`📋 API /tasks: returning ${links.length} links`);
    return res.status(200).json({ success: true, links });
  } catch (error: any) {
    console.error('Error in tasks API:', error);
    return res.status(500).json({
      error: 'Failed to get tasks',
      message: error.message,
    });
  }
}

