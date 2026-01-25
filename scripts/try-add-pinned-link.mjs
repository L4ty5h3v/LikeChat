// Скрипт для автоматического добавления закрепленной ссылки
// Пробует несколько вариантов URL приложения

const tokenAddress = '0xbe705864202df9a6c7c57993fde1865ae67825ce';
const position = 5;

// Возможные варианты URL
const possibleUrls = [
  'https://likechat-base.vercel.app',
  'https://likechat-base-app.vercel.app',
  'https://likechatbase.vercel.app',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  process.env.NEXT_PUBLIC_API_URL,
].filter(Boolean);

async function tryAddPinnedLink(url) {
  const apiUrl = `${url}/api/pin-link`;
  
  try {
    console.log(`\n🔗 Trying: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokenAddress,
        position,
        // Не передаем secretKey - попробуем без него
      }),
      signal: AbortSignal.timeout(10000), // 10 секунд таймаут
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Success!');
      console.log('📋 Link details:', {
        id: data.link.id,
        token_address: data.link.token_address,
        pinned: data.link.pinned,
        pinned_position: data.link.pinned_position,
      });
      return true;
    } else {
      console.log(`❌ Failed: ${data.error || data.message}`);
      return false;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('⏱️  Timeout - URL not responding');
    } else if (error.code === 'ENOTFOUND') {
      console.log('🌐 Domain not found');
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
    return false;
  }
}

async function main() {
  console.log('📌 Attempting to add pinned link...');
  console.log(`📍 Token: ${tokenAddress}`);
  console.log(`📍 Position: ${position}`);
  console.log(`\n🔍 Trying ${possibleUrls.length} possible URLs...`);

  for (const url of possibleUrls) {
    const success = await tryAddPinnedLink(url);
    if (success) {
      console.log(`\n🎉 Successfully added pinned link at ${url}!`);
      process.exit(0);
    }
  }

  console.log('\n❌ Could not add pinned link automatically.');
  console.log('\n💡 Please run manually:');
  console.log('   node scripts/add-pinned-link.mjs [YOUR_APP_URL] [SECRET_KEY]');
  console.log('\n   Or call the API directly:');
  console.log('   curl -X POST https://YOUR_APP_URL.vercel.app/api/pin-link \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"tokenAddress": "0xbe705864202df9a6c7c57993fde1865ae67825ce", "position": 5}\'');
  process.exit(1);
}

main();
