// Скрипт для получения топ-20 пользователей по количеству клеймов предсказаний
require('dotenv').config();
const { Redis } = require('@upstash/redis');

// Инициализация Redis
const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

if (!redisUrl || !redisToken) {
  console.error('❌ Ошибка: UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN должны быть установлены в .env файле');
  process.exit(1);
}

const redis = new Redis({
  url: redisUrl,
  token: redisToken,
});

const KEYS = {
  USER_PROGRESS: 'likechat:user_progress',
};

async function getTopFortuneUsers(limit = 20) {
  try {
    console.log('🔍 Получаю данные всех пользователей...');
    
    // Получаем все записи из hash
    const allUsers = await redis.hgetall(KEYS.USER_PROGRESS);
    
    if (!allUsers || Object.keys(allUsers).length === 0) {
      console.log('⚠️ Пользователи не найдены');
      return [];
    }
    
    console.log(`📊 Найдено пользователей: ${Object.keys(allUsers).length}`);
    
    // Парсим данные и собираем информацию о клеймах
    const usersWithClaims = [];
    
    for (const [fid, progressStr] of Object.entries(allUsers)) {
      try {
        const progress = typeof progressStr === 'string' ? JSON.parse(progressStr) : progressStr;
        
        // Подсчитываем количество клеймов
        // Используем total_fortune_claims если есть, иначе current_streak как приблизительную оценку
        let claimCount = 0;
        
        if (progress.total_fortune_claims !== undefined) {
          claimCount = progress.total_fortune_claims;
        } else if (progress.current_streak !== undefined && progress.current_streak > 0) {
          // Если есть стрик, используем его как минимальную оценку
          claimCount = progress.current_streak;
        } else if (progress.last_fortune_claim_date) {
          // Если есть дата последнего клейма, считаем что был хотя бы 1 клейм
          claimCount = 1;
        }
        
        // Добавляем только пользователей с клеймами
        if (claimCount > 0) {
          usersWithClaims.push({
            fid: parseInt(fid, 10),
            username: progress.username || `user_${fid}`,
            current_streak: progress.current_streak || 0,
            longest_streak: progress.longest_streak || 0,
            last_fortune_claim_date: progress.last_fortune_claim_date || null,
            total_fortune_claims: progress.total_fortune_claims || claimCount,
            claim_count: claimCount,
            token_purchased: progress.token_purchased || false,
          });
        }
      } catch (error) {
        console.error(`⚠️ Ошибка парсинга данных для пользователя ${fid}:`, error.message);
      }
    }
    
    // Сортируем по количеству клеймов (по убыванию)
    usersWithClaims.sort((a, b) => b.claim_count - a.claim_count);
    
    // Берем топ-N
    const topUsers = usersWithClaims.slice(0, limit);
    
    return topUsers;
  } catch (error) {
    console.error('❌ Ошибка при получении топ пользователей:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🍪 Получение топ-20 пользователей по клеймам предсказаний\n');
    
    const topUsers = await getTopFortuneUsers(20);
    
    if (topUsers.length === 0) {
      console.log('⚠️ Пользователи с клеймами не найдены');
      return;
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🏆 ТОП-${topUsers.length} ПОЛЬЗОВАТЕЛЕЙ ПО КЛЕЙМАМ ПРЕДСКАЗАНИЙ`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    topUsers.forEach((user, index) => {
      console.log(`${(index + 1).toString().padStart(2, ' ')}. FID: ${user.fid.toString().padStart(6, ' ')} | Клеймов: ${user.claim_count.toString().padStart(3, ' ')} | Стрик: ${user.current_streak.toString().padStart(2, ' ')} | Рекорд: ${user.longest_streak.toString().padStart(2, ' ')} | Последний клейм: ${user.last_fortune_claim_date || 'N/A'}`);
    });
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Всего пользователей с клеймами: ${topUsers.length}`);
    console.log(`📈 Всего клеймов: ${topUsers.reduce((sum, u) => sum + u.claim_count, 0)}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Выводим в формате JSON для удобства
    console.log('\n📋 JSON формат:');
    console.log(JSON.stringify(topUsers, null, 2));
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

// Запускаем скрипт
if (require.main === module) {
  main();
}

module.exports = { getTopFortuneUsers };

