// API endpoint для проверки активности пользователя на Farcaster
import type { NextApiRequest, NextApiResponse } from 'next';
import { 
  expandShortHash,
  checkUserLiked,
  checkUserRecasted,
  checkUserCommented
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
    const { castHash, userFid, activityType } = req.body;

    console.log('🔍 [VERIFY-API] Received verification request:', {
      castHash,
      userFid,
      activityType,
    });

    if (!castHash || !userFid || !activityType) {
      return res.status(400).json({ 
        error: 'Missing required parameters: castHash, userFid, activityType',
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

    let fullHash = castHash;

    // 1. Expand short farcaster.xyz hash
    if (fullHash.length < 42) {
      console.log(`🔄 [VERIFY-API] Short hash detected (${fullHash.length} chars), expanding...`);
      const expanded = await expandShortHash(fullHash);

      if (!expanded) {
        return res.status(200).json({
          success: false,
          completed: false,
          error: "Не удалось получить полный hash. Попробуйте позднее.",
          hint: "Ссылка формата farcaster.xyz содержит короткий hash — мы автоматически пытаемся расширить его.",
          castHash: fullHash,
        });
      }

      fullHash = expanded;
      console.log(`✅ [VERIFY-API] Expanded ${castHash} → ${fullHash}`);
    }

    // 2. Check activity
    let completed = false;

    if (activityType === "like") {
      completed = await checkUserLiked(fullHash, userFid);
    } else if (activityType === "recast") {
      completed = await checkUserRecasted(fullHash, userFid);
    } else if (activityType === "comment") {
      completed = await checkUserCommented(fullHash, userFid);
    } else {
      return res.status(400).json({
        success: false,
        completed: false,
        error: `Unknown activity type: ${activityType}`,
      });
    }

    console.log('✅ [VERIFY-API] Verification result:', {
      completed,
      castHash: fullHash,
      activityType,
    });

    return res.status(200).json({
      success: true,
      completed,
      castHash: fullHash,
      activityType
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

