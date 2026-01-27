// Utilities for Base App "content" URLs.
// base.app/content/<id> is a deterministic encoding of:
// - network: "networks/base-mainnet"
// - content id: token contract address (0x...)
//
// This lets us generate a stable URL for a tokenized post from token address alone.

export function isHexAddress(value?: string): value is `0x${string}` {
  return !!value && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function base64UrlEncode(bytes: Uint8Array): string {
  // Server: Buffer is available
  // Client: use btoa (ASCII only) after converting bytes to binary string.
  let base64: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasBuffer = typeof (globalThis as any).Buffer !== 'undefined';
  if (hasBuffer) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    base64 = (globalThis as any).Buffer.from(bytes).toString('base64');
  } else {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    base64 = btoa(bin);
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Generates `https://base.app/content/<id>` for a given token address on Base mainnet.
 * Verified against existing base.app/content examples in this repo.
 */
export function baseAppContentUrlFromTokenAddress(tokenAddress: string): string | null {
  if (!isHexAddress(tokenAddress)) return null;

  const network = 'networks/base-mainnet';
  const addr = tokenAddress.toLowerCase();

  const enc = new TextEncoder();
  const networkBytes = enc.encode(network);
  const addrBytes = enc.encode(addr);

  // Protobuf-ish layout observed from base.app/content IDs:
  // outer: 0x12 <len(inner)> <inner>
  // inner: 0x0a <len(payload)> <payload>
  // payload: 0x0a <len(network)> <network> 0x12 <len(addr)> <addr>
  const payload = new Uint8Array(2 + networkBytes.length + 2 + addrBytes.length);
  let o = 0;
  payload[o++] = 0x0a;
  payload[o++] = networkBytes.length;
  payload.set(networkBytes, o);
  o += networkBytes.length;
  payload[o++] = 0x12;
  payload[o++] = addrBytes.length;
  payload.set(addrBytes, o);

  const inner = new Uint8Array(2 + payload.length);
  inner[0] = 0x0a;
  inner[1] = payload.length;
  inner.set(payload, 2);

  const outer = new Uint8Array(2 + inner.length);
  outer[0] = 0x12;
  outer[1] = inner.length;
  outer.set(inner, 2);

  const id = base64UrlEncode(outer);
  return `https://base.app/content/${id}`;
}

function base64UrlDecodeToBytes(s: string): Uint8Array | null {
  if (!s) return null;
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  // pad to multiple of 4
  const pad = (4 - (b64.length % 4)) % 4;
  const padded = b64 + '='.repeat(pad);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasBuffer = typeof (globalThis as any).Buffer !== 'undefined';
  try {
    if (hasBuffer) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buf = (globalThis as any).Buffer.from(padded, 'base64');
      return new Uint8Array(buf);
    }
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * Extracts token address from a `https://base.app/content/<id>` URL.
 * Returns lowercased `0x...` address or null if decoding fails.
 */
export function tokenAddressFromBaseAppContentUrl(url: string): `0x${string}` | null {
  const u = (url || '').trim();
  const m = u.match(/^https?:\/\/(www\.)?base\.app\/content\/([a-zA-Z0-9\-_]+)$/i);
  if (!m) return null;
  const id = m[2];
  const bytes = base64UrlDecodeToBytes(id);
  if (!bytes || bytes.length < 10) return null;

  // Parse: outer(0x12 len inner) -> inner(0x0a len payload) -> payload(0x0a len network ... 0x12 len addr ...)
  let i = 0;
  if (bytes[i++] !== 0x12) return null;
  const innerLen = bytes[i++];
  if (innerLen <= 0 || i + innerLen > bytes.length) return null;
  const inner = bytes.slice(i, i + innerLen);

  i = 0;
  if (inner[i++] !== 0x0a) return null;
  const payloadLen = inner[i++];
  if (payloadLen <= 0 || i + payloadLen > inner.length) return null;
  const payload = inner.slice(i, i + payloadLen);

  i = 0;
  if (payload[i++] !== 0x0a) return null;
  const netLen = payload[i++];
  if (netLen <= 0 || i + netLen > payload.length) return null;
  i += netLen; // skip network string
  if (payload[i++] !== 0x12) return null;
  const addrLen = payload[i++];
  if (addrLen <= 0 || i + addrLen > payload.length) return null;
  const addrBytes = payload.slice(i, i + addrLen);
  const addr = new TextDecoder().decode(addrBytes).toLowerCase();
  if (!isHexAddress(addr)) return null;
  return addr as `0x${string}`;
}


