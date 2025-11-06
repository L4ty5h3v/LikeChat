// Тестовый endpoint для проверки данных ссылок в Redis
import type { NextApiRequest, NextApiResponse } from 'next';
import { getLastTenLinks } from '@/lib/db-config';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const links = await getLastTenLinks();
    
    // Детальная информация о каждой ссылке
    const detailedLinks = links.map((link, index) => ({
      index: index + 1,
      id: link.id,
      username: link.username,
      user_fid: link.user_fid,
      pfp_url: link.pfp_url,
      cast_url: link.cast_url,
      activity_type: link.activity_type,
      has_real_pfp: !!link.pfp_url && !link.pfp_url.includes('dicebear'),
      has_real_fid: link.user_fid > 0,
      pfp_source: link.pfp_url?.includes('dicebear') ? 'fallback' : 
                  link.pfp_url?.includes('imagedelivery') ? 'real' :
                  link.pfp_url?.includes('api.dicebear') ? 'fallback' : 'unknown',
    }));

    return res.status(200).json({
      success: true,
      total: links.length,
      links: detailedLinks,
      summary: {
        with_real_pfp: detailedLinks.filter(l => l.has_real_pfp).length,
        with_real_fid: detailedLinks.filter(l => l.has_real_fid).length,
        with_fallback_pfp: detailedLinks.filter(l => !l.has_real_pfp).length,
        with_fallback_fid: detailedLinks.filter(l => !l.has_real_fid).length,
      },
    });
  } catch (error: any) {
    console.error('Error in debug-links API:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Unknown error',
      details: error,
    });
  }
}

