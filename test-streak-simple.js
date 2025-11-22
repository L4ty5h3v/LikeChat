// Простой тест логики стрика
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

console.log('🧪 Тестирование логики стрика\n');

// Тест 1: Проверка формата дат
const now = new Date();
const todayUTC = toDateOnlyUTC(now);
const yesterdayUTC = getYesterdayUTC(now);
console.log('✅ Тест 1: Формат дат');
console.log('   Сегодня:', todayUTC);
console.log('   Вчера:', yesterdayUTC);
console.log('   Формат правильный:', /^\d{4}-\d{2}-\d{2}$/.test(todayUTC) ? '✅' : '❌');
console.log('');

// Тест 2: Сравнение последовательных дней
console.log('✅ Тест 2: Сравнение последовательных дней');
const testDate1 = new Date('2025-01-15T12:00:00.000Z');
const testDate2 = new Date('2025-01-16T12:00:00.000Z');
const date1Str = toDateOnlyUTC(testDate1);
const date2Str = toDateOnlyUTC(testDate2);
const date2Yesterday = getYesterdayUTC(testDate2);
console.log('   Дата 1:', date1Str);
console.log('   Дата 2:', date2Str);
console.log('   Вчера для даты 2:', date2Yesterday);
console.log('   Последовательные:', date1Str === date2Yesterday ? '✅' : '❌');
console.log('');

// Тест 3: Симуляция стрика
console.log('✅ Тест 3: Симуляция стрика');
let current = 0;
let longest = 0;
let lastClaimUTCDate = null;

// День 1
const day1 = new Date('2025-01-01T12:00:00.000Z');
const day1UTC = toDateOnlyUTC(day1);
if (lastClaimUTCDate === day1UTC) {
  // уже клеймили
} else {
  current = lastClaimUTCDate ? (lastClaimUTCDate === getYesterdayUTC(day1) ? current + 1 : 1) : 1;
  longest = Math.max(longest, current);
  lastClaimUTCDate = day1UTC;
}
console.log(`   День 1: current = ${current}, longest = ${longest}`);

// День 2
const day2 = new Date('2025-01-02T12:00:00.000Z');
const day2UTC = toDateOnlyUTC(day2);
const day2Yesterday = getYesterdayUTC(day2);
if (lastClaimUTCDate === day2UTC) {
  // уже клеймили
} else {
  const isConsecutive = lastClaimUTCDate === day2Yesterday;
  current = isConsecutive ? (current + 1) : 1;
  longest = Math.max(longest, current);
  lastClaimUTCDate = day2UTC;
}
console.log(`   День 2: current = ${current}, longest = ${longest} (ожидается: 2, 2)`);
console.log(`   Проверка: ${current === 2 && longest === 2 ? '✅' : '❌'}`);

// День 3
const day3 = new Date('2025-01-03T12:00:00.000Z');
const day3UTC = toDateOnlyUTC(day3);
const day3Yesterday = getYesterdayUTC(day3);
if (lastClaimUTCDate === day3UTC) {
  // уже клеймили
} else {
  const isConsecutive = lastClaimUTCDate === day3Yesterday;
  current = isConsecutive ? (current + 1) : 1;
  longest = Math.max(longest, current);
  lastClaimUTCDate = day3UTC;
}
console.log(`   День 3: current = ${current}, longest = ${longest} (ожидается: 3, 3)`);
console.log(`   Проверка: ${current === 3 && longest === 3 ? '✅' : '❌'}`);

// День 5 (пропущен день 4)
const day5 = new Date('2025-01-05T12:00:00.000Z');
const day5UTC = toDateOnlyUTC(day5);
const day5Yesterday = getYesterdayUTC(day5);
if (lastClaimUTCDate === day5UTC) {
  // уже клеймили
} else {
  const isConsecutive = lastClaimUTCDate === day5Yesterday;
  current = isConsecutive ? (current + 1) : 1;
  longest = Math.max(longest, current);
  lastClaimUTCDate = day5UTC;
}
console.log(`   День 5 (пропущен день 4): current = ${current}, longest = ${longest} (ожидается: 1, 3)`);
console.log(`   Проверка: ${current === 1 && longest === 3 ? '✅' : '❌'}`);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Тестирование завершено!');





