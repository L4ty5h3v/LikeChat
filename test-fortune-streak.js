// Тест стрика для печенья с предсказанием
// Симулирует работу API generate-fortune с обновлением стрика

function toDateOnlyUTC(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getYesterdayUTC(now) {
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return toDateOnlyUTC(yesterday);
}

// Симуляция пользователя
let userProgress = {
  user_fid: 12345,
  current_streak: 0,
  longest_streak: 0,
  last_fortune_claim_date: null,
};

console.log('🍪 Тестирование стрика для печенья с предсказанием\n');

// Функция для обновления стрика (как в API)
function updateFortuneStreak(userProgress, testDate = null) {
  const now = testDate || new Date();
  const todayUTC = toDateOnlyUTC(now);
  const yesterdayUTC = getYesterdayUTC(now);
  
  // Если уже клеймили сегодня, не обновляем
  if (userProgress.last_fortune_claim_date === todayUTC) {
    console.log('   ⚠️ Уже получили предсказание сегодня');
    return userProgress;
  }
  
  // Проверяем, последовательный ли клейм
  const isConsecutive = userProgress.last_fortune_claim_date === yesterdayUTC;
  
  // Обновляем стрик
  if (userProgress.last_fortune_claim_date === null) {
    // Первый клейм
    userProgress.current_streak = 1;
  } else if (isConsecutive) {
    // Последовательный клейм
    userProgress.current_streak += 1;
  } else {
    // Пропущен день - сброс стрика
    userProgress.current_streak = 1;
  }
  
  // Обновляем рекорд (сохраняем максимальный)
  const previousLongest = userProgress.longest_streak;
  userProgress.longest_streak = Math.max(previousLongest, userProgress.current_streak);
  
  // Обновляем дату последнего клейма
  userProgress.last_fortune_claim_date = todayUTC;
  
  return userProgress;
}

// Тест 1: Первое предсказание
console.log('✅ Тест 1: Первое предсказание');
userProgress = updateFortuneStreak(userProgress);
console.log(`   Текущий стрик: ${userProgress.current_streak}`);
console.log(`   Рекордный стрик: ${userProgress.longest_streak}`);
console.log(`   Последний клейм: ${userProgress.last_fortune_claim_date}`);
console.log(`   Ожидается: current=1, longest=1`);
console.log(`   Результат: ${userProgress.current_streak === 1 && userProgress.longest_streak === 1 ? '✅' : '❌'}\n`);

// Тест 2: Попытка получить второе предсказание в тот же день
console.log('✅ Тест 2: Попытка получить второе предсказание сегодня');
const beforeSecond = { ...userProgress };
userProgress = updateFortuneStreak(userProgress);
console.log(`   Текущий стрик: ${userProgress.current_streak} (было: ${beforeSecond.current_streak})`);
console.log(`   Ожидается: стрик не изменился`);
console.log(`   Результат: ${userProgress.current_streak === beforeSecond.current_streak ? '✅' : '❌'}\n`);

// Симуляция следующего дня
console.log('✅ Тест 3: Получение предсказания на следующий день (последовательно)');
const testDate3 = new Date('2025-01-15T12:00:00.000Z');
const yesterday = new Date('2025-01-14T12:00:00.000Z');
userProgress.last_fortune_claim_date = toDateOnlyUTC(yesterday);
userProgress.current_streak = 1; // Сбрасываем для теста

userProgress = updateFortuneStreak(userProgress, testDate3);
console.log(`   Текущий стрик: ${userProgress.current_streak}`);
console.log(`   Рекордный стрик: ${userProgress.longest_streak}`);
console.log(`   Последний клейм: ${userProgress.last_fortune_claim_date}`);
console.log(`   Ожидается: current=2, longest=2`);
console.log(`   Результат: ${userProgress.current_streak === 2 && userProgress.longest_streak === 2 ? '✅' : '❌'}\n`);

// Симуляция пропуска дня
console.log('✅ Тест 4: Пропуск дня (клейм через день)');
const testDate4 = new Date('2025-01-15T12:00:00.000Z');
const twoDaysAgo = new Date('2025-01-13T12:00:00.000Z');
userProgress.last_fortune_claim_date = toDateOnlyUTC(twoDaysAgo);
userProgress.current_streak = 5; // Был стрик 5 дней
userProgress.longest_streak = 5; // Рекорд был 5

userProgress = updateFortuneStreak(userProgress, testDate4);
console.log(`   Текущий стрик: ${userProgress.current_streak} (было: 5)`);
console.log(`   Рекордный стрик: ${userProgress.longest_streak}`);
console.log(`   Ожидается: current=1 (сброс), longest=5 (сохраняется)`);
console.log(`   Результат: ${userProgress.current_streak === 1 && userProgress.longest_streak === 5 ? '✅' : '❌'}\n`);

// Симуляция нескольких дней подряд
console.log('✅ Тест 5: Симуляция стрика на 5 дней');
userProgress = {
  user_fid: 12345,
  current_streak: 0,
  longest_streak: 0,
  last_fortune_claim_date: null,
};

for (let day = 1; day <= 5; day++) {
  // Устанавливаем дату для каждого дня
  const testDate = new Date('2025-01-01T12:00:00.000Z');
  testDate.setUTCDate(testDate.getUTCDate() + day - 1);
  
  // Обновляем стрик с тестовой датой
  userProgress = updateFortuneStreak(userProgress, testDate);
  
  console.log(`   День ${day}: current=${userProgress.current_streak}, longest=${userProgress.longest_streak}`);
  
  const expected = day;
  console.log(`   Проверка: ${userProgress.current_streak === expected && userProgress.longest_streak === expected ? '✅' : '❌'}`);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Тестирование стрика для печенья завершено!');

