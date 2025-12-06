// API endpoint для публикации ссылки
import type { NextApiRequest, NextApiResponse } from 'next';
import { submitLink, getAllLinks, getUserProgress } from '@/lib/db-config';
import { extractCastHash } from '@/lib/neynar';

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
    
    // Поддержка как activityType (старое), так и taskType (новое)
    let finalTaskType = taskType || activityType;

    // ⚠️ ВАЖНО: Если taskType не передан, получаем его из прогресса пользователя
    // Это гарантирует, что ссылка публикуется с тем же типом заданий, которые пользователь прошел
    if (!finalTaskType && userFid) {
      console.log('⚠️ [SUBMIT-LINK] taskType not provided, fetching from user progress...');
      const progress = await getUserProgress(Number(userFid));
      if (progress?.selected_task) {
        finalTaskType = progress.selected_task;
        console.log(`✅ [SUBMIT-LINK] Using taskType from user progress: ${finalTaskType}`);
      }
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

