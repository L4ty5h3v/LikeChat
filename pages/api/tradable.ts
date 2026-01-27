import type { NextApiRequest, NextApiResponse } from 'next';
import { parseUnits } from 'viem';
import { BUY_AMOUNT_USDC_DECIMAL } from '@/lib/app-config';
import { isTokenTradableCached } from '@/lib/tradable';

type TradableResponse =
  | { success: true; tradable: boolean }
  | { success: false; error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<TradableResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const tokenAddress = (req.body?.tokenAddress || '').toString();
    const amountDecimal = (req.body?.usdcAmountDecimal || BUY_AMOUNT_USDC_DECIMAL).toString();
    const usdcAmountIn = parseUnits(amountDecimal, 6);

    const tradable = await isTokenTradableCached(tokenAddress, usdcAmountIn);
    return res.status(200).json({ success: true, tradable });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to check tradability' });
  }
}


