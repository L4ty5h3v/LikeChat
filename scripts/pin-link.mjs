// Скрипт для добавления закрепленной ссылки
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const tokenAddress = '0xbe705864202df9a6c7c57993fde1865ae67825ce';
const position = 5;
const secretKey = process.env.INIT_LINKS_SECRET_KEY || '';
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function pinLink() {
  try {
    console.log(`📌 Adding pinned link at position ${position}...`);
    console.log(`📍 Token address: ${tokenAddress}`);
    console.log(`🔗 API URL: ${apiUrl}/api/pin-link`);

    const response = await fetch(`${apiUrl}/api/pin-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokenAddress,
        position,
        secretKey,
      }),
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
    } else {
      console.error('❌ Error:', data.error || data.message);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to pin link:', error.message);
    process.exit(1);
  }
}

pinLink();
