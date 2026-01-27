import type { NextApiRequest, NextApiResponse } from 'next';
import { getLastTenLinks } from '@/lib/db-config';
import { REQUIRED_BUYS_TO_PUBLISH } from '@/lib/app-config';
import { createPublicClient, http, erc20Abi, isAddress as isViemAddress } from 'viem';
import { base } from 'viem/chains';

const BASE_RPC_URL =
  process.env.ALCHEMY_BASE_RPC_URL ||
  process.env.BASE_RPC_URL ||
  process.env.BASERPCURL ||
  'https://mainnet.base.org';

const publicClient = createPublicClient({
  chain: base,
  transport: http(BASE_RPC_URL, { timeout: 15_000, retryCount: 1, retryDelay: 2_000 }),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const { walletAddress, taskType } = req.body || {};
    const wallet = (walletAddress || '').toString().trim();
    const t = (taskType || 'support').toString().trim();

    if (!isViemAddress(wallet)) {
      return res.status(400).json({ success: false, error: 'Invalid walletAddress' });
    }

    let verifiedOnchainCount = 0;
    let tokensChecked = 0;

    const batch = await getLastTenLinks(t as any);
    for (const l of batch) {
      if (verifiedOnchainCount >= REQUIRED_BUYS_TO_PUBLISH) break;
      const token = (l?.token_address || '').toString().trim();
      if (!isViemAddress(token)) continue;
      tokensChecked += 1;

      const bal = await publicClient.readContract({
        address: token as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [wallet as `0x${string}`],
      });
      if (typeof bal === 'bigint' && bal > 0n) {
        verifiedOnchainCount += 1;
      }
    }

    return res.status(200).json({
      success: true,
      verifiedOnchainCount,
      requiredCount: REQUIRED_BUYS_TO_PUBLISH,
      tokensChecked,
    });
  } catch (e: any) {
    console.error('Error in verify-buys API:', e);
    return res.status(500).json({ success: false, error: 'Failed to verify buys', message: e?.message });
  }
}


