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


