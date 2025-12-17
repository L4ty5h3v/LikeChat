/**
 * Media helpers (client-safe).
 * - Normalizes avatar URLs that can come as ipfs://... etc.
 * - Provides a PNG fallback avatar that works reliably in in-app WebViews.
 */

export function normalizeAvatarUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.toString().trim();
  if (!trimmed) return null;

  // Already usable
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // ipfs://<cid> or ipfs://ipfs/<cid>
  if (trimmed.startsWith('ipfs://')) {
    const rest = trimmed.slice('ipfs://'.length);
    const path = rest.startsWith('ipfs/') ? rest.slice('ipfs/'.length) : rest;
    // ipfs.io is often slow/blocked in in-app WebViews; Cloudflare gateway is usually more reliable.
    return `https://cloudflare-ipfs.com/ipfs/${path}`;
  }

  // ar://<tx>
  if (trimmed.startsWith('ar://')) {
    return `https://arweave.net/${trimmed.slice('ar://'.length)}`;
  }

  // Unknown scheme — return as-is; img onError will handle fallback.
  return trimmed;
}

export function dicebearIdenticonPng(seed: string, size = 128): string {
  const safeSeed = encodeURIComponent(seed || 'user');
  const safeSize = Math.max(32, Math.min(256, Math.floor(size)));
  return `https://api.dicebear.com/7.x/identicon/png?seed=${safeSeed}&size=${safeSize}`;
}

/**
 * Network-free fallback avatar (inline SVG data URI).
 * Works even when external image hosts are blocked in WebViews.
 */
export function fallbackAvatarDataUri(seed: string, size = 96): string {
  const s = (seed || 'user').toString();
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  const bg = `hsl(${hue}, 70%, 45%)`;
  const fg = 'rgba(255,255,255,0.92)';
  const letter = (s.trim()[0] || 'U').toUpperCase();
  const safeSize = Math.max(32, Math.min(256, Math.floor(size)));

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${safeSize}" height="${safeSize}" viewBox="0 0 ${safeSize} ${safeSize}">
  <rect width="100%" height="100%" rx="${Math.floor(safeSize / 2)}" fill="${bg}"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
        font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
        font-size="${Math.floor(safeSize * 0.44)}" font-weight="800" fill="${fg}">${letter}</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}


