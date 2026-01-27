// Скрипт для закрепления существующей ссылки
const tokenAddress = '0xbe705864202df9a6c7c57993fde1865ae67825ce';
const position = 5;
const appUrl = 'https://likechat-base-app.vercel.app';
const apiUrl = `${appUrl}/api/pin-link`;

async function pinLink() {
  try {
    console.log('📌 Закрепляю ссылку...');
    console.log(`📍 Token: ${tokenAddress}`);
    console.log(`📍 Position: ${position}`);
    console.log(`🔗 API: ${apiUrl}\n`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
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

    if (response.status === 403) {
      console.log('\n⚠️  Vercel Security Checkpoint блокирует запрос.');
      console.log('💡 Нужно выполнить команду через браузер (см. ЗАКРЕПИТЬ_ССЫЛКУ.txt)');
      process.exit(1);
    }

    if (!contentType.includes('application/json')) {
      const text = await response.text();
      console.log('❌ Non-JSON response:', text.substring(0, 200));
      process.exit(1);
    }

    const data = await response.json();

    if (response.ok) {
      console.log('\n✅ Успешно!');
      console.log('📋 Детали:', JSON.stringify(data, null, 2));
      console.log('\n🎉 Ссылка закреплена на 5-й позиции!');
    } else {
      console.error('\n❌ Ошибка:', data.error || data.message);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    process.exit(1);
  }
}

pinLink();
