// Скрипт проверки базы данных Upstash Redis
import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Инициализация Redis клиента
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL?.trim(),
  token: process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
});

// Ключи для Redis
const KEYS = {
  LINKS: 'likechat:links',
  USER_PROGRESS: 'likechat:user_progress',
  TOTAL_LINKS_COUNT: 'likechat:total_links_count',
};

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

// 1. Проверка подключения
async function checkConnection() {
  logSection('🔌 Проверка подключения к Redis');
  
  try {
    const pong = await redis.ping();
    if (pong === 'PONG') {
      log('✅ Подключение к Redis успешно!', 'green');
      return true;
    } else {
      log('❌ Неожиданный ответ от Redis', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка подключения к Redis: ${error.message}`, 'red');
    log('Проверьте переменные окружения:', 'yellow');
    log('  - UPSTASH_REDIS_REST_URL', 'yellow');
    log('  - UPSTASH_REDIS_REST_TOKEN', 'yellow');
    return false;
  }
}

// 2. Статистика по ссылкам
async function checkLinks() {
  logSection('📋 Статистика по ссылкам');
  
  try {
    const allLinks = await redis.lrange(KEYS.LINKS, 0, -1);
    const totalLinks = allLinks.length;
    
    log(`Всего ссылок: ${totalLinks}`, 'cyan');
    
    if (totalLinks === 0) {
      log('⚠️  В базе нет ссылок', 'yellow');
      return;
    }
    
    // Парсим ссылки
    const parsedLinks = allLinks.map((linkStr) => {
      try {
        return typeof linkStr === 'string' ? JSON.parse(linkStr) : linkStr;
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
    
    // Статистика по типам активности
    const activityStats = {};
    parsedLinks.forEach((link) => {
      const activity = link.activity_type || 'unknown';
      activityStats[activity] = (activityStats[activity] || 0) + 1;
    });
    
    log('\n📊 По типам активности:', 'bright');
    Object.entries(activityStats).forEach(([activity, count]) => {
      log(`  ${activity}: ${count}`, 'cyan');
    });
    
    // Статистика по уникальным пользователям
    const uniqueUsers = new Set(parsedLinks.map((link) => link.user_fid).filter(Boolean));
    log(`\n👥 Уникальных пользователей: ${uniqueUsers.size}`, 'cyan');
    
    // Последние 5 ссылок
    log('\n📝 Последние 5 ссылок:', 'bright');
    const sortedLinks = parsedLinks
      .sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 5);
    
    sortedLinks.forEach((link, index) => {
      log(`\n${index + 1}. ID: ${link.id}`, 'cyan');
      log(`   Пользователь: @${link.username} (FID: ${link.user_fid})`, 'cyan');
      log(`   Тип: ${link.activity_type}`, 'cyan');
      log(`   Ссылка: ${link.cast_url?.substring(0, 50)}...`, 'cyan');
      log(`   Создано: ${link.created_at || 'N/A'}`, 'cyan');
      log(`   Выполнили: ${link.completed_by?.length || 0}`, 'cyan');
    });
    
    // Проверка целостности данных
    log('\n🔍 Проверка целостности данных:', 'bright');
    const invalidLinks = parsedLinks.filter((link) => {
      return !link.id || !link.cast_url || !link.user_fid;
    });
    
    if (invalidLinks.length > 0) {
      log(`⚠️  Найдено ${invalidLinks.length} ссылок с неполными данными`, 'yellow');
    } else {
      log('✅ Все ссылки имеют корректные данные', 'green');
    }
    
  } catch (error) {
    log(`❌ Ошибка при проверке ссылок: ${error.message}`, 'red');
  }
}

// 3. Статистика по пользователям
async function checkUsers() {
  logSection('👥 Статистика по пользователям');
  
  try {
    const allProgress = await redis.hgetall(KEYS.USER_PROGRESS);
    const totalUsers = Object.keys(allProgress || {}).length;
    
    log(`Всего пользователей: ${totalUsers}`, 'cyan');
    
    if (totalUsers === 0) {
      log('⚠️  В базе нет данных о пользователях', 'yellow');
      return;
    }
    
    // Парсим прогресс пользователей
    const parsedProgress = Object.entries(allProgress || {})
      .map(([fid, progressStr]) => {
        try {
          const progress = typeof progressStr === 'string' ? JSON.parse(progressStr) : progressStr;
          return { fid: parseInt(fid), ...progress };
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);
    
    // Статистика
    const usersWithCompletedLinks = parsedProgress.filter((p) => p.completed_links?.length > 0);
    const usersWithTokenPurchased = parsedProgress.filter((p) => p.token_purchased === true);
    const usersWithActivity = parsedProgress.filter((p) => p.selected_activity);
    
    log(`\n📊 Статистика:`, 'bright');
    log(`  С выполненными заданиями: ${usersWithCompletedLinks.length}`, 'cyan');
    log(`  Купили токены: ${usersWithTokenPurchased.length}`, 'cyan');
    log(`  Выбрали активность: ${usersWithActivity.length}`, 'cyan');
    
    // Статистика по типам активности
    const activityTypeStats = {};
    parsedProgress.forEach((progress) => {
      const activity = progress.selected_activity || 'none';
      activityTypeStats[activity] = (activityTypeStats[activity] || 0) + 1;
    });
    
    log('\n📊 По выбранным активностям:', 'bright');
    Object.entries(activityTypeStats).forEach(([activity, count]) => {
      log(`  ${activity}: ${count}`, 'cyan');
    });
    
    // Топ пользователей по выполненным заданиям
    log('\n🏆 Топ 5 пользователей по выполненным заданиям:', 'bright');
    const topUsers = parsedProgress
      .filter((p) => p.completed_links?.length > 0)
      .sort((a, b) => (b.completed_links?.length || 0) - (a.completed_links?.length || 0))
      .slice(0, 5);
    
    if (topUsers.length > 0) {
      topUsers.forEach((progress, index) => {
        log(`\n${index + 1}. FID: ${progress.user_fid}`, 'cyan');
        log(`   Выполнено заданий: ${progress.completed_links?.length || 0}`, 'cyan');
        log(`   Активность: ${progress.selected_activity || 'не выбрана'}`, 'cyan');
        log(`   Токены куплены: ${progress.token_purchased ? '✅' : '❌'}`, 'cyan');
        log(`   Обновлено: ${progress.updated_at || 'N/A'}`, 'cyan');
      });
    } else {
      log('  Нет пользователей с выполненными заданиями', 'yellow');
    }
    
    // Проверка целостности данных
    log('\n🔍 Проверка целостности данных:', 'bright');
    const invalidProgress = parsedProgress.filter((p) => {
      return !p.user_fid || !p.id;
    });
    
    if (invalidProgress.length > 0) {
      log(`⚠️  Найдено ${invalidProgress.length} записей с неполными данными`, 'yellow');
    } else {
      log('✅ Все записи имеют корректные данные', 'green');
    }
    
  } catch (error) {
    log(`❌ Ошибка при проверке пользователей: ${error.message}`, 'red');
  }
}

// 4. Общая статистика
async function checkGeneralStats() {
  logSection('📈 Общая статистика');
  
  try {
    const allLinks = await redis.lrange(KEYS.LINKS, 0, -1);
    const allProgress = await redis.hgetall(KEYS.USER_PROGRESS);
    
    const totalLinks = allLinks.length;
    const totalUsers = Object.keys(allProgress || {}).length;
    
    // Подсчет выполненных заданий
    const parsedProgress = Object.values(allProgress || {})
      .map((progressStr) => {
        try {
          return typeof progressStr === 'string' ? JSON.parse(progressStr) : progressStr;
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);
    
    const totalCompletedLinks = parsedProgress.reduce((sum, p) => {
      return sum + (p.completed_links?.length || 0);
    }, 0);
    
    log(`Всего ссылок: ${totalLinks}`, 'cyan');
    log(`Всего пользователей: ${totalUsers}`, 'cyan');
    log(`Всего выполнено заданий: ${totalCompletedLinks}`, 'cyan');
    
    if (totalUsers > 0) {
      const avgCompleted = (totalCompletedLinks / totalUsers).toFixed(2);
      log(`Среднее заданий на пользователя: ${avgCompleted}`, 'cyan');
    }
    
    // Проверка счетчика
    try {
      const counter = await redis.get(KEYS.TOTAL_LINKS_COUNT);
      if (counter !== null) {
        log(`\nСчетчик ссылок: ${counter}`, 'cyan');
        if (parseInt(counter) !== totalLinks) {
          log(`⚠️  Несоответствие: счетчик (${counter}) ≠ реальное количество (${totalLinks})`, 'yellow');
        }
      }
    } catch (e) {
      // Счетчик может не существовать
    }
    
  } catch (error) {
    log(`❌ Ошибка при получении общей статистики: ${error.message}`, 'red');
  }
}

// Главная функция
async function main() {
  console.clear();
  log('\n🔍 СКРИПТ ПРОВЕРКИ БАЗЫ ДАННЫХ', 'bright');
  log('='.repeat(60), 'bright');
  
  // Проверяем переменные окружения
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    log('\n❌ Переменные окружения не настроены!', 'red');
    log('Создайте файл .env с переменными:', 'yellow');
    log('  UPSTASH_REDIS_REST_URL=...', 'yellow');
    log('  UPSTASH_REDIS_REST_TOKEN=...', 'yellow');
    process.exit(1);
  }
  
  // Проверка подключения
  const connected = await checkConnection();
  if (!connected) {
    process.exit(1);
  }
  
  // Выполняем проверки
  await checkGeneralStats();
  await checkLinks();
  await checkUsers();
  
  logSection('✅ Проверка завершена');
  log('\n', 'reset');
}

// Запуск
main().catch((error) => {
  log(`\n❌ Критическая ошибка: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

