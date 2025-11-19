// Neynar API для проверки лайков, реккастов и комментариев
import type { ActivityType, NeynarReaction, NeynarComment, CastDiagnostics } from '@/types';

const NEYNAR_API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY || '';
const NEYNAR_BASE_URL = 'https://api.neynar.com/v2';

// Очищаем API ключ от пробелов и недопустимых символов
const cleanApiKey = NEYNAR_API_KEY ? NEYNAR_API_KEY.trim().replace(/[\r\n\t]/g, '') : '';

export interface VerifyResult {
  success: boolean;
  completed: boolean;
  message?: string;
  neynarExplorerUrl?: string;
  castHash?: string;
}

// Функция для извлечения hash из ссылки
export function extractCastHash(url: string): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    // Поддержка формата farcaster.xyz/namespace/<hash>
    const segments = parsed.pathname.split('/').filter(Boolean);

    const last = segments[segments.length - 1];

    // Если последний сегмент выглядит как 0x-hash любого размера
    if (/^0x[0-9a-fA-F]{6,}$/i.test(last)) {
      return last.toLowerCase();
    }

    return null;
  } catch (err) {
    return null;
  }
}

// Проверка, является ли hash полным (42 символа)
export function isFullHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(hash);
}

// ------------------------
// RESOLVE SHORT LINK
// ------------------------
/**
 * Разрешает короткую ссылку farcaster.xyz через Neynar API
 * Извлекает username и частичный hash, затем ищет полный hash в кастах пользователя
 * Использует несколько стратегий для максимальной надёжности
 */
export async function resolveShortLink(shortUrl: string): Promise<string | null> {
  if (!cleanApiKey) {
    console.warn('⚠️ [RESOLVE] NEXT_PUBLIC_NEYNAR_API_KEY not configured');
    return null;
  }

  try {
    // Парсим URL типа https://farcaster.xyz/username/0xabc... или https://farcaster.xyz/namespace/0xabc...
    const urlPattern = /^https?:\/\/farcaster\.xyz\/([^\/]+)\/(0x[a-fA-F0-9]+)/;
    const match = shortUrl.match(urlPattern);
    
    if (!match) {
      console.warn('⚠️ [RESOLVE] URL не соответствует формату farcaster.xyz/username/hash:', shortUrl);
      return null;
    }

    const [, usernameOrNamespace, partialHash] = match;
    
    // Если hash уже полный (42 символа), возвращаем его
    if (partialHash.length >= 42) {
      return partialHash;
    }

    // Очищаем hash от возможных "..." в конце
    const cleanPartialHash = partialHash.replace(/\.\.\./g, '').trim().toLowerCase();
    
    console.log(`🔄 [RESOLVE] Resolving short link for "${usernameOrNamespace}" with partial hash ${cleanPartialHash.substring(0, 12)}...`);

    // ✅ СТРАТЕГИЯ 1: Пытаемся получить полный hash напрямую через resolveFullHash
    console.log(`🔄 [RESOLVE] Strategy 1: Direct hash resolution...`);
    const directResolved = await resolveFullHash(cleanPartialHash);
    if (directResolved) {
      console.log(`✅ [RESOLVE] Strategy 1 succeeded: ${directResolved}`);
      return directResolved;
    }

    // ✅ СТРАТЕГИЯ 2: Получаем касты пользователя и ищем совпадение
    console.log(`🔄 [RESOLVE] Strategy 2: Searching user casts...`);
    
    // Получаем FID пользователя по username
    const userUrl = `https://api.neynar.com/v2/farcaster/user/by_username?username=${encodeURIComponent(usernameOrNamespace)}`;
    
    const userRes = await fetch(userUrl, {
      headers: { "api_key": cleanApiKey }
    });

    if (!userRes.ok) {
      console.warn(`⚠️ [RESOLVE] Failed to get user by username (${userRes.status}), trying alternative methods...`);
    } else {
      const userData = await userRes.json();
      const userFid = userData?.result?.user?.fid;

      if (userFid) {
        // Получаем последние касты пользователя (увеличиваем лимит для большей надёжности)
        const castsUrl = `https://api.neynar.com/v2/farcaster/casts?fid=${userFid}&limit=100`;
        
        const castsRes = await fetch(castsUrl, {
          headers: { "api_key": cleanApiKey }
        });

        if (castsRes.ok) {
          const castsData = await castsRes.json();
          const casts = castsData?.result?.casts || [];

          // Ищем каст с совпадающим частичным hash
          const matchingCast = casts.find((cast: any) => {
            const castHash = (cast.hash || '').toLowerCase();
            return castHash.startsWith(cleanPartialHash);
          });

          if (matchingCast?.hash) {
            console.log(`✅ [RESOLVE] Strategy 2 succeeded: Found full hash ${matchingCast.hash} for partial ${cleanPartialHash}`);
            return matchingCast.hash;
          }
        }
      }
    }

    // ✅ СТРАТЕГИЯ 3: Пытаемся получить через reactions endpoint
    console.log(`🔄 [RESOLVE] Strategy 3: Trying reactions endpoint...`);
    // Это может быть полезно, если каст недавний и есть реакции

    console.warn(`⚠️ [RESOLVE] All strategies failed for partial hash ${cleanPartialHash}`);
    return null;

  } catch (err) {
    console.error('❌ [RESOLVE] Error resolving short link:', err);
    return null;
  }
}

// ------------------------
// RESOLVE FULL HASH
// ------------------------
/**
 * Автоматически получает полный hash через Neynar API для короткого hash
 */
export async function resolveFullHash(shortHash: string): Promise<string | null> {
  if (!shortHash || shortHash.length < 6) {
    console.warn(`⚠️ [RESOLVE-FULL] Hash слишком короткий: ${shortHash}`);
    return null;
  }

  // Если hash уже полный (42 символа), возвращаем его
  if (isFullHash(shortHash)) {
    return shortHash;
  }

  if (!cleanApiKey) {
    console.warn('⚠️ [RESOLVE-FULL] NEXT_PUBLIC_NEYNAR_API_KEY not configured');
    return null;
  }

  try {
    // Убираем "..." если есть
    const cleanHash = shortHash.replace(/\.\.\./g, '').trim();
    
    const url = `https://api.neynar.com/v2/farcaster/cast?identifier=${cleanHash}&type=hash`;

    console.log(`🔄 [RESOLVE-FULL] Resolving short hash: ${cleanHash.substring(0, 20)}...`);

    const res = await fetch(url, {
      headers: {
        "api_key": cleanApiKey
      }
    });

    if (!res.ok) {
      console.error(`❌ [RESOLVE-FULL] API error: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();

    if (data?.result?.cast?.hash) {
      console.log(`✅ [RESOLVE-FULL] Full hash resolved: ${data.result.cast.hash}`);
      return data.result.cast.hash;
    }

    console.error("❌ [RESOLVE-FULL] Full hash not found in response:", data);
    return null;

  } catch (err) {
    console.error("❌ [RESOLVE-FULL] Error resolving hash:", err);
    return null;
  }
}

// ------------------------
// EXPAND SHORT HASH (legacy, использует resolveFullHash)
// ------------------------
export async function expandShortHash(shortHash: string): Promise<string | null> {
  return await resolveFullHash(shortHash);
}

// Функция диагностики cast
export async function diagnoseCast(castHash: string, userFid?: number): Promise<CastDiagnostics> {
  const diagnostics: CastDiagnostics = {
    castHash,
    isValid: false,
    castFound: false,
    neynarExplorerUrl: `https://explorer.neynar.com/casts/${castHash}`,
    castData: null,
    reactions: {
      likes: [],
      recasts: [],
    },
  };

  if (!castHash) {
    diagnostics.error = 'Пустой hash';
    return diagnostics;
  }

  // Если короткий hash (< 42) — предупреждаем
  if (!isFullHash(castHash)) {
    diagnostics.error = 'Неверный формат ссылки. Проверьте, что вы скопировали полную ссылку на cast.';
    diagnostics.neynarExplorerUrl = `https://explorer.neynar.com/search?q=${castHash}`;
    return diagnostics;
  }

  diagnostics.isValid = true;

  try {
    // Проверка лайков
    if (userFid) {
      const reactionsRes = await fetch(
        `${NEYNAR_BASE_URL}/farcaster/reactions?cast_hash=${castHash}&types=likes&viewer_fid=${userFid}`,
        { 
          headers: { 
            'api_key': cleanApiKey,
            'Content-Type': 'application/json'
          } 
        }
      );
      const reactionsData = await reactionsRes.json();
      diagnostics.reactions.likes = reactionsData.reactions || [];
    }

    diagnostics.castFound = true;
    return diagnostics;
  } catch (err: any) {
    console.error('❌ diagnoseCast error:', err);
    diagnostics.error = 'Ошибка при проверке Neynar API';
    return diagnostics;
  }
}

// ------------------------
// CHECK LIKE
// ------------------------
export async function checkUserLiked(castHash: string, userFid: number): Promise<boolean> {
  if (!cleanApiKey) {
    console.warn('⚠️ NEXT_PUBLIC_NEYNAR_API_KEY not configured');
    return false;
  }

  try {
    const url = `https://api.neynar.com/v2/farcaster/reactions?cast_hash=${castHash}&types=likes&viewer_fid=${userFid}`;

    const res = await fetch(url, {
      headers: { "api_key": cleanApiKey }
    });

    if (!res.ok) {
      console.error(`❌ [LIKE] API error: ${res.status} ${res.statusText}`);
      return false;
    }

    const data = await res.json();
    
    // Проверяем, есть ли реакция от конкретного пользователя
    const userReaction = data?.reactions?.some((r: any) => r?.fid === userFid);
    
    console.log(`🔍 [LIKE] Cast: ${castHash}, User: ${userFid}, Found: ${userReaction}, Total reactions: ${data?.reactions?.length || 0}`);
    
    return userReaction || false;

  } catch (err) {
    console.error("❌ checkUserLiked error:", err);
    return false;
  }
}

// ------------------------
// CHECK RECAST
// ------------------------
export async function checkUserRecasted(castHash: string, userFid: number): Promise<boolean> {
  if (!cleanApiKey) {
    console.warn('⚠️ NEXT_PUBLIC_NEYNAR_API_KEY not configured');
    return false;
  }

  try {
    const url = `https://api.neynar.com/v2/farcaster/reactions?cast_hash=${castHash}&types=recasts&viewer_fid=${userFid}`;

    const res = await fetch(url, {
      headers: { "api_key": cleanApiKey }
    });

    if (!res.ok) {
      console.error(`❌ [RECAST] API error: ${res.status} ${res.statusText}`);
      return false;
    }

    const data = await res.json();
    
    // Проверяем, есть ли рекаст от конкретного пользователя
    const userReaction = data?.reactions?.some((r: any) => r?.fid === userFid);
    
    console.log(`🔍 [RECAST] Cast: ${castHash}, User: ${userFid}, Found: ${userReaction}, Total reactions: ${data?.reactions?.length || 0}`);
    
    return userReaction || false;

  } catch (err) {
    console.error("❌ checkUserRecasted error:", err);
    return false;
  }
}

// ------------------------
// CHECK COMMENT
// ------------------------
export async function checkUserCommented(castHash: string, userFid: number): Promise<boolean> {
  if (!cleanApiKey) {
    console.warn('⚠️ NEXT_PUBLIC_NEYNAR_API_KEY not configured');
    return false;
  }

  try {
    const url = `https://api.neynar.com/v2/farcaster/casts?parent_hash=${castHash}`;

    const res = await fetch(url, {
      headers: { "api_key": cleanApiKey }
    });

    if (!res.ok) {
      console.error(`❌ [COMMENT] API error: ${res.status} ${res.statusText}`);
      return false;
    }

    const data = await res.json();

    const userComment = data?.result?.casts?.some((c: any) => c.author?.fid === userFid) || false;
    
    console.log(`🔍 [COMMENT] Cast: ${castHash}, User: ${userFid}, Found: ${userComment}, Total comments: ${data?.result?.casts?.length || 0}`);

    return userComment;

  } catch (err) {
    console.error("❌ checkUserCommented error:", err);
    return false;
  }
}

// ------------------------
// CHECK ACTIVITY BY USERNAME (упрощенная проверка)
// ------------------------
/**
 * Проверяет активность пользователя по username вместо полного hash
 * Покрывает 90% случаев без необходимости разрешать короткие хеши
 */
export async function checkUserActivityByUsername(
  targetUsername: string,
  partialHash: string | null,
  userFid: number,
  activityType: ActivityType
): Promise<boolean> {
  if (!cleanApiKey) {
    console.warn('⚠️ [ACTIVITY-USERNAME] NEXT_PUBLIC_NEYNAR_API_KEY not configured');
    return false;
  }

  try {
    console.log(`🔄 [ACTIVITY-USERNAME] Checking activity for ${targetUsername}, userFid: ${userFid}, activity: ${activityType}`);

    // Получаем последние касты пользователя по username
    const castsUrl = `https://api.neynar.com/v2/farcaster/casts?username=${encodeURIComponent(targetUsername)}&limit=10`;
    
    const castsRes = await fetch(castsUrl, {
      headers: { "api_key": cleanApiKey }
    });

    if (!castsRes.ok) {
      console.error(`❌ [ACTIVITY-USERNAME] Failed to get casts: ${castsRes.status} ${castsRes.statusText}`);
      return false;
    }

    const castsData = await castsRes.json();
    const casts = castsData?.result?.casts || [];

    if (casts.length === 0) {
      console.warn(`⚠️ [ACTIVITY-USERNAME] No casts found for username: ${targetUsername}`);
      return false;
    }

    // Если есть частичный hash, ищем каст с совпадающим hash
    if (partialHash && partialHash.length >= 6) {
      const cleanPartialHash = partialHash.replace(/\.\.\./g, '').trim().toLowerCase();
      const matchingCast = casts.find((cast: any) => {
        const castHash = (cast.hash || '').toLowerCase();
        return castHash.startsWith(cleanPartialHash);
      });

      if (matchingCast) {
        console.log(`✅ [ACTIVITY-USERNAME] Found matching cast by partial hash: ${matchingCast.hash}`);
        // Проверяем активность на найденном касте
        return await checkActivityOnCast(matchingCast, userFid, activityType);
      }
    }

    // Если частичного hash нет или не нашли совпадение, проверяем первый (самый свежий) каст
    // Это работает, если username совпадает с авторизованным пользователем
    const latestCast = casts[0];
    console.log(`✅ [ACTIVITY-USERNAME] Checking latest cast: ${latestCast.hash}`);
    return await checkActivityOnCast(latestCast, userFid, activityType);

  } catch (err) {
    console.error('❌ [ACTIVITY-USERNAME] Error checking activity by username:', err);
    return false;
  }
}

/**
 * Проверяет активность пользователя на конкретном касте
 */
async function checkActivityOnCast(
  cast: any,
  userFid: number,
  activityType: ActivityType
): Promise<boolean> {
  const castHash = cast.hash;
  if (!castHash) return false;

  switch (activityType) {
    case 'like':
      return await checkUserLiked(castHash, userFid);
    case 'recast':
      return await checkUserRecasted(castHash, userFid);
    case 'comment':
      return await checkUserCommented(castHash, userFid);
    default:
      return false;
  }
}

// Проверка активности по типу (like, recast, comment)
// ✅ Автоматически расширяет короткий hash до полного перед проверкой
export async function checkUserActivityByHash(
  castHash: string, 
  userFid: number, 
  activityType: ActivityType
): Promise<boolean> {
  if (!castHash) {
    console.error('❌ [ACTIVITY] Empty cast hash');
    return false;
  }

  // ✅ ШАГ 1: Если hash короткий → автоматически получаем полный hash через Neynar
  let fullHash = castHash;
  if (!isFullHash(castHash)) {
    console.log(`🔄 [ACTIVITY] Short hash detected (${castHash.length} chars), resolving full hash...`);
    const full = await resolveFullHash(castHash);
    
    if (!full) {
      console.error(`❌ [ACTIVITY] Failed to resolve full hash: ${castHash}`);
      return false;
    }
    
    fullHash = full;
    console.log(`✅ [ACTIVITY] Resolved ${castHash} → ${fullHash}`);
  }

  // ✅ ШАГ 2: Проверяем активность с полным hash
  switch (activityType) {
    case 'like':
      return await checkUserLiked(fullHash, userFid);
    case 'recast':
      return await checkUserRecasted(fullHash, userFid);
    case 'comment':
      return await checkUserCommented(fullHash, userFid);
    default:
      console.error('❌ [ACTIVITY] Unknown activity type:', activityType);
      return false;
  }
}

// Универсальная проверка активности по URL (для обратной совместимости)
export async function checkUserActivity(
  castUrl: string,
  userFid: number,
  activityType: ActivityType
): Promise<boolean> {
  const castHash = extractCastHash(castUrl);
  if (!castHash) {
    console.error('❌ Invalid cast URL - cannot extract hash:', castUrl);
    return false;
  }

  return await checkUserActivityByHash(castHash, userFid, activityType);
}

// Получить информацию о касте по хэшу
export async function getCastByHash(castHash: string) {
  if (!NEYNAR_API_KEY) {
    console.warn('⚠️ NEXT_PUBLIC_NEYNAR_API_KEY not configured');
    return null;
  }

  try {
    const response = await fetch(`${NEYNAR_BASE_URL}/farcaster/cast?identifier=${castHash}&type=hash`, {
      headers: {
        'api_key': cleanApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`⚠️ Failed to fetch cast: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const cast = data.result?.cast || data.cast || data.result || data;
    
    if (!cast) {
      console.error('❌ Cast data is null or undefined');
      return null;
    }

    return cast;
  } catch (error: any) {
    console.error('❌ Error fetching cast:', error?.message || error);
    return null;
  }
}

// Получить данные автора каста по URL
export async function getCastAuthor(castUrl: string) {
  const castHash = extractCastHash(castUrl);
  if (!castHash) {
    console.error('❌ Invalid cast URL - cannot extract hash:', castUrl);
    return null;
  }

  console.log(`🔍 Getting author for cast: ${castUrl} (hash: ${castHash})`);
  const cast = await getCastByHash(castHash);
  
  if (!cast) {
    console.warn(`⚠️ Cast not found for hash: ${castHash}`);
    return null;
  }

  let author: any = null;
  
  if (cast.author) {
    author = cast.author;
  } else if (cast.author_fid) {
    console.log(`⚠️ Cast has only author_fid (${cast.author_fid}), fetching user data...`);
    const user = await getUserByFid(cast.author_fid);
    if (user) {
      author = user;
    } else {
      console.warn(`⚠️ Could not fetch user data for FID: ${cast.author_fid}`);
      return null;
    }
  } else {
    console.warn(`⚠️ Cast author not found in response:`, cast);
    return null;
  }

  if (!author || !author.fid) {
    console.warn(`⚠️ Invalid author data:`, author);
    return null;
  }

  const authorData = {
    fid: author.fid,
    username: author.username || `user_${author.fid}`,
    pfp_url: author.pfp?.url || author.pfp_url || author.pfp || `https://api.dicebear.com/7.x/avataaars/svg?seed=${author.fid}`,
    display_name: author.display_name || author.username || `User ${author.fid}`,
  };

  console.log(`✅ Author data extracted:`, authorData);
  return authorData;
}

// Получить информацию о пользователе по FID
export async function getUserByFid(fid: number) {
  if (!NEYNAR_API_KEY) {
    console.warn('⚠️ NEXT_PUBLIC_NEYNAR_API_KEY not configured');
    return null;
  }

  try {
    const response = await fetch(`${NEYNAR_BASE_URL}/farcaster/user/bulk?fids=${fid}`, {
      headers: {
        'api_key': cleanApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`⚠️ Failed to fetch user: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.users?.[0] || null;
  } catch (error: any) {
    console.error('❌ Error fetching user:', error?.message || error);
    return null;
  }
}

// Получить информацию о пользователе по username
export async function getUserByUsername(username: string) {
  if (!NEYNAR_API_KEY) {
    console.warn('⚠️ NEXT_PUBLIC_NEYNAR_API_KEY not configured');
    return null;
  }

  if (!username || username.trim() === '') {
    console.warn('⚠️ Username is empty');
    return null;
  }

  try {
    console.log(`🔍 Fetching user by username: ${username}`);
    
    // Попробуем несколько вариантов endpoint'ов
    let response;
    
    // Вариант 1: /farcaster/user/by_username
    try {
      response = await fetch(`${NEYNAR_BASE_URL}/farcaster/user/by_username?username=${encodeURIComponent(username.trim())}`, {
        headers: {
          'api_key': cleanApiKey,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const user = data.result?.user || data.user || data.result || data;
        if (user) {
          console.log(`✅ User data received (by_username):`, user);
          return user;
        }
      }
    } catch (error1: any) {
      console.warn(`⚠️ Method 1 failed:`, error1?.message);
    }
    
    // Вариант 2: /farcaster/user с параметром identifier
    try {
      response = await fetch(`${NEYNAR_BASE_URL}/farcaster/user?identifier=${encodeURIComponent(username.trim())}&type=username`, {
        headers: {
          'api_key': cleanApiKey,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const user = data.result?.user || data.user || data.result || data;
        if (user) {
          console.log(`✅ User data received (identifier):`, user);
          return user;
        }
      }
    } catch (error2: any) {
      console.warn(`⚠️ Method 2 failed:`, error2?.message);
    }
    
    // Вариант 3: /farcaster/user/search
    try {
      response = await fetch(`${NEYNAR_BASE_URL}/farcaster/user/search?q=${encodeURIComponent(username.trim())}`, {
        headers: {
          'api_key': cleanApiKey,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.result && Array.isArray(data.result)) {
          const foundUser = data.result.find((u: any) => 
            u.username?.toLowerCase() === username.trim().toLowerCase()
          );
          if (foundUser) {
            console.log(`✅ User data received (search):`, foundUser);
            return foundUser;
          }
          if (data.result[0]) {
            console.log(`✅ User data received (search, first result):`, data.result[0]);
            return data.result[0];
          }
        }
      }
    } catch (error3: any) {
      console.error(`❌ All methods failed:`, error3?.message);
      return null;
    }

    console.warn(`⚠️ User data is null or undefined for username: ${username}`);
    return null;
  } catch (error: any) {
    console.error('❌ Error fetching user by username:', {
      username: username,
      message: error?.message,
    });
    return null;
  }
}
