// lib/neynar.ts — Универсальная, полностью рабочая версия
// Принимает любые ссылки и короткие hash как Inflynce

import type { ActivityType } from "@/types";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || "";
const cleanApiKey = NEYNAR_API_KEY ? NEYNAR_API_KEY.trim().replace(/[\r\n\t]/g, "") : "";

// ----------------------------
// НОРМАЛИЗАЦИЯ URL
// ----------------------------
export function normalizeUrl(input: string): string {
  if (!input) return "";

  let url = input.trim();

  if (url.startsWith("0x")) return url;
  if (!url.startsWith("http")) return "https://" + url;

  return url;
}

// ----------------------------
// ИЗВЛЕЧЕНИЕ ПОЛНОГО ХЭША
// ----------------------------
export function extractFullHashFromUrl(url: string): string | null {
  const match = url.match(/0x[a-fA-F0-9]{40}/);
  return match ? match[0].toLowerCase() : null;
}

// ----------------------------
// ИЗВЛЕЧЕНИЕ ЛЮБОГО ХЭША (короткого)
// ----------------------------
export function extractAnyHash(url: string): string | null {
  const match = url.match(/0x[a-fA-F0-9]{6,40}/);
  return match ? match[0].toLowerCase() : null;
}

// ----------------------------
// RESOLVE URL → FULL HASH (как Inflynce)
// ----------------------------
export async function resolveCastUrl(url: string): Promise<string | null> {
  if (!cleanApiKey) {
    console.warn("[neynar] resolveCastUrl: NEYNAR_API_KEY not configured");
    return null;
  }

  try {
    console.log("[neynar] resolveCastUrl: attempting to resolve", url);
    const res = await fetch(
      "https://api.neynar.com/v2/farcaster/cast/resolve",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": cleanApiKey,
          "api_key": cleanApiKey, // Попробуем оба варианта
        },
        body: JSON.stringify({ url }),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[neynar] resolveCastUrl: API error", res.status, res.statusText, errorText?.substring(0, 200));
      return null;
    }

    const data = await res.json();
    const hash = data?.cast?.hash || data?.result?.cast?.hash || null;
    
    if (hash) {
      console.log("[neynar] resolveCastUrl: successfully resolved", url, "→", hash);
      return hash.toLowerCase();
    } else {
      console.warn("[neynar] resolveCastUrl: no hash in response", data);
      return null;
    }
  } catch (err) {
    console.error("[neynar] resolveCastUrl err", err);
    return null;
  }
}

// ----------------------------
// ГЛАВНАЯ УНИВЕРСАЛЬНАЯ ФУНКЦИЯ
// Принимает ВСЁ: warpcast, farcaster, miniapps, embed
// Короткие и длинные hash
// ----------------------------
export async function getFullCastHash(input: string): Promise<string | null> {
  if (!input) return null;

  const normalized = normalizeUrl(input);

  // 1 — полный hash внутри URL
  const full = extractFullHashFromUrl(normalized);
  if (full) return full;

  // 2 — короткий hash - ОБЯЗАТЕЛЬНО пытаемся расширить через resolve
  const short = extractAnyHash(normalized);
  if (short) {
    // Если короткий hash, пытаемся расширить его до полного
    const resolved = await resolveCastUrl(normalized);
    if (resolved) return resolved;
    
    // Если не удалось расширить через URL, попробуем resolve сам хеш
    const resolvedHash = await resolveCastUrl(short);
    if (resolvedHash) return resolvedHash;
    
    // Если всё равно не удалось, НЕ возвращаем короткий - API требует полный хеш
    console.warn("[neynar] getFullCastHash: failed to expand short hash", short);
    return null;
  }

  // 3 — resolve URL через Neynar
  const resolved = await resolveCastUrl(normalized);
  if (resolved) return resolved;

  // 4 — ещё одна попытка resolve только хэша
  if (input.startsWith("0x")) {
    const resolved2 = await resolveCastUrl(input);
    if (resolved2) return resolved2;
  }

  return null;
}

// ----------------------------
// ПРОВЕРКА АКТИВНОСТИ (лайк/реккаст/реплай)
// ----------------------------

/** Проверка реакций пользователя через /v2/farcaster/user/reactions (более надежный метод) */
export async function checkUserReactionsByCast(
  castHash: string,
  userFid: number,
  activityType: ActivityType
): Promise<boolean> {
  if (!cleanApiKey) return false;
  
  try {
    // Маппинг типов активности на типы реакций Neynar
    const reactionTypeMap: Record<ActivityType, string> = {
      like: "like",
      recast: "recast",
      comment: "reply", // Neynar использует "reply" для комментариев
    };
    
    const reactionType = reactionTypeMap[activityType];
    if (!reactionType) {
      console.error("[neynar] Unknown activity type for reactions check:", activityType);
      return false;
    }
    
    const url = `https://api.neynar.com/v2/farcaster/user/reactions?fid=${userFid}&reaction_type=${reactionType}&limit=100`;
    const res = await fetch(url, { 
      headers: { "api-key": cleanApiKey, "api_key": cleanApiKey } 
    });
    
    if (!res.ok) {
      console.warn("[neynar] checkUserReactionsByCast: API error", res.status, res.statusText);
      return false;
    }
    
    const data = await res.json();
    const reactions = data?.result?.reactions || data?.reactions || [];
    
    // Проверяем, есть ли реакция на этот cast
    const hasReaction = reactions.some((r: any) => {
      const targetHash = r.target?.cast?.hash || r.cast_hash || r.target?.hash;
      return targetHash?.toLowerCase() === castHash.toLowerCase();
    });
    
    if (hasReaction) {
      console.log("[neynar] checkUserReactionsByCast: found reaction", { castHash, userFid, activityType });
    }
    
    return hasReaction;
  } catch (e) {
    console.error("[neynar] checkUserReactionsByCast error", e);
    return false;
  }
}

export async function checkUserLiked(fullHash: string, userFid: number): Promise<boolean> {
  if (!cleanApiKey) return false;
  try {
    const url = `https://api.neynar.com/v2/farcaster/reactions?cast_hash=${fullHash}&types=likes&viewer_fid=${userFid}`;
    const res = await fetch(url, { headers: { "api-key": cleanApiKey, "api_key": cleanApiKey } });
    const data = await res.json();
    return Array.isArray(data?.reactions) && data.reactions.some((r: any) => r.reactor_fid === userFid);
  } catch (e) {
    console.error("[neynar] checkUserLiked error", e);
    return false;
  }
}

export async function checkUserRecasted(fullHash: string, userFid: number): Promise<boolean> {
  if (!cleanApiKey) return false;
  try {
    const url = `https://api.neynar.com/v2/farcaster/reactions?cast_hash=${fullHash}&types=recasts&viewer_fid=${userFid}`;
    const res = await fetch(url, { headers: { "api-key": cleanApiKey, "api_key": cleanApiKey } });
    const data = await res.json();
    return Array.isArray(data?.reactions) && data.reactions.some((r: any) => r.reactor_fid === userFid);
  } catch (e) {
    console.error("[neynar] checkUserRecasted error", e);
    return false;
  }
}

export async function checkUserCommented(fullHash: string, userFid: number): Promise<boolean> {
  if (!cleanApiKey) return false;
  try {
    const url = `https://api.neynar.com/v2/farcaster/casts?parent_hash=${fullHash}`;
    const res = await fetch(url, { headers: { "api-key": cleanApiKey, "api_key": cleanApiKey } });
    const data = await res.json();
    return Array.isArray(data?.result?.casts) && data.result.casts.some((c: any) => c.author?.fid === userFid);
  } catch (e) {
    console.error("[neynar] checkUserCommented error", e);
    return false;
  }
}

/** Универсальная проверка активности по типу (like, recast, comment) */
export async function checkUserActivityByHash(
  fullHash: string,
  userFid: number,
  activityType: ActivityType
): Promise<boolean> {
  switch (activityType) {
    case "like":
      return await checkUserLiked(fullHash, userFid);
    case "recast":
      return await checkUserRecasted(fullHash, userFid);
    case "comment":
      return await checkUserCommented(fullHash, userFid);
    default:
      console.error("[neynar] Unknown activity type:", activityType);
      return false;
  }
}

// ----------------------------
// ОБРАТНАЯ СОВМЕСТИМОСТЬ
// ----------------------------
export function extractCastHash(url: string): string | null {
  return extractFullHashFromUrl(url);
}

// ----------------------------
// ПОЛУЧЕНИЕ ДАННЫХ КАСТА И ПОЛЬЗОВАТЕЛЕЙ
// ----------------------------

/** Получить данные каста по URL (включая автора) */
export async function getCastAuthor(castUrl: string): Promise<{ fid: number; username: string; pfp_url: string } | null> {
  if (!cleanApiKey) {
    console.warn("[neynar] NEYNAR_API_KEY not configured");
    return null;
  }

  try {
    const fullHash = await getFullCastHash(castUrl);
    if (!fullHash) {
      console.warn("[neynar] getCastAuthor: could not resolve hash from URL", castUrl);
      return null;
    }

    const url = `https://api.neynar.com/v2/farcaster/cast?identifier=${fullHash}&type=hash`;
    const res = await fetch(url, { headers: { "api-key": cleanApiKey, "api_key": cleanApiKey } });
    const data = await res.json();

    const cast = data?.result?.cast || data?.cast || null;
    if (!cast || !cast.author) {
      console.warn("[neynar] getCastAuthor: no cast or author found", data);
      return null;
    }

    const author = cast.author;
    return {
      fid: author.fid || 0,
      username: author.username || author.display_name || "",
      pfp_url: author.pfp?.url || author.pfp_url || author.profile?.pfp?.url || "",
    };
  } catch (err) {
    console.error("[neynar] getCastAuthor error", err);
    return null;
  }
}

/** Получить данные пользователя по username */
export async function getUserByUsername(
  username: string
): Promise<{ fid: number; username: string; display_name?: string; pfp?: { url: string }; pfp_url?: string; profile?: { pfp: { url: string } } } | null> {
  if (!cleanApiKey) {
    console.warn("[neynar] NEYNAR_API_KEY not configured");
    return null;
  }

  try {
    const url = `https://api.neynar.com/v2/farcaster/user/by_username?username=${encodeURIComponent(username)}`;
    const res = await fetch(url, { headers: { "api-key": cleanApiKey, "api_key": cleanApiKey } });
    const data = await res.json();

    const user = data?.result?.user || data?.user || null;
    if (!user) {
      console.warn("[neynar] getUserByUsername: user not found", username);
      return null;
    }

    return user;
  } catch (err) {
    console.error("[neynar] getUserByUsername error", err);
    return null;
  }
}

/** Получить данные пользователя по FID */
export async function getUserByFid(
  fid: number
): Promise<{ fid: number; username: string; display_name?: string; pfp?: { url: string }; pfp_url?: string; profile?: { pfp: { url: string } } } | null> {
  if (!cleanApiKey) {
    console.warn("[neynar] NEYNAR_API_KEY not configured");
    return null;
  }

  try {
    const url = `https://api.neynar.com/v2/farcaster/user/by_fid?fid=${fid}`;
    const res = await fetch(url, { headers: { "api-key": cleanApiKey, "api_key": cleanApiKey } });
    const data = await res.json();

    const user = data?.result?.user || data?.user || null;
    if (!user) {
      console.warn("[neynar] getUserByFid: user not found", fid);
      return null;
    }

    return user;
  } catch (err) {
    console.error("[neynar] getUserByFid error", err);
    return null;
  }
}
