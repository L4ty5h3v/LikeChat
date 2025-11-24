/**
 * Тестовый скрипт для проверки верификации комментариев
 * 
 * Использование:
 * node test-comment-verification.js <cast_url> <user_fid>
 * 
 * Пример:
 * node test-comment-verification.js "https://warpcast.com/username/0x123" 12345
 */

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

if (!NEYNAR_API_KEY) {
  console.error('❌ NEYNAR_API_KEY не установлен в переменных окружения');
  process.exit(1);
}

const castUrl = process.argv[2];
const userFid = parseInt(process.argv[3]);

if (!castUrl || !userFid) {
  console.error('❌ Использование: node test-comment-verification.js <cast_url> <user_fid>');
  process.exit(1);
}

console.log('🔍 Тестирование проверки комментариев');
console.log('Cast URL:', castUrl);
console.log('User FID:', userFid);
console.log('---\n');

// Функция для получения hash из URL
async function getFullCastHash(url) {
  try {
    // Извлекаем hash из URL
    const hashMatch = url.match(/0x[a-fA-F0-9]+/);
    if (hashMatch) {
      return hashMatch[0];
    }
    
    // Если hash не найден в URL, пробуем через Neynar API
    const encodedUrl = encodeURIComponent(url);
    const res = await fetch(`https://api.neynar.com/v2/farcaster/cast?identifier=${encodedUrl}&type=url`, {
      headers: { "api_key": NEYNAR_API_KEY }
    });
    
    if (res.ok) {
      const data = await res.json();
      const cast = data?.cast || data?.result?.cast;
      return cast?.hash || cast?.hash_v1 || null;
    }
    
    return null;
  } catch (e) {
    console.error('Ошибка при получении hash:', e.message);
    return null;
  }
}

// Функция проверки комментариев (копия из lib/neynar.ts)
async function checkUserCommented(fullHash, userFid) {
  if (!NEYNAR_API_KEY) return false;
  
  // Нормализуем hash (убираем 0x если есть, для единообразия)
  const normalizedHash = fullHash.startsWith('0x') ? fullHash.slice(2) : fullHash;
  const hashWith0x = fullHash.startsWith('0x') ? fullHash : `0x${fullHash}`;
  
  console.log("[TEST] checkUserCommented: starting verification", { 
    fullHash, 
    normalizedHash, 
    hashWith0x,
    userFid, 
    hashLength: fullHash.length 
  });
  
  let found = false;
  
  // Метод 1: Проверка через cast endpoint с replies
  try {
    const castUrl = `https://api.neynar.com/v2/farcaster/cast?identifier=${fullHash}&type=hash`;
    console.log("\n[TEST] Method 1 - checking cast with replies");
    const res = await fetch(castUrl, { headers: { "api_key": NEYNAR_API_KEY } });
    
    if (res.ok) {
      const data = await res.json();
      const cast = data?.cast || data?.result?.cast;
      
      if (cast) {
        console.log("[TEST] Method 1 - cast object keys:", Object.keys(cast));
        
        const replies = cast.replies?.casts || cast.replies || cast.direct_replies || cast.thread?.casts || [];
        console.log("[TEST] Method 1 - found replies:", replies.length);
        
        const threadReplies = cast.thread?.casts || cast.thread?.replies || [];
        const allReplies = [...replies, ...threadReplies];
        
        console.log("[TEST] Method 1 - total replies to check:", allReplies.length);
        
        if (allReplies.length > 0) {
          console.log("[TEST] Method 1 - sample replies:", allReplies.slice(0, 3).map((r) => ({
            hash: r.hash,
            authorFid: r.author?.fid || r.fid || r.author_fid,
            text: r.text?.substring(0, 30)
          })));
        }
        
        const hasReply = allReplies.some((r) => {
          const authorFid = r.author?.fid || r.fid || r.author_fid;
          const match = Number(authorFid) === Number(userFid);
          if (match) {
            console.log("✅ [TEST] Method 1 - FOUND REPLY!", { 
              replyHash: r.hash, 
              authorFid, 
              userFid,
              replyText: r.text?.substring(0, 50)
            });
          }
          return match;
        });
        
        if (hasReply) {
          found = true;
          console.log("✅ [TEST] Method 1 - SUCCESS!");
        } else {
          console.log("❌ [TEST] Method 1 - no matching reply found");
        }
      }
    } else {
      const errorText = await res.text().catch(() => '');
      console.warn("[TEST] Method 1 - API error:", res.status, res.statusText, errorText.substring(0, 200));
    }
  } catch (e) {
    console.warn("[TEST] Method 1 - failed:", e?.message);
  }
  
  // Метод 2: Проверка через replies endpoint
  if (!found) {
    try {
      const repliesUrl = `https://api.neynar.com/v2/farcaster/cast/replies?identifier=${fullHash}&type=hash`;
      console.log("\n[TEST] Method 2 - checking replies endpoint");
      const res = await fetch(repliesUrl, { headers: { "api_key": NEYNAR_API_KEY } });
      
      if (res.ok) {
        const data = await res.json();
        console.log("[TEST] Method 2 - response keys:", Object.keys(data || {}));
        
        const replies = data?.result?.replies || data?.replies || data?.result?.casts || data?.casts || data?.result?.result?.replies || [];
        console.log("[TEST] Method 2 - found replies:", replies.length);
        
        if (replies.length > 0) {
          console.log("[TEST] Method 2 - sample replies:", replies.slice(0, 3).map((r) => ({
            hash: r.hash,
            authorFid: r.author?.fid || r.fid || r.author_fid,
            parentHash: r.parent_hash,
            text: r.text?.substring(0, 30)
          })));
        }
        
        const hasReply = replies.some((r) => {
          const authorFid = r.author?.fid || r.fid || r.author_fid;
          const match = Number(authorFid) === Number(userFid);
          if (match) {
            console.log("✅ [TEST] Method 2 - FOUND REPLY!", { 
              replyHash: r.hash, 
              authorFid, 
              userFid,
              replyText: r.text?.substring(0, 50)
            });
          }
          return match;
        });
        
        if (hasReply) {
          found = true;
          console.log("✅ [TEST] Method 2 - SUCCESS!");
        } else {
          console.log("❌ [TEST] Method 2 - no matching reply found");
        }
      } else {
        const errorText = await res.text().catch(() => '');
        console.warn("[TEST] Method 2 - API error:", res.status, res.statusText, errorText.substring(0, 200));
      }
    } catch (e) {
      console.warn("[TEST] Method 2 - failed:", e?.message);
    }
  }
  
  // Метод 3: Проверка через parent_hash
  if (!found) {
    const hashVariants = [fullHash, normalizedHash, hashWith0x].filter((h, i, arr) => arr.indexOf(h) === i);
    
    for (const hashVariant of hashVariants) {
      try {
        const url = `https://api.neynar.com/v2/farcaster/casts?parent_hash=${hashVariant}&limit=100`;
        console.log("\n[TEST] Method 3 - checking parent_hash:", hashVariant);
        const res = await fetch(url, { headers: { "api_key": NEYNAR_API_KEY } });
        
        if (res.ok) {
          const data = await res.json();
          const casts = data?.result?.casts || data?.casts || data?.result?.result?.casts || [];
          console.log("[TEST] Method 3 - found casts:", casts.length);
          
          if (casts.length > 0) {
            console.log("[TEST] Method 3 - sample casts:", casts.slice(0, 3).map((c) => ({
              hash: c.hash,
              authorFid: c.author?.fid || c.fid || c.author_fid,
              parentHash: c.parent_hash,
              text: c.text?.substring(0, 30)
            })));
          }
          
          const hasComment = casts.some((c) => {
            const authorFid = c.author?.fid || c.fid || c.author_fid;
            const match = Number(authorFid) === Number(userFid);
            if (match) {
              console.log("✅ [TEST] Method 3 - FOUND COMMENT!", { 
                commentHash: c.hash, 
                authorFid, 
                userFid,
                parentHash: c.parent_hash,
                commentText: c.text?.substring(0, 50)
              });
            }
            return match;
          });
          
          if (hasComment) {
            found = true;
            console.log("✅ [TEST] Method 3 - SUCCESS!");
            break;
          }
        } else {
          const errorText = await res.text().catch(() => '');
          console.warn("[TEST] Method 3 - API error:", res.status, res.statusText, errorText.substring(0, 200));
        }
      } catch (e) {
        console.warn("[TEST] Method 3 - failed:", e?.message);
      }
    }
  }
  
  // Метод 4: Проверка через user/casts
  if (!found) {
    try {
      const userCastsUrl = `https://api.neynar.com/v2/farcaster/user/casts?fid=${userFid}&limit=200`;
      console.log("\n[TEST] Method 4 - checking user casts");
      const res = await fetch(userCastsUrl, { headers: { "api_key": NEYNAR_API_KEY } });
      
      if (res.ok) {
        const data = await res.json();
        const casts = data?.result?.casts || data?.casts || [];
        console.log("[TEST] Method 4 - found user casts:", casts.length);
        
        const hasComment = casts.some((c) => {
          const parentHash = c.parent_hash || c.parent?.hash || c.parent_author?.hash;
          if (!parentHash) return false;
          
          const normalizedParentHash = parentHash.startsWith('0x') ? parentHash.slice(2) : parentHash;
          const parentHashWith0x = parentHash.startsWith('0x') ? parentHash : `0x${parentHash}`;
          
          const match = 
            parentHash.toLowerCase() === fullHash.toLowerCase() ||
            parentHash.toLowerCase() === normalizedHash.toLowerCase() ||
            parentHash.toLowerCase() === hashWith0x.toLowerCase() ||
            normalizedParentHash.toLowerCase() === fullHash.toLowerCase() ||
            normalizedParentHash.toLowerCase() === normalizedHash.toLowerCase() ||
            parentHashWith0x.toLowerCase() === fullHash.toLowerCase() ||
            parentHashWith0x.toLowerCase() === hashWith0x.toLowerCase();
          
          if (match) {
            console.log("✅ [TEST] Method 4 - FOUND COMMENT!", { 
              commentHash: c.hash, 
              parentHash, 
              fullHash,
              commentText: c.text?.substring(0, 50)
            });
          }
          return match;
        });
        
        if (hasComment) {
          found = true;
          console.log("✅ [TEST] Method 4 - SUCCESS!");
        } else {
          console.log("❌ [TEST] Method 4 - no matching comment found");
        }
      } else {
        const errorText = await res.text().catch(() => '');
        console.warn("[TEST] Method 4 - API error:", res.status, res.statusText, errorText.substring(0, 200));
      }
    } catch (e) {
      console.warn("[TEST] Method 4 - failed:", e?.message);
    }
  }
  
  console.log("\n---");
  if (found) {
    console.log("✅ РЕЗУЛЬТАТ: Комментарий найден!");
  } else {
    console.log("❌ РЕЗУЛЬТАТ: Комментарий не найден после всех методов");
  }
  
  return found;
}

// Запуск теста
(async () => {
  try {
    const hash = await getFullCastHash(castUrl);
    
    if (!hash) {
      console.error('❌ Не удалось получить hash из URL');
      process.exit(1);
    }
    
    console.log('✅ Hash получен:', hash);
    console.log('---\n');
    
    const result = await checkUserCommented(hash, userFid);
    
    process.exit(result ? 0 : 1);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
})();

