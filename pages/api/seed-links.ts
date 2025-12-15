import type { NextApiRequest, NextApiResponse } from 'next';
import { clearAllLinks, seedLinks } from '@/lib/db-config';

function isAddress(value?: string): boolean {
  return !!value && /^0x[a-fA-F0-9]{40}$/.test(value);
}

/**
 * Админский endpoint: загрузить конкретные ссылки (castUrl + tokenAddress) в базу.
 * Можно заменить весь список (replace=true), чтобы на Tasks остались только эти ссылки.
 *
 * Защита: если INIT_LINKS_SECRET_KEY задан — требует secretKey.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');

  const secretKey = req.body?.secretKey || req.query?.secretKey;
  const requiredSecretKey = process.env.INIT_LINKS_SECRET_KEY;
  if (requiredSecretKey && requiredSecretKey.trim() !== '') {
    if (!secretKey || secretKey !== requiredSecretKey) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Секретный ключ не указан или неверен. Установите INIT_LINKS_SECRET_KEY в Vercel или передайте secretKey.',
      });
    }
  }

  if (!seedLinks) {
    return res.status(503).json({
      success: false,
      error: 'seedLinks is not available',
      message: 'seedLinks is not available in current DB adapter.',
    });
  }

  const replace = !!req.body?.replace;
  const links = Array.isArray(req.body?.links) ? req.body.links : null;
  if (!links || links.length === 0) {
    return res.status(400).json({ success: false, error: 'Missing links[]' });
  }

  const normalized: Array<{ castUrl: string; tokenAddress: string; username?: string; pfpUrl?: string }> = [];
  for (const item of links) {
    const castUrl = (item?.castUrl || item?.url || '').toString().trim();
    const tokenAddress = (item?.tokenAddress || item?.token_address || '').toString().trim();
    const username = item?.username ? item.username.toString().trim() : undefined;
    const pfpUrl = item?.pfpUrl ? item.pfpUrl.toString().trim() : undefined;

    if (!castUrl || !castUrl.startsWith('http')) {
      return res.status(400).json({ success: false, error: `Invalid castUrl: ${castUrl}` });
    }
    if (!isAddress(tokenAddress)) {
      return res.status(400).json({ success: false, error: `Invalid tokenAddress: ${tokenAddress}` });
    }

    normalized.push({ castUrl, tokenAddress, username, pfpUrl });
  }

  try {
    let removed = 0;
    if (replace && clearAllLinks) {
      removed = await clearAllLinks();
    }

    const result = await seedLinks(normalized);
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error || 'Failed to seed links' });
    }

    return res.status(200).json({
      success: true,
      removed,
      added: result.count,
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to seed links' });
  }
}


