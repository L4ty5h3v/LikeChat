// API endpoint для публикации ссылки
import type { NextApiRequest, NextApiResponse } from 'next';
import { submitLink, getAllLinks, getUserProgress } from '@/lib/db-config';
import { extractCastHash } from '@/lib/neynar';

// Функция валидации URL - только ссылки на посты (casts)
function validateCastUrl(url: string): boolean {
  try {
    // Проверяем, что это валидный URL
    const urlObj = new URL(url);
    
    // Разрешаем только farcaster.xyz и warpcast.com
    const allowedDomains = ['farcaster.xyz', 'warpcast.com'];
    if (!allowedDomains.includes(urlObj.hostname)) {
      return false;
    }
    
    // БЛОКИРУЕМ ссылки на приложения
    if (urlObj.pathname.includes('/miniapps/')) {
      return false;
    }
    
    // БЛОКИРУЕМ ссылки на каналы
    if (urlObj.pathname.includes('/~/channel/')) {
      return false;
    }
    
    // БЛОКИРУЕМ ссылки на профили (без hash)
    // Профиль: /username (без дальнейшего пути или без hash)
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    if (pathParts.length === 1 && !urlObj.pathname.includes('0x')) {
      // Это профиль, если только username без hash
      return false;
    }
    
      // РАЗРЕШАЕМ только ссылки на посты с hash (0x...)
      // Формат: /username/0x... или /~/conversations/0x...
      // Хеши могут быть короткими, минимум 6 символов после 0x
      const hasHash = /0x[a-fA-F0-9]{6,}/i.test(url);
      if (!hasHash) {
        return false;
      }
    
    // Дополнительная проверка: должен быть путь с username или conversations
    const isValidCastPath = 
      /^\/[^\/]+\/0x/i.test(urlObj.pathname) || // /username/0x...
      /^\/~\/conversations\/0x/i.test(urlObj.pathname); // /~/conversations/0x...
    
    return isValidCastPath;
  } catch (error) {
    // Если URL невалидный, возвращаем false
    return false;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Отключаем кеширование
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    let { userFid, username, pfpUrl, castUrl, activityType, taskType } = req.body;
    
    // Валидация URL - только ссылки на посты (casts)
    if (!validateCastUrl(castUrl)) {
      return res.status(400).json({
        success: false,
        error: 'Only Farcaster cast links are allowed. You cannot use links to profiles, applications, or other sections.'
      });
    }
    
    // ⚠️ КРИТИЧНО: ВАЖНО использовать selected_task из БД как основной источник истины
    // Получаем selected_task из прогресса пользователя, чтобы гарантировать правильный тип
    const progress = await getUserProgress(Number(userFid));
    const taskTypeFromDb = progress?.selected_task;
    
    // Поддержка как activityType (старое), так и taskType (новое)
    let finalTaskType = taskType || activityType;
    
    // ⚠️ ВАЖНО: Приоритет у selected_task из БД - это то, что пользователь реально прошел
    if (taskTypeFromDb) {
      console.log(`✅ [SUBMIT-LINK] Using taskType from user progress (DB): ${taskTypeFromDb}`);
      finalTaskType = taskTypeFromDb;
    } else if (finalTaskType) {
      console.log(`⚠️ [SUBMIT-LINK] Using taskType from request: ${finalTaskType} (no taskType in DB)`);
    } else {
      console.error('❌ [SUBMIT-LINK] No taskType provided and no selected_task in DB!');
    }

    if (!userFid || !username || !castUrl || !finalTaskType) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: userFid, username, castUrl, taskType (or activityType). taskType must be "like" or "recast".' 
      });
    }

    // Валидация taskType
    if (finalTaskType !== 'like' && finalTaskType !== 'recast') {
      return res.status(400).json({
        success: false,
        error: `Invalid taskType: ${finalTaskType}. Must be "like" or "recast".`
      });
    }

    // Публикация ссылки разрешена всегда (все задания уже проверены)

    console.log('📝 API /submit-link: Submitting link:', {
      userFid,
      username,
      castUrl: castUrl.substring(0, 50) + '...',
      taskType: finalTaskType,
    });

    // ✅ Упрощенная логика: для farcaster.xyz ссылок проверка будет по username
    // Не требуем полный hash, так как проверка активности происходит по username
    if (castUrl.includes('farcaster.xyz/')) {
      console.log('✅ [SUBMIT-LINK] Farcaster.xyz link detected, will verify by username');
      // Просто сохраняем ссылку как есть, проверка будет по username
    } else {
      // Для других форматов (farcaster.xyz и т.д.) проверяем наличие hash
      const castHash = extractCastHash(castUrl);
      if (!castHash || castHash.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Failed to extract valid hash from link. Make sure the link contains a hash (e.g., https://farcaster.xyz/username/0x...)',
          hint: 'For farcaster.xyz links, verification happens automatically by username.'
        });
      }
    }

    const result = await submitLink(
      userFid,
      username,
      pfpUrl || '',
      castUrl,
      finalTaskType
    );

    if (!result) {
      console.error('❌ API /submit-link: submitLink returned null');
      return res.status(500).json({ 
        success: false,
        error: 'Failed to submit link - result is null' 
      });
    }

    console.log(`✅ API /submit-link: Link published successfully:`, {
      id: result.id,
      username: result.username,
      user_fid: result.user_fid,
      created_at: result.created_at,
    });

    return res.status(200).json({ 
      success: true, 
      link: result 
    });
  } catch (error: any) {
    console.error('❌ API /submit-link error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to submit link',
      details: error.toString()
    });
  }
}

