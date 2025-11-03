// Тест подключения к Upstash Redis
const { Redis } = require('@upstash/redis');

async function testUpstashConnection() {
  console.log('🔍 Testing Upstash Redis connection...\n');

  // Проверяем переменные окружения
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.log('❌ Missing Upstash credentials!');
    console.log('📝 Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN');
    console.log('📖 See ENV_EXAMPLE.md for instructions\n');
    return false;
  }

  try {
    // Создаем клиент
    const redis = new Redis({
      url: url,
      token: token,
    });

    console.log('✅ Redis client created successfully');
    console.log(`📍 URL: ${url.substring(0, 50)}...`);

    // Тестируем простое подключение
    console.log('\n🧪 Testing basic operations...');
    
    // Ping test
    const pong = await redis.ping();
    console.log(`🏓 Ping result: ${pong}`);

    // Set/Get test
    await redis.set('test_key', 'Hello Upstash!');
    const value = await redis.get('test_key');
    console.log(`📝 Set/Get test: ${value}`);

    // Cleanup
    await redis.del('test_key');
    console.log('🧹 Cleaned up test data');

    console.log('\n✅ Upstash Redis connection successful!');
    console.log('🚀 Ready for production deployment');
    return true;

  } catch (error) {
    console.log('\n❌ Upstash Redis connection failed!');
    console.log('🔍 Error details:', error.message);
    
    if (error.message.includes('401')) {
      console.log('💡 Tip: Check your REST Token');
    } else if (error.message.includes('404')) {
      console.log('💡 Tip: Check your REST URL');
    } else if (error.message.includes('network')) {
      console.log('💡 Tip: Check your internet connection');
    }
    
    return false;
  }
}

// Запускаем тест
if (require.main === module) {
  testUpstashConnection()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { testUpstashConnection };





