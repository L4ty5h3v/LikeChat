// Debug API to check Redis contents
import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

const KEYS = {
  LINKS: 'likechat:links',
  TOTAL_LINKS_COUNT: 'likechat:total_links_count',
};

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL.trim(),
      token: process.env.UPSTASH_REDIS_REST_TOKEN.trim(),
    })
  : null;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!redis) {
    return res.status(500).json({ error: 'Redis not configured' });
  }

  try {
    const count = await redis.get<number>(KEYS.TOTAL_LINKS_COUNT);
    const listLength = await redis.llen(KEYS.LINKS);
    const rawLinks = await redis.lrange(KEYS.LINKS, 0, 9);

    return res.status(200).json({
      success: true,
      countFromKey: count,
      listLength,
      rawLinksCount: rawLinks?.length || 0,
      firstRawLink: rawLinks?.[0] || null,
      rawLinksSample: rawLinks?.slice(0, 3) || [],
    });
  } catch (error: any) {
    console.error('Debug error:', error);
    return res.status(500).json({
      error: 'Failed',
      message: error.message,
    });
  }
}

