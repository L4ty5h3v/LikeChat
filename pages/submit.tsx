// Страница публикации ссылки
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Button from '@/components/Button';
import { getUserProgress, getAllLinks } from '@/lib/db-config';
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

    // Определяем канал и текст публикации в зависимости от типа активности
    const activityConfig = {
      like: {
        castText: `❤️ Liked via mini-app: ${castUrl}`,
        channel: '/like', // Канал для лайков
        hashtag: '#likes',
      },
      recast: {
        castText: `🔄 Recasted via mini-app: ${castUrl}`,
        channel: '/recast', // Канал для рекастов
        hashtag: '#recasts',
      },
      comment: {
        castText: `💬 Commented via mini-app: ${castUrl}`,
        channel: '/comment', // Канал для комментариев
        hashtag: '#comments',
      },
    };

    const config = activityConfig[activityType];
    if (!config) {
      // Неизвестный тип активности - не публикуем
      console.log(`ℹ️ [PUBLISH-CAST] Unknown activity type: ${activityType}, skipping cast publication`);
      return {
        success: false,
        error: `Unknown activity type: ${activityType}`,
      };
    }

    // Добавляем хештег канала в текст для лучшей видимости
    const castTextWithHashtag = `${config.castText}\n\n${config.hashtag}`;

    // Используем composeCast если доступен, иначе fallback на openUrl
    if (typeof (sdk.actions as any).composeCast === 'function') {
      // Пробуем указать канал через parentUrl или channel параметр
      const composeParams: any = {
        text: castTextWithHashtag,
        embeds: [castUrl],
      };

      // Пробуем разные варианты указания канала
      // Вариант 1: через parentUrl (если поддерживается)
      try {
        composeParams.parentUrl = `https://warpcast.com/~/channel${config.channel}`;
      } catch (e) {
        // Игнорируем ошибку
      }

      // Вариант 2: через channel параметр (если поддерживается)
      try {
        composeParams.channel = config.channel.replace('/', '');
      } catch (e) {
        // Игнорируем ошибку
      }

      await (sdk.actions as any).composeCast(composeParams);
      console.log(`✅ [PUBLISH-CAST] Cast published via composeCast for ${activityType} activity in channel ${config.channel}`);
      return { success: true };
    } else if (sdk.actions.openUrl) {
      // Fallback: открываем Compose с предзаполненным текстом и каналом
      // Пробуем указать канал через URL параметр
      let warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castTextWithHashtag)}`;
      
      // Добавляем канал в URL (если поддерживается Warpcast)
      // Пробуем несколько вариантов формата
      const channelParam = config.channel.replace('/', '');
      warpcastUrl += `&channel=${encodeURIComponent(channelParam)}`;
      
      // Альтернативный вариант: через parentUrl в URL
      // warpcastUrl += `&parentUrl=${encodeURIComponent(`https://warpcast.com/~/channel${config.channel}`)}`;

      await sdk.actions.openUrl({ url: warpcastUrl });
      console.log(`✅ [PUBLISH-CAST] Cast compose opened via openUrl for ${activityType} activity in channel ${config.channel}`);
      return { success: true };
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

// Глобальный счетчик событий для отслеживания порядка выполнения
let eventCounter = 0;
function getEventId(): number {
  return ++eventCounter;
}

// Функция для логирования с временной меткой и ID события
// ⚠️ ОБЕРНУТО В try-catch для предотвращения ошибок при загрузке модуля
function logEvent(prefix: string, data: any, eventId?: number) {
  try {
    const id = eventId || getEventId();
    const timestamp = Date.now();
    const timeISO = new Date(timestamp).toISOString();
    
    // Безопасное логирование - проверяем, что console.log доступен
    if (typeof console !== 'undefined' && typeof console.log === 'function') {
      try {
        console.log(`${prefix} [EVENT #${id}]`, {
          ...data,
          eventId: id,
          timestamp: timeISO,
          timestampMs: timestamp,
        });
      } catch (logError) {
        // Если логирование не удалось, пробуем простое логирование
        console.log(`${prefix} [EVENT #${id}]`, 'Logging error - data too large or circular');
      }
    }
    
    return id;
  } catch (error) {
    // Если произошла ошибка в самой функции логирования - просто возвращаем ID
    // Не вызываем console.error, чтобы не создать бесконечный цикл
    const id = eventId || getEventId();
    return id;
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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [publishedLinkId, setPublishedLinkId] = useState<string | null>(null);

  // ⚠️ БЛОКИРОВКА НАВИГАЦИИ: Проверяем флаг при монтировании и блокируем навигацию назад
  useEffect(() => {
    // Проверяем флаг при монтировании компонента
    if (typeof window !== 'undefined') {
      const sessionFlag = sessionStorage.getItem('link_published');
      const localFlag = localStorage.getItem('link_published');
      
      if (sessionFlag === 'true' || localFlag === 'true') {
        console.log('🚫 [SUBMIT] Component mounted but link already published - redirecting to home immediately', {
          sessionFlag,
          localFlag,
          timestamp: new Date().toISOString(),
        });
        // Редиректим на главную страницу
        router.replace('/');
        return; // Прерываем выполнение эффекта
      }
    }

    // Используем beforePopState для блокировки навигации назад
    const handleBeforePopState = (state: any) => {
      if (typeof window !== 'undefined') {
        const sessionFlag = sessionStorage.getItem('link_published');
        const localFlag = localStorage.getItem('link_published');
        
        if (sessionFlag === 'true' || localFlag === 'true') {
          console.log('🚫 [SUBMIT] Browser back navigation blocked - link already published', {
            sessionFlag,
            localFlag,
            timestamp: new Date().toISOString(),
          });
          // Редиректим на главную страницу
          router.replace('/');
          return false; // Блокируем навигацию назад
        }
      }
      
      return true; // Разрешаем навигацию
    };

    // Устанавливаем обработчик для блокировки навигации назад
    router.beforePopState(handleBeforePopState);

    return () => {
      // Очищаем обработчик при размонтировании
      router.beforePopState(() => true);
    };
  }, [router]);

  // ⚠️ СЛУШАТЕЛЬ STORAGE: Отслеживаем изменения в localStorage/sessionStorage из других вкладок/сессий
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'link_published' && e.newValue === 'true') {
        console.log('🔔 [SUBMIT] Storage event detected - link_published changed to true:', {
          key: e.key,
          oldValue: e.oldValue,
          newValue: e.newValue,
          url: e.url,
          timestamp: new Date().toISOString(),
        });
        
        // Если флаг установлен - редиректим на главную
        setTimeout(() => {
          const finalCheck = sessionStorage.getItem('link_published') || localStorage.getItem('link_published');
          console.log('🔔 [SUBMIT] Storage event - final check before redirect:', {
            finalCheck,
            timestamp: new Date().toISOString(),
          });
          if (finalCheck === 'true') {
            router.replace('/');
          }
        }, 100);
      }
    };

    // Также проверяем изменения в sessionStorage (хотя storage event не срабатывает для sessionStorage)
    // Но мы можем проверить периодически
    const checkStorageInterval = setInterval(() => {
      const sessionFlag = sessionStorage.getItem('link_published');
      const localFlag = localStorage.getItem('link_published');
      
      if (sessionFlag === 'true' || localFlag === 'true') {
        console.log('🔔 [SUBMIT] Periodic storage check - link_published detected:', {
          sessionFlag,
          localFlag,
          timestamp: new Date().toISOString(),
        });
        clearInterval(checkStorageInterval);
        setTimeout(() => router.replace('/'), 100);
      }
    }, 500); // Проверяем каждые 500ms

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkStorageInterval);
    };
  }, [router]);

  useEffect(() => {
    console.log('🔍 [SUBMIT] Component mounted, checking auth...', {
      hasUser: !!user,
      userFid: user?.fid,
      authLoading,
      isInitialized,
    });
    
    // Проверяем, что код выполняется на клиенте
    if (typeof window !== 'undefined') {
      // ⚠️ КРИТИЧЕСКИ ВАЖНО: Проверяем link_published В САМОМ НАЧАЛЕ
      // Это предотвращает зацикливание редиректов, даже если модальное окно закрылось некорректно
      // Проверяем ОБА хранилища для надежности
      const useEffectMountEventId = logEvent('🔍 [SUBMIT]', {
        action: 'useEffect on mount - checking storage',
        sessionStorage: sessionStorage.getItem('link_published'),
        localStorage: localStorage.getItem('link_published'),
        sessionStorageRaw: sessionStorage.getItem('link_published'),
        localStorageRaw: localStorage.getItem('link_published'),
        allSessionKeys: Object.keys(sessionStorage),
        allLocalKeys: Object.keys(localStorage).filter(k => k.includes('link') || k.includes('published')),
      });
      
      const sessionFlag = sessionStorage.getItem('link_published');
      const localFlag = localStorage.getItem('link_published');
      
      // Если флаг установлен в ЛЮБОМ хранилище - редиректим
      if (sessionFlag === 'true' || localFlag === 'true') {
        // Финальная проверка прямо перед редиректом
        const finalSessionCheck = sessionStorage.getItem('link_published');
        const finalLocalCheck = localStorage.getItem('link_published');
        
        const redirectScheduledEventId = logEvent('✅ [SUBMIT]', {
          action: 'Link already published detected on mount - scheduling redirect',
          initialSessionFlag: sessionFlag,
          initialLocalFlag: localFlag,
          finalSessionCheck,
          finalLocalCheck,
          redirecting: 'to home in 100ms',
          useEffectMountEventId,
        });
        
        // Используем setTimeout для гарантии, что хранилище "успело" сохраниться
        // Увеличено до 100ms для проверки race condition
        setTimeout(() => {
          // Еще раз проверяем перед фактическим редиректом
          const preRedirectSession = sessionStorage.getItem('link_published');
          const preRedirectLocal = localStorage.getItem('link_published');
          
          const beforeRedirectEventId = logEvent('🚀 [SUBMIT]', {
            action: 'RIGHT BEFORE router.replace("/") call',
            preRedirectSession,
            preRedirectLocal,
            delay: '100ms',
            redirectScheduledEventId,
            useEffectMountEventId,
          });
          
          // Безопасное логирование callStack
          try {
            console.log(`📍 [ROUTER] router.replace('/') called from useEffect mount check`, {
              eventId: beforeRedirectEventId,
              flagStatus: { preRedirectSession, preRedirectLocal },
              callStack: new Error().stack?.substring(0, 500), // Ограничиваем размер
            });
          } catch (stackError) {
            console.log(`📍 [ROUTER] router.replace('/') called from useEffect mount check`, {
              eventId: beforeRedirectEventId,
              flagStatus: { preRedirectSession, preRedirectLocal },
            });
          }
          
          router.replace('/');
        }, 100);
        return; // Выходим сразу, не выполняя дальнейшие проверки
      }
      
      // Ждём инициализации авторизации
      if (!isInitialized) {
        console.log('⏳ [SUBMIT] Waiting for auth initialization...');
        return;
      }
      
      // Проверяем наличие user
      if (!user || !user.fid) {
        console.error('❌ [SUBMIT] No user found, redirecting to home...');
        // Проверяем link_published еще раз перед редиректом (на случай если изменился)
        const checkSession = sessionStorage.getItem('link_published');
        const checkLocal = localStorage.getItem('link_published');
        if (checkSession === 'true' || checkLocal === 'true') {
          const preRedirectSession = sessionStorage.getItem('link_published');
          const preRedirectLocal = localStorage.getItem('link_published');
          console.log('✅ [SUBMIT] Link published flag detected before user check redirect:', {
            checkSession,
            checkLocal,
            preRedirectSession,
            preRedirectLocal,
            timestamp: new Date().toISOString(),
          });
          setTimeout(() => {
            const finalCheck = sessionStorage.getItem('link_published') || localStorage.getItem('link_published');
            console.log('🔍 [SUBMIT] RIGHT BEFORE redirect (user check, 100ms delay):', {
              finalCheck,
              sessionStorage: sessionStorage.getItem('link_published'),
              localStorage: localStorage.getItem('link_published'),
              timestamp: new Date().toISOString(),
              delay: '100ms',
            });
            router.replace('/');
          }, 100);
        } else {
          router.push('/');
        }
        return;
      }
      
    const savedActivity = localStorage.getItem('selected_activity');
      if (!savedActivity) {
        console.error('❌ [SUBMIT] No activity selected, redirecting to home...');
        // Проверяем link_published еще раз перед редиректом
        const checkSession = sessionStorage.getItem('link_published');
        const checkLocal = localStorage.getItem('link_published');
        if (checkSession === 'true' || checkLocal === 'true') {
          const preRedirectSession = sessionStorage.getItem('link_published');
          const preRedirectLocal = localStorage.getItem('link_published');
          console.log('✅ [SUBMIT] Link published flag detected before activity check redirect:', {
            checkSession,
            checkLocal,
            preRedirectSession,
            preRedirectLocal,
            timestamp: new Date().toISOString(),
          });
          setTimeout(() => {
            const finalCheck = sessionStorage.getItem('link_published') || localStorage.getItem('link_published');
            console.log('🔍 [SUBMIT] RIGHT BEFORE redirect (activity check, 100ms delay):', {
              finalCheck,
              sessionStorage: sessionStorage.getItem('link_published'),
              localStorage: localStorage.getItem('link_published'),
              timestamp: new Date().toISOString(),
              delay: '100ms',
            });
            router.replace('/');
          }, 100);
        } else {
      router.push('/');
        }
      return;
    }

    setActivity(savedActivity as ActivityType);
    
      console.log('✅ [SUBMIT] User and activity loaded:', {
        fid: user.fid,
        username: user.username,
        activity: savedActivity,
      });
      
      // ⚠️ ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Проверяем в БД, не опубликована ли уже ссылка
      // Это предотвращает зацикливание редиректов даже если флаг sessionStorage не установлен
      checkIfLinkAlreadyPublished(user.fid).then((linkPublished) => {
        // Еще раз проверяем флаг (на случай если он установился пока выполнялся запрос)
        const flagCheckSession = sessionStorage.getItem('link_published');
        const flagCheckLocal = localStorage.getItem('link_published');
        if (flagCheckSession === 'true' || flagCheckLocal === 'true' || linkPublished) {
          console.log('✅ [SUBMIT] User already published a link, redirecting to /tasks:', {
            flagCheckSession,
            flagCheckLocal,
            linkPublished,
          });
          // Устанавливаем флаг в ОБА хранилища для надежности
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('link_published', 'true');
            localStorage.setItem('link_published', 'true');
          }
          // ⚠️ ВАЖНО: Редиректим на /tasks, а не на главную, чтобы пользователь остался на странице задач
          setTimeout(() => {
            const finalCheckSession = sessionStorage.getItem('link_published');
            const finalCheckLocal = localStorage.getItem('link_published');
            console.log('🔍 [SUBMIT] RIGHT BEFORE redirect to /tasks (checkIfLinkAlreadyPublished, 100ms delay):', {
              finalCheckSession,
              finalCheckLocal,
              timestamp: new Date().toISOString(),
              delay: '100ms',
            });
            router.replace('/tasks');
          }, 100);
          return;
        }
        // Только если ссылка еще не опубликована - проверяем прогресс
        checkProgress(user.fid);
      }).catch((error) => {
        console.error('❌ [SUBMIT] Error checking published link:', error);
        // Перед продолжением проверяем флаг еще раз
        const flagCheckSession = sessionStorage.getItem('link_published');
        const flagCheckLocal = localStorage.getItem('link_published');
        if (flagCheckSession === 'true' || flagCheckLocal === 'true') {
          console.log('✅ [SUBMIT] Link published flag detected after error, redirecting to /tasks:', {
            flagCheckSession,
            flagCheckLocal,
          });
          // ⚠️ ВАЖНО: Редиректим на /tasks, а не на главную
          setTimeout(() => {
            const finalCheckSession = sessionStorage.getItem('link_published');
            const finalCheckLocal = localStorage.getItem('link_published');
            console.log('🔍 [SUBMIT] RIGHT BEFORE redirect to /tasks (error handler, 100ms delay):', {
              finalCheckSession,
              finalCheckLocal,
              timestamp: new Date().toISOString(),
              delay: '100ms',
            });
            router.replace('/tasks');
          }, 100);
          return;
        }
        // В случае ошибки продолжаем с проверкой прогресса
        checkProgress(user.fid);
      });
    }
  }, [router, user, authLoading, isInitialized]);
  
  // Функция для проверки, опубликована ли уже ссылка пользователем
  const checkIfLinkAlreadyPublished = async (userFid: number): Promise<boolean> => {
    try {
      const allLinks = await getAllLinks();
      const userHasPublishedLink = allLinks.some((link) => link.user_fid === userFid);
      console.log(`🔍 [SUBMIT] Check if link already published for user ${userFid}: ${userHasPublishedLink}`);
      return userHasPublishedLink;
    } catch (error) {
      console.error('❌ [SUBMIT] Error checking if link published:', error);
      return false;
    }
  };

  const checkProgress = async (userFid: number) => {
    // ⚠️ КРИТИЧЕСКИ ВАЖНО: Проверяем link_published в начале checkProgress
    // Это предотвращает выполнение логики, если ссылка уже опубликована
    if (typeof window !== 'undefined') {
      const sessionFlag = sessionStorage.getItem('link_published');
      const localFlag = localStorage.getItem('link_published');
      console.log('🔍 [SUBMIT] checkProgress - checking storage:', {
        sessionFlag,
        localFlag,
        timestamp: new Date().toISOString(),
      });
      if (sessionFlag === 'true' || localFlag === 'true') {
        console.log('✅ [SUBMIT] Link already published (from storage in checkProgress), redirecting to /tasks');
        // ⚠️ ВАЖНО: Редиректим на /tasks, а не на главную
        setTimeout(() => {
          const finalCheckSession = sessionStorage.getItem('link_published');
          const finalCheckLocal = localStorage.getItem('link_published');
          console.log('🔍 [SUBMIT] RIGHT BEFORE redirect to /tasks (checkProgress start, 100ms delay):', {
            finalCheckSession,
            finalCheckLocal,
            timestamp: new Date().toISOString(),
            delay: '100ms',
          });
          router.replace('/tasks');
        }, 100);
        return;
      }
    }
    
    const progress = await getUserProgress(userFid);
    
    // Еще раз проверяем флаг после получения прогресса (на случай если установился)
    if (typeof window !== 'undefined') {
      const flagCheckSession = sessionStorage.getItem('link_published');
      const flagCheckLocal = localStorage.getItem('link_published');
      if (flagCheckSession === 'true' || flagCheckLocal === 'true') {
        console.log('✅ [SUBMIT] Link published flag detected in checkProgress after getUserProgress, redirecting to /tasks:', {
          flagCheckSession,
          flagCheckLocal,
        });
        // ⚠️ ВАЖНО: Редиректим на /tasks, а не на главную
        setTimeout(() => {
          const finalCheckSession = sessionStorage.getItem('link_published');
          const finalCheckLocal = localStorage.getItem('link_published');
          console.log('🔍 [SUBMIT] RIGHT BEFORE redirect to /tasks (checkProgress after getUserProgress, 100ms delay):', {
            finalCheckSession,
            finalCheckLocal,
            timestamp: new Date().toISOString(),
            delay: '100ms',
          });
          router.replace('/tasks');
        }, 100);
        return;
      }
    }
    
    if (!progress) {
      router.replace('/'); // Используем replace, чтобы нельзя было вернуться
      return;
    }

    // Проверка: все 10 ссылок пройдены
    if (progress.completed_links.length < 10) {
      router.replace('/tasks'); // Используем replace
      return;
    }

    // Проверка: токен куплен
    if (!progress.token_purchased) {
      router.replace('/buyToken'); // Используем replace
      return;
    }

    // ⚠️ ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Если ссылка уже опубликована, редиректим на /tasks
    // Это предотвращает зацикливание, если пользователь случайно попал на /submit после публикации
    const linkAlreadyPublished = await checkIfLinkAlreadyPublished(userFid);
    
    // Финальная проверка флага перед редиректом
    if (typeof window !== 'undefined') {
      const finalFlagCheckSession = sessionStorage.getItem('link_published');
      const finalFlagCheckLocal = localStorage.getItem('link_published');
      if (finalFlagCheckSession === 'true' || finalFlagCheckLocal === 'true' || linkAlreadyPublished) {
        console.log('✅ [SUBMIT] Link already published (final check in checkProgress), redirecting to /tasks:', {
          finalFlagCheckSession,
          finalFlagCheckLocal,
          linkAlreadyPublished,
        });
        // Устанавливаем флаг в ОБА хранилища для надежности
        sessionStorage.setItem('link_published', 'true');
        localStorage.setItem('link_published', 'true');
        // ⚠️ ВАЖНО: Редиректим на /tasks, а не на главную
        setTimeout(() => {
          const finalCheckSession = sessionStorage.getItem('link_published');
          const finalCheckLocal = localStorage.getItem('link_published');
          console.log('🔍 [SUBMIT] RIGHT BEFORE redirect to /tasks (checkProgress final check, 100ms delay):', {
            finalCheckSession,
            finalCheckLocal,
            linkAlreadyPublished,
            timestamp: new Date().toISOString(),
            delay: '100ms',
          });
          router.replace('/tasks');
        }, 100);
        return;
      }
    }
    
    if (linkAlreadyPublished) {
      console.log('✅ [SUBMIT] Link already published (from DB), redirecting to /tasks');
      // Устанавливаем флаг в ОБА хранилища для надежности
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('link_published', 'true');
        localStorage.setItem('link_published', 'true');
      }
      // ⚠️ ВАЖНО: Редиректим на /tasks, а не на главную
      setTimeout(() => {
        const finalCheckSession = sessionStorage.getItem('link_published');
        const finalCheckLocal = localStorage.getItem('link_published');
        console.log('🔍 [SUBMIT] RIGHT BEFORE redirect to /tasks (linkAlreadyPublished, 100ms delay):', {
          finalCheckSession,
          finalCheckLocal,
          timestamp: new Date().toISOString(),
          delay: '100ms',
        });
        router.replace('/tasks');
      }, 100);
      return;
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
        console.log('📊 [SUBMIT] Saved link data:', {
          id: data.link.id,
          activity_type: data.link.activity_type,
          user_fid: data.link.user_fid,
          cast_url: data.link.cast_url?.substring(0, 50) + '...',
        });
        
        // ⚠️ КРИТИЧЕСКИ ВАЖНО: Устанавливаем флаг СРАЗУ после успешного API ответа
        // ДО любых других операций, включая setState и асинхронные вызовы
        // Это гарантирует, что флаг будет установлен до возможного редиректа
        if (typeof window !== 'undefined') {
          const beforeSetItemEventId = logEvent('⏱️ [SUBMIT]', {
            action: 'BEFORE setItem',
            sessionStorageBefore: sessionStorage.getItem('link_published'),
            localStorageBefore: localStorage.getItem('link_published'),
          });
          
          // Сохраняем в sessionStorage (быстрый доступ)
          sessionStorage.setItem('link_published', 'true');
          // Сохраняем в localStorage (сохраняется между табами и более надежен)
          localStorage.setItem('link_published', 'true');
          
          // ⚠️ СИНХРОННАЯ проверка СРАЗУ после setItem (БЕЗ setTimeout!)
          // Это критически важно для понимания порядка событий
          const check1 = {
            session: sessionStorage.getItem('link_published'),
            local: localStorage.getItem('link_published'),
          };
          
          // Логируем СИНХРОННО сразу после setItem
          const afterSetItemEventId = logEvent('✅ [SUBMIT]', {
            action: 'AFTER setItem (SYNCHRONOUS)',
            check1,
            check1BothTrue: check1.session === 'true' && check1.local === 'true',
            sessionStorageType: typeof check1.session,
            localStorageType: typeof check1.local,
            sessionStorageEqualsTrue: check1.session === 'true',
            localStorageEqualsTrue: check1.local === 'true',
            beforeSetItemEventId,
          });
          
          // Небольшая задержка для проверки persistence после setState
          // Используем Promise для небольшой задержки без блокировки
          const checkPromise = new Promise<void>((resolve) => {
            setTimeout(() => {
              const check2 = {
                session: sessionStorage.getItem('link_published'),
                local: localStorage.getItem('link_published'),
              };
              
              const delayedCheckEventId = logEvent('⏱️ [SUBMIT]', {
                action: 'Delayed check (10ms after setItem)',
                check1,
                check2,
                check1BothTrue: check1.session === 'true' && check1.local === 'true',
                check2BothTrue: check2.session === 'true' && check2.local === 'true',
                beforeSetState: true,
                afterSetItemEventId,
              });
              
              // КРИТИЧЕСКАЯ ПРОВЕРКА: Убеждаемся, что флаг действительно установлен
              if (check1.session !== 'true' || check1.local !== 'true') {
                logEvent('❌ [SUBMIT]', {
                  action: 'CRITICAL: Flag not set correctly after setItem!',
                  check1,
                  check2,
                  afterSetItemEventId,
                  delayedCheckEventId,
                });
                // Пытаемся установить еще раз
                sessionStorage.setItem('link_published', 'true');
                localStorage.setItem('link_published', 'true');
                const retrySession = sessionStorage.getItem('link_published');
                const retryLocal = localStorage.getItem('link_published');
                logEvent('🔄 [SUBMIT]', {
                  action: 'Retry setItem - checking again',
                  retrySession,
                  retryLocal,
                  retrySessionEqualsTrue: retrySession === 'true',
                  retryLocalEqualsTrue: retryLocal === 'true',
                });
              } else {
                logEvent('✅ [SUBMIT]', {
                  action: 'Flag confirmed set correctly in BOTH storages after delay',
                  delayedCheckEventId,
                  afterSetItemEventId,
                });
              }
              
              resolve();
            }, 10);
          });
          
          // Ждем завершения проверки перед продолжением
          await checkPromise;
          
          sessionStorage.removeItem('redirect_to_submit_done');
        }
        
        // ТЕПЕРЬ устанавливаем state (это может вызвать ре-рендер, но флаг уже установлен)
        const beforeSetStateEventId = logEvent('⏱️ [SUBMIT]', {
          action: 'BEFORE setState (setPublishedLinkId, setShowSuccessModal)',
          flagStatus: {
            sessionStorage: sessionStorage.getItem('link_published'),
            localStorage: localStorage.getItem('link_published'),
          },
        });
        
        setPublishedLinkId(data.link.id);
        setShowSuccessModal(true);
        
        logEvent('✅ [SUBMIT]', {
          action: 'AFTER setState (setPublishedLinkId, setShowSuccessModal)',
          flagStatus: {
            sessionStorage: sessionStorage.getItem('link_published'),
            localStorage: localStorage.getItem('link_published'),
          },
          beforeSetStateEventId,
        });
        
        // Очищаем форму, чтобы предотвратить повторную отправку
        setCastUrl('');
        setError('');
        
        // Публикуем cast в Farcaster только для соответствующего типа активности
        // Это предотвращает спам и делает публикацию более targeted
        // ⚠️ ВАЖНО: Это асинхронная операция, НЕ блокирует выполнение
        // Флаг уже установлен выше, так что даже если useEffect сработает - он увидит флаг
        if (activity) {
          console.log('📤 [SUBMIT] Starting publishCastByActivityType (async, non-blocking):', {
            activity,
            castUrl: castUrl.substring(0, 50) + '...',
            flagBeforePublish: {
              sessionStorage: sessionStorage.getItem('link_published'),
              localStorage: localStorage.getItem('link_published'),
            },
            timestamp: new Date().toISOString(),
          });
          
          publishCastByActivityType(activity, castUrl).then((result) => {
            console.log('📤 [SUBMIT] publishCastByActivityType completed:', {
              success: result.success,
              error: result.error,
              flagAfterPublish: {
                sessionStorage: sessionStorage.getItem('link_published'),
                localStorage: localStorage.getItem('link_published'),
              },
              timestamp: new Date().toISOString(),
            });
            if (result.success) {
              console.log('✅ [SUBMIT] Cast published to Farcaster via MiniKit SDK');
            } else {
              console.warn('⚠️ [SUBMIT] Failed to publish cast to Farcaster:', result.error);
              // Не блокируем flow, если публикация не удалась
            }
          }).catch((publishError) => {
            console.error('❌ [SUBMIT] Error publishing cast to Farcaster:', {
              error: publishError,
              flagAfterError: {
                sessionStorage: sessionStorage.getItem('link_published'),
                localStorage: localStorage.getItem('link_published'),
              },
              timestamp: new Date().toISOString(),
            });
            // Не блокируем flow, если публикация не удалась
          });
        }
        
        // Финальная проверка флага после всех операций (но до return)
        const finalFlagCheckAfterAllOps = {
          sessionStorage: typeof window !== 'undefined' ? sessionStorage.getItem('link_published') : null,
          localStorage: typeof window !== 'undefined' ? localStorage.getItem('link_published') : null,
        };
        console.log('🔍 [SUBMIT] Final flag check AFTER all operations (before return):', {
          ...finalFlagCheckAfterAllOps,
          timestamp: new Date().toISOString(),
          aboutToReturn: true,
        });
        
        // НЕ делаем автоматический редирект - показываем модальное окно с поздравлением
        // Пользователь может выбрать другую активность через кнопку в модальном окне
        // НЕ меняем setLoading(false) здесь - оставляем loading=true чтобы форма была заблокирована
        // setLoading(false) будет вызван в finally только если будет ошибка
        return; // Выходим из функции сразу после успешной публикации
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
      setLoading(false); // Разблокируем форму только при ошибке
    }
    // finally блок убран - loading управляется вручную для предотвращения повторной отправки
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
              🚀 Publish Link
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
          <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-12 max-w-md w-full mx-4 border-4 border-success">
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
                Ваше задание опубликовано!
              </p>
              <p className="text-gray-600 mb-8">
                Ваша ссылка теперь доступна в списке заданий для других пользователей.
              </p>
              <div className="bg-success bg-opacity-10 rounded-2xl p-4 mb-8">
                <p className="text-sm text-gray-700 mb-2">
                  <strong>Следующие 10 пользователей</strong> пройдут вашу ссылку и выполнят выбранную активность.
                </p>
              </div>
              <Button
                onClick={() => {
                  console.log('🔍 [SUBMIT] Button "Выбрать другую активность" clicked', {
                    flagBeforeClick: {
                      sessionStorage: typeof window !== 'undefined' ? sessionStorage.getItem('link_published') : null,
                      localStorage: typeof window !== 'undefined' ? localStorage.getItem('link_published') : null,
                    },
                    timestamp: new Date().toISOString(),
                  });
                  
                  // Закрываем модальное окно
                  setShowSuccessModal(false);
                  
                  // Разблокируем форму
                  setLoading(false);
                  
                  // Очищаем selected_activity, так как пользователь хочет выбрать другую активность
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('selected_activity');
                    
                    // Флаг link_published уже установлен при успешной публикации,
                    // но убеждаемся, что он установлен (на случай, если что-то пошло не так)
                    const existingSessionFlag = sessionStorage.getItem('link_published');
                    const existingLocalFlag = localStorage.getItem('link_published');
                    
                    if (existingSessionFlag !== 'true' || existingLocalFlag !== 'true') {
                      console.warn('⚠️ [SUBMIT] Flag not found after publication - setting it now', {
                        existingSessionFlag,
                        existingLocalFlag,
                      });
                      sessionStorage.setItem('link_published', 'true');
                      localStorage.setItem('link_published', 'true');
                    }
                    
                    // Логируем перед редиректом
                    const beforeButtonRedirectEventId = logEvent('🔍 [SUBMIT]', {
                      action: 'RIGHT BEFORE redirect (button click)',
                      sessionStorage: sessionStorage.getItem('link_published'),
                      localStorage: localStorage.getItem('link_published'),
                    });
                  }
                  
                  // Переходим на главную страницу (главная страница сама очистит флаг при загрузке)
                  // Используем setTimeout для гарантии, что все операции завершены
                  setTimeout(() => {
                    if (typeof window !== 'undefined') {
                      const finalCheckSession = sessionStorage.getItem('link_published');
                      const finalCheckLocal = localStorage.getItem('link_published');
                      
                      const finalButtonRedirectEventId = logEvent('🚀 [SUBMIT]', {
                        action: 'Final check before router.replace("/") (button click, 100ms delay)',
                        finalCheckSession,
                        finalCheckLocal,
                        delay: '100ms',
                      });
                      
                      // Безопасное логирование callStack
                      try {
                        console.log(`📍 [ROUTER] router.replace('/') called from button click`, {
                          eventId: finalButtonRedirectEventId,
                          flagStatus: { finalCheckSession, finalCheckLocal },
                          callStack: new Error().stack?.substring(0, 500), // Ограничиваем размер
                        });
                      } catch (stackError) {
                        console.log(`📍 [ROUTER] router.replace('/') called from button click`, {
                          eventId: finalButtonRedirectEventId,
                          flagStatus: { finalCheckSession, finalCheckLocal },
                        });
                      }
                    }
                    router.replace('/');
                  }, 100);
                }}
                variant="success"
                fullWidth
                className="text-lg py-4"
              >
                Выбрать другую активность
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

