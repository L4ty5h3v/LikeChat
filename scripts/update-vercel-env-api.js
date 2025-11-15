// Скрипт для автоматического обновления переменных окружения на Vercel через API
require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');

const CONTRACT_ADDRESS = '0x3FD7a1D5C9C3163E873Df212006cB81D7178f3b4';
const VAR_NAME = 'NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS';
const PROJECT_NAME = 'likechat-farcaster';

async function makeVercelRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    // Пробуем получить токен из разных источников
    let token = process.env.VERCEL_TOKEN;
    
    // Если токена нет в .env, пробуем получить из Vercel CLI конфига
    if (!token) {
      const vercelConfigPath = path.join(__dirname, '..', '.vercel', 'project.json');
      if (fs.existsSync(vercelConfigPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
          // Токен обычно хранится в другом месте, но попробуем
        } catch (e) {}
      }
    }
    
    if (!token) {
      // Пробуем получить из глобального конфига Vercel
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      const vercelAuthPath = path.join(homeDir, '.vercel', 'auth.json');
      if (fs.existsSync(vercelAuthPath)) {
        try {
          const auth = JSON.parse(fs.readFileSync(vercelAuthPath, 'utf8'));
          token = auth.token;
        } catch (e) {}
      }
    }
    
    if (!token) {
      reject(new Error('VERCEL_TOKEN not found. Please add it to .env file or run: vercel login'));
      return;
    }
    
    const options = {
      hostname: 'api.vercel.com',
      port: 443,
      path: endpoint,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    
    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`API Error: ${res.statusCode} - ${body}`));
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`API Error: ${res.statusCode} - ${body}`));
          }
        }
      });
    });
    
    req.on('error', (e) => {
      reject(e);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function updateVercelEnv() {
  try {
    console.log('🚀 Updating Vercel environment variables...\n');
    console.log('📋 Project:', PROJECT_NAME);
    console.log('🔑 Variable:', VAR_NAME);
    console.log('📍 Value:', CONTRACT_ADDRESS);
    console.log('');
    
    // Сначала получаем информацию о проекте
    let projectId;
    try {
      const projects = await makeVercelRequest('GET', '/v9/projects');
      const project = projects.projects?.find(p => p.name === PROJECT_NAME);
      if (project) {
        projectId = project.id;
        console.log('✅ Project found:', projectId);
      } else {
        throw new Error('Project not found');
      }
    } catch (error) {
      console.error('❌ Error getting project:', error.message);
      console.log('\n💡 Trying alternative method...');
      
      // Пробуем получить projectId из .vercel/project.json
      const vercelConfigPath = path.join(__dirname, '..', '.vercel', 'project.json');
      if (fs.existsSync(vercelConfigPath)) {
        const config = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
        projectId = config.projectId;
        console.log('✅ Using project ID from config:', projectId);
      } else {
        throw new Error('Cannot find project. Please run: vercel link');
      }
    }
    
    // Удаляем старую переменную, если существует
    try {
      const envs = await makeVercelRequest('GET', `/v9/projects/${projectId}/env`);
      const existingEnv = envs.envs?.find(e => e.key === VAR_NAME);
      if (existingEnv) {
        console.log('🗑️  Removing existing variable...');
        await makeVercelRequest('DELETE', `/v9/projects/${projectId}/env/${existingEnv.id}`);
        console.log('✅ Old variable removed');
      }
    } catch (error) {
      // Игнорируем ошибки при удалении
    }
    
    // Добавляем переменную для всех окружений
    const environments = ['production', 'preview', 'development'];
    
    for (const env of environments) {
      try {
        console.log(`📝 Adding variable for ${env}...`);
        await makeVercelRequest('POST', `/v9/projects/${projectId}/env`, {
          key: VAR_NAME,
          value: CONTRACT_ADDRESS,
          type: 'encrypted',
          target: [env],
        });
        console.log(`✅ Variable added for ${env}`);
      } catch (error) {
        console.error(`❌ Error adding variable for ${env}:`, error.message);
      }
    }
    
    console.log('\n🎉 Environment variables updated successfully!');
    console.log('📝 Next: Vercel will automatically redeploy with new variables');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n💡 Alternative: Update manually in Vercel dashboard');
    console.log('   https://vercel.com/dashboard');
    console.log('\n📝 Or get Vercel token:');
    console.log('   1. Go to: https://vercel.com/account/tokens');
    console.log('   2. Create new token');
    console.log('   3. Add to .env: VERCEL_TOKEN=your_token');
    process.exit(1);
  }
}

updateVercelEnv();




