// Простая база данных в памяти для быстрого тестирования
// Позже заменим на Upstash Redis

import type { LinkSubmission, UserProgress, TaskType } from '@/types';

// In-memory storage
const linkSubmissions: LinkSubmission[] = [];
const userProgress: Map<number, UserProgress> = new Map();

// Генерируем тестовые данные для демонстрации
function generateTestData() {
  // Если база пустая, добавляем тестовые ссылки для демонстрации
  if (linkSubmissions.length === 0) {
    console.log('📝 [MEMORY-DB] Generating test data...');
    const baseLinks = [
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
    
    const taskTypes: TaskType[] = ['like', 'recast', 'comment'];
    
    // Создаем по 10 ссылок для каждого типа задачи (всего 30)
    taskTypes.forEach((taskType, typeIndex) => {
      baseLinks.forEach((castUrl, linkIndex) => {
        const index = typeIndex * baseLinks.length + linkIndex;
        linkSubmissions.push({
          id: `test-link-${taskType}-${linkIndex + 1}`,
          user_fid: 1000 + index,
          username: `user${index + 1}`,
          pfp_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=user${index + 1}`,
          cast_url: castUrl,
          task_type: taskType,
          completed_by: [],
          created_at: new Date(Date.now() - index * 60000).toISOString(),
        });
      });
    });
    
    console.log(`✅ [MEMORY-DB] Generated ${linkSubmissions.length} test links`);
  }
}

// Получить последние 10 ссылок
export async function getLastTenLinks(taskType?: TaskType): Promise<LinkSubmission[]> {
  generateTestData();
  
  // Сортируем все ссылки по дате создания (новые первыми)
  const sortedLinks = [...linkSubmissions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
  // Фильтруем по taskType, если указан
  let filteredLinks = sortedLinks;
  if (taskType) {
    filteredLinks = sortedLinks.filter(link => link.task_type === taskType);
    console.log(`🔍 [MEMORY-DB] Filtering links by task type: ${taskType}`);
    console.log(`📊 [MEMORY-DB] Total links: ${sortedLinks.length}, Filtered: ${filteredLinks.length}`);
    
    // Если после фильтрации меньше 10 ссылок, дополняем ссылками других типов
    if (filteredLinks.length < 10) {
      const otherLinks = sortedLinks
        .filter(link => link.task_type !== taskType)
        .slice(0, 10 - filteredLinks.length);
      filteredLinks = [...filteredLinks, ...otherLinks];
      console.log(`📊 [MEMORY-DB] Added ${otherLinks.length} links of other types to reach 10 total`);
    }
  }
  
  // Берем первые 10 ссылок
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
  taskType: TaskType
): Promise<LinkSubmission | null> {
  const newLink: LinkSubmission = {
    id: `link-${Date.now()}-${Math.random().toString(16).substr(2, 8)}`,
    user_fid: userFid,
    username,
    pfp_url: pfpUrl,
    cast_url: castUrl,
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
