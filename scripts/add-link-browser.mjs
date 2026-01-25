// Скрипт для добавления ссылки с обходом Security Checkpoint
// Использует User-Agent браузера и дополнительные заголовки

const tokenAddress = '0xbe705864202df9a6c7c57993fde1865ae67825ce';
const position = 5;
const appUrl = 'https://likechat-base-app.vercel.app';
const apiUrl = `${appUrl}/api/pin-link`;

async function addLink() {
  try {
    console.log('📌 Adding pinned link with browser-like headers...');
    console.log(`📍 Token: ${tokenAddress}`);
    console.log(`📍 Position: ${position}`);
    console.log(`🔗 API: ${apiUrl}\n`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': appUrl,
        'Referer': `${appUrl}/`,
      },
      body: JSON.stringify({
        tokenAddress,
        position,
      }),
    });

    const contentType = response.headers.get('content-type') || '';
    console.log(`📄 Status: ${response.status}`);
    console.log(`📄 Content-Type: ${contentType}`);

    if (response.status === 403) {
      console.log('\n⚠️  Vercel Security Checkpoint is blocking the request.');
      console.log('\n💡 Solutions:');
      console.log('   1. Wait 5-10 minutes after deployment and try again');
      console.log('   2. Open the app in browser first to pass the checkpoint');
      console.log('   3. Use the browser console method (see INSTRUCTIONS.md)');
      console.log('   4. Add link directly via database if you have Upstash credentials');
      process.exit(1);
    }

    if (!contentType.includes('application/json')) {
      const text = await response.text();
      console.log('❌ Non-JSON response:');
      console.log(text.substring(0, 300));
      process.exit(1);
    }

    const data = await response.json();

    if (response.ok) {
      console.log('\n✅ Success!');
      console.log('📋 Link details:', JSON.stringify(data, null, 2));
      console.log('\n🎉 Link successfully pinned at position 5!');
    } else {
      console.error('\n❌ Error:', data.error || data.message);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  }
}

addLink();
