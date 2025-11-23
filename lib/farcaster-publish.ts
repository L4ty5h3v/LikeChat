// Функции для публикации кастов в Farcaster через SDK
import type { ActivityType } from '@/types';

// Публиковать каст в Farcaster через SDK (открывает Farcaster с предзаполненным текстом)
export async function publishCastToFarcaster(
  castUrl: string,
  activityType: ActivityType
): Promise<{
  success: boolean;
  castHash?: string;
  error?: string;
}> {
  try {
    if (typeof window === 'undefined') {
      return {
        success: false,
        error: 'SDK доступен только на клиенте',
      };
    }

    // Формируем текст каста
    const activityEmoji = {
      like: '❤️',
      recast: '🔄',
      comment: '💬',
    };

    const activityLabel = {
      like: 'Like',
      recast: 'Recast',
      comment: 'Comment',
    };

    const castText = `${activityEmoji[activityType]} Need ${activityLabel[activityType]}!\n\n${castUrl}\n\n#MultiLike #Farcaster`;

    console.log('🔄 Opening Farcaster to publish cast:', castText);

    // Пробуем использовать SDK для открытия Farcaster
    try {
      const { sdk } = await import('@farcaster/miniapp-sdk');
      
      if (sdk && sdk.actions && sdk.actions.openUrl) {
        // Используем openUrl для открытия Farcaster с предзаполненным текстом
        const farcasterUrl = `https://farcaster.xyz/~/compose?text=${encodeURIComponent(castText)}`;
        await sdk.actions.openUrl({ url: farcasterUrl });
        console.log('✅ Opened Farcaster via SDK');
        return {
          success: true,
        };
      }
    } catch (sdkError) {
      console.warn('⚠️ SDK not available, using direct URL:', sdkError);
    }

    // Fallback: открываем Farcaster напрямую
    const farcasterUrl = `https://farcaster.xyz/~/compose?text=${encodeURIComponent(castText)}`;
    
    // Проверяем, мобильное ли устройство
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // На мобильных пробуем deep link
      const farcasterDeepLink = `farcaster://~/compose?text=${encodeURIComponent(castText)}`;
      window.location.href = farcasterDeepLink;
      
      // Fallback на веб-версию через секунду
      setTimeout(() => {
        window.open(farcasterUrl, '_blank');
      }, 1000);
    } else {
      // На десктопе открываем в новой вкладке
      window.open(farcasterUrl, '_blank');
    }

    console.log('✅ Opened Farcaster for cast publishing');
    return {
      success: true,
    };
  } catch (error: any) {
    console.error('❌ Error opening Farcaster:', error);
    return {
      success: false,
      error: error?.message || 'Ошибка при открытии Farcaster',
    };
  }
}

