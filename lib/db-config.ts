// Конфигурация базы данных - автоматический выбор между Upstash и Memory
import * as memoryDb from './memory-db';
import * as upstashDb from './upstash-db';

// Проверяем наличие переменных окружения Upstash
const USE_UPSTASH = !!(
  process.env.UPSTASH_REDIS_REST_URL && 
  process.env.UPSTASH_REDIS_REST_TOKEN
);

// Выбираем базу данных
const db = USE_UPSTASH ? upstashDb : memoryDb;

// Экспортируем все функции
// Обертка для getLastTenLinks с поддержкой фильтрации по taskType
export const getLastTenLinks = async (taskType?: import('@/types').TaskType) => {
  return db.getLastTenLinks(taskType);
};
export const getUserProgress = db.getUserProgress;
export const upsertUserProgress = db.upsertUserProgress;
export const markLinkCompleted = db.markLinkCompleted;
export const markTokenPurchased = db.markTokenPurchased;
export const setUserActivity = db.setUserActivity;
export const submitLink = db.submitLink;
export const getAllLinks = db.getAllLinks;
export const deleteLink = db.deleteLink;
export const subscribeToLinks = db.subscribeToLinks;
export const getAllUsersProgress = USE_UPSTASH ? (upstashDb as any).getAllUsersProgress : undefined;
// getTotalLinksCount - не используется, удалено для очистки кода

// Экспортируем initializeLinks только из upstash-db (если доступна)
export const initializeLinks = USE_UPSTASH ? (upstashDb as any).initializeLinks : undefined;

// Экспортируем addLinksForTaskType только из upstash-db (если доступна)
export const addLinksForTaskType = USE_UPSTASH ? (upstashDb as any).addLinksForTaskType : undefined;

// Информация о текущей базе данных
export const DB_INFO = {
  type: USE_UPSTASH ? 'upstash' : 'memory',
  persistent: USE_UPSTASH,
  realtime: false,
};

// Логирование в консоль (только на сервере)
if (typeof window === 'undefined') {
  console.log(`📊 Database: ${DB_INFO.type.toUpperCase()} (persistent: ${DB_INFO.persistent})`);
  
  if (!USE_UPSTASH) {
    console.warn('⚠️  Using IN-MEMORY database. Data will be lost on restart!');
    console.warn('⚠️  Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for production.');
  } else {
    console.log('✅ Using Upstash Redis for persistent storage');
  }
}




