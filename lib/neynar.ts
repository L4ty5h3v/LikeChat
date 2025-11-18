// Neynar API для проверки лайков, реккастов и комментариев
import axios from 'axios';
import type { ActivityType, NeynarReaction, NeynarComment, CastDiagnostics } from '@/types';

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

// Определить, является ли hash коротким или полным
export function isShortHash(hash: string): boolean {
  if (!hash || !hash.startsWith('0x')) return false;
  const hashLength = hash.length;
  // Короткий hash: 0x + 8-12 символов (10-14 символов всего)
  // Полный hash: 0x + 40 символов (42 символа всего)
  return hashLength >= 3 && hashLength < 20;
}

// Извлечь hash каста из URL
// ✅ ПРИНИМАЕТ ЛЮБУЮ ССЫЛКУ: Farcaster, Firefly, Warpcast, Kiosk, короткие/длинные hash
// ⚠️ ВАЖНО: Полный cast_hash должен быть формата 0x + 40 шестнадцатеричных символов (0x + 40 chars = 42 total)
// Короткий hash (например, 0xef39e991 = 10 символов) будет автоматически расширен до полного
export function extractCastHash(castUrl: string): string | null {
  try {
    if (!castUrl || typeof castUrl !== 'string') {
      console.warn('⚠️ Invalid cast URL (empty or not a string):', castUrl);
      return null;
    }

    // Примеры форматов:
    // https://warpcast.com/username/0x123abc...
    // https://warpcast.com/~/conversations/0x123abc...
    // https://farcaster.xyz/svs-smm/0x123abc...
    // https://firefly.gg/c/0x3a60c5c9...  ← Firefly формат
    // 0x3a60c5c9...  ← Прямой хеш
    
    // Ищем хеш в формате 0x + hex символы (минимум 1 символ после 0x)
    const match = castUrl.match(/0x[a-fA-F0-9]+/);
    
    if (!match) {
      console.warn('⚠️ No cast hash found in URL:', castUrl);
      return null;
    }
    
    const hash = match[0];
    
    // Валидация: хеш должен быть минимум 0x + 1 символ
    if (hash.length < 3) {
      console.warn('⚠️ Invalid cast hash (too short):', hash);
      return null;
    }
    
    // ⚠️ КРИТИЧЕСКАЯ ПРОВЕРКА: Полный cast_hash должен быть 0x + 40 символов = 42 символа всего
    // Короткий hash (например, 0xef39e991 = 10 символов) может быть неполным
    const EXPECTED_FULL_HASH_LENGTH = 42; // 0x + 40 hex chars
    const hashLength = hash.length;
    
    if (hashLength < EXPECTED_FULL_HASH_LENGTH) {
      console.warn(`⚠️ [HASH-LENGTH] Cast hash is shorter than expected full hash:`, {
        hash,
        length: hashLength,
        expectedLength: EXPECTED_FULL_HASH_LENGTH,
        isShort: hashLength < 20, // Если меньше 20 символов - явно короткий
        warning: hashLength < 20 
          ? '❌ Hash слишком короткий! Это может быть неполный hash. Полный hash должен быть 0x + 40 символов.'
          : '⚠️ Hash короче стандартного. Убедитесь, что это полный hash.',
      });
      
      // Если hash очень короткий (меньше 20 символов), это явно проблема
      if (hashLength < 20) {
        console.error(`❌ [HASH-LENGTH] Hash слишком короткий (${hashLength} символов). Полный hash должен быть ${EXPECTED_FULL_HASH_LENGTH} символов (0x + 40 hex).`);
        console.log(`📌 Проверьте в Neynar Explorer: https://neynar.com/explorer/casts?castHash=${hash}`);
        // Не возвращаем null, но предупреждаем - возможно, это всё же валидный короткий hash
      }
    } else if (hashLength === EXPECTED_FULL_HASH_LENGTH) {
      console.log(`✅ [HASH-LENGTH] Cast hash имеет правильную длину (${hashLength} символов)`);
    } else {
      console.warn(`⚠️ [HASH-LENGTH] Cast hash длиннее ожидаемого:`, {
        hash,
        length: hashLength,
        expectedLength: EXPECTED_FULL_HASH_LENGTH,
      });
    }
    
    const isShort = isShortHash(hash);
    console.log(`✅ Extracted cast hash: ${hash} (length: ${hashLength}, ${isShort ? 'SHORT' : 'FULL'}) from URL: ${castUrl.substring(0, 50)}...`);
    return hash;
  } catch (error) {
    console.error('❌ Error extracting cast hash:', error);
    return null;
  }
}

// Расширить короткий hash до полного через Neynar API
// GET https://api.neynar.com/v2/farcaster/casts?short_hash=0xef39e991
export async function expandShortHash(shortHash: string): Promise<string | null> {
  if (!NEYNAR_API_KEY) {
    console.warn('⚠️ NEXT_PUBLIC_NEYNAR_API_KEY not configured');
    return null;
  }

  if (!isShortHash(shortHash)) {
    console.log(`ℹ️ [EXPAND] Hash is not short, returning as-is: ${shortHash}`);
    return shortHash;
  }

  try {
    console.log(`🔍 [EXPAND] Expanding short hash: ${shortHash}`);
    
    // Пробуем несколько вариантов endpoint'ов для получения полного hash
    let response;
    
    // Вариант 1: /farcaster/casts с параметром short_hash
    try {
      response = await neynarClient.get('/farcaster/casts', {
        params: {
          short_hash: shortHash,
        },
      });
      console.log(`✅ [EXPAND] Cast data received (method 1 - short_hash):`, response.data);
    } catch (error1: any) {
      console.warn(`⚠️ [EXPAND] Method 1 failed:`, {
        status: error1?.response?.status,
        statusText: error1?.response?.statusText,
        data: error1?.response?.data,
      });
      
      // Вариант 2: /farcaster/cast с identifier и type=hash (может работать с коротким hash)
      try {
        response = await neynarClient.get('/farcaster/cast', {
          params: {
            identifier: shortHash,
            type: 'hash',
          },
        });
        console.log(`✅ [EXPAND] Cast data received (method 2 - identifier):`, response.data);
      } catch (error2: any) {
        console.warn(`⚠️ [EXPAND] Method 2 failed:`, {
          status: error2?.response?.status,
          statusText: error2?.response?.statusText,
          data: error2?.response?.data,
        });
        
        // Вариант 3: Попробуем через /farcaster/casts с hash параметром
        try {
          response = await neynarClient.get('/farcaster/casts', {
            params: {
              hash: shortHash,
            },
          });
          console.log(`✅ [EXPAND] Cast data received (method 3 - hash):`, response.data);
        } catch (error3: any) {
          console.error(`❌ [EXPAND] All methods failed. Cast not found for short hash: ${shortHash}`);
          return null;
        }
      }
    }

    // Обрабатываем различные форматы ответа
    const casts = response.data?.result?.casts || response.data?.casts || [];
    const cast = response.data?.result?.cast || response.data?.cast || response.data?.result || response.data;
    
    // Если это массив casts, берём первый
    if (Array.isArray(casts) && casts.length > 0) {
      const fullHash = casts[0].hash;
      if (fullHash && fullHash.startsWith('0x')) {
        console.log(`✅ [EXPAND] Expanded short hash ${shortHash} → full hash ${fullHash}`);
        return fullHash;
      }
    }
    
    // Если это один cast объект
    if (cast && cast.hash && cast.hash.startsWith('0x')) {
      const fullHash = cast.hash;
      console.log(`✅ [EXPAND] Expanded short hash ${shortHash} → full hash ${fullHash}`);
      return fullHash;
    }

    console.error(`❌ [EXPAND] Could not extract full hash from response:`, response.data);
    return null;
  } catch (error: any) {
    console.error('❌ [EXPAND] Error expanding short hash:', {
      shortHash,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      message: error?.message,
    });
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

// Диагностика cast для проверки в Neynar Explorer
// Согласно инструкции: https://neynar.com/explorer/casts
// Использование:
//   const diagnostics = await diagnoseCast('0x3a60c5c9', userFid);
//   console.log(diagnostics.neynarExplorerUrl); // Открой в браузере для проверки
export async function diagnoseCast(castHash: string, userFid?: number): Promise<CastDiagnostics> {
  const diagnostics: CastDiagnostics = {
    castHash,
    isValid: false,
    castFound: false,
    neynarExplorerUrl: `https://neynar.com/explorer/casts?castHash=${castHash}`,
    castData: null,
    reactions: {
      likes: [],
      recasts: [],
    },
  };

  // Шаг 1: Проверяем валидность cast_hash
  if (!castHash || !castHash.startsWith('0x') || castHash.length < 3) {
    diagnostics.error = '❌ Invalid cast_hash format. Must start with 0x and contain hex characters.';
    console.error('❌ [DIAGNOSTICS] Invalid cast_hash:', castHash);
    return diagnostics;
  }

  // ⚠️ Проверка длины hash: полный hash должен быть 0x + 40 символов = 42 символа
  const hashLength = castHash.length;
  const EXPECTED_FULL_HASH_LENGTH = 42;
  
  if (hashLength < EXPECTED_FULL_HASH_LENGTH) {
    if (hashLength < 20) {
      diagnostics.error = `❌ Hash слишком короткий (${hashLength} символов). Полный hash должен быть ${EXPECTED_FULL_HASH_LENGTH} символов (0x + 40 hex).`;
      console.error(`❌ [DIAGNOSTICS] ${diagnostics.error}`);
      return diagnostics;
    } else {
      diagnostics.error = `⚠️ Hash короче стандартного (${hashLength} символов). Убедитесь, что это полный hash.`;
      console.warn(`⚠️ [DIAGNOSTICS] ${diagnostics.error}`);
    }
  }

  diagnostics.isValid = true;
  console.log(`🔍 [DIAGNOSTICS] Checking cast: ${castHash} (length: ${hashLength})`);

  // Шаг 2: Проверяем cast через Neynar API
  // GET https://api.neynar.com/v2/farcaster/cast?identifier=0xHASH&type=hash
  try {
    const cast = await getCastByHash(castHash);
    
    if (!cast) {
      diagnostics.error = '❌ Cast not found in Neynar API. Check if cast_hash is correct.';
      console.error('❌ [DIAGNOSTICS] Cast not found for hash:', castHash);
      console.log(`📌 [DIAGNOSTICS] Check in Neynar Explorer: ${diagnostics.neynarExplorerUrl}`);
      return diagnostics;
    }

    diagnostics.castFound = true;
    diagnostics.castData = cast;
    console.log(`✅ [DIAGNOSTICS] Cast found:`, {
      hash: cast.hash || castHash,
      author: cast.author?.username || cast.author_fid,
    });

    // Шаг 3: Проверяем реакции через Neynar API
    if (userFid) {
      try {
        // Проверяем лайки
        const likesResponse = await neynarClient.get('/farcaster/reactions', {
          params: {
            cast_hash: castHash,
            types: 'likes',
            viewer_fid: userFid,
          },
        });
        const likes = likesResponse.data?.reactions || likesResponse.data?.result?.reactions || [];
        diagnostics.reactions.likes = likes;
        
        // Проверяем рекасты
        const recastsResponse = await neynarClient.get('/farcaster/reactions', {
          params: {
            cast_hash: castHash,
            types: 'recasts',
            viewer_fid: userFid,
          },
        });
        const recasts = recastsResponse.data?.reactions || recastsResponse.data?.result?.reactions || [];
        diagnostics.reactions.recasts = recasts;

        console.log(`📊 [DIAGNOSTICS] Reactions for user ${userFid}:`, {
          likes: diagnostics.reactions.likes.length,
          recasts: diagnostics.reactions.recasts.length,
        });

        // Проверяем, есть ли реакции от пользователя
        const userLiked = diagnostics.reactions.likes.some((r: any) => r.reactor_fid === userFid);
        const userRecasted = diagnostics.reactions.recasts.some((r: any) => r.reactor_fid === userFid);

        if (!userLiked && !userRecasted) {
          diagnostics.error = '⚠️ No reactions found from user. Client may not have sent reaction to public hub.';
          console.warn('⚠️ [DIAGNOSTICS] No reactions found from user:', userFid);
        } else {
          console.log(`✅ [DIAGNOSTICS] User reactions found:`, {
            liked: userLiked,
            recasted: userRecasted,
          });
        }
      } catch (reactionsError: any) {
        console.warn('⚠️ [DIAGNOSTICS] Error fetching reactions:', reactionsError?.response?.data || reactionsError?.message);
        diagnostics.error = `⚠️ Could not fetch reactions: ${reactionsError?.response?.data?.message || reactionsError?.message}`;
      }
    } else {
      // Если userFid не указан, просто получаем общую информацию о cast
      console.log('ℹ️ [DIAGNOSTICS] User FID not provided, skipping reaction check');
    }

    // Проверяем реакции в самом cast объекте
    if (cast.reactions) {
      console.log(`📊 [DIAGNOSTICS] Cast reactions summary:`, {
        likes_count: cast.reactions.likes_count || 0,
        recasts_count: cast.reactions.recasts_count || 0,
      });
    }

  } catch (error: any) {
    diagnostics.error = `❌ Error checking cast: ${error?.response?.data?.message || error?.message || 'Unknown error'}`;
    console.error('❌ [DIAGNOSTICS] Error:', error?.response?.data || error?.message);
  }

  return diagnostics;
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
    console.log(`🔍 [LIKE] Checking like for cast ${castHash}, user ${userFid}`);
    
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
    
    console.log(`🔍 [LIKE] Checked like for cast ${castHash}, user ${userFid}:`, {
      totalReactions: reactions.length,
      userReactions: reactions.filter((r: NeynarReaction) => r.reactor_fid === userFid).length,
      found: found ? '✅ FOUND' : '❌ NOT FOUND',
      neynarExplorerUrl: `https://neynar.com/explorer/casts?castHash=${castHash}`,
    });
    
    if (!found && reactions.length === 0) {
      console.warn(`⚠️ [LIKE] No reactions found in public hub. Check Neynar Explorer: https://neynar.com/explorer/casts?castHash=${castHash}`);
    }
    
    return found;
  } catch (error: any) {
    console.error('❌ [LIKE] Error checking like:', {
      castHash,
      userFid,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      message: error?.message,
      neynarExplorerUrl: `https://neynar.com/explorer/casts?castHash=${castHash}`,
    });
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
    console.log(`🔍 [RECAST] Checking recast for cast ${castHash}, user ${userFid}`);
    
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
    
    console.log(`🔍 [RECAST] Checked recast for cast ${castHash}, user ${userFid}:`, {
      totalReactions: reactions.length,
      userReactions: reactions.filter((r: NeynarReaction) => r.reactor_fid === userFid).length,
      found: found ? '✅ FOUND' : '❌ NOT FOUND',
      neynarExplorerUrl: `https://neynar.com/explorer/casts?castHash=${castHash}`,
    });
    
    if (!found && reactions.length === 0) {
      console.warn(`⚠️ [RECAST] No reactions found in public hub. Check Neynar Explorer: https://neynar.com/explorer/casts?castHash=${castHash}`);
    }
    
    return found;
  } catch (error: any) {
    console.error('❌ [RECAST] Error checking recast:', {
      castHash,
      userFid,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      message: error?.message,
      neynarExplorerUrl: `https://neynar.com/explorer/casts?castHash=${castHash}`,
    });
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
    console.log(`🔍 [COMMENT] Checking comment for cast ${castHash}, user ${userFid}`);
    
    const response = await neynarClient.get('/farcaster/casts', {
      params: {
        parent_hash: castHash,
      },
    });

    // ✅ Условие успеха: response.result.casts.some(c => c.author.fid === userFid)
    const casts = response.data?.result?.casts || response.data?.casts || [];
    const userComments = casts.filter((cast: any) => {
      const authorFid = cast.author?.fid || cast.author_fid;
      return authorFid === userFid;
    });
    const found = userComments.length > 0;
    
    // Сохраняем в кэш
    setCachedResult(cacheKey, found);
    
    console.log(`🔍 [COMMENT] Checked comment for cast ${castHash}, user ${userFid}:`, {
      totalComments: casts.length,
      userComments: userComments.length,
      found: found ? '✅ FOUND' : '❌ NOT FOUND',
      neynarExplorerUrl: `https://neynar.com/explorer/casts?castHash=${castHash}`,
    });
    
    if (!found) {
      console.warn(`⚠️ [COMMENT] No comments found from user. Check Neynar Explorer: https://neynar.com/explorer/casts?castHash=${castHash}`);
    }
    
    return found;
  } catch (error: any) {
    console.error('❌ [COMMENT] Error checking comment:', {
      castHash,
      userFid,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      message: error?.message,
      neynarExplorerUrl: `https://neynar.com/explorer/casts?castHash=${castHash}`,
    });
    return false;
  }
}

// Универсальная проверка активности по castHash (правильный алгоритм)
// ✅ Автоматически расширяет короткий hash до полного перед проверкой
export async function checkUserActivityByHash(
  castHash: string,
  userFid: number,
  activityType: ActivityType
): Promise<boolean> {
  if (!castHash || !castHash.startsWith('0x')) {
    console.error('❌ [ACTIVITY] Invalid cast hash:', castHash);
    console.log(`📌 [ACTIVITY] Check cast_hash format. Example from Firefly: https://firefly.gg/c/0x3a60c5c9 → cast_hash = 0x3a60c5c9`);
    return false;
  }

  // ✅ ШАГ 1: Определяем, короткий ли hash
  const hashLength = castHash.length;
  const isShort = isShortHash(castHash);
  
  // ✅ ШАГ 2: Если hash короткий → расширяем до полного
  let fullHash = castHash;
  if (isShort) {
    console.log(`🔄 [ACTIVITY] Short hash detected (${hashLength} chars), expanding to full hash...`);
    const expanded = await expandShortHash(castHash);
    
    if (!expanded) {
      console.error(`❌ [ACTIVITY] Failed to expand short hash: ${castHash}`);
      console.log(`📌 [ACTIVITY] Cast не найден. Проверьте, что вы скопировали ссылку из официального Farcaster-клиента.`);
      return false;
    }
    
    fullHash = expanded;
    console.log(`✅ [ACTIVITY] Expanded ${castHash} → ${fullHash}`);
  }

  const EXPECTED_FULL_HASH_LENGTH = 42;
  if (fullHash.length < EXPECTED_FULL_HASH_LENGTH) {
    console.warn(`⚠️ [ACTIVITY] Hash still shorter than expected after expansion:`, {
      originalHash: castHash,
      fullHash,
      length: fullHash.length,
      expectedLength: EXPECTED_FULL_HASH_LENGTH,
    });
  }

  console.log(`🔍 [ACTIVITY] Checking ${activityType} for cast ${fullHash} (length: ${fullHash.length}), user ${userFid}`);
  console.log(`📌 [ACTIVITY] Neynar Explorer: https://neynar.com/explorer/casts?castHash=${fullHash}`);

  // ✅ ШАГ 3: Проверяем активность с полным hash
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