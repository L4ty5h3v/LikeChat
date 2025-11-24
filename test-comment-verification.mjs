/**
 * Тестовый скрипт для проверки функции проверки комментариев
 * 
 * Использование:
 * node test-comment-verification.mjs <castUrl> <userFid>
 * 
 * Пример:
 * node test-comment-verification.mjs "https://warpcast.com/dwr/0x123..." 12345
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Загружаем переменные окружения
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env.local') });

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

if (!NEYNAR_API_KEY) {
  console.error('❌ NEYNAR_API_KEY не установлен в .env.local');
  process.exit(1);
}

// Получаем аргументы командной строки
const args = process.argv.slice(2);
const castUrl = args[0];
const userFid = parseInt(args[1]);

if (!castUrl || !userFid) {
  console.log('📝 Использование: node test-comment-verification.mjs <castUrl> <userFid>');
  console.log('');
  console.log('Пример:');
  console.log('  node test-comment-verification.mjs "https://warpcast.com/dwr/0x123..." 12345');
  process.exit(1);
}

console.log('🧪 Тестирование проверки комментариев');
console.log('=====================================');
console.log(`Cast URL: ${castUrl}`);
console.log(`User FID: ${userFid}`);
console.log('');

// Функция для получения полного hash из URL
async function getFullCastHash(shortUrl) {
  if (!shortUrl) return null;

  // Если уже полный хеш 0x... (64 символа)
  const fullHashMatch = shortUrl.match(/^0x[a-fA-F0-9]{64}$/);
  if (fullHashMatch) {
    console.log('[getFullCastHash] Уже полный hash:', shortUrl);
    return shortUrl.toLowerCase();
  }

  // Проверяем, есть ли полный хеш внутри URL
  const hashInUrl = shortUrl.match(/0x[a-fA-F0-9]{64}/);
  if (hashInUrl) {
    console.log('[getFullCastHash] Найден hash в URL:', hashInUrl[0]);
    return hashInUrl[0].toLowerCase();
  }

  // Если это URL - используем resolveCastUrl
  const isUrl = shortUrl.includes('farcaster.xyz') || shortUrl.includes('http') || shortUrl.includes('warpcast.com');
  if (isUrl) {
    try {
      const normalized = shortUrl.startsWith('http') ? shortUrl : `https://${shortUrl}`;
      console.log('[getFullCastHash] Разрешаем URL через API:', normalized);
      
      const castUrl = `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(normalized)}&type=url`;
      const res = await fetch(castUrl, { 
        headers: { "api_key": NEYNAR_API_KEY } 
      });
      
      if (res.ok) {
        const data = await res.json();
        const cast = data?.cast || data?.result?.cast;
        if (cast?.hash) {
          console.log('[getFullCastHash] ✅ Разрешен hash:', cast.hash);
          return cast.hash.toLowerCase();
        }
      }
    } catch (e) {
      console.error('[getFullCastHash] Ошибка:', e.message);
    }
  }

  return null;
}

// Функция проверки комментариев (копия из lib/neynar.ts)
async function checkUserCommented(fullHash, userFid) {
  if (!NEYNAR_API_KEY) return false;
  
  console.log('[checkUserCommented] Начало проверки', { fullHash, userFid, hashLength: fullHash.length });
  
  // Метод 1: Проверка через cast endpoint с replies
  try {
    const castUrl = `https://api.neynar.com/v2/farcaster/cast?identifier=${fullHash}&type=hash`;
    console.log('[checkUserCommented] Метод 1 - проверка cast с replies', castUrl);
    const res = await fetch(castUrl, { headers: { "api_key": NEYNAR_API_KEY } });
    
    if (res.ok) {
      const data = await res.json();
      const cast = data?.cast || data?.result?.cast;
      
      if (cast) {
        const replies = cast.replies?.casts || cast.replies || cast.direct_replies || [];
        console.log('[checkUserCommented] Метод 1 - найдено replies в cast', {
          repliesCount: replies.length,
          repliesKeys: Object.keys(cast.replies || {}),
          hasDirectReplies: !!cast.direct_replies,
          castKeys: Object.keys(cast).filter(k => k.toLowerCase().includes('reply') || k.toLowerCase().includes('thread'))
        });
        
        const threadReplies = cast.thread?.casts || [];
        const allReplies = [...replies, ...threadReplies];
        
        console.log('[checkUserCommented] Всего replies для проверки:', allReplies.length);
        
        const hasReply = allReplies.some((r, index) => {
          const authorFid = r.author?.fid || r.fid || r.author_fid;
          const match = Number(authorFid) === Number(userFid);
          console.log(`[checkUserCommented] Reply ${index + 1}:`, {
            authorFid,
            userFid,
            match,
            replyHash: r.hash,
            replyText: r.text?.substring(0, 50)
          });
          return match;
        });
        
        if (hasReply) {
          console.log('[checkUserCommented] ✅ Найдено через cast.replies', { fullHash, userFid });
          return true;
        }
      }
    } else {
      const errorText = await res.text().catch(() => '');
      console.warn('[checkUserCommented] Метод 1 - ошибка API', res.status, res.statusText, errorText.substring(0, 200));
    }
  } catch (e) {
    console.warn('[checkUserCommented] Метод 1 - ошибка', e?.message);
  }
  
  // Метод 2: Проверка через replies endpoint
  try {
    const repliesUrl = `https://api.neynar.com/v2/farcaster/cast/replies?identifier=${fullHash}&type=hash`;
    console.log('[checkUserCommented] Метод 2 - проверка replies endpoint', repliesUrl);
    const res = await fetch(repliesUrl, { headers: { "api_key": NEYNAR_API_KEY } });
    
    if (res.ok) {
      const data = await res.json();
      const replies = data?.result?.replies || data?.replies || data?.result?.casts || data?.casts || [];
      console.log('[checkUserCommented] Метод 2 - найдено replies', replies.length);
      
      const hasReply = replies.some((r, index) => {
        const authorFid = r.author?.fid || r.fid || r.author_fid;
        const match = Number(authorFid) === Number(userFid);
        console.log(`[checkUserCommented] Reply ${index + 1}:`, {
          authorFid,
          userFid,
          match,
          replyHash: r.hash,
          replyText: r.text?.substring(0, 50)
        });
        return match;
      });
      
      if (hasReply) {
        console.log('[checkUserCommented] ✅ Найдено через replies endpoint', { fullHash, userFid });
        return true;
      }
    } else {
      console.warn('[checkUserCommented] Метод 2 - ошибка API', res.status, res.statusText);
    }
  } catch (e) {
    console.warn('[checkUserCommented] Метод 2 - ошибка', e?.message);
  }
  
  // Метод 3: Проверка через parent_hash
  try {
    const url = `https://api.neynar.com/v2/farcaster/casts?parent_hash=${fullHash}&limit=100`;
    console.log('[checkUserCommented] Метод 3 - проверка parent_hash', url);
    const res = await fetch(url, { headers: { "api_key": NEYNAR_API_KEY } });
    
    if (res.ok) {
      const data = await res.json();
      const casts = data?.result?.casts || data?.casts || [];
      console.log('[checkUserCommented] Метод 3 - найдено casts с parent_hash', casts.length);
      
      const hasComment = casts.some((c, index) => {
        const authorFid = c.author?.fid || c.fid || c.author_fid;
        const match = Number(authorFid) === Number(userFid);
        console.log(`[checkUserCommented] Comment ${index + 1}:`, {
          authorFid,
          userFid,
          match,
          commentHash: c.hash,
          parentHash: c.parent_hash,
          commentText: c.text?.substring(0, 50)
        });
        return match;
      });
      
      if (hasComment) {
        console.log('[checkUserCommented] ✅ Найдено через parent_hash', { fullHash, userFid });
        return true;
      }
    } else {
      console.warn('[checkUserCommented] Метод 3 - ошибка API', res.status, res.statusText);
    }
  } catch (e) {
    console.warn('[checkUserCommented] Метод 3 - ошибка', e?.message);
  }
  
  // Метод 4: Проверка через user/casts
  try {
    const userCastsUrl = `https://api.neynar.com/v2/farcaster/user/casts?fid=${userFid}&limit=200`;
    console.log('[checkUserCommented] Метод 4 - проверка user casts', userCastsUrl);
    const res = await fetch(userCastsUrl, { headers: { "api_key": NEYNAR_API_KEY } });
    
    if (res.ok) {
      const data = await res.json();
      const casts = data?.result?.casts || data?.casts || [];
      console.log('[checkUserCommented] Метод 4 - найдено user casts', casts.length);
      
      const hasComment = casts.some((c, index) => {
        const parentHash = c.parent_hash || c.parent?.hash || c.parent_author?.hash;
        const match = parentHash && parentHash.toLowerCase() === fullHash.toLowerCase();
        if (match || index < 5) {
          console.log(`[checkUserCommented] User cast ${index + 1}:`, {
            castHash: c.hash,
            parentHash,
            fullHash,
            match,
            castText: c.text?.substring(0, 50)
          });
        }
        return match;
      });
      
      if (hasComment) {
        console.log('[checkUserCommented] ✅ Найдено через user/casts', { fullHash, userFid });
        return true;
      }
    } else {
      console.warn('[checkUserCommented] Метод 4 - ошибка API', res.status, res.statusText);
    }
  } catch (e) {
    console.warn('[checkUserCommented] Метод 4 - ошибка', e?.message);
  }
  
  console.log('[checkUserCommented] ❌ Комментарий не найден после всех методов', { fullHash, userFid });
  return false;
}

// Основная функция тестирования
async function testCommentVerification() {
  console.log('🔍 Шаг 1: Получение hash из URL...\n');
  const fullHash = await getFullCastHash(castUrl);
  
  if (!fullHash) {
    console.error('❌ Не удалось получить hash из URL:', castUrl);
    process.exit(1);
  }
  
  console.log(`✅ Hash получен: ${fullHash}\n`);
  console.log('🔍 Шаг 2: Проверка комментариев...\n');
  
  const result = await checkUserCommented(fullHash, userFid);
  
  console.log('\n=====================================');
  console.log('📊 РЕЗУЛЬТАТ:');
  console.log('=====================================');
  console.log(`Cast URL: ${castUrl}`);
  console.log(`Hash: ${fullHash}`);
  console.log(`User FID: ${userFid}`);
  console.log(`Комментарий найден: ${result ? '✅ ДА' : '❌ НЕТ'}`);
  console.log('');
  
  if (result) {
    console.log('✅ Тест пройден! Комментарий успешно найден.');
    process.exit(0);
  } else {
    console.log('❌ Тест не пройден! Комментарий не найден.');
    console.log('');
    console.log('💡 Возможные причины:');
    console.log('  1. Пользователь действительно не оставил комментарий');
    console.log('  2. Комментарий был удален');
    console.log('  3. Проблема с API Neynar');
    console.log('  4. Неправильный hash или FID');
    process.exit(1);
  }
}

// Запускаем тест
testCommentVerification().catch(error => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});

