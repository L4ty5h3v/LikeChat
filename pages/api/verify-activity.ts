// API endpoint для проверки активности пользователя на Farcaster
import type { NextApiRequest, NextApiResponse } from 'next';
import { 
  resolveFullHash,
  resolveShortLink,
  extractCastHash,
  checkUserActivityByUsername,
  checkUserLiked,
  checkUserRecasted,
  checkUserCommented,
  isFullHash
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
    let { castHash, castUrl, userFid, activityType } = req.body;

    console.log('🔍 [VERIFY-API] Received verification request:', {
      castHash,
      castUrl,
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

    // ✅ ШАГ 0: Упрощенная проверка по username для коротких ссылок farcaster.xyz
    if (castUrl && castUrl.includes('farcaster.xyz/')) {
      const urlPattern = /^https?:\/\/farcaster\.xyz\/([^\/]+)\/(0x[a-fA-F0-9]*)/;
      const match = castUrl.match(urlPattern);
      
      if (match) {
        const [, targetUsername, partialHash] = match;
        const cleanPartialHash = partialHash && partialHash.length >= 6 ? partialHash.replace(/\.\.\./g, '').trim() : null;
        
        console.log(`🔄 [VERIFY-API] Detected farcaster.xyz link, checking by username: ${targetUsername}`);
        
        // Проверяем активность по username (покрывает 90% случаев)
        const completed = await checkUserActivityByUsername(
          targetUsername,
          cleanPartialHash,
          userFid,
          activityType
        );
        
        if (completed) {
          console.log(`✅ [VERIFY-API] Activity verified by username: ${targetUsername}`);
          return res.status(200).json({
            success: true,
            completed: true,
            castHash: cleanPartialHash || 'verified-by-username',
            activityType,
            verifiedBy: 'username'
          });
        } else {
          console.log(`⚠️ [VERIFY-API] Activity not found by username, will try hash resolution`);
          // Продолжаем с обычной проверкой по hash
        }
      }
    }

    // Проверяем, что hash не слишком короткий (минимум 6 символов для частичного hash)
    if (castHash && castHash.length < 6) {
      return res.status(200).json({
        success: false,
        completed: false,
        error: "Hash слишком короткий (возможно обрезан). Требуется полный URL или полный hash.",
        hint: "Пожалуйста, скопируйте полную ссылку из Warpcast или Farcaster. Полный hash должен содержать 42 символа (0x + 40 hex символов).",
        castHash: castHash,
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

    // 1. Автоматически получаем полный hash через Neynar, если hash короткий
    if (!isFullHash(fullHash)) {
      console.log(`🔄 [VERIFY-API] Short hash detected (${fullHash.length} chars), resolving full hash...`);
      const resolved = await resolveFullHash(fullHash);

      if (!resolved) {
        return res.status(200).json({
          success: false,
          completed: false,
          error: "Не удалось получить полный hash. Hash слишком короткий или обрезан.",
          hint: "Требуется полный URL или полный hash (0x + 40 hex символов). Скопируйте полную ссылку из Warpcast (например, https://warpcast.com/username/0x...) или Farcaster.",
          castHash: fullHash,
        });
      }

      fullHash = resolved;
      console.log(`✅ [VERIFY-API] Resolved ${castHash} → ${fullHash}`);
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

