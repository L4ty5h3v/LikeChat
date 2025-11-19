// pages/api/verify-activity.ts

import type { NextApiRequest, NextApiResponse } from 'next';

import {
  getFullCastHash,
  checkUserLiked,
  checkUserRecasted,
  checkUserCommented,
} from '@/lib/neynar';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { castUrl, userFid, activityType } = req.body ?? {};

  console.log('[VERIFY] request body:', { castUrl, userFid, activityType });

  if (!castUrl || !userFid || !activityType) {
    return res.status(400).json({ success: false, completed: false, error: 'Missing params' });
  }

  // Проверяем наличие API ключа
  if (!process.env.NEYNAR_API_KEY) {
    console.error('[VERIFY] NEYNAR_API_KEY not configured');
    return res.status(500).json({
      success: false,
      completed: false,
      error: 'Neynar API key not configured',
    });
  }

  // получаем полный hash (resolve if needed)
  console.log('[VERIFY] Attempting to resolve castUrl:', castUrl);
  const fullHash = await getFullCastHash(castUrl);
  console.log('[VERIFY] resolved fullHash:', fullHash);

  if (!fullHash) {
    console.error('[VERIFY] Failed to resolve full hash for URL:', castUrl);
    return res.status(200).json({
      success: false,
      completed: false,
      error: 'Не удалось получить полный hash. Проверьте ссылку или попробуйте позже.',
      neynarExplorerUrl: `https://explorer.neynar.com/search?q=${encodeURIComponent(castUrl)}`,
    });
  }

  // проверяем активность
  let completed = false;
  try {
    if (activityType === 'like') completed = await checkUserLiked(fullHash, Number(userFid));
    if (activityType === 'recast') completed = await checkUserRecasted(fullHash, Number(userFid));
    if (activityType === 'comment') completed = await checkUserCommented(fullHash, Number(userFid));
  } catch (e) {
    console.error('[VERIFY] check error', e);
    return res.status(500).json({ success: false, completed: false, error: 'Internal check error' });
  }

  return res.status(200).json({
    success: true,
    completed,
    castHash: fullHash,
    neynarExplorerUrl: `https://explorer.neynar.com/casts/${fullHash}`,
  });
}
