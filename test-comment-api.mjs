/**
 * Упрощенный тест проверки комментариев через API приложения
 * 
 * Использование:
 * node test-comment-api.mjs <castUrl> <userFid>
 * 
 * Пример:
 * node test-comment-api.mjs "https://warpcast.com/dwr/0x123..." 12345
 */

const args = process.argv.slice(2);
const castUrl = args[0];
const userFid = parseInt(args[1]);
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

if (!castUrl || !userFid) {
  console.log('📝 Использование: node test-comment-api.mjs <castUrl> <userFid>');
  console.log('');
  console.log('Пример:');
  console.log('  node test-comment-api.mjs "https://warpcast.com/dwr/0x123..." 12345');
  console.log('');
  console.log('Переменные окружения:');
  console.log('  NEXT_PUBLIC_BASE_URL - URL приложения (по умолчанию: http://localhost:3000)');
  process.exit(1);
}

async function testCommentViaAPI() {
  console.log('🧪 Тестирование проверки комментариев через API');
  console.log('================================================');
  console.log(`API URL: ${baseUrl}/api/verify-activity`);
  console.log(`Cast URL: ${castUrl}`);
  console.log(`User FID: ${userFid}`);
  console.log(`Activity Type: comment`);
  console.log('');

  try {
    console.log('📤 Отправка запроса к API...\n');
    
    const response = await fetch(`${baseUrl}/api/verify-activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        castUrl: castUrl,
        userFid: userFid,
        activityType: 'comment',
      }),
    });

    const data = await response.json();

    console.log('📥 Ответ от API:');
    console.log('================================================');
    console.log(JSON.stringify(data, null, 2));
    console.log('');

    if (data.success && data.completed) {
      console.log('✅ ТЕСТ ПРОЙДЕН!');
      console.log('Комментарий успешно найден через API.');
      console.log(`Hash: ${data.castHash || 'не указан'}`);
      process.exit(0);
    } else if (data.success && !data.completed) {
      console.log('❌ ТЕСТ НЕ ПРОЙДЕН');
      console.log('Комментарий не найден.');
      console.log('');
      console.log('💡 Возможные причины:');
      console.log('  1. Пользователь действительно не оставил комментарий');
      console.log('  2. Комментарий был удален');
      console.log('  3. Проблема с API Neynar');
      console.log('  4. Неправильный hash или FID');
      if (data.error) {
        console.log(`  5. Ошибка: ${data.error}`);
      }
      process.exit(1);
    } else {
      console.log('❌ ОШИБКА API');
      console.log(`Ошибка: ${data.error || data.message || 'Неизвестная ошибка'}`);
      if (data.neynarExplorerUrl) {
        console.log(`Проверьте каст: ${data.neynarExplorerUrl}`);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
    console.error('');
    console.error('💡 Проверьте:');
    console.error('  1. Запущено ли приложение? (npm run dev)');
    console.error(`  2. Правильный ли URL? (${baseUrl})`);
    console.error('  3. Настроен ли NEYNAR_API_KEY в .env.local?');
    process.exit(1);
  }
}

testCommentViaAPI();

