// lib/neynar.ts

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || '';

const cleanApiKey = NEYNAR_API_KEY ? NEYNAR_API_KEY.trim().replace(/[\r\n\t]/g, '') : '';

/** Нормализация URL: добавляет https:// если нужно */
export function normalizeUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return 'https://' + url;
}

/** Попытка извлечь полный 0x-hash (42 chars). Для коротких/усечённых возвращаем null. */
export function extractFullHashFromUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/0x[a-fA-F0-9]{40}/);
  if (match && match[0]) return match[0].toLowerCase();
  return null;
}

/** Если в URL есть короткий хэш (0x + >=8 hex), но не полный — возвращаем короткий (для логики) */
export function extractAnyHash(url: string): string | null {
  if (!url) return null;
  const match = url.match(/0x[a-fA-F0-9]{8,}/);
  return match ? match[0].toLowerCase() : null;
}

/** Resolve URL через Neynar (как в Inflynce) — возвращает полный hash или null */
export async function resolveCastUrl(url: string): Promise<string | null> {
  if (!cleanApiKey) {
    console.warn('[neynar] NEYNAR_API_KEY not configured');
    return null;
  }

  try {
    const res = await fetch('https://api.neynar.com/v2/farcaster/cast/resolve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // многие примеры Neynar ожидают header 'api-key' — оставим этот вариант
        'api-key': cleanApiKey,
        // если у тебя docs требуют Authorization, можно добавить: Authorization: `Bearer ${cleanApiKey}`
      },
      body: JSON.stringify({ url }),
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }

    if (!res.ok) {
      console.error('[neynar] resolveCastUrl response not ok', res.status, res.statusText, text);
      return null;
    }

    // разные форматы ответа — пробуем стандартные поля
    const hash = data?.cast?.hash || data?.result?.cast?.hash || data?.result?.hash || null;
    if (hash) return hash.toLowerCase();
    console.warn('[neynar] resolveCastUrl: no hash in response', data);
    return null;
  } catch (err) {
    console.error('[neynar] resolveCastUrl error', err);
    return null;
  }
}

/** Универсальная функция получения полного hash по URL или короткому hash */
export async function getFullCastHash(input: string): Promise<string | null> {
  if (!input) return null;

  const normalized = normalizeUrl(input);

  // 1) если в URL уже есть полный hash — вернём её
  const fullFromUrl = extractFullHashFromUrl(normalized);
  if (fullFromUrl) return fullFromUrl;

  // 2) если есть короткий/любой 0x... сегмент — всё равно пытаем resolve
  // (resolve умеет разобрать и короткие, и укороченные)
  const resolved = await resolveCastUrl(normalized);
  if (resolved) return resolved;

  // 3) если ничего не найдено — попытка: если input сам по себе выглядит как bare shortHash (без протокола)
  const anyHash = extractAnyHash(input);
  if (anyHash) {
    // попробуем resolve короткого хеша (в виде just the hash)
    const asUrl = normalizeUrl(anyHash);
    const resolved2 = await resolveCastUrl(asUrl);
    if (resolved2) return resolved2;
  }

  return null;
}

/** Проверки активности через Neynar (по уже полному hash) */
export async function checkUserLiked(fullHash: string, userFid: number): Promise<boolean> {
  try {
    const url = `https://api.neynar.com/v2/farcaster/reactions?cast_hash=${fullHash}&types=likes&viewer_fid=${userFid}`;
    const res = await fetch(url, { headers: { 'api-key': cleanApiKey } });
    const data = await res.json();
    return Array.isArray(data?.reactions) && data.reactions.some((r:any) => r.reactor_fid === userFid);
  } catch (e) {
    console.error('[neynar] checkUserLiked error', e);
    return false;
  }
}

export async function checkUserRecasted(fullHash: string, userFid: number): Promise<boolean> {
  try {
    const url = `https://api.neynar.com/v2/farcaster/reactions?cast_hash=${fullHash}&types=recasts&viewer_fid=${userFid}`;
    const res = await fetch(url, { headers: { 'api-key': cleanApiKey } });
    const data = await res.json();
    return Array.isArray(data?.reactions) && data.reactions.some((r:any) => r.reactor_fid === userFid);
  } catch (e) {
    console.error('[neynar] checkUserRecasted error', e);
    return false;
  }
}

export async function checkUserCommented(fullHash: string, userFid: number): Promise<boolean> {
  try {
    const url = `https://api.neynar.com/v2/farcaster/casts?parent_hash=${fullHash}`;
    const res = await fetch(url, { headers: { 'api-key': cleanApiKey } });
    const data = await res.json();
    return Array.isArray(data?.result?.casts) && data.result.casts.some((c:any) => c.author?.fid === userFid);
  } catch (e) {
    console.error('[neynar] checkUserCommented error', e);
    return false;
  }
}

/** Универсальная проверка активности по типу (like, recast, comment) */
export async function checkUserActivityByHash(
  fullHash: string,
  userFid: number,
  activityType: 'like' | 'recast' | 'comment'
): Promise<boolean> {
  switch (activityType) {
    case 'like':
      return await checkUserLiked(fullHash, userFid);
    case 'recast':
      return await checkUserRecasted(fullHash, userFid);
    case 'comment':
      return await checkUserCommented(fullHash, userFid);
    default:
      console.error('[neynar] Unknown activity type:', activityType);
      return false;
  }
}

/** Обратная совместимость: extractCastHash использует extractFullHashFromUrl */
export function extractCastHash(url: string): string | null {
  return extractFullHashFromUrl(url);
}
