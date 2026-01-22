// Универсальный скрипт для добавления закрепленной ссылки через API
// Использование: node scripts/add-pinned-link.mjs [APP_URL] [SECRET_KEY]

const tokenAddress = '0xbe705864202df9a6c7c57993fde1865ae67825ce';
const position = 5;

// Получаем URL и secretKey из аргументов или переменных окружения
const appUrl = process.argv[2] || process.env.NEXT_PUBLIC_API_URL || process.env.VERCEL_URL || 'https://likechat-base.vercel.app';
const secretKey = process.argv[3] || process.env.INIT_LINKS_SECRET_KEY || '';

// Нормализуем URL
const normalizedUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
const apiUrl = `${normalizedUrl}/api/pin-link`;

async function addPinnedLink() {
  try {
    console.log('📌 Adding pinned link...');
    console.log(`📍 Token address: ${tokenAddress}`);
    console.log(`📍 Position: ${position}`);
    console.log(`🔗 API URL: ${apiUrl}`);

    const body = {
      tokenAddress,
      position,
    };

    if (secretKey) {
      body.secretKey = secretKey;
      console.log('🔐 Using secret key for authentication');
    } else {
      console.log('⚠️  No secret key provided (API may require it)');
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Success:', data.message);
      console.log('📋 Link details:', {
        id: data.link.id,
        token_address: data.link.token_address,
        pinned: data.link.pinned,
        pinned_position: data.link.pinned_position,
        cast_url: data.link.cast_url,
      });
      console.log('\n🎉 Link successfully pinned at position 5!');
    } else {
      console.error('❌ Error:', data.error || data.message);
      if (data.message) {
        console.error('   Details:', data.message);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to add pinned link:', error.message);
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tips:');
      console.error('   1. Make sure the app is deployed and accessible');
      console.error('   2. Check that the URL is correct');
      console.error('   3. Wait a few minutes after deployment for the API to be ready');
      console.error('\n📝 Usage:');
      console.error('   node scripts/add-pinned-link.mjs [APP_URL] [SECRET_KEY]');
      console.error('   Example: node scripts/add-pinned-link.mjs https://your-app.vercel.app your-secret-key');
    }
    process.exit(1);
  }
}

addPinnedLink();
