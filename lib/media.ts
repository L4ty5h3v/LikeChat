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
    return `https://ipfs.io/ipfs/${path}`;
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


