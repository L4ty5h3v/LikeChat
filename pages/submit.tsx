// Страница публикации ссылки
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Button from '@/components/Button';
import { getUserProgress, getTotalLinksCount } from '@/lib/db-config';
import { useFarcasterAuth } from '@/contexts/FarcasterAuthContext';
import type { ActivityType } from '@/types';

/**
 * Публикует cast в Farcaster через MiniKit SDK только для соответствующего типа активности
 * Это предотвращает спам и делает публикацию более targeted
 */
async function publishCastByActivityType(
  activityType: ActivityType,
  castUrl: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Проверяем, что мы в Farcaster Mini App
    if (typeof window === 'undefined') {
      return {
        success: false,
        error: 'SDK доступен только на клиенте',
      };
    }

    const isInFarcasterFrame = window.self !== window.top;
    if (!isInFarcasterFrame) {
      console.log('ℹ️ [PUBLISH-CAST] Not in Farcaster frame, skipping cast publication');
      return {
        success: false,
        error: 'Not in Farcaster Mini App',
      };
    }

    // Импортируем SDK
    const { sdk } = await import('@farcaster/miniapp-sdk');

    if (!sdk || !sdk.actions) {
      console.warn('⚠️ [PUBLISH-CAST] SDK or actions not available');
      return {
        success: false,
        error: 'SDK actions not available',
      };
    }

    // Проверяем тип активности и публикуем только для соответствующего типа
    // Это предотвращает публикацию ссылок для всех типов активности
    if (activityType === 'like') {
      // Публикуем cast только для лайков
      const castText = `❤️ Liked via mini-app: ${castUrl}`;
      
      // Используем composeCast если доступен, иначе fallback на openUrl
      if (typeof (sdk.actions as any).composeCast === 'function') {
        await (sdk.actions as any).composeCast({
          text: castText,
          embeds: [castUrl],
        });
        console.log('✅ [PUBLISH-CAST] Cast published via composeCast for like activity');
        return { success: true };
      } else if (sdk.actions.openUrl) {
        // Fallback: открываем Compose с предзаполненным текстом
        const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}`;
        await sdk.actions.openUrl({ url: warpcastUrl });
        console.log('✅ [PUBLISH-CAST] Cast compose opened via openUrl for like activity');
        return { success: true };
      }
    } else if (activityType === 'recast') {
      // Публикуем cast только для рекастов
      const castText = `🔄 Recasted via mini-app: ${castUrl}`;
      
      if (typeof (sdk.actions as any).composeCast === 'function') {
        await (sdk.actions as any).composeCast({
          text: castText,
          embeds: [castUrl],
        });
        console.log('✅ [PUBLISH-CAST] Cast published via composeCast for recast activity');
        return { success: true };
      } else if (sdk.actions.openUrl) {
        const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}`;
        await sdk.actions.openUrl({ url: warpcastUrl });
        console.log('✅ [PUBLISH-CAST] Cast compose opened via openUrl for recast activity');
        return { success: true };
      }
    } else if (activityType === 'comment') {
      // Публикуем cast только для комментариев
      const castText = `💬 Commented via mini-app: ${castUrl}`;
      
      if (typeof (sdk.actions as any).composeCast === 'function') {
        await (sdk.actions as any).composeCast({
          text: castText,
          embeds: [castUrl],
        });
        console.log('✅ [PUBLISH-CAST] Cast published via composeCast for comment activity');
        return { success: true };
      } else if (sdk.actions.openUrl) {
        const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}`;
        await sdk.actions.openUrl({ url: warpcastUrl });
        console.log('✅ [PUBLISH-CAST] Cast compose opened via openUrl for comment activity');
        return { success: true };
      }
    } else {
      // Неизвестный тип активности - не публикуем
      console.log(`ℹ️ [PUBLISH-CAST] Unknown activity type: ${activityType}, skipping cast publication`);
      return {
        success: false,
        error: `Unknown activity type: ${activityType}`,
      };
    }

    // Если ни один метод не доступен
    console.warn('⚠️ [PUBLISH-CAST] No compose method available in SDK');
    return {
      success: false,
      error: 'No compose method available',
    };
  } catch (error: any) {
    console.error('❌ [PUBLISH-CAST] Error publishing cast:', error);
    return {
      success: false,
      error: error?.message || 'Failed to publish cast',
    };
  }
}

export default function Submit() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { user, isLoading: authLoading, isInitialized } = useFarcasterAuth();
  const [activity, setActivity] = useState<ActivityType | null>(null);
  const [castUrl, setCastUrl] = useState('');
  const [error, setError] = useState('');
  const [canSubmit, setCanSubmit] = useState(false);
  const [totalLinks, setTotalLinks] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [publishedLinkId, setPublishedLinkId] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔍 [SUBMIT] Component mounted, checking auth...', {
      hasUser: !!user,
      userFid: user?.fid,
      authLoading,
      isInitialized,
    });
    
    // Проверяем, что код выполняется на клиенте
    if (typeof window !== 'undefined') {
      // Ждём инициализации авторизации
      if (!isInitialized) {
        console.log('⏳ [SUBMIT] Waiting for auth initialization...');
        return;
      }
      
      // Проверяем наличие user
      if (!user || !user.fid) {
        console.error('❌ [SUBMIT] No user found, redirecting to home...');
        router.push('/');
        return;
      }
      
      const savedActivity = localStorage.getItem('selected_activity');
      if (!savedActivity) {
        console.error('❌ [SUBMIT] No activity selected, redirecting to home...');
        router.push('/');
        return;
      }

      setActivity(savedActivity as ActivityType);
      
      console.log('✅ [SUBMIT] User and activity loaded:', {
        fid: user.fid,
        username: user.username,
        activity: savedActivity,
      });
      
      checkProgress(user.fid);
    }
  }, [router, user, authLoading, isInitialized]);

  const checkProgress = async (userFid: number) => {
    const progress = await getUserProgress(userFid);
    
    if (!progress) {
      router.push('/');
      return;
    }

    // Проверка: все 10 ссылок пройдены
    if (progress.completed_links.length < 10) {
      router.push('/tasks');
      return;
    }

    // Проверка: токен куплен
    if (!progress.token_purchased) {
      router.push('/buyToken');
      return;
    }

    // Проверка: в системе должно быть минимум 10 ссылок
    const count = await getTotalLinksCount();
    setTotalLinks(count);
    
    // Показываем предупреждение только если меньше 10 ссылок
    // Но разрешаем первым 10 пользователям добавлять
    if (count < 10) {
      setShowWarning(true);
    }

    setCanSubmit(true);
  };

  const validateUrl = (url: string): boolean => {
    // Проверка формата URL Farcaster/Warpcast
    const urlPattern = /^https?:\/\/(warpcast\.com|farcaster\.xyz)\/.+/i;
    return urlPattern.test(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ⚠️ ДЕТАЛЬНАЯ ПРОВЕРКА: Проверяем наличие всех необходимых данных
    console.log('🔍 [SUBMIT] Starting submission process...');
    console.log('🔍 [SUBMIT] User data:', {
      user: user ? {
        fid: user.fid,
        username: user.username,
        hasPfp: !!user.pfp_url,
      } : 'NULL',
      activity,
      castUrl: castUrl ? castUrl.substring(0, 50) + '...' : 'EMPTY',
    });
    
    // Проверяем наличие user из контекста
    if (!user) {
      console.error('❌ [SUBMIT] User is null in context!');
      setError('Ошибка: данные пользователя не найдены. Пожалуйста, авторизуйтесь заново.');
      router.push('/');
      return;
    }
    
    if (!activity || !castUrl) {
      console.error('❌ [SUBMIT] Missing required data:', {
        hasUser: !!user,
        hasActivity: !!activity,
        hasCastUrl: !!castUrl,
      });
      setError('Заполните все обязательные поля');
      return;
    }
    
    // ⚠️ ПРОВЕРКА FID: Убеждаемся, что fid существует и валиден
    if (!user.fid || typeof user.fid !== 'number') {
      console.error('❌ [SUBMIT] Invalid or missing user.fid:', user.fid);
      setError('Ошибка: не найден FID пользователя. Попробуйте перезагрузить страницу.');
      return;
    }
    
    if (!user.username) {
      console.warn('⚠️ [SUBMIT] Missing username, using fallback');
      user.username = `user_${user.fid}`;
    }

    setError('');

    // Валидация URL
    if (!validateUrl(castUrl)) {
      setError('Please enter a valid Farcaster/Warpcast cast link');
      return;
    }

    setLoading(true);

    try {
      // Публикация cast убрана - чтобы избежать баннера "Upgrade to Pro"
      // Сохраняем ссылку в базе данных через API endpoint
      const submissionData = {
        userFid: user.fid,
        username: user.username,
        pfpUrl: user.pfp_url || '',
        castUrl: castUrl,
        activityType: activity,
      };
      
      console.log('📝 [SUBMIT] Submitting link via API...', {
        ...submissionData,
        castUrl: castUrl.substring(0, 50) + '...',
      });

      const response = await fetch('/api/submit-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData),
      });

      console.log('📡 [SUBMIT] API response status:', response.status);
      console.log('📡 [SUBMIT] API response ok:', response.ok);

      const data = await response.json();
      console.log('📊 [SUBMIT] API response data:', data);

      if (!response.ok || !data.success) {
        console.error('❌ [SUBMIT] API submit-link error:', {
          status: response.status,
          ok: response.ok,
          data: data.error || data,
        });
        throw new Error(data.error || 'Failed to submit link');
      }

      if (data.link) {
        // Успешная публикация
        console.log('✅ [SUBMIT] Link saved to database via API:', data.link.id);
        setPublishedLinkId(data.link.id);
        setShowSuccessModal(true);
        
        // Публикуем cast в Farcaster только для соответствующего типа активности
        // Это предотвращает спам и делает публикацию более targeted
        if (activity) {
          publishCastByActivityType(activity, castUrl).then((result) => {
            if (result.success) {
              console.log('✅ [SUBMIT] Cast published to Farcaster via MiniKit SDK');
            } else {
              console.warn('⚠️ [SUBMIT] Failed to publish cast to Farcaster:', result.error);
              // Не блокируем flow, если публикация не удалась
            }
          }).catch((publishError) => {
            console.error('❌ [SUBMIT] Error publishing cast to Farcaster:', publishError);
            // Не блокируем flow, если публикация не удалась
          });
        }
        
        // Редирект на tasks через 3 секунды, чтобы пользователь увидел поздравление
        setTimeout(() => {
          router.push('/tasks?published=true');
        }, 3000);
      } else {
        console.error('❌ [SUBMIT] Link object not returned from API:', data);
        throw new Error('Link object not returned from API');
      }
    } catch (err: any) {
      console.error('❌ [SUBMIT] Error submitting link:', {
        message: err.message,
        stack: err.stack,
        name: err.name,
        cause: err.cause,
      });
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!canSubmit) {
    return (
      <Layout title="Проверка доступа...">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Проверка прогресса...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Multi Like - Publish Link">
      <div className="max-w-3xl mx-auto">
        {/* Заголовок с анимацией */}
        <div className="text-center mb-8">
          <div className="flex justify-center gap-2 text-6xl mb-4 animate-pulse-slow">
            <span>🎉</span>
            <span>💌</span>
            <span>🎊</span>
          </div>
          <h1 className="text-4xl font-bold text-primary mb-2">
            Поздравляем!
          </h1>
          <p className="text-xl text-gray-600">
            Вы выполнили все задания и купили токен
          </p>
          <p className="text-gray-500 mt-2">
            Теперь опубликуйте свою ссылку
          </p>
        </div>

        {/* Прогресс пользователя */}
        <div className="bg-gradient-to-r from-success to-green-400 text-white rounded-2xl p-6 mb-8">
          <h3 className="text-xl font-bold mb-4">Ваш прогресс:</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
              <div className="text-4xl mb-2">✅</div>
              <p className="font-semibold">10 ссылок</p>
              <p className="text-sm">пройдено</p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
              <div className="text-4xl mb-2">💎</div>
              <p className="font-semibold">Токен куплен</p>
              <p className="text-sm">$0.10</p>
            </div>
          </div>
        </div>

        {/* Информация о системе для первых пользователей */}
        {showWarning && totalLinks < 10 && (
          <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-sm border-2 border-blue-400 rounded-2xl p-6 mb-8 shadow-xl">
            <h3 className="font-black text-blue-800 mb-3 flex items-center gap-3 text-xl">
              <span className="text-3xl">🚀</span>
              SYSTEM INITIALIZATION
            </h3>
            <p className="text-blue-800 mb-3 font-bold text-lg">
              You are one of the first users!
            </p>
            <p className="text-blue-700 mb-4">
              The system is collecting the first <strong>10 links</strong>. You can submit your link now and help initialize the platform!
            </p>
            <div className="bg-white bg-opacity-70 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-gray-800">Links in system:</span>
                <span className="text-2xl font-black text-blue-600">{totalLinks}/10</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-500"
                  style={{ width: `${(totalLinks / 10) * 100}%` }}
                ></div>
              </div>
            </div>
            <p className="text-blue-700 mt-4 text-sm">
              💡 <strong>Early Bird Bonus:</strong> As one of the first 10 users, you can submit your link immediately!
            </p>
          </div>
        )}

        {/* Форма публикации */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Опубликуйте вашу ссылку
            </h2>
            <p className="text-gray-600">
              Вставьте ссылку на ваш каст в Farcaster/Warpcast
            </p>
          </div>

          {/* Информация о выбранной активности */}
          <div className="bg-primary bg-opacity-10 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-700 mb-2">
              <strong>Выбранная активность:</strong>
            </p>
            <div className="flex items-center gap-2 text-primary font-semibold text-lg">
              {activity === 'like' && (
                <>
                  <span className="text-2xl">❤️</span>
                  <span>Лайк</span>
                </>
              )}
              {activity === 'recast' && (
                <>
                  <span className="text-2xl">🔄</span>
                  <span>Рекаст</span>
                </>
              )}
              {activity === 'comment' && (
                <>
                  <span className="text-2xl">💬</span>
                  <span>Комментарий</span>
                </>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Другие пользователи будут выполнять эту активность на вашей ссылке
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label
                htmlFor="castUrl"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Ссылка на ваш каст:
              </label>
              <input
                type="url"
                id="castUrl"
                value={castUrl}
                onChange={(e) => setCastUrl(e.target.value)}
                placeholder="https://warpcast.com/username/0x123abc..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-primary focus:outline-none transition-colors"
                required
              />
              <p className="text-xs text-gray-500 mt-2">
                Пример: https://warpcast.com/username/0x123abc
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-6">
                <p className="text-red-800 font-semibold flex items-center gap-2">
                  <span>❌</span>
                  {error}
                </p>
              </div>
            )}

            <Button
              type="submit"
              loading={loading}
              disabled={!castUrl}
              variant="success"
              fullWidth
              className="text-xl py-5"
            >
              {totalLinks < 10 ? '🚀 Publish Link (Early Bird)' : '🚀 Publish Link'}
            </Button>
          </form>
        </div>

        {/* Инструкция */}
        <div className="bg-gray-50 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">
            📝 Что дальше?
          </h3>
          <ol className="space-y-2 text-gray-700 list-decimal list-inside">
            <li>Ваша ссылка будет добавлена в очередь</li>
            <li>Следующие 10 пользователей пройдут вашу ссылку</li>
            <li>Они выполнят выбранную вами активность</li>
            <li>Вы получите взаимную поддержку от сообщества</li>
          </ol>
        </div>
      </div>

      {/* Модальное окно с поздравлением */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-12 max-w-md w-full mx-4 border-4 border-success animate-pulse">
            <div className="text-center">
              <div className="flex justify-center gap-2 text-7xl mb-6 animate-bounce">
                <span>🎉</span>
                <span>✨</span>
                <span>🎊</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-success mb-4">
                Поздравляем!
              </h2>
              <p className="text-xl sm:text-2xl text-gray-800 font-bold mb-6">
                Ваша ссылка опубликована!
              </p>
              <p className="text-gray-600 mb-8">
                Она теперь доступна в списке заданий для других пользователей.
              </p>
              <div className="bg-success bg-opacity-10 rounded-2xl p-4 mb-6">
                <p className="text-sm text-gray-700 mb-2">
                  <strong>Следующие 10 пользователей</strong> пройдут вашу ссылку и выполнят выбранную активность.
                </p>
              </div>
              <div className="flex justify-center">
                <div className="w-12 h-12 border-4 border-success border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Перенаправление на страницу заданий...
              </p>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

