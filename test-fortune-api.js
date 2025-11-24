// Тест API generate-fortune с обновлением стрика
require('dotenv').config();

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function testFortuneAPI(userFid = 12345) {
  console.log('🍪 Тестирование API generate-fortune со стриком\n');
  console.log(`📍 URL: ${BASE_URL}/api/generate-fortune`);
  console.log(`👤 User FID: ${userFid}\n`);
  
  try {
    // Тест 1: Первый клейм
    console.log('✅ Тест 1: Первый клейм');
    const response1 = await fetch(`${BASE_URL}/api/generate-fortune`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Give me today\'s fortune',
        userFid: userFid,
      }),
    });
    
    const data1 = await response1.json();
    console.log('   Ответ:', {
      fortune: data1.fortune?.substring(0, 50) + '...',
      source: data1.source,
      streak: data1.streak,
    });
    
    if (data1.streak) {
      console.log(`   ✅ Стрик обновлен: current=${data1.streak.current}, longest=${data1.streak.longest}, total=${data1.streak.total}`);
    } else {
      console.log('   ⚠️ Стрик не обновлен (возможно, userFid не передан или ошибка)');
    }
    console.log('');
    
    // Тест 2: Повторный клейм в тот же день
    console.log('✅ Тест 2: Повторный клейм сегодня');
    const response2 = await fetch(`${BASE_URL}/api/generate-fortune`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Give me today\'s fortune',
        userFid: userFid,
      }),
    });
    
    const data2 = await response2.json();
    console.log('   Ответ:', {
      fortune: data2.fortune?.substring(0, 50) + '...',
      streak: data2.streak,
    });
    
    if (data2.streak) {
      const streakSame = data2.streak.current === data1.streak?.current;
      console.log(`   ${streakSame ? '✅' : '❌'} Стрик ${streakSame ? 'не изменился' : 'изменился'} (ожидается: не измениться)`);
      console.log(`   Текущий стрик: ${data2.streak.current} (было: ${data1.streak?.current})`);
    }
    console.log('');
    
    // Тест 3: Без userFid (не должен обновлять стрик)
    console.log('✅ Тест 3: Запрос без userFid');
    const response3 = await fetch(`${BASE_URL}/api/generate-fortune`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Give me today\'s fortune',
      }),
    });
    
    const data3 = await response3.json();
    console.log('   Ответ:', {
      fortune: data3.fortune?.substring(0, 50) + '...',
      streak: data3.streak,
    });
    
    if (!data3.streak) {
      console.log('   ✅ Стрик не обновлен (ожидается, т.к. userFid не передан)');
    } else {
      console.log('   ⚠️ Стрик обновлен (неожиданно)');
    }
    console.log('');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Тестирование API завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании API:', error);
    console.log('\n💡 Убедитесь, что:');
    console.log('   1. Сервер запущен (npm run dev)');
    console.log('   2. API доступен по адресу:', BASE_URL);
    console.log('   3. Переменные окружения настроены');
  }
}

// Запускаем тест
const userFid = process.argv[2] ? parseInt(process.argv[2], 10) : 12345;
testFortuneAPI(userFid);

