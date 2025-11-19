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

/** Resolve URL через Neynar — возвращает полный hash или null */
export async function resolveCastUrl(url: string): Promise<string | null> {
  if (!cleanApiKey) {
    console.warn('[neynar] NEYNAR_API_KEY not configured');
    return null;
  }

  // Метод 1: Попробуем через /v2/farcaster/cast с identifier=url
  try {
    const encodedUrl = encodeURIComponent(url);
    const res = await fetch(`https://api.neynar.com/v2/farcaster/cast?identifier=${encodedUrl}&type=url`, {
      method: 'GET',
      headers: {
        'api-key': cleanApiKey,
        'Authorization': `Bearer ${cleanApiKey}`, // Попробуем оба варианта
      },
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }

    if (res.ok && data) {
      const hash = data?.result?.cast?.hash || data?.cast?.hash || data?.result?.hash || null;
      if (hash) {
        console.log('[neynar] resolveCastUrl: resolved via /cast endpoint', hash);
        return hash.toLowerCase();
      }
    } else {
      console.warn('[neynar] resolveCastUrl: /cast endpoint failed', res.status, res.statusText, text?.substring(0, 200));
    }
  } catch (err) {
    console.warn('[neynar] resolveCastUrl: /cast endpoint error', err);
  }

  // Метод 2: Попробуем через /v2/farcaster/cast/resolve (POST)
  try {
    const res = await fetch('https://api.neynar.com/v2/farcaster/cast/resolve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': cleanApiKey,
        'Authorization': `Bearer ${cleanApiKey}`, // Попробуем оба варианта
      },
      body: JSON.stringify({ url }),
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }

    if (res.ok && data) {
      const hash = data?.cast?.hash || data?.result?.cast?.hash || data?.result?.hash || null;
      if (hash) {
        console.log('[neynar] resolveCastUrl: resolved via /cast/resolve endpoint', hash);
        return hash.toLowerCase();
      }
    } else {
      console.warn('[neynar] resolveCastUrl: /cast/resolve endpoint failed', res.status, res.statusText, text?.substring(0, 200));
    }
  } catch (err) {
    console.warn('[neynar] resolveCastUrl: /cast/resolve endpoint error', err);
  }

  // Метод 3: Если в URL есть короткий hash, попробуем через /v2/farcaster/casts?short_hash
  const shortHash = extractAnyHash(url);
  if (shortHash && shortHash.length < 42) {
    try {
      const res = await fetch(`https://api.neynar.com/v2/farcaster/casts?short_hash=${shortHash}`, {
        method: 'GET',
        headers: {
          'api-key': cleanApiKey,
          'Authorization': `Bearer ${cleanApiKey}`, // Попробуем оба варианта
        },
      });

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = null; }

      if (res.ok && data) {
        const casts = data?.result?.casts || data?.casts || [];
        if (casts.length > 0 && casts[0]?.hash) {
          console.log('[neynar] resolveCastUrl: resolved via /casts?short_hash endpoint', casts[0].hash);
          return casts[0].hash.toLowerCase();
        }
      } else {
        console.warn('[neynar] resolveCastUrl: /casts?short_hash endpoint failed', res.status, res.statusText, text?.substring(0, 200));
      }
    } catch (err) {
      console.warn('[neynar] resolveCastUrl: /casts?short_hash endpoint error', err);
    }
  }

  console.error('[neynar] resolveCastUrl: all methods failed for URL', url);
  return null;
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

/** Получить данные каста по URL (включая автора) */
export async function getCastAuthor(castUrl: string): Promise<{ fid: number; username: string; pfp_url: string } | null> {
  if (!cleanApiKey) {
    console.warn('[neynar] NEYNAR_API_KEY not configured');
    return null;
  }

  try {
    const fullHash = await getFullCastHash(castUrl);
    if (!fullHash) {
      console.warn('[neynar] getCastAuthor: could not resolve hash from URL', castUrl);
      return null;
    }

    const url = `https://api.neynar.com/v2/farcaster/cast?identifier=${fullHash}&type=hash`;
    const res = await fetch(url, { headers: { 'api-key': cleanApiKey } });
    const data = await res.json();

    const cast = data?.result?.cast || data?.cast || null;
    if (!cast || !cast.author) {
      console.warn('[neynar] getCastAuthor: no cast or author found', data);
      return null;
    }

    const author = cast.author;
    return {
      fid: author.fid || 0,
      username: author.username || author.display_name || '',
      pfp_url: author.pfp?.url || author.pfp_url || author.profile?.pfp?.url || '',
    };
  } catch (err) {
    console.error('[neynar] getCastAuthor error', err);
    return null;
  }
}

/** Получить данные пользователя по username */
export async function getUserByUsername(username: string): Promise<{ fid: number; username: string; display_name?: string; pfp?: { url: string }; pfp_url?: string; profile?: { pfp: { url: string } } } | null> {
  if (!cleanApiKey) {
    console.warn('[neynar] NEYNAR_API_KEY not configured');
    return null;
  }

  try {
    const url = `https://api.neynar.com/v2/farcaster/user/by_username?username=${encodeURIComponent(username)}`;
    const res = await fetch(url, { headers: { 'api-key': cleanApiKey } });
    const data = await res.json();

    const user = data?.result?.user || data?.user || null;
    if (!user) {
      console.warn('[neynar] getUserByUsername: user not found', username);
      return null;
    }

    return user;
  } catch (err) {
    console.error('[neynar] getUserByUsername error', err);
    return null;
  }
}

/** Получить данные пользователя по FID */
export async function getUserByFid(fid: number): Promise<{ fid: number; username: string; display_name?: string; pfp?: { url: string }; pfp_url?: string; profile?: { pfp: { url: string } } } | null> {
  if (!cleanApiKey) {
    console.warn('[neynar] NEYNAR_API_KEY not configured');
    return null;
  }

  try {
    const url = `https://api.neynar.com/v2/farcaster/user/by_fid?fid=${fid}`;
    const res = await fetch(url, { headers: { 'api-key': cleanApiKey } });
    const data = await res.json();

    const user = data?.result?.user || data?.user || null;
    if (!user) {
      console.warn('[neynar] getUserByFid: user not found', fid);
      return null;
    }

    return user;
  } catch (err) {
    console.error('[neynar] getUserByFid error', err);
    return null;
  }
}
