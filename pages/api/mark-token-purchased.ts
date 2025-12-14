// API endpoint для отметки покупки MCT как выполненной
import type { NextApiRequest, NextApiResponse } from 'next';
import { markTokenPurchased } from '@/lib/db-config';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const { userFid, txHash } = req.body || {};
    if (!userFid) {
      return res.status(400).json({ error: 'Missing userFid' });
    }

    const fid = typeof userFid === 'number' ? userFid : parseInt(userFid, 10);
    if (isNaN(fid)) {
      return res.status(400).json({ error: 'Invalid userFid' });
    }

    await markTokenPurchased(fid, txHash);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error in mark-token-purchased API:', error);
    return res.status(500).json({ error: 'Failed to mark token purchased', message: error?.message });
  }
}


