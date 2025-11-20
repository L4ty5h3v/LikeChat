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
    console.warn("[neynar] resolveCastUrl: process.env.NEYNAR_API_KEY =", process.env.NEYNAR_API_KEY ? "SET (length: " + process.env.NEYNAR_API_KEY.length + ")" : "NOT SET");
    return null;
  }

  try {
    console.log("[neynar] resolveCastUrl: attempting to resolve", url);
    console.log("[neynar] resolveCastUrl: API key present, length:", cleanApiKey.length);
    
    // Правильный метод: GET /v2/farcaster/cast?identifier={url}&type=url
    const apiUrl = `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(url)}&type=url`;
    console.log("[neynar] resolveCastUrl: API URL:", apiUrl.substring(0, 100) + "...");
    
    const res = await fetch(apiUrl, {
      headers: {
        "api_key": cleanApiKey,
      }
    });

    console.log("[neynar] resolveCastUrl: Response status:", res.status, res.statusText);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[neynar] resolveCastUrl: API error", res.status, res.statusText);
      console.error("[neynar] resolveCastUrl: Error details:", errorText?.substring(0, 300));
      return null;
    }

    const data = await res.json();
    const hash = data?.cast?.hash || data?.result?.cast?.hash || null;
    
    if (hash) {
      console.log("[neynar] resolveCastUrl: successfully resolved", url, "→", hash);
      return hash.toLowerCase();
    } else {
      console.warn("[neynar] resolveCastUrl: no hash in response");
      console.warn("[neynar] resolveCastUrl: Response data:", JSON.stringify(data, null, 2).substring(0, 500));
      return null;
    }
  } catch (err: any) {
    console.error("[neynar] resolveCastUrl err", err);
    console.error("[neynar] resolveCastUrl err message:", err?.message);
    console.error("[neynar] resolveCastUrl err stack:", err?.stack?.substring(0, 300));
    return null;
  }
}

// ----------------------------
// ГЛАВНАЯ УНИВЕРСАЛЬНАЯ ФУНКЦИЯ
// Принимает ВСЁ: warpcast, farcaster, miniapps, embed
// Короткие и длинные hash
// ----------------------------
export async function getFullCastHash(shortUrl: string): Promise<string | null> {
  if (!shortUrl) return null;

  // 1. Если уже полный хеш 0x... (64 символа) — возвращаем как есть
  const fullHashMatch = shortUrl.match(/^0x[a-fA-F0-9]{64}$/);
  if (fullHashMatch) {
    console.log("[neynar] getFullCastHash: already full hash (64 chars)", shortUrl);
    return shortUrl.toLowerCase();
  }

  // 2. Проверяем, есть ли полный хеш внутри URL
  const hashInUrl = shortUrl.match(/0x[a-fA-F0-9]{64}/);
  if (hashInUrl) {
    console.log("[neynar] getFullCastHash: found full hash in URL", hashInUrl[0]);
    return hashInUrl[0].toLowerCase();
  }

  // 3. Если это URL (farcaster.xyz, warpcast.com и т.д.) - используем resolveCastUrl
  // Это правильный метод через GET /v2/farcaster/cast?identifier={url}&type=url
  const isUrl = shortUrl.includes('farcaster.xyz') || shortUrl.includes('warpcast.com') || shortUrl.includes('http');
  if (isUrl) {
    if (!cleanApiKey) {
      console.error("[neynar] getFullCastHash: NEYNAR_API_KEY not configured - cannot resolve URL");
      console.error("[neynar] getFullCastHash: process.env.NEYNAR_API_KEY =", process.env.NEYNAR_API_KEY ? "SET" : "NOT SET");
      return null;
    }
    
    try {
      const normalized = normalizeUrl(shortUrl);
      console.log("[neynar] getFullCastHash: trying resolveCastUrl for URL", normalized);
      const resolved = await resolveCastUrl(normalized);
      if (resolved) {
        console.log("[neynar] getFullCastHash: resolved via resolveCastUrl", shortUrl, "→", resolved);
        return resolved.toLowerCase();
      } else {
        console.warn("[neynar] getFullCastHash: resolveCastUrl returned null for", normalized);
      }
    } catch (e: any) {
      console.error('[neynar] getFullCastHash: resolveCastUrl failed with error:', e?.message);
      console.error('[neynar] getFullCastHash: error stack:', e?.stack?.substring(0, 200));
    }
  }

  console.warn("[neynar] getFullCastHash: Cannot resolve cast hash from", shortUrl);
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
  
  // Для комментариев используем специальную проверку
  if (activityType === "comment") {
    return await checkUserCommented(castHash, userFid);
  }
  
  try {
    // Маппинг типов активности на типы реакций Neynar
    const reactionTypeMap: Record<"like" | "recast", string> = {
      like: "like",
      recast: "recast",
    };
    
    const reactionType = reactionTypeMap[activityType as "like" | "recast"];
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
  
  // Метод 1: Проверка через parent_hash (стандартный метод)
  try {
    const url = `https://api.neynar.com/v2/farcaster/casts?parent_hash=${fullHash}`;
    const res = await fetch(url, { headers: { "api-key": cleanApiKey, "api_key": cleanApiKey } });
    const data = await res.json();
    const casts = data?.result?.casts || data?.casts || [];
    const hasComment = casts.some((c: any) => c.author?.fid === userFid);
    if (hasComment) {
      console.log("[neynar] checkUserCommented: found via parent_hash", { fullHash, userFid });
      return true;
    }
  } catch (e) {
    console.warn("[neynar] checkUserCommented: parent_hash method failed", e);
  }
  
  // Метод 2: Проверка через replies endpoint
  try {
    const repliesUrl = `https://api.neynar.com/v2/farcaster/cast/replies?identifier=${fullHash}&type=hash`;
    const res = await fetch(repliesUrl, { headers: { "api-key": cleanApiKey, "api_key": cleanApiKey } });
    const data = await res.json();
    const replies = data?.result?.replies || data?.replies || [];
    const hasReply = replies.some((r: any) => r.author?.fid === userFid);
    if (hasReply) {
      console.log("[neynar] checkUserCommented: found via replies endpoint", { fullHash, userFid });
      return true;
    }
  } catch (e) {
    console.warn("[neynar] checkUserCommented: replies endpoint failed", e);
  }
  
  // Метод 3: Проверка через user/casts (все касты пользователя, ищем комментарии к этому cast)
  try {
    const userCastsUrl = `https://api.neynar.com/v2/farcaster/user/casts?fid=${userFid}&limit=100`;
    const res = await fetch(userCastsUrl, { headers: { "api-key": cleanApiKey, "api_key": cleanApiKey } });
    const data = await res.json();
    const casts = data?.result?.casts || data?.casts || [];
    const hasComment = casts.some((c: any) => {
      const parentHash = c.parent_hash || c.parent?.hash || c.parent_author?.hash;
      return parentHash?.toLowerCase() === fullHash.toLowerCase();
    });
    if (hasComment) {
      console.log("[neynar] checkUserCommented: found via user/casts", { fullHash, userFid });
      return true;
    }
  } catch (e) {
    console.warn("[neynar] checkUserCommented: user/casts method failed", e);
  }
  
  return false;
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
