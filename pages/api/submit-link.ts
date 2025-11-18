// API endpoint для публикации ссылки
import type { NextApiRequest, NextApiResponse } from 'next';
import { submitLink } from '@/lib/db-config';
import { resolveShortLink, extractCastHash } from '@/lib/neynar';

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
    let { userFid, username, pfpUrl, castUrl, activityType } = req.body;

    if (!userFid || !username || !castUrl || !activityType) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: userFid, username, castUrl, activityType' 
      });
    }

    console.log('📝 API /submit-link: Submitting link:', {
      userFid,
      username,
      castUrl: castUrl.substring(0, 50) + '...',
      activityType,
    });

    // ✅ ШАГ 1: Проверяем, является ли ссылка короткой farcaster.xyz ссылкой
    if (castUrl.includes('farcaster.xyz/') && castUrl.length < 100) {
      console.log('🔄 [SUBMIT-LINK] Detected short farcaster.xyz link, attempting to resolve...');
      
      const resolvedHash = await resolveShortLink(castUrl);
      
      if (resolvedHash) {
        // Создаем полный URL с разрешенным hash
        const urlParts = castUrl.split('/');
        urlParts[urlParts.length - 1] = resolvedHash;
        castUrl = urlParts.join('/');
        console.log(`✅ [SUBMIT-LINK] Resolved short link to full URL: ${castUrl.substring(0, 60)}...`);
      } else {
        console.warn('⚠️ [SUBMIT-LINK] Failed to resolve short link, using original URL');
        // Продолжаем с оригинальным URL - возможно, это не короткая ссылка
      }
    }

    // ✅ ШАГ 2: Проверяем, что можем извлечь hash из финального URL
    const castHash = extractCastHash(castUrl);
    if (!castHash || castHash.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Не удалось извлечь валидный hash из ссылки. Убедитесь, что ссылка полная (например, https://warpcast.com/username/0x...)',
        hint: 'Если вы используете ссылку из farcaster.xyz, она должна быть полной или мы попытаемся автоматически разрешить её.'
      });
    }

    const result = await submitLink(
      userFid,
      username,
      pfpUrl || '',
      castUrl,
      activityType
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

