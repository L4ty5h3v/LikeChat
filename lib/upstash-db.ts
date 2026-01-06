import { Redis } from '@upstash/redis';
import type { LinkSubmission, UserProgress, TaskType } from '@/types';
import { baseAppContentUrlFromTokenAddress } from '@/lib/base-content';
import { REQUIRED_BUYS_TO_PUBLISH, TASKS_LIMIT } from '@/lib/app-config';

// Инициализация Redis клиента
let redis: Redis | null = null;

function readEnvTrimmed(key: string): string | undefined {
  const v = process.env[key];
  if (!v) return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

// Инициализировать только на сервере
if (typeof window === 'undefined') {
  // Support both direct Upstash env vars and Vercel KV integration env vars.
  const url =
    readEnvTrimmed('UPSTASH_REDIS_REST_URL') ||
    readEnvTrimmed('KV_REST_API_URL');
  const token =
    readEnvTrimmed('UPSTASH_REDIS_REST_TOKEN') ||
    readEnvTrimmed('KV_REST_API_TOKEN') ||
    readEnvTrimmed('KV_REST_API_READ_ONLY_TOKEN');

  if (url && token) {
  redis = new Redis({
    url,
    token,
  });
  } else {
    console.warn('⚠️ Upstash Redis credentials not found. Using fallback mode.');
  }
}

// Ключи для Redis
const KEYS = {
  LINKS: 'likechat:links',
  USER_PROGRESS: 'likechat:user_progress',
  TOTAL_LINKS_COUNT: 'likechat:total_links_count',
};

// Функции для работы с ссылками
export async function getLastTenLinks(taskType?: TaskType): Promise<LinkSubmission[]> {
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
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      
      // Если даты одинаковые (или очень близкие), сортируем по ID для стабильности
      if (Math.abs(dateA - dateB) < 1000) {
        // Сортируем по ID в обратном порядке (новые ID первыми)
        return b.id.localeCompare(a.id);
      }
      
      return dateB - dateA;
    });
    
    // Фильтруем по taskType, если указан
    let filteredLinks = parsedLinks;
    if (taskType) {
      // ⚠️ ВАЖНО: Строгая фильтрация - только ссылки нужного типа, без дополнения другими типами
      filteredLinks = parsedLinks.filter((link: LinkSubmission) => link.task_type === taskType);
      console.log(`🔍 Filtering links by task type: ${taskType}`);
      console.log(`📊 Total links: ${parsedLinks.length}, Filtered: ${filteredLinks.length} (strict filtering - no mixing)`);
    }
    
    // Берем только TASKS_LIMIT ссылок (по ТЗ: ровно 5 задач одновременно)
    const result = filteredLinks.slice(0, TASKS_LIMIT);
    
    // Логируем данные для диагностики
    console.log(`📖 Loaded ${result.length} links from Redis${taskType ? ` (filtered by ${taskType})` : ' (all tasks)'}:`, 
      result.map((link, index) => ({
        index: index + 1,
        id: link.id,
        username: link.username,
        user_fid: link.user_fid,
        task_type: link.task_type,
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

export async function deleteLink(linkId: string): Promise<boolean> {
  if (!redis) return false;
  
  try {
    // Получаем все ссылки
    const links = await redis.lrange(KEYS.LINKS, 0, -1);
    
    // Находим индекс ссылки для удаления
    let linkIndex = -1;
    for (let i = 0; i < links.length; i++) {
      const linkStr = links[i];
      const link = typeof linkStr === 'string' ? JSON.parse(linkStr) : linkStr;
      if (link.id === linkId) {
        linkIndex = i;
        break;
      }
    }
    
    if (linkIndex === -1) {
      console.warn(`⚠️ Link ${linkId} not found for deletion`);
      return false;
    }
    
    // Удаляем ссылку из списка
    // В Redis списках удаляем по значению
    await redis.lrem(KEYS.LINKS, 1, links[linkIndex]);
    
    console.log(`✅ Link ${linkId} deleted successfully`);
    return true;
  } catch (error) {
    console.error('Error deleting link from Upstash:', error);
    return false;
  }
}

export async function submitLink(
  userFid: number,
  username: string,
  pfpUrl: string,
  castUrl: string,
  taskType: TaskType,
  tokenAddress?: string
): Promise<LinkSubmission | null> {
  if (!redis) return null;
  
  try {
    const newLink: LinkSubmission = {
      id: `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_fid: userFid,
      username,
      pfp_url: pfpUrl,
      cast_url: castUrl,
      token_address: tokenAddress,
      task_type: taskType,
      completed_by: [],
      created_at: new Date().toISOString(),
    };

    // Добавляем ссылку в начало списка (сериализуем в JSON)
    await redis.lpush(KEYS.LINKS, JSON.stringify(newLink));

    // Keep queue bounded: always keep only TASKS_LIMIT newest links.
    await redis.ltrim(KEYS.LINKS, 0, TASKS_LIMIT - 1);
    
    // Обновляем счетчик
    try {
      const len = await redis.llen(KEYS.LINKS);
      await redis.set(KEYS.TOTAL_LINKS_COUNT, typeof len === 'number' ? len : TASKS_LIMIT);
    } catch {
      await redis.incr(KEYS.TOTAL_LINKS_COUNT);
    }

    console.log(`✅ Link published successfully:`, {
      id: newLink.id,
      username: newLink.username,
      user_fid: newLink.user_fid,
      cast_url: newLink.cast_url,
      task_type: newLink.task_type,
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
      // ⚠️ ВАЖНО: Если selected_task передан в updates, используем его (даже если это обновление)
      selected_task: updates.selected_task !== undefined ? updates.selected_task : existing?.selected_task,
      current_link_id: updates.current_link_id || existing?.current_link_id,
      // Fortune cookie streak fields
      current_streak: updates.current_streak !== undefined ? updates.current_streak : (existing?.current_streak ?? 0),
      longest_streak: updates.longest_streak !== undefined ? updates.longest_streak : (existing?.longest_streak ?? 0),
      last_fortune_claim_date: updates.last_fortune_claim_date || existing?.last_fortune_claim_date,
      total_fortune_claims: updates.total_fortune_claims !== undefined ? updates.total_fortune_claims : (existing?.total_fortune_claims ?? 0),
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
      const capped = updatedCompletedLinks.slice(-REQUIRED_BUYS_TO_PUBLISH);
      
      await upsertUserProgress(userFid, {
        completed_links: capped,
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

export async function setUserActivity(userFid: number, activity: TaskType): Promise<void> {
  if (!redis) return;
  
  try {
    await upsertUserProgress(userFid, {
      selected_task: activity,
    });
  } catch (error) {
    console.error('Error setting user activity in Upstash:', error);
  }
}

// Функция для очистки всех ссылок
export async function clearAllLinks(): Promise<number> {
  if (!redis) return 0;
  
  try {
    // Удаляем все элементы из списка
    const listLength = await redis.llen(KEYS.LINKS);
    if (listLength > 0) {
      await redis.del(KEYS.LINKS);
    }
    
    // Сбрасываем счетчик
    await redis.set(KEYS.TOTAL_LINKS_COUNT, 0);
    return typeof listLength === 'number' ? listLength : 0;
  } catch (error) {
    console.error('Error clearing links:', error);
    return 0;
  }
}

export async function seedLinks(
  entries: Array<{ castUrl?: string; tokenAddress: string; username?: string; pfpUrl?: string }>
): Promise<{ success: boolean; count: number; error?: string }> {
  if (!redis) {
    return { success: false, count: 0, error: 'Redis not available' };
  }

  try {
    const now = Date.now();
    const usernameFallback = 'svs-smm';
    const pfpFallback = `https://api.dicebear.com/7.x/identicon/svg?seed=${usernameFallback}`;

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const tokenAddress = (e.tokenAddress || '').toString().trim();
      const direct = (e.castUrl || '').toString().trim();
      const generated = baseAppContentUrlFromTokenAddress(tokenAddress) || '';
      const castUrl = direct.startsWith('http') ? direct : generated;
      const newLink: LinkSubmission = {
        id: `seed_${now}_${i}_${Math.random().toString(36).slice(2, 9)}`,
        user_fid: 0,
        username: e.username || usernameFallback,
        pfp_url: e.pfpUrl || pfpFallback,
        cast_url: castUrl,
        token_address: tokenAddress,
        task_type: 'support',
        completed_by: [],
        created_at: new Date(now + i).toISOString(),
      };

      await redis.lpush(KEYS.LINKS, JSON.stringify(newLink));
    }

    // Keep queue bounded: always keep only TASKS_LIMIT newest links.
    await redis.ltrim(KEYS.LINKS, 0, TASKS_LIMIT - 1);

    // Update counter to actual length (best-effort).
    try {
      const len = await redis.llen(KEYS.LINKS);
      await redis.set(KEYS.TOTAL_LINKS_COUNT, typeof len === 'number' ? len : TASKS_LIMIT);
    } catch {
      // ignore
    }

    return { success: true, count: entries.length };
  } catch (error: any) {
    return { success: false, count: 0, error: error?.message || 'Failed to seed links' };
  }
}

// Функция для инициализации начальных ссылок
export async function initializeLinks(): Promise<{ success: boolean; count: number; error?: string }> {
  if (!redis) {
    return { success: false, count: 0, error: 'Redis not available' };
  }

  try {
    // По запросу: НЕ создаём тестовые/стартовые ссылки. Только очищаем.
    const removed = await clearAllLinks();
    console.log(`🧹 Cleared links via initializeLinks(): removed=${removed}`);
    return { success: true, count: removed };
  } catch (error: any) {
    console.error('Error initializing links:', error);
    return { 
      success: false, 
      count: 0, 
      error: error.message || 'Failed to initialize links' 
    };
  }
}

// Функция для добавления ссылок только одного типа (без удаления существующих)
export async function addLinksForTaskType(taskType: TaskType): Promise<{ success: boolean; count: number; error?: string }> {
  if (!redis) {
    return { success: false, count: 0, error: 'Redis not available' };
  }

  try {
    // По запросу: отключаем добавление тестовых ссылок.
    return { success: false, count: 0, error: 'Disabled: seeding links is turned off.' };
  } catch (error: any) {
    console.error(`❌ [ADD-LINKS] Error adding links for task type "${taskType}":`, error);
    return { 
      success: false, 
      count: 0, 
      error: error.message || `Failed to add links for task type "${taskType}"` 
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

// Получить всех пользователей с их прогрессом
export async function getAllUsersProgress(): Promise<UserProgress[]> {
  if (!redis) return [];
  
  try {
    const allUsers = await redis.hgetall(KEYS.USER_PROGRESS);
    if (!allUsers || Object.keys(allUsers).length === 0) return [];
    
    const users: UserProgress[] = [];
    for (const [fid, progressStr] of Object.entries(allUsers)) {
      try {
        const progress = typeof progressStr === 'string' ? JSON.parse(progressStr as string) : progressStr;
        users.push({
          ...progress,
          created_at: progress.created_at || new Date().toISOString(),
          updated_at: progress.updated_at || new Date().toISOString(),
        });
      } catch (error) {
        console.error(`Error parsing user progress for FID ${fid}:`, error);
      }
    }
    
    return users;
  } catch (error) {
    console.error('Error getting all users progress from Upstash:', error);
    return [];
  }
}

