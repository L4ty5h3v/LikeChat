// Простая база данных в памяти для быстрого тестирования
// Позже заменим на Upstash Redis

import type { LinkSubmission, UserProgress, ActivityType } from '@/types';

// In-memory storage
const linkSubmissions: LinkSubmission[] = [];
const userProgress: Map<number, UserProgress> = new Map();

// Генерируем тестовые данные (отключено для продакшена)
function generateTestData() {
  // Начинаем с пустой системы - первые пользователи добавят свои ссылки
  // if (linkSubmissions.length === 0) {
  //   // Добавляем 10 тестовых ссылок
  //   for (let i = 1; i <= 10; i++) {
  //     linkSubmissions.push({
  //       id: `test-link-${i}`,
  //       user_fid: 1000 + i,
  //       username: `testuser${i}`,
  //       pfp_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=test${i}`,
  //       cast_url: `https://warpcast.com/testuser${i}/0x${Math.random().toString(16).substr(2, 8)}`,
  //       activity_type: ['like', 'recast', 'comment'][i % 3] as ActivityType,
  //       completed_by: [],
  //       created_at: new Date(Date.now() - i * 3600000).toISOString()
  //     });
  //   }
  // }
}

// Получить последние 10 ссылок
export async function getLastTenLinks(activityType?: ActivityType): Promise<LinkSubmission[]> {
  generateTestData();
  
  // Фильтруем по activityType, если указан
  let filteredLinks = linkSubmissions;
  if (activityType) {
    filteredLinks = linkSubmissions.filter(link => link.task_type === activityType);
    console.log(`🔍 [MEMORY-DB] Filtering links by activity type: ${activityType}`);
    console.log(`📊 [MEMORY-DB] Total links: ${linkSubmissions.length}, Filtered: ${filteredLinks.length}`);
  }
  
  // Сортируем по дате создания (новые первыми) и берем первые 10
  return filteredLinks
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);
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
export async function setUserActivity(userFid: number, activity: ActivityType): Promise<void> {
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
  activityType: ActivityType
): Promise<LinkSubmission | null> {
  const newLink: LinkSubmission = {
    id: `link-${Date.now()}-${Math.random().toString(16).substr(2, 8)}`,
    user_fid: userFid,
    username,
    pfp_url: pfpUrl,
    cast_url: castUrl,
    task_type: activityType,
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
  generateTestData();
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
  generateTestData();
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
