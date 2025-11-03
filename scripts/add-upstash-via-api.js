// Скрипт для автоматического добавления Upstash переменных
// Требует UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN

const https = require('https');
const { execSync } = require('child_process');

console.log('🔍 Проверяю наличие Upstash переменных...\n');

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  console.log('❌ Переменные UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN не найдены!');
  console.log('\n📝 Чтобы добавить их в Vercel:');
  console.log('   1. Создайте базу данных на https://console.upstash.com/');
  console.log('   2. Скопируйте REST URL и REST Token');
  console.log('   3. Добавьте их в Vercel через веб-интерфейс или используйте:\n');
  console.log('   vercel env add UPSTASH_REDIS_REST_URL production');
  console.log('   vercel env add UPSTASH_REDIS_REST_TOKEN production\n');
  process.exit(1);
}

console.log('✅ Переменные найдены!');
console.log('📊 Добавляю переменные в Vercel...\n');

try {
  // Добавляем для Production
  console.log('➕ Добавляю для Production...');
  execSync(`echo "${UPSTASH_URL}" | vercel env add UPSTASH_REDIS_REST_URL production`, { stdio: 'inherit' });
  execSync(`echo "${UPSTASH_TOKEN}" | vercel env add UPSTASH_REDIS_REST_TOKEN production`, { stdio: 'inherit' });
  
  // Добавляем для Preview
  console.log('\n➕ Добавляю для Preview...');
  execSync(`echo "${UPSTASH_URL}" | vercel env add UPSTASH_REDIS_REST_URL preview`, { stdio: 'inherit' });
  execSync(`echo "${UPSTASH_TOKEN}" | vercel env add UPSTASH_REDIS_REST_TOKEN preview`, { stdio: 'inherit' });
  
  // Добавляем для Development
  console.log('\n➕ Добавляю для Development...');
  execSync(`echo "${UPSTASH_URL}" | vercel env add UPSTASH_REDIS_REST_URL development`, { stdio: 'inherit' });
  execSync(`echo "${UPSTASH_TOKEN}" | vercel env add UPSTASH_REDIS_REST_TOKEN development`, { stdio: 'inherit' });
  
  console.log('\n✅ Все переменные добавлены!');
  console.log('🚀 Теперь запустите: vercel --prod\n');
  
} catch (error) {
  console.error('❌ Ошибка при добавлении переменных:', error.message);
  process.exit(1);
}



