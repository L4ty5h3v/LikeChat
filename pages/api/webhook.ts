import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Webhook endpoint (optional).
 * Base Mini App манифест может ссылаться на webhookUrl — отвечаем 200 OK,
 * чтобы валидаторы/платформы не получали 404.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true });
  }

  try {
    // Пока просто принимаем payload (можно расширить позже).
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(200).json({ ok: true, error: e?.message });
  }
}


