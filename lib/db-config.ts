// Конфигурация базы данных - автоматический выбор между Upstash и Memory
import * as memoryDb from './memory-db';

// Проверяем наличие переменных окружения Upstash
const USE_UPSTASH = !!(
  process.env.UPSTASH_REDIS_REST_URL && 
  process.env.UPSTASH_REDIS_REST_TOKEN
);

// Динамический импорт Upstash (только если доступен)
let upstashDb: any = null;

if (USE_UPSTASH) {
  try {
    upstashDb = require('./upstash-db');
  } catch (error) {
    console.warn('Failed to load Upstash Redis:', error);
  }
}

// Выбираем базу данных
const db = USE_UPSTASH && upstashDb ? upstashDb : memoryDb;

// Экспортируем все функции
export const getLastTenLinks = db.getLastTenLinks;
export const getUserProgress = db.getUserProgress;
export const upsertUserProgress = db.upsertUserProgress;
export const markLinkCompleted = db.markLinkCompleted;
export const markTokenPurchased = db.markTokenPurchased;
export const setUserActivity = db.setUserActivity;
export const submitLink = db.submitLink;
export const getAllLinks = db.getAllLinks;
export const getTotalLinksCount = db.getTotalLinksCount;
export const subscribeToLinks = db.subscribeToLinks;

// Информация о текущей базе данных
export const DB_INFO = {
  type: USE_UPSTASH && upstashDb ? 'upstash' : 'memory',
  persistent: USE_UPSTASH && upstashDb,
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
