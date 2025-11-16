import { Redis } from '@upstash/redis';
import type { LinkSubmission, UserProgress, ActivityType } from '@/types';
import { getCastAuthor, getUserByUsername } from '@/lib/neynar';

// Инициализация Redis клиента
let redis: Redis | null = null;

// Инициализировать только на сервере
if (typeof window === 'undefined' && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  // Убираем пробелы и переносы строк из URL и токена
  const url = process.env.UPSTASH_REDIS_REST_URL.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN.trim();
  redis = new Redis({
    url,
    token,
  });
} else if (typeof window === 'undefined') {
  console.warn('⚠️ Upstash Redis credentials not found. Using fallback mode.');
}

// Ключи для Redis
const KEYS = {
  LINKS: 'likechat:links',
  USER_PROGRESS: 'likechat:user_progress',
  TOTAL_LINKS_COUNT: 'likechat:total_links_count',
};

// Функции для работы с ссылками
export async function getLastTenLinks(activityType?: ActivityType): Promise<LinkSubmission[]> {
  if (!redis) return [];
  
  try {
    // Получаем все ссылки (берем больше, чтобы после фильтрации осталось достаточно)
    const allLinks = await redis.lrange(KEYS.LINKS, 0, -1);
    const parsedLinks = allLinks.map((linkStr: any) => {
      // Try to parse as JSON, or use as-is if already parsed
      const link = typeof linkStr === 'string' ? JSON.parse(linkStr) : linkStr;
      return {
        ...link,
        created_at: link.created_at || new Date().toISOString(),
      };
    }).sort((a, b) => {
      // Сортируем по дате создания (новые первыми)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    
    // Фильтруем по activityType, если указан
    let filteredLinks = parsedLinks;
    if (activityType) {
      filteredLinks = parsedLinks.filter((link: LinkSubmission) => link.activity_type === activityType);
      console.log(`🔍 Filtering links by activity type: ${activityType}`);
      console.log(`📊 Total links: ${parsedLinks.length}, Filtered: ${filteredLinks.length}`);
    }
    
    // Берем первые 10 ссылок после фильтрации
    const result = filteredLinks.slice(0, 10);
    
    // Логируем данные для диагностики
    console.log(`📖 Loaded ${result.length} links from Redis${activityType ? ` (filtered by ${activityType})` : ' (all activities)'}:`, 
      result.map((link, index) => ({
        index: index + 1,
        id: link.id,
        username: link.username,
        user_fid: link.user_fid,
        activity_type: link.activity_type,
        created_at: link.created_at,
        cast_url: link.cast_url?.substring(0, 50) + '...',
      }))
    );
    
    return result;
  } catch (error) {
    console.error('Error getting links from Upstash:', error);
    return [];
  }
}

export async function getAllLinks(): Promise<LinkSubmission[]> {
  if (!redis) return [];
  
  try {
    const links = await redis.lrange(KEYS.LINKS, 0, -1);
    return links.map((linkStr: any) => {
      // Try to parse as JSON, or use as-is if already parsed
      const link = typeof linkStr === 'string' ? JSON.parse(linkStr) : linkStr;
      return {
        ...link,
        created_at: link.created_at || new Date().toISOString(),
      };
    });
  } catch (error) {
    console.error('Error getting all links from Upstash:', error);
    return [];
  }
}

export async function submitLink(
  userFid: number,
  username: string,
  pfpUrl: string,
  castUrl: string,
  activityType: ActivityType
): Promise<LinkSubmission | null> {
  if (!redis) return null;
  
  try {
    const newLink: LinkSubmission = {
      id: `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_fid: userFid,
      username,
      pfp_url: pfpUrl,
      cast_url: castUrl,
      activity_type: activityType,
      completed_by: [],
      created_at: new Date().toISOString(),
    };

    // Добавляем ссылку в начало списка (сериализуем в JSON)
    await redis.lpush(KEYS.LINKS, JSON.stringify(newLink));
    
    // Обновляем счетчик
    await redis.incr(KEYS.TOTAL_LINKS_COUNT);

    console.log(`✅ Link published successfully:`, {
      id: newLink.id,
      username: newLink.username,
      user_fid: newLink.user_fid,
      cast_url: newLink.cast_url,
      activity_type: newLink.activity_type,
      created_at: newLink.created_at,
    });

    return newLink;
  } catch (error) {
    console.error('Error submitting link to Upstash:', error);
    throw error;
  }
}

export async function getTotalLinksCount(): Promise<number> {
  if (!redis) return 0;
  
  try {
    const count = await redis.get(KEYS.TOTAL_LINKS_COUNT);
    return typeof count === 'number' ? count : 0;
  } catch (error) {
    console.error('Error getting total links count from Upstash:', error);
    return 0;
  }
}

// Функции для работы с прогрессом пользователей
export async function getUserProgress(userFid: number): Promise<UserProgress | null> {
  if (!redis) return null;
  
  try {
    const progressStr = await redis.hget<string>(KEYS.USER_PROGRESS, userFid.toString());
    if (!progressStr) return null;
    
    const progress = JSON.parse(progressStr) as UserProgress;
    return {
      ...progress,
      created_at: progress.created_at || new Date().toISOString(),
      updated_at: progress.updated_at || new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error getting user progress from Upstash:', error);
    return null;
  }
}

export async function upsertUserProgress(
  userFid: number,
  updates: Partial<UserProgress>
): Promise<UserProgress> {
  if (!redis) {
    throw new Error('Redis not available');
  }
  
  try {
    const existing = await getUserProgress(userFid);
    
    const progress: UserProgress = {
      id: existing?.id || `progress_${userFid}_${Date.now()}`,
      user_fid: userFid,
      completed_links: updates.completed_links || existing?.completed_links || [],
      token_purchased: updates.token_purchased ?? existing?.token_purchased ?? false,
      selected_activity: updates.selected_activity || existing?.selected_activity,
      current_link_id: updates.current_link_id || existing?.current_link_id,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await redis.hset(KEYS.USER_PROGRESS, { [userFid.toString()]: JSON.stringify(progress) });
    return progress;
  } catch (error) {
    console.error('Error upserting user progress to Upstash:', error);
    throw error;
  }
}

export async function markLinkCompleted(userFid: number, linkId: string): Promise<void> {
  if (!redis) return;
  
  try {
    const progress = await getUserProgress(userFid);
    if (!progress) return;

    const updatedCompletedLinks = [...progress.completed_links];
    if (!updatedCompletedLinks.includes(linkId)) {
      updatedCompletedLinks.push(linkId);
      
      await upsertUserProgress(userFid, {
        completed_links: updatedCompletedLinks,
      });
    }
  } catch (error) {
    console.error('Error marking link as completed in Upstash:', error);
  }
}

export async function markTokenPurchased(userFid: number, txHash?: string): Promise<void> {
  if (!redis) return;
  
  try {
    const updates: Partial<UserProgress> = {
      token_purchased: true,
    };
    
    // Сохраняем txHash если передан (для dexscreener и истории транзакций)
    if (txHash) {
      updates.token_purchase_tx_hash = txHash;
      console.log(`✅ [DB] Saving token purchase txHash ${txHash} for user ${userFid}`);
    }
    
    await upsertUserProgress(userFid, updates);
  } catch (error) {
    console.error('Error marking token as purchased in Upstash:', error);
  }
}

export async function setUserActivity(userFid: number, activity: ActivityType): Promise<void> {
  if (!redis) return;
  
  try {
    await upsertUserProgress(userFid, {
      selected_activity: activity,
    });
  } catch (error) {
    console.error('Error setting user activity in Upstash:', error);
  }
}

// Функция для очистки всех ссылок
async function clearAllLinks(): Promise<void> {
  if (!redis) return;
  
  try {
    // Удаляем все элементы из списка
    const listLength = await redis.llen(KEYS.LINKS);
    if (listLength > 0) {
      await redis.del(KEYS.LINKS);
    }
    
    // Сбрасываем счетчик
    await redis.set(KEYS.TOTAL_LINKS_COUNT, 0);
  } catch (error) {
    console.error('Error clearing links:', error);
  }
}

// Функция для инициализации начальных ссылок
export async function initializeLinks(): Promise<{ success: boolean; count: number; error?: string }> {
  if (!redis) {
    return { success: false, count: 0, error: 'Redis not available' };
  }

  try {
    // Проверяем, не добавлены ли уже ссылки
    const existingCount = await getTotalLinksCount();
    if (existingCount > 0) {
      // Если ссылки уже есть, очищаем их перед повторной инициализацией
      await clearAllLinks();
    }

    // Список начальных ссылок
    const initialLinks = [
      'https://farcaster.xyz/gladness/0xaa4214bf',
      'https://farcaster.xyz/svs-smm/0xf17842cb',
      'https://farcaster.xyz/svs-smm/0x4fce02cd',
      'https://farcaster.xyz/svs-smm/0xd976e9a8',
      'https://farcaster.xyz/svs-smm/0x4349a0e0',
      'https://farcaster.xyz/svs-smm/0x3bfa3788',
      'https://farcaster.xyz/svs-smm/0xef39e991',
      'https://farcaster.xyz/svs-smm/0xea43ddbf',
      'https://farcaster.xyz/svs-smm/0x31157f15',
      'https://farcaster.xyz/svs-smm/0xd4a09fb3',
    ];

    // Получаем реальные данные авторов кастов через Neynar API
    const activityTypes: ActivityType[] = ['like', 'recast', 'comment'];
    const baseTimestamp = Date.now();
    const linksToAdd: LinkSubmission[] = [];
    const userCache = new Map<string, { fid: number; username: string; pfp_url: string }>();

    for (let index = 0; index < initialLinks.length; index++) {
      const castUrl = initialLinks[index];
      console.log(`🔍 Fetching cast author data for: ${castUrl}`);
      
      try {
        // Получаем реальные данные автора каста
        const authorData = await getCastAuthor(castUrl);
        
        if (authorData && authorData.fid && authorData.username) {
          userCache.set(authorData.username.toLowerCase(), {
            fid: authorData.fid,
            username: authorData.username,
            pfp_url: authorData.pfp_url,
          });
          linksToAdd.push({
            id: `init_link_${index + 1}_${baseTimestamp + index}`,
            user_fid: authorData.fid,
            username: authorData.username,
            pfp_url: authorData.pfp_url,
            cast_url: castUrl,
            activity_type: activityTypes[index % activityTypes.length],
            completed_by: [],
            created_at: new Date().toISOString(),
          });
          console.log(`✅ [${index + 1}/${initialLinks.length}] Loaded real data for @${authorData.username} (FID: ${authorData.fid})`);
        } else {
          // Если не удалось получить данные из каста, пытаемся получить данные пользователя по username из URL
          console.warn(`⚠️ [${index + 1}/${initialLinks.length}] Failed to get author data from cast for ${castUrl}`);
          console.warn(`⚠️ Author data received:`, authorData);
          console.warn(`⚠️ Cast may not exist in Neynar API, trying to get user by username from URL...`);
          
          // Извлекаем hash из URL для использования в fallback
          const castHash = castUrl.match(/0x[a-fA-F0-9]+/)?.[0] || `hash_${index}`;
          
          // Пытаемся извлечь username из URL (если есть)
          // Формат: https://farcaster.xyz/svs-smm/0xf9660a16
          const urlMatch = castUrl.match(/farcaster\.xyz\/([^\/]+)/);
          const usernameFromUrl = urlMatch ? urlMatch[1] : null;
          
          // Пытаемся получить данные пользователя по username через Neynar API
          let userData = null;
          let cachedUser = null;
          if (usernameFromUrl) {
            cachedUser = userCache.get(usernameFromUrl.toLowerCase()) || null;
          }

          if (usernameFromUrl && !cachedUser) {
            try {
              console.log(`🔍 [${index + 1}/${initialLinks.length}] Trying to get user data by username: ${usernameFromUrl}`);
              userData = await getUserByUsername(usernameFromUrl);
              
              console.log(`🔍 [${index + 1}/${initialLinks.length}] getUserByUsername returned:`, {
                hasData: !!userData,
                fid: userData?.fid,
                username: userData?.username,
                display_name: userData?.display_name,
                hasPfp: !!(userData?.pfp || userData?.pfp_url || userData?.profile?.pfp),
                pfpUrl: userData?.pfp?.url || userData?.pfp_url || userData?.profile?.pfp?.url,
                rawData: userData,
              });
              
              if (userData && userData.fid) {
                console.log(`✅ [${index + 1}/${initialLinks.length}] Got user data by username: @${userData.username || userData.display_name} (FID: ${userData.fid})`);
              } else {
                console.warn(`⚠️ [${index + 1}/${initialLinks.length}] User data not found or invalid for username: ${usernameFromUrl}`);
                console.warn(`⚠️ [${index + 1}/${initialLinks.length}] UserData received:`, userData);
              }

              if (userData && userData.fid && userData.username) {
                userCache.set(userData.username.toLowerCase(), {
                  fid: userData.fid,
                  username: userData.username,
                  pfp_url: userData?.pfp?.url || userData?.pfp_url || userData?.profile?.pfp?.url || '',
                });
              }
            } catch (userError: any) {
              console.error(`❌ [${index + 1}/${initialLinks.length}] Failed to get user by username:`, {
                message: userError?.message,
                stack: userError?.stack,
                response: userError?.response?.data,
                status: userError?.response?.status,
              });
            }
          } else {
            console.warn(`⚠️ [${index + 1}/${initialLinks.length}] No username extracted from URL: ${castUrl}`);
          }
          
          // Если username из URL не найден, но это может быть реальный пользователь,
          // попробуем использовать данные из других источников или создать временные данные с более реалистичными значениями
          if (!userData && cachedUser) {
            userData = cachedUser;
          }

          if (!userData && usernameFromUrl) {
            console.warn(`⚠️ Could not fetch real user data for ${usernameFromUrl}, but will use it as username`);
          }
          
          // Если получили данные пользователя, используем их
          if (userData && userData.fid) {
            // Извлекаем pfp_url из различных форматов ответа Neynar API
            let pfpUrl = null;
            if (userData.pfp?.url) {
              pfpUrl = userData.pfp.url;
            } else if (userData.pfp_url) {
              pfpUrl = userData.pfp_url;
            } else if (userData.pfp) {
              pfpUrl = typeof userData.pfp === 'string' ? userData.pfp : userData.pfp.url;
            } else if (userData.profile?.pfp?.url) {
              pfpUrl = userData.profile.pfp.url;
            } else if (userData.profile?.pfp_url) {
              pfpUrl = userData.profile.pfp_url;
            }
            
            // Если не нашли pfp_url, используем fallback
            if (!pfpUrl) {
              pfpUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.fid}`;
            }

            userCache.set((userData.username || usernameFromUrl || `user_${index + 1}`).toLowerCase(), {
              fid: userData.fid,
              username: userData.username || usernameFromUrl || `user_${index + 1}`,
              pfp_url: pfpUrl,
            });
            
            linksToAdd.push({
              id: `init_link_${index + 1}_${baseTimestamp + index}`,
              user_fid: userData.fid,
              username: userData.username || userData.display_name || usernameFromUrl || `user_${index + 1}`,
              pfp_url: pfpUrl,
              cast_url: castUrl,
              activity_type: activityTypes[index % activityTypes.length],
              completed_by: [],
              created_at: new Date().toISOString(),
            });
            console.log(`✅ [${index + 1}/${initialLinks.length}] Loaded real user data by username: @${userData.username || userData.display_name} (FID: ${userData.fid}, pfp: ${pfpUrl})`);
          } else {
            // Если не удалось получить данные пользователя, используем fallback
            linksToAdd.push({
              id: `init_link_${index + 1}_${baseTimestamp + index}`,
              user_fid: 0, // Временный FID
              username: usernameFromUrl || `user_${index + 1}`, // Используем username из URL если есть
              pfp_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${castHash}`,
              cast_url: castUrl,
              activity_type: activityTypes[index % activityTypes.length],
              completed_by: [],
              created_at: new Date().toISOString(),
            });
            console.log(`⚠️ [${index + 1}/${initialLinks.length}] Using fallback data for ${castUrl} (username: ${usernameFromUrl || `user_${index + 1}`})`);
          }
        }
      } catch (error: any) {
        console.error(`❌ [${index + 1}/${initialLinks.length}] Error fetching author data for ${castUrl}:`, error);
        console.error(`❌ Error details:`, {
          message: error.message,
          stack: error.stack,
        });
        
        // Используем fallback вместо выброса ошибки, чтобы система могла работать
        const castHash = castUrl.match(/0x[a-fA-F0-9]+/)?.[0] || `hash_${index}`;
        
        // Пытаемся извлечь username из URL (если есть)
        const urlMatch = castUrl.match(/farcaster\.xyz\/([^\/]+)/);
        const usernameFromUrl = urlMatch ? urlMatch[1] : null;
        
        // Пытаемся получить данные пользователя по username даже при ошибке
        let userData = null;
        if (usernameFromUrl) {
          const cachedUser = userCache.get(usernameFromUrl.toLowerCase()) || null;
          try {
            console.log(`🔍 Retrying to get user data by username after error: ${usernameFromUrl}`);
            // Добавляем небольшую задержку перед повторной попыткой
            await new Promise(resolve => setTimeout(resolve, 500));
            userData = cachedUser || await getUserByUsername(usernameFromUrl);
            if (userData && userData.fid) {
              console.log(`✅ Got user data by username after error: @${userData.username} (FID: ${userData.fid})`);
              userCache.set((userData.username || usernameFromUrl).toLowerCase(), {
                fid: userData.fid,
                username: userData.username || usernameFromUrl,
                pfp_url: userData?.pfp?.url || userData?.pfp_url || userData?.profile?.pfp?.url || '',
              });
            }
          } catch (retryError: any) {
            console.warn(`⚠️ Retry failed to get user by username:`, retryError?.message);
          }
        }
        
        // Если получили данные пользователя, используем их
        if (!userData && usernameFromUrl) {
          userData = userCache.get(usernameFromUrl.toLowerCase()) || null;
        }

        if (userData && userData.fid) {
          let pfpUrl = null;
          if (userData.pfp?.url) {
            pfpUrl = userData.pfp.url;
          } else if (userData.pfp_url) {
            pfpUrl = userData.pfp_url;
          } else if (userData.pfp) {
            pfpUrl = typeof userData.pfp === 'string' ? userData.pfp : userData.pfp.url;
          } else if (userData.profile?.pfp?.url) {
            pfpUrl = userData.profile.pfp.url;
          } else if (userData.profile?.pfp_url) {
            pfpUrl = userData.profile.pfp_url;
          }
          
          if (!pfpUrl) {
            pfpUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.fid}`;
          }

          userCache.set((userData.username || usernameFromUrl || `user_${index + 1}`).toLowerCase(), {
            fid: userData.fid,
            username: userData.username || usernameFromUrl || `user_${index + 1}`,
            pfp_url: pfpUrl,
          });
          
          linksToAdd.push({
            id: `init_link_${index + 1}_${baseTimestamp + index}`,
            user_fid: userData.fid,
            username: userData.username || userData.display_name || usernameFromUrl || `user_${index + 1}`,
            pfp_url: pfpUrl,
            cast_url: castUrl,
            activity_type: activityTypes[index % activityTypes.length],
            completed_by: [],
            created_at: new Date().toISOString(),
          });
          console.log(`✅ [${index + 1}/${initialLinks.length}] Loaded real user data after error: @${userData.username || userData.display_name} (FID: ${userData.fid}, pfp: ${pfpUrl})`);
        } else {
          // Если не удалось получить данные пользователя, используем fallback
          linksToAdd.push({
            id: `init_link_${index + 1}_${baseTimestamp + index}`,
            user_fid: 0,
            username: usernameFromUrl || `user_${index + 1}`, // Используем username из URL если есть
            pfp_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${castHash}`,
            cast_url: castUrl,
            activity_type: activityTypes[index % activityTypes.length],
            completed_by: [],
            created_at: new Date().toISOString(),
          });
          console.log(`⚠️ [${index + 1}/${initialLinks.length}] Using fallback data due to error for ${castUrl} (username: ${usernameFromUrl || `user_${index + 1}`})`);
        }
      }
      
      // Задержка между запросами, чтобы не перегружать API и избежать rate limiting
      // Увеличиваем задержку для последних элементов, так как они могут быть более проблемными
      const delay = index < 6 ? 500 : 1000; // Больше задержка для элементов 7-10
      if (index < initialLinks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Добавляем ссылки в Redis (в правильном порядке, первая - последняя)
    console.log(`📝 Adding ${linksToAdd.length} links to Redis...`);
    for (let i = 0; i < linksToAdd.length; i++) {
      const link = linksToAdd[i];
      console.log(`📝 [${i + 1}/${linksToAdd.length}] Adding link:`, {
        id: link.id,
        username: link.username,
        user_fid: link.user_fid,
        pfp_url: link.pfp_url,
        has_pfp: !!link.pfp_url && link.pfp_url !== `https://api.dicebear.com/7.x/avataaars/svg?seed=${link.user_fid || 'hash'}`,
      });
      await redis.lpush(KEYS.LINKS, JSON.stringify(link));
    }

    // Устанавливаем счетчик
    await redis.set(KEYS.TOTAL_LINKS_COUNT, initialLinks.length);

    console.log(`✅ Successfully initialized ${linksToAdd.length} links`);
    return { success: true, count: linksToAdd.length };
  } catch (error: any) {
    console.error('Error initializing links:', error);
    return { 
      success: false, 
      count: 0, 
      error: error.message || 'Failed to initialize links' 
    };
  }
}

// Функция для подписки на обновления (заглушка для совместимости)
export function subscribeToLinks(callback: (payload: unknown) => void): { unsubscribe: () => void } {
  // В Upstash Redis нет встроенной подписки на изменения
  // Можно использовать polling или webhooks для обновлений
  return {
    unsubscribe: () => {
      console.log('Unsubscribed from Upstash Redis updates');
    },
  };
}

