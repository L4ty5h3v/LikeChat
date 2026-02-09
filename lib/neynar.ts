// lib/neynar.ts — Универсальная, полностью рабочая версия
// Принимает любые ссылки и короткие hash как Inflynce

import type { TaskType } from "@/types";

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
  // Farcaster cast hash is 20 bytes => 40 hex chars (plus 0x prefix)
  const match = url.match(/0x[a-fA-F0-9]{40}/);
  return match ? match[0].toLowerCase() : null;
}

// ----------------------------
// ИЗВЛЕЧЕНИЕ ЛЮБОГО ХЭША (короткого)
// ----------------------------
export function extractAnyHash(url: string): string | null {
  // Some sources may include shortened hashes; keep it permissive.
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
// Принимает ВСЁ: farcaster, miniapps, embed
// Короткие и длинные hash
// ----------------------------
export async function getFullCastHash(shortUrl: string): Promise<string | null> {
  if (!shortUrl) return null;

  // 1. Если уже полный хеш 0x... (40 символов) — возвращаем как есть
  const fullHashMatch = shortUrl.match(/^0x[a-fA-F0-9]{40}$/);
  if (fullHashMatch) {
    console.log("[neynar] getFullCastHash: already full hash (40 chars)", shortUrl);
    return shortUrl.toLowerCase();
  }

  // 2. Проверяем, есть ли полный хеш внутри URL
  const hashInUrl = shortUrl.match(/0x[a-fA-F0-9]{40}/);
  if (hashInUrl) {
    console.log("[neynar] getFullCastHash: found full hash in URL", hashInUrl[0]);
    return hashInUrl[0].toLowerCase();
  }

  // 3. Если это URL (farcaster.xyz и т.д.) - используем resolveCastUrl
  // Это правильный метод через GET /v2/farcaster/cast?identifier={url}&type=url
  const isUrl = shortUrl.includes('farcaster.xyz') || shortUrl.includes('http');
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

/** Проверка реакций пользователя через /v2/farcaster/cast (единственный рабочий метод) */
export async function checkUserReactionsByCast(
  castHash: string,
  userFid: number,
  taskType: TaskType
): Promise<boolean> {
  if (!cleanApiKey) return false;
  
  
  // ВАЖНО: Neynar API возвращает пустой массив likes/recasts по умолчанию
  // Нужно использовать параметр viewer_fid, чтобы получить информацию о реакции конкретного пользователя
  try {
    console.log("[neynar] checkUserReactionsByCast: checking via /cast endpoint with viewer_fid", { castHash, userFid, taskType });
    
    // Добавляем viewer_fid к запросу - это вернет информацию о реакции этого пользователя
    const castUrl = `https://api.neynar.com/v2/farcaster/cast?identifier=${castHash}&type=hash&viewer_fid=${userFid}`;
    const res = await fetch(castUrl, { 
      headers: { "api_key": cleanApiKey } 
    });
    
    if (!res.ok) {
      console.warn("[neynar] checkUserReactionsByCast: API error", res.status, res.statusText);
      return false;
    }
    
    const data = await res.json();
    const cast = data?.cast || data?.result?.cast;
    
    if (!cast) {
      console.warn("[neynar] checkUserReactionsByCast: cast not found");
      return false;
    }
    
    // Проверяем viewer_context - это содержит информацию о реакции viewer_fid
    const viewerContext = cast.viewer_context;
    console.log("[neynar] checkUserReactionsByCast: viewer_context", viewerContext);
    
    if (taskType === "like") {
      // viewer_context.liked указывает, поставил ли viewer лайк
      const hasLike = viewerContext?.liked === true;
      if (hasLike) {
        console.log("[neynar] checkUserReactionsByCast: ✅ found like via viewer_context", { castHash, userFid });
        return true;
      }
      
      // Fallback: проверяем массив likes (может быть заполнен, если viewer_fid указан)
      const likes = cast.reactions?.likes || [];
      if (likes.length > 0) {
        const hasLikeInArray = likes.some((like: any) => {
          const reactorFid = like.fid || like.reactor_fid || like.user?.fid || like.author?.fid;
          return reactorFid === userFid;
        });
        if (hasLikeInArray) {
          console.log("[neynar] checkUserReactionsByCast: ✅ found like in array", { castHash, userFid });
          return true;
        }
      }
      
      console.log("[neynar] checkUserReactionsByCast: ❌ like not found", { 
        castHash, 
        userFid, 
        viewerLiked: viewerContext?.liked,
        likesCount: cast.reactions?.likes_count || 0,
        likesArrayLength: likes.length
      });
      return false;
    } else if (taskType === "recast") {
      // viewer_context.recasted указывает, сделал ли viewer рекаст
      const hasRecast = viewerContext?.recasted === true;
      if (hasRecast) {
        console.log("[neynar] checkUserReactionsByCast: ✅ found recast via viewer_context", { castHash, userFid });
        return true;
      }
      
      // Fallback: проверяем массив recasts
      const recasts = cast.reactions?.recasts || [];
      if (recasts.length > 0) {
        const hasRecastInArray = recasts.some((recast: any) => {
          const reactorFid = recast.fid || recast.reactor_fid || recast.user?.fid || recast.author?.fid;
          return reactorFid === userFid;
        });
        if (hasRecastInArray) {
          console.log("[neynar] checkUserReactionsByCast: ✅ found recast in array", { castHash, userFid });
          return true;
        }
      }
      
      console.log("[neynar] checkUserReactionsByCast: ❌ recast not found", { 
        castHash, 
        userFid, 
        viewerRecasted: viewerContext?.recasted,
        recastsCount: cast.reactions?.recasts_count || 0,
        recastsArrayLength: recasts.length
      });
      return false;
    }
    
    return false;
  } catch (e: any) {
    console.error("[neynar] checkUserReactionsByCast error", e?.message);
    return false;
  }
}

export async function checkUserLiked(fullHash: string, userFid: number): Promise<boolean> {
  if (!cleanApiKey) return false;
  
  console.log("[neynar] checkUserLiked: checking", { fullHash, userFid, hashLength: fullHash.length });
  
  // ВАЖНО: Используем viewer_fid для получения информации о реакции конкретного пользователя
  try {
    const castUrl = `https://api.neynar.com/v2/farcaster/cast?identifier=${fullHash}&type=hash&viewer_fid=${userFid}`;
    console.log("[neynar] checkUserLiked: fetching cast data with viewer_fid");
    const res = await fetch(castUrl, { headers: { "api_key": cleanApiKey } });
    
    console.log("[neynar] checkUserLiked: response status", res.status);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.warn("[neynar] checkUserLiked: API error", res.status, errorText?.substring(0, 200));
      return false;
    }
    
    const data = await res.json();
    const cast = data?.cast || data?.result?.cast;
    
    if (!cast) {
      console.warn("[neynar] checkUserLiked: cast not found in response");
      return false;
    }
    
    console.log("[neynar] checkUserLiked: cast found", {
      author: cast.author?.username,
      authorFid: cast.author?.fid,
      likesCount: cast.reactions?.likes_count || 0,
      viewerLiked: cast.viewer_context?.liked
    });
    
    // Проверяем viewer_context - это правильный способ проверки реакции viewer
    const viewerContext = cast.viewer_context;
    if (viewerContext?.liked === true) {
      console.log("[neynar] checkUserLiked: ✅ like found via viewer_context");
      return true;
    }
    
    // Fallback: проверяем массив likes (может быть заполнен, если viewer_fid указан)
    const likes = cast.reactions?.likes || [];
    console.log("[neynar] checkUserLiked: checking", likes.length, "likes in array");
    
    if (likes.length > 0) {
      likes.forEach((like: any, i: number) => {
        const fid = like.fid || like.reactor_fid || like.user?.fid || like.author?.fid;
        console.log(`[neynar] checkUserLiked: like ${i + 1} - FID: ${fid}, checking against ${userFid}`);
      });
      
      const hasLike = likes.some((like: any) => {
        const reactorFid = like.fid || like.reactor_fid || like.user?.fid || like.author?.fid;
        const match = reactorFid === userFid;
        if (match) {
          console.log("[neynar] checkUserLiked: ✅ FOUND LIKE from user", userFid);
        }
        return match;
      });
      
      if (hasLike) {
        console.log("[neynar] checkUserLiked: ✅ like found via likes array");
        return true;
      }
    }
    
    console.log("[neynar] checkUserLiked: ❌ like not found. Likes count:", cast.reactions?.likes_count || 0, "viewerLiked:", viewerContext?.liked);
    return false;
  } catch (e: any) {
    console.error("[neynar] checkUserLiked: /cast endpoint error", e?.message);
  }
  
  console.log("[neynar] checkUserLiked: no like found");
  return false;
}

export async function checkUserRecasted(fullHash: string, userFid: number): Promise<boolean> {
  if (!cleanApiKey) return false;
  try {
    const url = `https://api.neynar.com/v2/farcaster/reactions?cast_hash=${fullHash}&types=recasts&viewer_fid=${userFid}`;
    const res = await fetch(url, { headers: { "api-key": cleanApiKey, "api_key": cleanApiKey } });
    const data = await res.json();
    return Array.isArray(data?.reactions) && data.reactions.some((r: any) => r.reactor_fid === userFid);
  } catch (e: any) {
    console.error("[neynar] checkUserRecasted error", e?.message || e);
    return false;
  }
}

export async function checkUserCommented(fullHash: string, userFid: number): Promise<boolean> {
  if (!cleanApiKey) return false;
  
  // Нормализуем hash (убираем 0x если есть, для единообразия)
  const normalizedHash = fullHash.startsWith('0x') ? fullHash.slice(2) : fullHash;
  const hashWith0x = fullHash.startsWith('0x') ? fullHash : `0x${fullHash}`;
  
  console.log("[neynar] checkUserCommented: starting verification", { 
    fullHash, 
    normalizedHash, 
    hashWith0x,
    userFid, 
    hashLength: fullHash.length 
  });
  
  // Метод 1: Проверка через cast endpoint с replies (самый надежный метод)
  try {
    const castUrl = `https://api.neynar.com/v2/farcaster/cast?identifier=${fullHash}&type=hash`;
    console.log("[neynar] checkUserCommented: Method 1 - checking cast with replies", castUrl);
    const res = await fetch(castUrl, { headers: { "api_key": cleanApiKey } });
    
    if (res.ok) {
      const data = await res.json();
      const cast = data?.cast || data?.result?.cast;
      
      if (cast) {
        console.log("[neynar] checkUserCommented: Method 1 - cast object keys", Object.keys(cast));
        
        // Проверяем replies в разных местах cast объекта
        const replies = cast.replies?.casts || cast.replies || cast.direct_replies || cast.thread?.casts || [];
        console.log("[neynar] checkUserCommented: Method 1 - found replies in cast", {
          repliesCount: replies.length,
          repliesKeys: Object.keys(cast.replies || {}),
          hasDirectReplies: !!cast.direct_replies,
          hasThread: !!cast.thread,
          threadCasts: cast.thread?.casts?.length || 0,
          castKeys: Object.keys(cast).filter(k => k.toLowerCase().includes('reply') || k.toLowerCase().includes('thread') || k.toLowerCase().includes('comment'))
        });
        
        // Также проверяем thread_hash для тредов
        const threadReplies = cast.thread?.casts || cast.thread?.replies || [];
        const allReplies = [...replies, ...threadReplies];
        
        console.log("[neynar] checkUserCommented: Method 1 - total replies to check", allReplies.length);
        
        // Логируем первые несколько replies для отладки
        if (allReplies.length > 0) {
          console.log("[neynar] checkUserCommented: Method 1 - sample replies", allReplies.slice(0, 3).map((r: any) => ({
            hash: r.hash,
            authorFid: r.author?.fid || r.fid || r.author_fid,
            text: r.text?.substring(0, 30)
          })));
        }
        
        const hasReply = allReplies.some((r: any) => {
          const authorFid = r.author?.fid || r.fid || r.author_fid;
          const match = Number(authorFid) === Number(userFid);
          if (match) {
            console.log("[neynar] checkUserCommented: ✅ found reply in cast.replies", { 
              replyHash: r.hash, 
              authorFid, 
              userFid,
              replyText: r.text?.substring(0, 50),
              parentHash: r.parent_hash
            });
          }
          return match;
        });
        
        if (hasReply) {
          console.log("[neynar] checkUserCommented: ✅ found via cast.replies", { fullHash, userFid });
          return true;
        }
      } else {
        console.warn("[neynar] checkUserCommented: Method 1 - cast not found in response", { dataKeys: Object.keys(data || {}) });
      }
    } else {
      const errorText = await res.text().catch(() => '');
      console.warn("[neynar] checkUserCommented: Method 1 - API error", res.status, res.statusText, errorText.substring(0, 200));
    }
  } catch (e: any) {
    console.warn("[neynar] checkUserCommented: Method 1 - cast endpoint failed", e?.message);
  }
  
  // Метод 2: Проверка через replies endpoint (специальный endpoint для replies)
  try {
    const repliesUrl = `https://api.neynar.com/v2/farcaster/cast/replies?identifier=${fullHash}&type=hash`;
    console.log("[neynar] checkUserCommented: Method 2 - checking replies endpoint", repliesUrl);
    const res = await fetch(repliesUrl, { headers: { "api_key": cleanApiKey } });
    
    if (res.ok) {
      const data = await res.json();
      console.log("[neynar] checkUserCommented: Method 2 - response keys", Object.keys(data || {}));
      
      const replies = data?.result?.replies || data?.replies || data?.result?.casts || data?.casts || data?.result?.result?.replies || [];
      console.log("[neynar] checkUserCommented: Method 2 - found replies", replies.length, {
        dataStructure: JSON.stringify(Object.keys(data || {})).substring(0, 200)
      });
      
      // Логируем первые несколько replies для отладки
      if (replies.length > 0) {
        console.log("[neynar] checkUserCommented: Method 2 - sample replies", replies.slice(0, 3).map((r: any) => ({
          hash: r.hash,
          authorFid: r.author?.fid || r.fid || r.author_fid,
          parentHash: r.parent_hash,
          text: r.text?.substring(0, 30)
        })));
      }
      
      const hasReply = replies.some((r: any) => {
        const authorFid = r.author?.fid || r.fid || r.author_fid;
        const match = Number(authorFid) === Number(userFid);
        if (match) {
          console.log("[neynar] checkUserCommented: ✅ found reply via replies endpoint", { 
            replyHash: r.hash, 
            authorFid, 
            userFid,
            parentHash: r.parent_hash,
            replyText: r.text?.substring(0, 50)
          });
        }
        return match;
      });
      
      if (hasReply) {
        console.log("[neynar] checkUserCommented: ✅ found via replies endpoint", { fullHash, userFid });
        return true;
      }
    } else {
      const errorText = await res.text().catch(() => '');
      console.warn("[neynar] checkUserCommented: Method 2 - API error", res.status, res.statusText, errorText.substring(0, 200));
    }
  } catch (e: any) {
    console.warn("[neynar] checkUserCommented: Method 2 - replies endpoint failed", e?.message || e);
  }
  
  // Метод 3: Проверка через parent_hash (поиск всех кастов с этим parent_hash)
  // Пробуем оба формата hash (с 0x и без)
  const hashVariants = [fullHash, normalizedHash, hashWith0x].filter((h, i, arr) => arr.indexOf(h) === i);
  
  for (const hashVariant of hashVariants) {
    try {
      const url = `https://api.neynar.com/v2/farcaster/casts?parent_hash=${hashVariant}&limit=100`;
      console.log("[neynar] checkUserCommented: Method 3 - checking parent_hash", url, { hashVariant });
      const res = await fetch(url, { headers: { "api_key": cleanApiKey } });
      
      if (res.ok) {
        const data = await res.json();
        const casts = data?.result?.casts || data?.casts || data?.result?.result?.casts || [];
        console.log("[neynar] checkUserCommented: Method 3 - found casts with parent_hash", casts.length, { hashVariant });
        
        // Логируем первые несколько кастов для отладки
        if (casts.length > 0) {
          console.log("[neynar] checkUserCommented: Method 3 - sample casts", casts.slice(0, 3).map((c: any) => ({
            hash: c.hash,
            authorFid: c.author?.fid || c.fid || c.author_fid,
            parentHash: c.parent_hash,
            text: c.text?.substring(0, 30)
          })));
        }
        
        const hasComment = casts.some((c: any) => {
          const authorFid = c.author?.fid || c.fid || c.author_fid;
          const match = Number(authorFid) === Number(userFid);
          if (match) {
            console.log("[neynar] checkUserCommented: ✅ found comment via parent_hash", { 
              commentHash: c.hash, 
              authorFid, 
              userFid,
              parentHash: c.parent_hash,
              targetHash: fullHash,
              hashVariant,
              commentText: c.text?.substring(0, 50)
            });
          }
          return match;
        });
        
        if (hasComment) {
          console.log("[neynar] checkUserCommented: ✅ found via parent_hash", { fullHash, userFid, hashVariant });
          return true;
        }
      } else {
        const errorText = await res.text().catch(() => '');
        console.warn("[neynar] checkUserCommented: Method 3 - API error", res.status, res.statusText, errorText.substring(0, 200), { hashVariant });
      }
    } catch (e: any) {
      console.warn("[neynar] checkUserCommented: Method 3 - parent_hash method failed", e?.message || e, { hashVariant });
    }
  }
  
  // Метод 4: Проверка через user/casts (все касты пользователя, ищем комментарии к этому cast)
  try {
    const userCastsUrl = `https://api.neynar.com/v2/farcaster/user/casts?fid=${userFid}&limit=200`;
    console.log("[neynar] checkUserCommented: Method 4 - checking user casts", userCastsUrl);
    const res = await fetch(userCastsUrl, { headers: { "api_key": cleanApiKey } });
    
    if (res.ok) {
      const data = await res.json();
      const casts = data?.result?.casts || data?.casts || [];
      console.log("[neynar] checkUserCommented: Method 4 - found user casts", casts.length);
      
      // Проверяем все варианты parent_hash
      const hasComment = casts.some((c: any) => {
        const parentHash = c.parent_hash || c.parent?.hash || c.parent_author?.hash;
        if (!parentHash) return false;
        
        // Нормализуем parentHash для сравнения
        const normalizedParentHash = parentHash.startsWith('0x') ? parentHash.slice(2) : parentHash;
        const parentHashWith0x = parentHash.startsWith('0x') ? parentHash : `0x${parentHash}`;
        
        // Сравниваем с разными вариантами target hash
        const match = 
          parentHash.toLowerCase() === fullHash.toLowerCase() ||
          parentHash.toLowerCase() === normalizedHash.toLowerCase() ||
          parentHash.toLowerCase() === hashWith0x.toLowerCase() ||
          normalizedParentHash.toLowerCase() === fullHash.toLowerCase() ||
          normalizedParentHash.toLowerCase() === normalizedHash.toLowerCase() ||
          parentHashWith0x.toLowerCase() === fullHash.toLowerCase() ||
          parentHashWith0x.toLowerCase() === hashWith0x.toLowerCase();
        
        if (match) {
          console.log("[neynar] checkUserCommented: ✅ found comment via user/casts", { 
            commentHash: c.hash, 
            parentHash, 
            normalizedParentHash,
            fullHash,
            normalizedHash,
            hashWith0x,
            commentText: c.text?.substring(0, 50)
          });
        }
        return match;
      });
      
      if (hasComment) {
        console.log("[neynar] checkUserCommented: ✅ found via user/casts", { fullHash, userFid });
        return true;
      }
    } else {
      const errorText = await res.text().catch(() => '');
      console.warn("[neynar] checkUserCommented: Method 4 - API error", res.status, res.statusText, errorText.substring(0, 200));
    }
  } catch (e: any) {
    console.warn("[neynar] checkUserCommented: Method 4 - user/casts method failed", e?.message || e);
  }
  
  // Метод 5: Проверка через feed endpoint (альтернативный способ)
  try {
    const feedUrl = `https://api.neynar.com/v2/farcaster/feed/cast_likes?cast_hashes=${fullHash}&limit=100`;
    console.log("[neynar] checkUserCommented: Method 5 - checking feed endpoint (alternative)", feedUrl);
    // Этот метод может не работать для комментариев, но попробуем
    const res = await fetch(feedUrl, { headers: { "api_key": cleanApiKey } });
    
    if (res.ok) {
      const data = await res.json();
      console.log("[neynar] checkUserCommented: Method 5 - feed response", Object.keys(data || {}));
    }
  } catch (e: any) {
    // Игнорируем ошибки этого метода, он экспериментальный
    console.log("[neynar] checkUserCommented: Method 5 - feed endpoint not available for comments");
  }
  
  console.log("[neynar] checkUserCommented: ❌ comment not found after all methods", { 
    fullHash, 
    normalizedHash,
    hashWith0x,
    userFid 
  });
  return false;
}

/** Универсальная проверка задачи по типу (like, recast, comment) */
export async function checkUserTaskByHash(
  fullHash: string,
  userFid: number,
  taskType: TaskType
): Promise<boolean> {
  switch (taskType) {
    case "like":
      return await checkUserLiked(fullHash, userFid);
    case "recast":
      return await checkUserRecasted(fullHash, userFid);
    default:
      console.error("[neynar] Unknown task type:", taskType);
      return false;
  }
}

// ----------------------------
// ОБРАТНАЯ СОВМЕСТИМОСТЬ
// ----------------------------
export function extractCastHash(url: string): string | null {
  if (!url) return null;
  
  // Сначала пробуем извлечь полный hash (64 символа)
  const fullHash = extractFullHashFromUrl(url);
  if (fullHash) return fullHash;
  
  // Если не нашли, пробуем любой hash (6-64 символов)
  const anyHash = extractAnyHash(url);
  if (anyHash) return anyHash;
  
  // Если hash не найден в URL, пробуем извлечь из пути
  // Например: /vitalik/0x1234567890abcdef
  const pathMatch = url.match(/\/(?:[^\/]+\/)?(0x[a-fA-F0-9]{6,64})/);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1].toLowerCase();
  }
  
  return null;
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
