// API endpoint для проверки активности пользователя на Farcaster
import type { NextApiRequest, NextApiResponse } from 'next';
import { checkUserActivityByHash } from '@/lib/neynar';
import type { ActivityType } from '@/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { castHash, userFid, activityType } = req.body;

    console.log('🔍 [VERIFY-API] Received verification request:', {
      castHash,
      userFid,
      activityType,
      hasCastHash: !!castHash,
      hasUserFid: !!userFid,
      hasActivityType: !!activityType,
    });

    if (!castHash || !userFid || !activityType) {
      console.error('❌ [VERIFY-API] Missing required parameters:', {
        hasCastHash: !!castHash,
        hasUserFid: !!userFid,
        hasActivityType: !!activityType,
      });
      return res.status(400).json({ 
        error: 'Missing required parameters: castHash, userFid, activityType',
        success: false,
        completed: false 
      });
    }

    // ⚠️ ГАРД: Проверяем наличие и валидность fid перед проверкой активности
    if (!userFid || typeof userFid !== 'number' || userFid <= 0 || !Number.isInteger(userFid)) {
      console.error('❌ [VERIFY-API] Invalid or missing userFid:', {
        userFid,
        type: typeof userFid,
        isNumber: typeof userFid === 'number',
        isPositive: userFid > 0,
        isInteger: Number.isInteger(userFid),
      });
      return res.status(400).json({ 
        error: 'FID отсутствует или невалиден. Проверьте авторизацию перед верификацией.',
        completed: false,
        authError: true,
      });
    }

    // Проверяем наличие API ключа Neynar
    if (!process.env.NEXT_PUBLIC_NEYNAR_API_KEY) {
      console.warn('⚠️ [VERIFY-API] NEXT_PUBLIC_NEYNAR_API_KEY not configured - cannot verify activity');
      // ❌ Ошибки Neynar НЕ засчитываются как выполненные
      return res.status(500).json({ 
        success: false,
        completed: false,
        error: 'Neynar API key not configured',
        castHash,
        activityType 
      });
    }

    // ⚠️ Проверка длины cast_hash перед проверкой
    const hashLength = castHash.length;
    const EXPECTED_FULL_HASH_LENGTH = 42; // 0x + 40 hex chars
    let hashWarning: string | null = null;
    
    if (hashLength < EXPECTED_FULL_HASH_LENGTH) {
      if (hashLength < 20) {
        hashWarning = `Hash слишком короткий (${hashLength} символов). Полный hash должен быть ${EXPECTED_FULL_HASH_LENGTH} символов. Проверьте в Neynar Explorer: https://neynar.com/explorer/casts?castHash=${castHash}`;
        console.error(`❌ [VERIFY-API] ${hashWarning}`);
      } else {
        hashWarning = `Hash короче стандартного (${hashLength} символов). Убедитесь, что это полный hash.`;
        console.warn(`⚠️ [VERIFY-API] ${hashWarning}`);
      }
    }

    console.log('📡 [VERIFY-API] Calling checkUserActivityByHash...', {
      castHash,
      hashLength,
      userFid,
      activityType,
      neynarExplorerUrl: `https://neynar.com/explorer/casts?castHash=${castHash}`,
    });

    const isCompleted = await checkUserActivityByHash(
      castHash,
      userFid,
      activityType as ActivityType
    );

    console.log('✅ [VERIFY-API] checkUserActivityByHash result:', {
      isCompleted,
      castHash,
      hashLength,
      userFid,
      activityType,
    });

    // Формируем понятное сообщение для пользователя
    let userMessage: string | null = null;
    let isError = false;
    if (!isCompleted) {
      if (hashLength < 20) {
        userMessage = 'Неверный формат ссылки. Проверьте, что вы скопировали полную ссылку на cast.';
        isError = true;
      } else {
        // Проверяем, была ли ошибка расширения hash (cast не найден)
        // Это определяется по тому, что checkUserActivityByHash вернул false
        // и возможно hash не был расширен
        userMessage = 'Активность не найдена в сети. Убедитесь, что вы выполнили действие через официальный клиент Farcaster, связанный с Neynar. Попробуйте ещё раз через 1-2 минуты.';
        // Если hash был коротким и не удалось расширить - это ошибка
        if (hashLength < 42) {
          isError = true;
        }
      }
    }

    return res.status(200).json({ 
      success: true,
      completed: isCompleted,
      castHash,
      hashLength,
      activityType,
      hashWarning: hashWarning || undefined,
      userMessage: userMessage || undefined,
      isError: isError || undefined,
      neynarExplorerUrl: `https://neynar.com/explorer/casts?castHash=${castHash}`,
    });
  } catch (error: any) {
    console.error('❌ [VERIFY-API] Error verifying activity:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      response: error?.response?.data,
      status: error?.response?.status,
    });
    // ❌ Ошибки Neynar НЕ засчитываются как выполненные
    return res.status(500).json({ 
      success: false,
      completed: false,
      error: error.message || 'Failed to verify activity',
      castHash: req.body.castHash,
      activityType: req.body.activityType
    });
  }
}

