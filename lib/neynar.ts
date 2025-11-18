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
  if (!url || typeof url !== 'string') {
    console.warn('⚠️ Invalid cast URL (empty or not a string):', url);
    return null;
  }

  const patterns = [
    /\/(0x[a-fA-F0-9]{8,})$/,      // farcaster.xyz/.../0x123...
    /\/c\/(0x[a-fA-F0-9]{8,})/,      // firefly.gg/c/0x123...
    /\/cast\/(0x[a-fA-F0-9]{8,})/,   // warpcast.com/~/cast/0x123...
    /(0x[a-fA-F0-9]{8,})/,           // Просто hash в строке
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      console.log(`✅ Extracted cast hash: ${match[1]} from URL: ${url.substring(0, 50)}...`);
      return match[1];
    }
  }

  console.warn('⚠️ extractCastHash: unsupported URL', url);
  return null;
}

// Проверка, является ли hash полным (42 символа)
function isFullHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(hash);
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

// Проверка активности по типу (like, recast, comment)
export async function checkUserActivityByHash(
  castHash: string, 
  userFid: number, 
  activityType: ActivityType
): Promise<boolean> {
  if (!castHash) {
    console.error('❌ [ACTIVITY] Empty cast hash');
    return false;
  }

  if (!isFullHash(castHash)) {
    console.error('❌ [ACTIVITY] Invalid hash format. Expected full hash (42 chars):', castHash);
    return false;
  }

  try {
    let url = '';
    if (activityType === 'like' || activityType === 'recast') {
      url = `${NEYNAR_BASE_URL}/farcaster/reactions?cast_hash=${castHash}&types=${activityType === 'like' ? 'likes' : 'recasts'}&viewer_fid=${userFid}`;
    } else if (activityType === 'comment') {
      url = `${NEYNAR_BASE_URL}/farcaster/casts?parent_hash=${castHash}`;
    } else {
      console.error('❌ [ACTIVITY] Unknown activity type:', activityType);
      return false;
    }

    const res = await fetch(url, { 
      headers: { 
        'api_key': cleanApiKey,
        'Content-Type': 'application/json'
      } 
    });
    const data = await res.json();

    let completed = false;
    if (activityType === 'like' || activityType === 'recast') {
      completed = data.reactions && data.reactions.some((r: any) => r.reactor_fid === userFid);
    } else if (activityType === 'comment') {
      completed = data.result && data.result.casts && data.result.casts.some((c: any) => c.author?.fid === userFid);
    }

    console.log(`🔍 [ACTIVITY] Checked ${activityType} for cast ${castHash}, user ${userFid}: ${completed ? '✅ FOUND' : '❌ NOT FOUND'}`);
    return completed;
  } catch (err: any) {
    console.error('❌ checkUserActivityByHash error:', err);
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
