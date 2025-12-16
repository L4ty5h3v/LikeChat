// Простая база данных в памяти для быстрого тестирования
// Позже заменим на Upstash Redis

import type { LinkSubmission, UserProgress, TaskType } from '@/types';

// In-memory storage
const linkSubmissions: LinkSubmission[] = [];
const userProgress: Map<number, UserProgress> = new Map();

// Default posts to buy (used only in memory DB to avoid an empty app on Vercel when Upstash is not configured).
// Note: memory DB is ephemeral; these defaults will re-appear after a cold start.
(() => {
  try {
    const now = Date.now();
    const username = 'svs-smm';
    const pfp = `https://api.dicebear.com/7.x/identicon/svg?seed=${username}`;

    const defaults: LinkSubmission[] = [
      {
        id: `default_${now}_0`,
        user_fid: 0,
        username,
        pfp_url: pfp,
        cast_url: 'https://base.app/content/EkUKQwoVbmV0d29ya3MvYmFzZS1tYWlubmV0EioweDA2NTkwZWViOWM5MThiYTU3YmFjYjcxZWZlZGRiZTAyNGE0OTk0ZDc',
        token_address: '0x06590eeb9c918ba57bacb71efeddbe024a4994d7',
        task_type: 'support',
        completed_by: [],
        created_at: new Date(now).toISOString(),
      },
      {
        id: `default_${now}_1`,
        user_fid: 0,
        username,
        pfp_url: pfp,
        cast_url: 'https://base.app/content/EkUKQwoVbmV0d29ya3MvYmFzZS1tYWlubmV0EioweGMwMjkyZjllODVkYWZiZGU1ZTEyYWIyNWMxYTcxNzEzNjY5YmQ3Y2M',
        token_address: '0xc0292f9e85dafbde5e12ab25c1a71713669bd7cc',
        task_type: 'support',
        completed_by: [],
        created_at: new Date(now + 1).toISOString(),
      },
      {
        id: `default_${now}_2`,
        user_fid: 0,
        username,
        pfp_url: pfp,
        cast_url: 'https://base.app/content/EkUKQwoVbmV0d29ya3MvYmFzZS1tYWlubmV0EioweGUyNTg1MmY4OGY4NWQxY2RjMzA0NzM2NjllZDcxOTUyY2VkNjAzZmE',
        token_address: '0xe25852f88f85d1cdc30473669ed71952ced603fa',
        task_type: 'support',
        completed_by: [],
        created_at: new Date(now + 2).toISOString(),
      },
      {
        id: `default_${now}_3`,
        user_fid: 0,
        username,
        pfp_url: pfp,
        cast_url: 'https://base.app/content/EkUKQwoVbmV0d29ya3MvYmFzZS1tYWlubmV0EioweDNkNjRkNzBkYjM1NWUzNmM3NGNjZWYzMDgwOTc5ZGE5ODE2NWU2YzQ',
        token_address: '0x3d64d70db355e36c74ccef3080979da98165e6c4',
        task_type: 'support',
        completed_by: [],
        created_at: new Date(now + 3).toISOString(),
      },
      {
        id: `default_${now}_4`,
        user_fid: 0,
        username,
        pfp_url: pfp,
        cast_url: 'https://base.app/content/EkUKQwoVbmV0d29ya3MvYmFzZS1tYWlubmV0EioweDg2ZGU3OTIyMmYyYjZmNTA1ZWU5YzZhZTg0YWRjNzg2N2RhZjM5MDY',
        token_address: '0x86de79222f2b6f505ee9c6ae84adc7867daf3906',
        task_type: 'support',
        completed_by: [],
        created_at: new Date(now + 4).toISOString(),
      },
    ];

    // Put newest first
    for (let i = defaults.length - 1; i >= 0; i--) {
      linkSubmissions.unshift(defaults[i]);
    }
  } catch {
    // ignore
  }
})();

export async function clearAllLinks(): Promise<number> {
  const n = linkSubmissions.length;
  linkSubmissions.length = 0;
  return n;
}

export async function seedLinks(entries: Array<{ castUrl: string; tokenAddress: string; username?: string; pfpUrl?: string }>): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const now = Date.now();
    const usernameFallback = 'svs-smm';
    const pfpFallback = `https://api.dicebear.com/7.x/identicon/svg?seed=${usernameFallback}`;

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const newLink: LinkSubmission = {
        id: `seed_${now}_${i}_${Math.random().toString(16).slice(2, 8)}`,
        user_fid: 0,
        username: e.username || usernameFallback,
        pfp_url: e.pfpUrl || pfpFallback,
        cast_url: e.castUrl,
        token_address: e.tokenAddress,
        task_type: 'support',
        completed_by: [],
        created_at: new Date(now + i).toISOString(),
      };
      linkSubmissions.unshift(newLink);
    }

    return { success: true, count: entries.length };
  } catch (error: any) {
    return { success: false, count: 0, error: error?.message || 'Failed to seed links' };
  }
}

// Получить последние 10 ссылок
export async function getLastTenLinks(taskType?: TaskType): Promise<LinkSubmission[]> {
  // Сортируем все ссылки по дате создания (новые первыми)
  const sortedLinks = [...linkSubmissions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
  // Фильтруем по taskType, если указан
  let filteredLinks = sortedLinks;
  if (taskType) {
    // ⚠️ ВАЖНО: Строгая фильтрация - только ссылки нужного типа, без дополнения другими типами
    filteredLinks = sortedLinks.filter(link => link.task_type === taskType);
    console.log(`🔍 [MEMORY-DB] Filtering links by task type: ${taskType} (strict filtering - no mixing)`);
    console.log(`📊 [MEMORY-DB] Total links: ${sortedLinks.length}, Filtered: ${filteredLinks.length}`);
  }
  
  // Берем первые 10 ссылок (может быть меньше 10, если нет достаточного количества)
  return filteredLinks.slice(0, 10);
}

// Получить прогресс пользователя
export async function getUserProgress(userFid: number): Promise<UserProgress | null> {
  const progress = userProgress.get(userFid);
  if (progress) {
    return progress;
  }
  
  // Создаем новый прогресс
  const newProgress: UserProgress = {
    id: `progress-${userFid}`,
    user_fid: userFid,
    completed_links: [],
    token_purchased: false,
    selected_task: undefined,
    current_link_id: undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  userProgress.set(userFid, newProgress);
  return newProgress;
}

// Создать или обновить прогресс пользователя
export async function upsertUserProgress(
  userFid: number,
  updates: Partial<UserProgress>
): Promise<UserProgress> {
  const existing = await getUserProgress(userFid);
  
  if (existing) {
    const updated = {
      ...existing,
      ...updates,
      // Сохраняем поля стрика
      current_streak: updates.current_streak !== undefined ? updates.current_streak : existing.current_streak,
      longest_streak: updates.longest_streak !== undefined ? updates.longest_streak : existing.longest_streak,
      last_fortune_claim_date: updates.last_fortune_claim_date || existing.last_fortune_claim_date,
      total_fortune_claims: updates.total_fortune_claims !== undefined ? updates.total_fortune_claims : existing.total_fortune_claims,
      updated_at: new Date().toISOString(),
    };
    userProgress.set(userFid, updated);
    return updated;
  } else {
    const newProgress: UserProgress = {
      id: `progress_${userFid}_${Date.now()}`,
      user_fid: userFid,
      completed_links: updates.completed_links || [],
      token_purchased: updates.token_purchased ?? false,
      selected_task: updates.selected_task,
      current_link_id: updates.current_link_id,
      // Fortune cookie streak fields
      current_streak: updates.current_streak ?? 0,
      longest_streak: updates.longest_streak ?? 0,
      last_fortune_claim_date: updates.last_fortune_claim_date,
      total_fortune_claims: updates.total_fortune_claims ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    userProgress.set(userFid, newProgress);
    return newProgress;
  }
}

// Добавить завершенную ссылку
export async function markLinkCompleted(userFid: number, linkId: string): Promise<void> {
  const progress = await getUserProgress(userFid);
  if (!progress) return;
  
  if (!progress.completed_links.includes(linkId)) {
    await upsertUserProgress(userFid, {
      completed_links: [...progress.completed_links, linkId],
    });
  }
}

// Установить флаг покупки токена
export async function markTokenPurchased(userFid: number, txHash?: string): Promise<void> {
  const progress = await getUserProgress(userFid);
  if (!progress) return;
  
  progress.token_purchased = true;
  
  // Сохраняем txHash если передан (для dexscreener и истории транзакций)
  if (txHash) {
    progress.token_purchase_tx_hash = txHash;
    console.log(`✅ [DB] Saving token purchase txHash ${txHash} for user ${userFid}`);
  }
  
  progress.updated_at = new Date().toISOString();
  userProgress.set(userFid, progress);
}

// Установить выбранную активность
export async function setUserActivity(userFid: number, activity: TaskType): Promise<void> {
  await upsertUserProgress(userFid, {
    selected_task: activity,
  });
}

// Опубликовать новую ссылку
export async function submitLink(
  userFid: number,
  username: string,
  pfpUrl: string,
  castUrl: string,
  taskType: TaskType,
  tokenAddress?: string
): Promise<LinkSubmission | null> {
  const newLink: LinkSubmission = {
    id: `link-${Date.now()}-${Math.random().toString(16).substr(2, 8)}`,
    user_fid: userFid,
    username,
    pfp_url: pfpUrl,
    cast_url: castUrl,
    token_address: tokenAddress,
    task_type: taskType,
    completed_by: [],
    created_at: new Date().toISOString()
  };
  
  // Добавляем ссылку в начало массива (новые первыми)
  linkSubmissions.unshift(newLink);
  
  console.log(`✅ Link published successfully (memory-db):`, {
    id: newLink.id,
    username: newLink.username,
    user_fid: newLink.user_fid,
    cast_url: newLink.cast_url,
    task_type: newLink.task_type,
    created_at: newLink.created_at,
    total_links: linkSubmissions.length,
  });
  
  // Сохранить ID в прогресс пользователя
  await upsertUserProgress(userFid, {
    current_link_id: newLink.id,
  });
  
  return newLink;
}

// Получить все ссылки для чата
export async function getAllLinks(): Promise<LinkSubmission[]> {
  return linkSubmissions
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// Удалить ссылку
export async function deleteLink(linkId: string): Promise<boolean> {
  try {
    const initialLength = linkSubmissions.length;
    const index = linkSubmissions.findIndex(link => link.id === linkId);
    
    if (index !== -1) {
      linkSubmissions.splice(index, 1);
      console.log(`✅ Link ${linkId} deleted successfully from memory DB`);
      return true;
    } else {
      console.warn(`⚠️ Link ${linkId} not found for deletion`);
      return false;
    }
  } catch (error) {
    console.error('Error deleting link from memory DB:', error);
    return false;
  }
}

// Получить общее количество ссылок
export async function getTotalLinksCount(): Promise<number> {
  return linkSubmissions.length;
}

// Подписка на изменения (заглушка для совместимости)
export function subscribeToLinks(callback: (payload: any) => void) {
  // В реальной версии здесь будет WebSocket подключение к Upstash Redis
  console.log('Subscribe to links (memory DB)');
  return {
    unsubscribe: () => console.log('Unsubscribed from links')
  };
}
