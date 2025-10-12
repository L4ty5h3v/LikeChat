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
export async function getLastTenLinks(): Promise<LinkSubmission[]> {
  generateTestData();
  return linkSubmissions
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
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
    selected_activity: undefined,
    current_link_id: undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  userProgress.set(userFid, newProgress);
  return newProgress;
}

// Создать или обновить прогресс пользователя
export async function upsertUserProgress(progress: Partial<UserProgress>): Promise<boolean> {
  if (!progress.user_fid) return false;
  
  const existing = await getUserProgress(progress.user_fid);
  if (existing) {
    Object.assign(existing, progress, { updated_at: new Date().toISOString() });
    userProgress.set(progress.user_fid, existing);
  } else {
    const newProgress: UserProgress = {
      id: `progress-${progress.user_fid}`,
      user_fid: progress.user_fid,
      completed_links: [],
      token_purchased: false,
      selected_activity: undefined,
      current_link_id: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...progress
    };
    userProgress.set(progress.user_fid, newProgress);
  }
  
  return true;
}

// Добавить завершенную ссылку
export async function markLinkCompleted(userFid: number, linkId: string): Promise<boolean> {
  const progress = await getUserProgress(userFid);
  if (!progress) return false;
  
  if (!progress.completed_links.includes(linkId)) {
    progress.completed_links.push(linkId);
    progress.updated_at = new Date().toISOString();
    userProgress.set(userFid, progress);
  }
  
  return true;
}

// Установить флаг покупки токена
export async function markTokenPurchased(userFid: number, txHash: string): Promise<boolean> {
  const progress = await getUserProgress(userFid);
  if (!progress) return false;
  
  progress.token_purchased = true;
  progress.updated_at = new Date().toISOString();
  userProgress.set(userFid, progress);
  
  return true;
}

// Установить выбранную активность
export async function setUserActivity(userFid: number, activityType: ActivityType): Promise<boolean> {
  return await upsertUserProgress({
    user_fid: userFid,
    selected_activity: activityType
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
  // Проверяем: если меньше 10 ссылок, разрешаем только первым 10 пользователям
  const totalLinks = linkSubmissions.length;
  
  if (totalLinks < 10) {
    // Получаем уникальных пользователей, которые уже добавили ссылки
    const uniqueUsers = new Set(linkSubmissions.map(link => link.user_fid));
    
    // Если этот пользователь еще не добавлял ссылку И уже есть 10 разных пользователей
    if (!uniqueUsers.has(userFid) && uniqueUsers.size >= 10) {
      throw new Error(`System is initializing. Please wait for the first 10 users to add their links. Current: ${totalLinks}/10`);
    }
  }
  
  const newLink: LinkSubmission = {
    id: `link-${Date.now()}-${Math.random().toString(16).substr(2, 8)}`,
    user_fid: userFid,
    username,
    pfp_url: pfpUrl,
    cast_url: castUrl,
    activity_type: activityType,
    completed_by: [],
    created_at: new Date().toISOString()
  };
  
  linkSubmissions.push(newLink);
  
  // Сохранить ID в прогресс пользователя
  await upsertUserProgress({
    user_fid: userFid,
    current_link_id: newLink.id
  });
  
  return newLink;
}

// Получить все ссылки для чата
export async function getAllLinks(): Promise<LinkSubmission[]> {
  generateTestData();
  return linkSubmissions
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
