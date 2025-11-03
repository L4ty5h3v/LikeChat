import { Redis } from '@upstash/redis';
import type { LinkSubmission, UserProgress, ActivityType } from '@/types';

// Инициализация Redis клиента
let redis: Redis | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
} else {
  console.warn('⚠️ Upstash Redis credentials not found. Using fallback mode.');
}

// Ключи для Redis
const KEYS = {
  LINKS: 'likechat:links',
  USER_PROGRESS: 'likechat:user_progress',
  TOTAL_LINKS_COUNT: 'likechat:total_links_count',
};

// Функции для работы с ссылками
export async function getLastTenLinks(): Promise<LinkSubmission[]> {
  if (!redis) return [];
  
  try {
    const links = await redis.lrange<string>(KEYS.LINKS, 0, 9);
    return links.map((linkStr: string) => {
      const link = JSON.parse(linkStr) as LinkSubmission;
      return {
        ...link,
        created_at: link.created_at || new Date().toISOString(),
      };
    });
  } catch (error) {
    console.error('Error getting links from Upstash:', error);
    return [];
  }
}

export async function getAllLinks(): Promise<LinkSubmission[]> {
  if (!redis) return [];
  
  try {
    const links = await redis.lrange<string>(KEYS.LINKS, 0, -1);
    return links.map((linkStr: string) => {
      const link = JSON.parse(linkStr) as LinkSubmission;
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
    const totalLinks = await getTotalLinksCount();
    
    // Логика для "early bird" пользователей
    if (totalLinks < 10) {
      const uniqueUsers = new Set();
      const existingLinks = await getAllLinks();
      
      for (const link of existingLinks) {
        uniqueUsers.add(link.user_fid);
      }
      
      if (!uniqueUsers.has(userFid) && uniqueUsers.size >= 10) {
        throw new Error(`System is initializing. Please wait for the first 10 users to add their links. Current: ${totalLinks}/10`);
      }
    }

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

export async function markTokenPurchased(userFid: number): Promise<void> {
  if (!redis) return;
  
  try {
    await upsertUserProgress(userFid, {
      token_purchased: true,
    });
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

// Функция для инициализации начальных ссылок
export async function initializeLinks(): Promise<{ success: boolean; count: number; error?: string }> {
  if (!redis) {
    return { success: false, count: 0, error: 'Redis not available' };
  }

  try {
    // Проверяем, не добавлены ли уже ссылки
    const existingCount = await getTotalLinksCount();
    if (existingCount > 0) {
      return { 
        success: false, 
        count: existingCount, 
        error: `Links already initialized (${existingCount} links exist)` 
      };
    }

    // Список начальных ссылок
    const initialLinks = [
      'https://farcaster.xyz/svs-smm/0xf9660a16',
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

    // Создаем ссылки с фиктивными пользователями
    const activityTypes: ActivityType[] = ['like', 'recast', 'comment'];
    const linksToAdd: LinkSubmission[] = initialLinks.map((castUrl, index) => ({
      id: `init_link_${index + 1}_${Date.now()}`,
      user_fid: 1000 + index, // Фиктивные FID
      username: `user${index + 1}`,
      pfp_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=init${index}`,
      cast_url: castUrl,
      activity_type: activityTypes[index % activityTypes.length],
      completed_by: [],
      created_at: new Date().toISOString(),
    }));

    // Добавляем ссылки в Redis (в правильном порядке, первая - последняя)
    for (const link of linksToAdd.reverse()) {
      await redis.lpush(KEYS.LINKS, JSON.stringify(link));
    }

    // Устанавливаем счетчик
    await redis.set(KEYS.TOTAL_LINKS_COUNT, initialLinks.length);

    return { success: true, count: initialLinks.length };
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

