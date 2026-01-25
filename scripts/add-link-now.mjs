// Скрипт для добавления закрепленной ссылки
const tokenAddress = '0xbe705864202df9a6c7c57993fde1865ae67825ce';
const position = 5;
const appUrl = 'https://likechat-base-app.vercel.app';
const apiUrl = `${appUrl}/api/pin-link`;

async function addLink() {
  try {
    console.log('📌 Adding pinned link...');
    console.log(`📍 Token: ${tokenAddress}`);
    console.log(`📍 Position: ${position}`);
    console.log(`🔗 API: ${apiUrl}\n`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokenAddress,
        position,
      }),
    });

    // Проверяем тип ответа
    const contentType = response.headers.get('content-type');
    console.log(`📄 Response status: ${response.status}`);
    console.log(`📄 Content-Type: ${contentType}`);

    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.log('❌ API returned non-JSON response:');
      console.log(text.substring(0, 500));
      console.log('\n💡 This might mean:');
      console.log('   1. API endpoint is not deployed yet');
      console.log('   2. There is an error in the API');
      console.log('   3. The route is not found');
      process.exit(1);
    }

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Success!');
      console.log('📋 Link details:', JSON.stringify(data, null, 2));
      console.log('\n🎉 Link successfully pinned at position 5!');
    } else {
      console.error('❌ Error:', data.error || data.message);
      if (data.message) {
        console.error('   Details:', data.message);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed:', error.message);
    if (error.cause) {
      console.error('   Cause:', error.cause);
    }
    process.exit(1);
  }
}

addLink();
