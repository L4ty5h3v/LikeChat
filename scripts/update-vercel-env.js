// Скрипт для обновления переменных окружения на Vercel
require('dotenv').config();
const https = require('https');

const CONTRACT_ADDRESS = '0x3FD7a1D5C9C3163E873Df212006cB81D7178f3b4';
const VAR_NAME = 'NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS';

async function updateVercelEnv() {
  try {
    console.log('🚀 Updating Vercel environment variables...\n');
    
    // Проверяем наличие VERCEL_TOKEN
    const token = process.env.VERCEL_TOKEN;
    if (!token) {
      console.error('❌ Error: VERCEL_TOKEN environment variable is not set');
      console.log('\n📝 To update Vercel env:');
      console.log('1. Get your Vercel token from: https://vercel.com/account/tokens');
      console.log('2. Add to .env: VERCEL_TOKEN=your_token_here');
      console.log('3. Run: node scripts/update-vercel-env.js');
      console.log('\n💡 Alternative: Update manually in Vercel dashboard');
      console.log('   https://vercel.com/your-project/settings/environment-variables');
      return;
    }

    // Получаем информацию о проекте
    const projectName = process.env.VERCEL_PROJECT_NAME || 'likechat-farcaster';
    const teamId = process.env.VERCEL_TEAM_ID || null;
    
    console.log('📋 Project:', projectName);
    console.log('📍 Contract address:', CONTRACT_ADDRESS);
    console.log('🔑 Variable name:', VAR_NAME);
    
    // Формируем URL для API
    let url = `https://api.vercel.com/v10/projects/${projectName}/env`;
    if (teamId) {
      url += `?teamId=${teamId}`;
    }
    
    console.log('\n⚠️  Note: This script requires Vercel API access.');
    console.log('   For easier setup, use Vercel dashboard:');
    console.log('   https://vercel.com/dashboard');
    console.log('\n📝 Manual steps:');
    console.log('1. Go to: https://vercel.com/your-project/settings/environment-variables');
    console.log('2. Add variable:', VAR_NAME);
    console.log('3. Set value:', CONTRACT_ADDRESS);
    console.log('4. Select environments: Production, Preview, Development');
    console.log('5. Save and redeploy');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

updateVercelEnv();


