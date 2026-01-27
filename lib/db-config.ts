// Конфигурация базы данных - автоматический выбор между Upstash и Memory
import * as memoryDb from './memory-db';
import * as upstashDb from './upstash-db';

function readEnvTrimmed(key: string): string | undefined {
  const v = process.env[key];
  if (!v) return undefined;
  let t = v.trim();
  // Vercel env values are sometimes pasted with wrapping quotes; strip them to avoid WRONGPASS/NOPERM confusion.
  if (
    (t.startsWith('"') && t.endsWith('"') && t.length >= 2) ||
    (t.startsWith("'") && t.endsWith("'") && t.length >= 2)
  ) {
    t = t.slice(1, -1).trim();
  }
  return t ? t : undefined;
}

// Support both "direct Upstash" env vars and Vercel KV (Upstash) integration env vars.
// Vercel KV typically exposes: KV_REST_API_URL, KV_REST_API_TOKEN.
const UPSTASH_URL =
  readEnvTrimmed('UPSTASH_REDIS_REST_URL') ||
  readEnvTrimmed('KV_REST_API_URL') ||
  // Some Vercel Storage integrations allow a custom prefix; support the common "STORAGE_*" shape.
  readEnvTrimmed('STORAGE_REST_API_URL');
const UPSTASH_TOKEN =
  readEnvTrimmed('UPSTASH_REDIS_REST_TOKEN') ||
  readEnvTrimmed('KV_REST_API_TOKEN') ||
  readEnvTrimmed('KV_REST_API_READ_ONLY_TOKEN') ||
  readEnvTrimmed('STORAGE_REST_API_TOKEN') ||
  readEnvTrimmed('STORAGE_REST_API_READ_ONLY_TOKEN');

// Проверяем наличие переменных окружения Upstash (или Vercel KV)
const USE_UPSTASH = !!(UPSTASH_URL && UPSTASH_TOKEN);

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
export const clearAllLinks = (db as any).clearAllLinks as undefined | (() => Promise<number>);
export const seedLinks = (db as any).seedLinks as
  | undefined
  | ((
      entries: Array<{ castUrl?: string; tokenAddress: string; username?: string; pfpUrl?: string }>
    ) => Promise<{ success: boolean; count: number; error?: string }>);
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
  // Debug flags (safe to expose): help diagnose missing Vercel env vars without leaking secrets.
  hasUpstashUrl: !!UPSTASH_URL,
  hasUpstashToken: !!UPSTASH_TOKEN,
  upstashUrlSource: readEnvTrimmed('UPSTASH_REDIS_REST_URL')
    ? 'UPSTASH_REDIS_REST_URL'
    : readEnvTrimmed('KV_REST_API_URL')
      ? 'KV_REST_API_URL'
      : readEnvTrimmed('STORAGE_REST_API_URL')
        ? 'STORAGE_REST_API_URL'
      : 'none',
  upstashTokenSource: readEnvTrimmed('UPSTASH_REDIS_REST_TOKEN')
    ? 'UPSTASH_REDIS_REST_TOKEN'
    : readEnvTrimmed('KV_REST_API_TOKEN')
      ? 'KV_REST_API_TOKEN'
      : readEnvTrimmed('KV_REST_API_READ_ONLY_TOKEN')
        ? 'KV_REST_API_READ_ONLY_TOKEN'
        : readEnvTrimmed('STORAGE_REST_API_TOKEN')
          ? 'STORAGE_REST_API_TOKEN'
          : readEnvTrimmed('STORAGE_REST_API_READ_ONLY_TOKEN')
            ? 'STORAGE_REST_API_READ_ONLY_TOKEN'
        : 'none',
  vercelEnv: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
};

// Логирование в консоль (только на сервере)
if (typeof window === 'undefined') {
  console.log(`📊 Database: ${DB_INFO.type.toUpperCase()} (persistent: ${DB_INFO.persistent})`);
  
  if (!USE_UPSTASH) {
    console.warn('⚠️  Using IN-MEMORY database. Data will be lost on restart!');
    console.warn('⚠️  Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or Vercel KV vars KV_REST_API_URL/KV_REST_API_TOKEN) for production.');
  } else {
    console.log('✅ Using Upstash Redis for persistent storage');
  }
}




