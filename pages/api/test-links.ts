// Temporary API to test links retrieval
import type { NextApiRequest, NextApiResponse } from 'next';
import { getLastTenLinks, getTotalLinksCount } from '@/lib/db-config';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const count = await getTotalLinksCount();
    const links = await getLastTenLinks();

    return res.status(200).json({
      success: true,
      count,
      linksCount: links.length,
      links: links.map(link => ({
        id: link.id,
        cast_url: link.cast_url,
        username: link.username,
        activity_type: link.activity_type,
      })),
    });
  } catch (error: any) {
    console.error('Error in test-links:', error);
    return res.status(500).json({
      error: 'Failed to get links',
      message: error.message,
    });
  }
}

