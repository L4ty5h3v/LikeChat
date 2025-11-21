// Скрипт для получения информации о проекте Vercel, включая описание
require('dotenv').config({ path: '.env.local' });
const https = require('https');
const fs = require('fs');
const path = require('path');

const PROJECT_NAME = 'mini-app-third'; // Имя проекта в Vercel

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

async function getProjectInfo() {
  try {
    console.log('🔍 Получение информации о проекте Vercel...\n');
    console.log('📋 Проект:', PROJECT_NAME);
    console.log('');

    // Получаем список всех проектов
    let projects;
    try {
      projects = await makeVercelRequest('GET', '/v9/projects');
      console.log('✅ Получен список проектов');
    } catch (e) {
      throw new Error(`Не удалось получить список проектов: ${e.message}`);
    }

    // Ищем нужный проект
    const project = projects.projects?.find(p => p.name === PROJECT_NAME);
    if (!project) {
      console.log('❌ Проект не найден. Доступные проекты:');
      projects.projects?.forEach(p => console.log(`   - ${p.name}`));
      return;
    }

    console.log('✅ Проект найден!');
    console.log('\n📊 Информация о проекте:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`ID: ${project.id}`);
    console.log(`Имя: ${project.name}`);
    console.log(`Ссылка: ${project.link?.repo || 'Не подключен'}`);
    console.log(`Обновлен: ${project.updatedAt || 'N/A'}`);
    console.log(`Создан: ${project.createdAt || 'N/A'}`);
    
    // Проверяем описание проекта
    if (project.description) {
      console.log(`\n📝 Описание проекта:`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(project.description);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } else {
      console.log('\n📝 Описание проекта: (не задано)');
    }

    // Получаем переменные окружения
    try {
      const envs = await makeVercelRequest('GET', `/v9/projects/${project.id}/env`);
      console.log('\n🔑 Переменные окружения:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      if (envs.envs && envs.envs.length > 0) {
        envs.envs.forEach(env => {
          const valuePreview = env.value ? 
            (env.type === 'encrypted' ? '[зашифровано]' : env.value.substring(0, 20) + '...') : 
            '[пусто]';
          console.log(`${env.key} = ${valuePreview} (${env.target?.join(', ') || 'all'})`);
        });
      } else {
        console.log('(нет переменных)');
      }
    } catch (e) {
      console.log('\n⚠️  Не удалось получить переменные окружения:', e.message);
    }

    // Получаем последние деплои
    try {
      const deployments = await makeVercelRequest('GET', `/v13/deployments?projectId=${project.id}&limit=5`);
      console.log('\n🚀 Последние деплои:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      if (deployments.deployments && deployments.deployments.length > 0) {
        deployments.deployments.forEach((deploy, idx) => {
          console.log(`\n${idx + 1}. ${deploy.url || 'N/A'}`);
          console.log(`   Статус: ${deploy.readyState || 'N/A'}`);
          console.log(`   Создан: ${deploy.createdAt || 'N/A'}`);
          if (deploy.meta?.githubCommitMessage) {
            console.log(`   Коммит: ${deploy.meta.githubCommitMessage}`);
          }
        });
      } else {
        console.log('(нет деплоев)');
      }
    } catch (e) {
      console.log('\n⚠️  Не удалось получить деплои:', e.message);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ Готово!');

  } catch (error) {
    if (error.message.includes('VERCEL_TOKEN not found')) {
      console.error('❌ VERCEL_TOKEN не найден\n');
      console.log('📝 Инструкция:');
      console.log('   1. Откройте: https://vercel.com/account/tokens');
      console.log('   2. Создайте новый токен');
      console.log('   3. Добавьте в .env.local: VERCEL_TOKEN=your_token');
      console.log('   4. Запустите скрипт снова');
    } else {
      console.error('❌ Ошибка:', error.message);
    }
    process.exit(1);
  }
}

// Запуск
getProjectInfo().catch(error => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});

