export function addressToUserId(address: string): number {
  try {
    const normalized = address.toLowerCase();
    if (!normalized.startsWith('0x') || normalized.length !== 42) return 0;
    const n = BigInt(normalized);
    // Ограничиваем диапазон, чтобы безопасно хранить как number и использовать как ключ user_fid
    return Number(n % 1000000000n); // 0..999,999,999
  } catch {
    return 0;
  }
}

export function shortAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}


