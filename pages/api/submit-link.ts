// API endpoint для публикации ссылки
import type { NextApiRequest, NextApiResponse } from 'next';
import { submitLink, getAllLinks, getUserProgress } from '@/lib/db-config';

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
    let { userFid, username, pfpUrl, castUrl, activityType, taskType, tokenAddress } = req.body;
    
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

    // Critical UX: Base App may not provide a canonical "tokenized post" URL.
    // Allow publishing with tokenAddress only; castUrl is optional.
    const safeCastUrl = (castUrl || '').toString().trim();
    if (!userFid || !username || !finalTaskType || !tokenAddress) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: userFid, username, taskType (or activityType), tokenAddress.' 
      });
    }

    console.log('📝 API /submit-link: Submitting link:', {
      userFid,
      username,
      castUrl: safeCastUrl ? safeCastUrl.substring(0, 50) + '...' : 'EMPTY (optional)',
      taskType: finalTaskType,
      tokenAddress,
    });

    const result = await submitLink(
      userFid,
      username,
      pfpUrl || '',
      safeCastUrl,
      finalTaskType,
      tokenAddress
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

