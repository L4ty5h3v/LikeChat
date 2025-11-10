// API endpoint для верификации покупки токена через Farcaster API
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyTokenPurchaseViaFarcaster } from '@/lib/web3';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userFid } = req.body;

    if (!userFid) {
      return res.status(400).json({ 
        error: 'Missing user FID',
        verified: false 
      });
    }

    // Верифицируем покупку через Farcaster API
    const verified = await verifyTokenPurchaseViaFarcaster(userFid);
    
    return res.status(200).json({ 
      verified: verified,
      method: 'farcaster',
      userFid 
    });
  } catch (error: any) {
    console.error('Error verifying token purchase:', error);
    return res.status(500).json({ 
      error: error?.message || 'Internal server error',
      verified: false 
    });
  }
}

