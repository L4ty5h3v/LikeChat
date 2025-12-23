// Простая база данных в памяти для быстрого тестирования
// Позже заменим на Upstash Redis

import type { LinkSubmission, UserProgress, TaskType } from '@/types';
import { baseAppContentUrlFromTokenAddress } from '@/lib/base-content';
import { TASKS_LIMIT } from '@/lib/app-config';

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

    // In serverless environments without Upstash, memory storage isn't shared between functions.
    // So we keep a deterministic default list that always shows up on cold start.
    const defaultTokenAddresses = [
      // User-provided tokens (Dec 2025) — keep only these (remove older defaults).
      '0x5df8fd1a995f6ebb325ce1dffa785ec6109fa19a',
      '0x6335f4352517952eb0cbdaa0d1ae756c7802d97f',
      '0x82827d9e803388ac433c6c173c274f784e1675d0',
      '0x8ab5918fc6f9a14f2671d5bd7143e5c930ace970',
      '0xa82113814b25594e6b97b7c4ee3930a16796508d',
    ] as const;

    const defaults: LinkSubmission[] = defaultTokenAddresses.map((token_address, idx) => ({
      id: `default_${now}_${idx}`,
      user_fid: 0,
      username,
      pfp_url: pfp,
      cast_url: baseAppContentUrlFromTokenAddress(token_address) || '',
      token_address,
      task_type: 'support',
      completed_by: [],
      created_at: new Date(now + idx).toISOString(),
    }));

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

export async function seedLinks(
  entries: Array<{ castUrl?: string; tokenAddress: string; username?: string; pfpUrl?: string }>
): Promise<{ success: boolean; count: number; error?: string }> {
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
        id: `seed_${now}_${i}_${Math.random().toString(16).slice(2, 8)}`,
        user_fid: 0,
        username: e.username || usernameFallback,
        pfp_url: e.pfpUrl || pfpFallback,
        cast_url: castUrl,
        token_address: tokenAddress,
        task_type: 'support',
        completed_by: [],
        created_at: new Date(now + i).toISOString(),
      };
      linkSubmissions.unshift(newLink);
    }

    // Keep queue bounded: always keep only TASKS_LIMIT newest links (per spec: exactly 5 tasks at a time).
    if (linkSubmissions.length > TASKS_LIMIT) {
      linkSubmissions.length = TASKS_LIMIT;
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

  // Keep queue bounded: always keep only TASKS_LIMIT newest links.
  if (linkSubmissions.length > TASKS_LIMIT) {
    linkSubmissions.length = TASKS_LIMIT;
  }
  
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
