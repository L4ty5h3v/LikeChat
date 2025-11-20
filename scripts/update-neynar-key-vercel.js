// Скрипт для обновления NEYNAR_API_KEY на Vercel через API
require('dotenv').config({ path: '.env.local' });
const https = require('https');
const fs = require('fs');
const path = require('path');

const NEYNAR_API_KEY = '1F4EE142-7FBF-4BBB-83B3-9AF9E1588383';
const VAR_NAME = 'NEYNAR_API_KEY';
const PROJECT_NAME = 'likechat-farcaster';

async function makeVercelRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    // Пробуем получить токен из разных источников
    let token = process.env.VERCEL_TOKEN;
    
    // Если токена нет в .env, пробуем получить из Vercel CLI конфига
    if (!token) {
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
      reject(new Error('VERCEL_TOKEN not found'));
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
            reject(new Error(`API Error: ${res.statusCode} - ${JSON.stringify(parsed)}`));
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
    console.log('🚀 Обновление NEYNAR_API_KEY на Vercel...\n');
    console.log('📋 Проект:', PROJECT_NAME);
    console.log('🔑 Переменная:', VAR_NAME);
    console.log('📍 Значение:', NEYNAR_API_KEY.substring(0, 8) + '...\n');

    // Сначала получаем список существующих переменных
    let endpoint = `/v10/projects/${PROJECT_NAME}/env`;
    let existingEnvs;
    
    try {
      existingEnvs = await makeVercelRequest('GET', endpoint);
      console.log('✅ Получен список переменных окружения');
    } catch (e) {
      throw new Error(`Не удалось получить список переменных: ${e.message}`);
    }

    // Проверяем, существует ли уже переменная
    const existingVar = Array.isArray(existingEnvs.envs) 
      ? existingEnvs.envs.find(env => env.key === VAR_NAME)
      : null;

    if (existingVar) {
      console.log(`⚠️  Переменная ${VAR_NAME} уже существует. Обновляем...`);
      
      // Удаляем старую переменную
      try {
        await makeVercelRequest('DELETE', `${endpoint}/${existingVar.id}`);
        console.log('✅ Старая переменная удалена');
      } catch (e) {
        console.warn('⚠️  Не удалось удалить старую переменную:', e.message);
      }
    }

    // Создаем новую переменную для всех окружений
    const envData = {
      key: VAR_NAME,
      value: NEYNAR_API_KEY,
      type: 'encrypted',
      target: ['production', 'preview', 'development'],
    };

    try {
      const result = await makeVercelRequest('POST', endpoint, envData);
      console.log('✅ Переменная успешно добавлена/обновлена на Vercel!');
      console.log('\n📝 Следующие шаги:');
      console.log('   1. Перезапустите деплой в Vercel Dashboard');
      console.log('   2. Или подождите автоматического перезапуска');
      console.log('\n🔗 Vercel Dashboard: https://vercel.com/dashboard');
      return true;
    } catch (e) {
      throw new Error(`Не удалось создать переменную: ${e.message}`);
    }

  } catch (error) {
    if (error.message.includes('VERCEL_TOKEN not found')) {
      console.error('❌ VERCEL_TOKEN не найден\n');
      console.log('📝 Инструкция для ручного обновления:');
      console.log('   1. Откройте: https://vercel.com/dashboard');
      console.log('   2. Выберите проект:', PROJECT_NAME);
      console.log('   3. Перейдите в Settings → Environment Variables');
      console.log('   4. Добавьте переменную:');
      console.log(`      Name: ${VAR_NAME}`);
      console.log(`      Value: ${NEYNAR_API_KEY}`);
      console.log('   5. Отметьте все окружения: Production, Preview, Development');
      console.log('   6. Сохраните и перезапустите деплой\n');
      console.log('💡 Или получите VERCEL_TOKEN:');
      console.log('   1. Откройте: https://vercel.com/account/tokens');
      console.log('   2. Создайте новый токен');
      console.log('   3. Добавьте в .env.local: VERCEL_TOKEN=your_token');
      console.log('   4. Запустите скрипт снова');
    } else {
      console.error('❌ Ошибка:', error.message);
    }
    return false;
  }
}

// Запуск
updateVercelEnv().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});

