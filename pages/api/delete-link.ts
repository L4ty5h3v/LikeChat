// API endpoint для удаления ссылки
import type { NextApiRequest, NextApiResponse } from 'next';
import { deleteLink } from '@/lib/db-config';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { linkId } = req.body;

    if (!linkId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: linkId',
      });
    }

    console.log(`🗑️ API /delete-link: deleting link:`, {
      linkId,
      timestamp: new Date().toISOString(),
    });

    const deleted = await deleteLink(linkId);

    if (deleted) {
      console.log(`✅ API /delete-link: link deleted successfully`);
      return res.status(200).json({ success: true });
    } else {
      console.warn(`⚠️ API /delete-link: link not found`);
      return res.status(404).json({
        success: false,
        error: 'Link not found',
      });
    }
  } catch (error: any) {
    console.error('Error in delete-link API:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete link',
      message: error.message,
    });
  }
}

