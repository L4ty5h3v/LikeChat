// API endpoint для проверки активности пользователя на Farcaster
import type { NextApiRequest, NextApiResponse } from 'next';
import { 
  getFullCastHash,
  checkUserActivityByHash
} from '@/lib/neynar';
import type { ActivityType } from '@/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { castUrl, userFid, activityType } = req.body;

    console.log('🔍 [VERIFY-API] Received verification request:', {
      castUrl,
      userFid,
      activityType,
    });

    if (!castUrl || !userFid || !activityType) {
      return res.status(400).json({ 
        error: 'Missing required parameters: castUrl, userFid, activityType',
        success: false,
        completed: false 
      });
    }

    // ⚠️ ГАРД: Проверяем наличие и валидность fid перед проверкой активности
    if (!userFid || typeof userFid !== 'number' || userFid <= 0 || !Number.isInteger(userFid)) {
      return res.status(400).json({ 
        error: 'FID отсутствует или невалиден. Проверьте авторизацию перед верификацией.',
        completed: false,
        authError: true,
      });
    }

    // Проверяем наличие API ключа Neynar
    if (!process.env.NEXT_PUBLIC_NEYNAR_API_KEY) {
      console.warn('⚠️ [VERIFY-API] NEXT_PUBLIC_NEYNAR_API_KEY not configured');
      return res.status(500).json({ 
        success: false,
        completed: false,
        error: 'Neynar API key not configured',
      });
    }

    // Получаем полный hash из URL
    const fullHash = await getFullCastHash(castUrl);

    if (!fullHash) {
      return res.status(400).json({
        success: false,
        error: "Не удалось получить hash. Проверьте корректность ссылки.",
      });
    }

    // Обычная проверка через Neynar
    const completed = await checkUserActivityByHash(fullHash, userFid, activityType);

    console.log('✅ [VERIFY-API] Verification result:', {
      completed,
      castHash: fullHash,
      activityType,
    });

    return res.json({
      success: true,
      completed,
      castHash: fullHash,
    });

  } catch (err: any) {
    console.error("❌ verify-activity API error:", err);
    
    return res.status(500).json({
      success: false,
      completed: false,
      error: "Internal server error",
      message: err?.message || 'Unknown error'
    });
  }
}

