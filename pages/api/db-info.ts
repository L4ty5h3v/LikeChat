import type { NextApiRequest, NextApiResponse } from 'next';
import { DB_INFO } from '@/lib/db-config';
import { Redis } from '@upstash/redis';

function readEnvTrimmed(key: string): string | undefined {
  const v = process.env[key];
  if (!v) return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Optional active health check (safe: no secrets returned)
  const url = readEnvTrimmed('UPSTASH_REDIS_REST_URL') || readEnvTrimmed('KV_REST_API_URL');
  const token =
    readEnvTrimmed('UPSTASH_REDIS_REST_TOKEN') ||
    readEnvTrimmed('KV_REST_API_TOKEN') ||
    readEnvTrimmed('KV_REST_API_READ_ONLY_TOKEN');

  const health: any = {
    env: {
      hasUrl: !!url,
      hasToken: !!token,
      vercelGitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    },
    upstash: {
      pingOk: false,
      canRead: false,
      canWrite: false,
      linksLen: null as null | number,
      error: null as null | string,
    },
  };

  if (url && token) {
    const redis = new Redis({ url, token });
    const keyLinks = 'likechat:links';
    const keyProbe = 'likechat:__health_probe__';

    // Run checks sequentially; any failure is captured in health.upstash.error.
    return (async () => {
      try {
        // Ping may not exist in older clients; fall back to a small read.
        try {
          const pong = await (redis as any).ping?.();
          if (pong) health.upstash.pingOk = true;
        } catch {
          // ignore
        }

        try {
          const len = await redis.llen(keyLinks);
          if (typeof len === 'number') {
            health.upstash.canRead = true;
            health.upstash.linksLen = len;
          } else {
            health.upstash.linksLen = null;
          }
        } catch (e: any) {
          health.upstash.error = e?.message || String(e);
        }

        // Non-destructive write test: LPUSH + LPOP on a dedicated probe key.
        try {
          await redis.lpush(keyProbe, `probe_${Date.now()}`);
          await redis.lpop(keyProbe);
          health.upstash.canWrite = true;
        } catch (e: any) {
          // Read-only tokens will fail here.
          health.upstash.canWrite = false;
          if (!health.upstash.error) health.upstash.error = e?.message || String(e);
        }
      } catch (e: any) {
        health.upstash.error = e?.message || String(e);
      }

      return res.status(200).json({ success: true, db: DB_INFO, health });
    })();
  }

  return res.status(200).json({ success: true, db: DB_INFO, health });
}


