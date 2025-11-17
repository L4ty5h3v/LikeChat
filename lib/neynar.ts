// Neynar API для проверки лайков, реккастов и комментариев
import axios from 'axios';
import type { ActivityType, NeynarReaction, NeynarComment } from '@/types';

const NEYNAR_API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY || '';
const NEYNAR_BASE_URL = 'https://api.neynar.com/v2';

// Очищаем API ключ от пробелов и недопустимых символов
const cleanApiKey = NEYNAR_API_KEY ? NEYNAR_API_KEY.trim().replace(/[\r\n\t]/g, '') : '';

const neynarClient = axios.create({
  baseURL: NEYNAR_BASE_URL,
  headers: {
    'api_key': cleanApiKey,
    'Content-Type': 'application/json',
  },
});

// Кэш для результатов проверки активности (в памяти, истекает через 60 секунд)
interface CacheEntry {
  result: boolean;
  timestamp: number;
}

const activityCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60 секунд

// Генерируем ключ кэша
function getCacheKey(castHash: string, userFid: number, activityType: ActivityType): string {
  return `${activityType}:${castHash}:${userFid}`;
}

// Проверяем кэш
function getCachedResult(key: string): boolean | null {
  const entry = activityCache.get(key);
  if (!entry) return null;
  
  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL_MS) {
    activityCache.delete(key);
    return null;
  }
  
  return entry.result;
}

// Сохраняем в кэш
function setCachedResult(key: string, result: boolean): void {
  activityCache.set(key, {
    result,
    timestamp: Date.now(),
  });
  
  // Очищаем старые записи, если кэш слишком большой (больше 1000 записей)
  if (activityCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of activityCache.entries()) {
      if (now - v.timestamp > CACHE_TTL_MS) {
        activityCache.delete(k);
      }
    }
  }
}

// Извлечь hash каста из URL
export function extractCastHash(castUrl: string): string | null {
  try {
    // Примеры форматов:
    // https://warpcast.com/username/0x123abc
    // https://warpcast.com/~/conversations/0x123abc
    // https://farcaster.xyz/svs-smm/0x123abc
    const match = castUrl.match(/0x[a-fA-F0-9]+/);
    return match ? match[0] : null;
  } catch (error) {
    console.error('Error extracting cast hash:', error);
    return null;
  }
}

// Получить информацию о касте по хэшу
export async function getCastByHash(castHash: string) {
  if (!NEYNAR_API_KEY) {
    console.warn('⚠️ NEXT_PUBLIC_NEYNAR_API_KEY not configured');
    return null;
  }

  try {
    console.log(`🔍 Fetching cast by hash: ${castHash}`);
    console.log(`🔍 Using Neynar API key: ${NEYNAR_API_KEY ? `${NEYNAR_API_KEY.substring(0, 8)}...` : 'NOT SET'}`);
    
    // Попробуем несколько вариантов endpoint'ов согласно документации Neynar API v2
    let response;
    let lastError: any = null;
    
    // Вариант 1: /farcaster/cast с параметром identifier и type (правильный формат для Neynar API v2)
    try {
      response = await neynarClient.get('/farcaster/cast', {
        params: {
          identifier: castHash,
          type: 'hash',
        },
      });
      console.log(`✅ Cast data received (method 1 - identifier):`, response.data);
    } catch (error1: any) {
      lastError = error1;
      console.warn(`⚠️ Method 1 failed:`, {
        status: error1?.response?.status,
        statusText: error1?.response?.statusText,
        data: error1?.response?.data,
        message: error1?.message,
      });
      
      // Вариант 2: Попробуем без type параметра
      try {
        response = await neynarClient.get('/farcaster/cast', {
          params: {
            identifier: castHash,
          },
        });
        console.log(`✅ Cast data received (method 2 - identifier only):`, response.data);
      } catch (error2: any) {
        lastError = error2;
        console.warn(`⚠️ Method 2 failed:`, {
          status: error2?.response?.status,
          statusText: error2?.response?.statusText,
          data: error2?.response?.data,
          message: error2?.message,
        });
        
        // Вариант 3: Попробуем с параметром hash
        try {
          response = await neynarClient.get('/farcaster/cast', {
            params: {
              hash: castHash,
            },
          });
          console.log(`✅ Cast data received (method 3 - hash):`, response.data);
        } catch (error3: any) {
          lastError = error3;
          console.warn(`⚠️ Method 3 failed:`, {
            status: error3?.response?.status,
            statusText: error3?.response?.statusText,
            data: error3?.response?.data,
            message: error3?.message,
          });
          
          // Вариант 4: Попробуем с заголовком x-api-key
          try {
            const directResponse = await axios.get(`${NEYNAR_BASE_URL}/farcaster/cast`, {
              params: {
                identifier: castHash,
                type: 'hash',
              },
              headers: {
                'x-api-key': cleanApiKey,
                'Content-Type': 'application/json',
              },
            });
            response = directResponse;
            console.log(`✅ Cast data received (method 4 - x-api-key):`, response.data);
          } catch (error4: any) {
            lastError = error4;
            console.warn(`⚠️ Method 4 failed:`, {
              status: error4?.response?.status,
              statusText: error4?.response?.statusText,
              data: error4?.response?.data,
              message: error4?.message,
            });
            
            // Вариант 5: Попробуем с Authorization заголовком
            try {
              const authResponse = await axios.get(`${NEYNAR_BASE_URL}/farcaster/cast`, {
                params: {
                  identifier: castHash,
                  type: 'hash',
                },
                headers: {
                  'Authorization': `Bearer ${cleanApiKey}`,
                  'Content-Type': 'application/json',
                },
              });
              response = authResponse;
              console.log(`✅ Cast data received (method 5 - Authorization):`, response.data);
            } catch (error5: any) {
              lastError = error5;
              console.error(`❌ All methods failed. Last error:`, {
                status: error5?.response?.status,
                statusText: error5?.response?.statusText,
                data: error5?.response?.data,
                message: error5?.message,
              });
              throw error5;
            }
          }
        }
      }
    }

    // Обрабатываем различные форматы ответа от Neynar API
    const cast = response.data?.result?.cast || 
                 response.data?.cast || 
                 response.data?.result || 
                 response.data;
    
    if (!cast) {
      console.error('❌ Cast data is null or undefined. Full response:', JSON.stringify(response.data, null, 2));
      console.error('❌ Last error:', lastError?.response?.data || lastError?.message);
      return null;
    }

    // Проверяем, что cast имеет необходимую структуру
    if (!cast.author && !cast.author_fid) {
      console.warn('⚠️ Cast does not have author data:', cast);
      return null;
    }

    return cast;
  } catch (error: any) {
    console.error('❌ Error fetching cast:', {
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      message: error?.message,
      castHash: castHash,
    });
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

  // Обрабатываем различные форматы ответа от Neynar API
  let author: any = null;
  
  if (cast.author) {
    // Стандартный формат: cast.author
    author = cast.author;
  } else if (cast.author_fid) {
    // Альтернативный формат: только author_fid, нужно получить данные пользователя
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

// Проверка лайка
export async function checkUserLiked(
  castHash: string,
  userFid: number
): Promise<boolean> {
  if (!NEYNAR_API_KEY) {
    console.warn('⚠️ NEXT_PUBLIC_NEYNAR_API_KEY not configured');
    return false;
  }

  // Проверяем кэш
  const cacheKey = getCacheKey(castHash, userFid, 'like');
  const cached = getCachedResult(cacheKey);
  if (cached !== null) {
    console.log(`💾 [CACHE] Using cached like result for cast ${castHash}, user ${userFid}: ${cached ? '✅ FOUND' : '❌ NOT FOUND'}`);
    return cached;
  }

  try {
    const response = await neynarClient.get('/farcaster/reactions', {
      params: {
        cast_hash: castHash,
        types: 'likes',
        viewer_fid: userFid,
      },
    });

    const reactions = response.data?.reactions || response.data?.result?.reactions || [];
    // ✅ Условие успеха: response.reactions.length > 0 (есть реакции от пользователя)
    const found = reactions.length > 0 && reactions.some(
      (r: NeynarReaction) => 
        r.reactor_fid === userFid && r.reaction_type === 'like'
    );
    
    // Сохраняем в кэш
    setCachedResult(cacheKey, found);
    
    console.log(`🔍 Checked like for cast ${castHash}, user ${userFid}: reactions=${reactions.length}, found=${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
    return found;
  } catch (error: any) {
    console.error('❌ Error checking like:', error?.response?.data || error?.message || error);
    return false;
  }
}

// Проверка реккаста
export async function checkUserRecasted(
  castHash: string,
  userFid: number
): Promise<boolean> {
  if (!NEYNAR_API_KEY) {
    console.warn('⚠️ NEXT_PUBLIC_NEYNAR_API_KEY not configured');
    return false;
  }

  // Проверяем кэш
  const cacheKey = getCacheKey(castHash, userFid, 'recast');
  const cached = getCachedResult(cacheKey);
  if (cached !== null) {
    console.log(`💾 [CACHE] Using cached recast result for cast ${castHash}, user ${userFid}: ${cached ? '✅ FOUND' : '❌ NOT FOUND'}`);
    return cached;
  }

  try {
    const response = await neynarClient.get('/farcaster/reactions', {
      params: {
        cast_hash: castHash,
        types: 'recasts',
        viewer_fid: userFid,
      },
    });

    const reactions = response.data?.reactions || response.data?.result?.reactions || [];
    // ✅ Условие успеха: response.reactions.length > 0 (есть рекасты от пользователя)
    const found = reactions.length > 0 && reactions.some(
      (r: NeynarReaction) => 
        r.reactor_fid === userFid && r.reaction_type === 'recast'
    );
    
    // Сохраняем в кэш
    setCachedResult(cacheKey, found);
    
    console.log(`🔍 Checked recast for cast ${castHash}, user ${userFid}: reactions=${reactions.length}, found=${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
    return found;
  } catch (error: any) {
    console.error('❌ Error checking recast:', error?.response?.data || error?.message || error);
    return false;
  }
}

// Проверка комментария
export async function checkUserCommented(
  castHash: string,
  userFid: number
): Promise<boolean> {
  if (!NEYNAR_API_KEY) {
    console.warn('⚠️ NEXT_PUBLIC_NEYNAR_API_KEY not configured');
    return false;
  }

  // Проверяем кэш
  const cacheKey = getCacheKey(castHash, userFid, 'comment');
  const cached = getCachedResult(cacheKey);
  if (cached !== null) {
    console.log(`💾 [CACHE] Using cached comment result for cast ${castHash}, user ${userFid}: ${cached ? '✅ FOUND' : '❌ NOT FOUND'}`);
    return cached;
  }

  try {
    const response = await neynarClient.get('/farcaster/casts', {
      params: {
        parent_hash: castHash,
      },
    });

    // ✅ Условие успеха: response.result.casts.some(c => c.author.fid === userFid)
    const casts = response.data?.result?.casts || response.data?.casts || [];
    const found = casts.some(
      (cast: any) => {
        const authorFid = cast.author?.fid || cast.author_fid;
        return authorFid === userFid;
      }
    );
    
    // Сохраняем в кэш
    setCachedResult(cacheKey, found);
    
    console.log(`🔍 Checked comment for cast ${castHash}, user ${userFid}: casts=${casts.length}, found=${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
    return found;
  } catch (error: any) {
    console.error('❌ Error checking comment:', error?.response?.data || error?.message || error);
    return false;
  }
}

// Универсальная проверка активности по castHash (правильный алгоритм)
export async function checkUserActivityByHash(
  castHash: string,
  userFid: number,
  activityType: ActivityType
): Promise<boolean> {
  if (!castHash || !castHash.startsWith('0x')) {
    console.error('❌ Invalid cast hash:', castHash);
    return false;
  }

  console.log(`🔍 Checking ${activityType} for cast ${castHash}, user ${userFid}`);

  switch (activityType) {
    case 'like':
      return await checkUserLiked(castHash, userFid);
    case 'recast':
      return await checkUserRecasted(castHash, userFid);
    case 'comment':
      return await checkUserCommented(castHash, userFid);
    default:
      console.error('❌ Unknown activity type:', activityType);
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

// Получить информацию о пользователе по FID
export async function getUserByFid(fid: number) {
  if (!NEYNAR_API_KEY) {
    console.warn('⚠️ NEXT_PUBLIC_NEYNAR_API_KEY not configured');
    return null;
  }

  try {
    const response = await neynarClient.get('/farcaster/user/bulk', {
      params: { fids: fid },
    });
    return response.data.users?.[0] || null;
  } catch (error: any) {
    console.error('❌ Error fetching user:', error?.response?.data || error?.message || error);
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
      response = await neynarClient.get('/farcaster/user/by_username', {
        params: {
          username: username.trim(),
        },
      });
      console.log(`✅ User data received (by_username):`, response.data);
    } catch (error1: any) {
      console.warn(`⚠️ Method 1 failed:`, error1?.response?.status, error1?.response?.data);
      
      // Вариант 2: /farcaster/user с параметром identifier
      try {
        response = await neynarClient.get('/farcaster/user', {
          params: {
            identifier: username.trim(),
            type: 'username',
          },
        });
        console.log(`✅ User data received (identifier):`, response.data);
      } catch (error2: any) {
        console.warn(`⚠️ Method 2 failed:`, error2?.response?.status, error2?.response?.data);
        
        // Вариант 3: /farcaster/user/search
        try {
          response = await neynarClient.get('/farcaster/user/search', {
            params: {
              q: username.trim(),
            },
          });
          console.log(`✅ User data received (search):`, response.data);
          
          // Если это поиск, берем первый результат
          if (response.data.result && Array.isArray(response.data.result)) {
            const foundUser = response.data.result.find((u: any) => 
              u.username?.toLowerCase() === username.trim().toLowerCase()
            );
            if (foundUser) {
              return foundUser;
            }
            return response.data.result[0] || null;
          }
        } catch (error3: any) {
          console.error(`❌ All methods failed:`, error3?.response?.data || error3?.message);
          return null;
        }
      }
    }

    // Обрабатываем различные форматы ответа
    const user = response.data?.result?.user || 
                 response.data?.user || 
                 response.data?.result || 
                 response.data;
    
    if (!user) {
      console.warn(`⚠️ User data is null or undefined for username: ${username}`);
      return null;
    }

    return user;
  } catch (error: any) {
    console.error('❌ Error fetching user by username:', {
      username: username,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      message: error?.message,
    });
    return null;
  }
}

// УДАЛЕНО: getUserWalletAddresses - не используется после удаления verifyTokenPurchaseViaNeynar
// Получить адреса кошельков пользователя по FID через Neynar API (не используется)
async function getUserWalletAddresses(fid: number): Promise<string[]> {
  if (!NEYNAR_API_KEY) {
    console.warn('⚠️ NEXT_PUBLIC_NEYNAR_API_KEY not configured');
    return [];
  }

  try {
    console.log(`🔍 Fetching wallet addresses for FID: ${fid}`);
    
    const user = await getUserByFid(fid);
    if (!user) {
      console.warn(`⚠️ User not found for FID: ${fid}`);
      return [];
    }

    // Извлекаем адреса кошельков из данных пользователя
    const addresses: string[] = [];
    
    // Проверяем различные поля, где могут быть адреса кошельков
    if (user.verifications && Array.isArray(user.verifications)) {
      user.verifications.forEach((addr: string) => {
        if (addr && typeof addr === 'string') {
          addresses.push(addr.toLowerCase());
        }
      });
    }
    
    if (user.custody_address && typeof user.custody_address === 'string') {
      addresses.push(user.custody_address.toLowerCase());
    }
    
    if (user.verified_addresses && Array.isArray(user.verified_addresses)) {
      user.verified_addresses.forEach((addr: string) => {
        if (addr && typeof addr === 'string') {
          addresses.push(addr.toLowerCase());
        }
      });
    }

    // Удаляем дубликаты
    const uniqueAddresses = [...new Set(addresses)];
    
    console.log(`✅ Found ${uniqueAddresses.length} wallet addresses for FID ${fid}:`, uniqueAddresses);
    return uniqueAddresses;
  } catch (error: any) {
    console.error('❌ Error fetching wallet addresses:', {
      fid: fid,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      message: error?.message,
    });
    return [];
  }
}

// УДАЛЕНО: verifyTokenPurchaseViaNeynar - не используется, так как покупка теперь происходит напрямую через Farcaster API