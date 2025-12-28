import type { NextApiRequest, NextApiResponse } from 'next';

const MAX_BYTES = 1_500_000; // 1.5MB
const TIMEOUT_MS = 10_000;

function isIpHostname(host: string): boolean {
  // Basic IPv4 / IPv6 literal checks (avoid SSRF to raw IPs)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  if (/^\[?[a-fA-F0-9:]+\]?$/.test(host) && host.includes(':')) return true;
  return false;
}

function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (!h) return false;
  if (isIpHostname(h)) return false;

  // Allowlist common avatar/media hosts we use (ENS/IPFS/Warpcast/Dicebear/etc.)
  const exact = new Set([
    'api.dicebear.com',
    'cloudflare-ipfs.com',
    'arweave.net',
    'ipfs.io',
    'gateway.pinata.cloud',
    'metadata.ens.domains',
    'i.imgur.com',
    'res.cloudinary.com',
    'imagedelivery.net',
    'cdn.warpcast.com',
    'warpcast.com',
  ]);
  if (exact.has(h)) return true;

  // Subdomain allows (conservative)
  if (h.endsWith('.imagedelivery.net')) return true;
  if (h.endsWith('.cloudinary.com')) return true;
  if (h.endsWith('.warpcast.com')) return true;

  return false;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');

  const raw = typeof req.query.url === 'string' ? req.query.url : '';
  if (!raw) return res.status(400).json({ error: 'Missing url' });

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // ignore
  }

  let u: URL;
  try {
    u = new URL(decoded);
  } catch {
    return res.status(400).json({ error: 'Invalid url' });
  }

  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    return res.status(400).json({ error: 'Unsupported protocol' });
  }
  if (!isAllowedHost(u.hostname)) {
    return res.status(400).json({ error: 'Host not allowed' });
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const r = await fetch(u.toString(), {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        Accept: 'image/*,*/*;q=0.8',
        'User-Agent': 'likechat-avatar-proxy/1.0',
      },
    });

    if (!r.ok) {
      return res.status(502).json({ error: 'Upstream error', status: r.status });
    }

    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (!ct.startsWith('image/')) {
      return res.status(415).json({ error: 'Upstream is not an image' });
    }

    const contentLength = Number(r.headers.get('content-length') || '0');
    if (contentLength && contentLength > MAX_BYTES) {
      return res.status(413).json({ error: 'Image too large' });
    }

    const ab = await r.arrayBuffer();
    const buf = Buffer.from(ab);
    if (buf.byteLength > MAX_BYTES) {
      return res.status(413).json({ error: 'Image too large' });
    }

    res.setHeader('Content-Type', ct);
    return res.status(200).send(buf);
  } catch (e: any) {
    const msg = (e?.name === 'AbortError' || /aborted/i.test(String(e?.message || ''))) ? 'Timeout' : 'Fetch failed';
    return res.status(502).json({ error: msg });
  } finally {
    clearTimeout(t);
  }
}


