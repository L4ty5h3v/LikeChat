// Страница публикации ссылки
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
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
        composeParams.parentUrl = `https://farcaster.xyz/~/channel${config.channel}`;
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
      let farcasterUrl = `https://farcaster.xyz/~/compose?text=${encodeURIComponent(castTextWithHashtag)}`;
      
      // Добавляем канал в URL (если поддерживается Farcaster)
      // Пробуем несколько вариантов формата
      const channelParam = config.channel.replace('/', '');
      farcasterUrl += `&channel=${encodeURIComponent(channelParam)}`;
      
      // Альтернативный вариант: через parentUrl в URL
      // farcasterUrl += `&parentUrl=${encodeURIComponent(`https://farcaster.xyz/~/channel${config.channel}`)}`;

      await sdk.actions.openUrl({ url: farcasterUrl });
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
  const [canSubmit, setCanSubmit] = useState(true); // Публикация разрешена всегда
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [publishedLinkId, setPublishedLinkId] = useState<string | null>(null);


  // ⚠️ БЛОКИРОВКА НАВИГАЦИИ: Проверяем флаг при монтировании и блокируем навигацию назад
  useEffect(() => {
    // Если показывается поздравление, не делаем редирект - пользователь должен остаться на странице
    if (showSuccessModal) {
      console.log('✅ [SUBMIT] Success modal is showing, skipping redirect check');
      return;
    }
    
    // Проверяем флаг при монтировании компонента
    if (typeof window !== 'undefined') {
      const sessionFlag = sessionStorage.getItem('link_published');
      const localFlag = localStorage.getItem('link_published');
      
      if (sessionFlag === 'true' || localFlag === 'true') {
        console.log('🚫 [SUBMIT] Component mounted but link already published - redirecting to /tasks', {
          sessionFlag,
          localFlag,
          timestamp: new Date().toISOString(),
        });
        // Редиректим на страницу задач, а не на главную
        router.replace('/tasks');
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
          // Редиректим на страницу задач
          router.replace('/tasks');
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
  }, [router, showSuccessModal]); // Добавляем showSuccessModal в зависимости

  // ⚠️ СЛУШАТЕЛЬ STORAGE: Отслеживаем изменения в localStorage/sessionStorage из других вкладок/сессий
  useEffect(() => {
    // Если показывается поздравление, не делаем редирект - пользователь должен остаться на странице
    if (showSuccessModal) {
      console.log('✅ [SUBMIT] Success modal is showing, skipping storage event checks');
      return;
    }
    
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
            router.replace('/tasks');
          }
        }, 100);
      }
    };

    // Также проверяем изменения в sessionStorage (хотя storage event не срабатывает для sessionStorage)
    // Но мы можем проверить периодически
    const checkStorageInterval = setInterval(() => {
      // Если показывается поздравление, не делаем редирект
      if (showSuccessModal) {
        clearInterval(checkStorageInterval);
        return;
      }
      
      const sessionFlag = sessionStorage.getItem('link_published');
      const localFlag = localStorage.getItem('link_published');
      
      if (sessionFlag === 'true' || localFlag === 'true') {
        console.log('🔔 [SUBMIT] Periodic storage check - link_published detected:', {
          sessionFlag,
          localFlag,
          timestamp: new Date().toISOString(),
        });
        clearInterval(checkStorageInterval);
        setTimeout(() => router.replace('/tasks'), 100);
      }
    }, 500); // Проверяем каждые 500ms

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkStorageInterval);
    };
  }, [router, showSuccessModal]); // Добавляем showSuccessModal в зависимости

  useEffect(() => {
    // Если показывается поздравление, не делаем редирект - пользователь должен остаться на странице
    if (showSuccessModal) {
      console.log('✅ [SUBMIT] Success modal is showing, skipping auth and redirect checks');
      return;
    }
    
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
      
      // Если флаг установлен в ЛЮБОМ хранилище - редиректим на /tasks
      if (sessionFlag === 'true' || localFlag === 'true') {
        console.log('✅ [SUBMIT] Link already published, redirecting to /tasks');
        setTimeout(() => {
          router.replace('/tasks');
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
  }, [router, user, authLoading, isInitialized, showSuccessModal]); // Добавляем showSuccessModal в зависимости
  
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
    // Если показывается поздравление, не делаем редирект - пользователь должен остаться на странице
    if (showSuccessModal) {
      console.log('✅ [SUBMIT] Success modal is showing, skipping checkProgress redirect');
      return;
    }
    
    // Упрощенная проверка: только проверяем, не опубликована ли уже ссылка
    if (typeof window !== 'undefined') {
      const sessionFlag = sessionStorage.getItem('link_published');
      const localFlag = localStorage.getItem('link_published');
      if (sessionFlag === 'true' || localFlag === 'true') {
        console.log('✅ [SUBMIT] Link already published, redirecting to /tasks');
        router.replace('/tasks');
        return;
      }
    }

    // Проверка: ссылка уже опубликована
    const linkAlreadyPublished = await checkIfLinkAlreadyPublished(userFid);
    if (linkAlreadyPublished) {
      console.log('✅ [SUBMIT] Link already published, redirecting to /tasks');
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('link_published', 'true');
        localStorage.setItem('link_published', 'true');
      }
      router.replace('/tasks');
      return;
    }

    // Публикация ссылки разрешена всегда (все задания уже проверены)
    setCanSubmit(true);
  };

  const validateUrl = (url: string): boolean => {
    // Проверка формата URL Farcaster
    const urlPattern = /^https?:\/\/(farcaster\.xyz)\/.+/i;
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
      setError('Please enter a valid Farcaster cast link');
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
          completedCount: data.completedCount,
          otherLinksCount: data.otherLinksCount,
          requiredCount: data.requiredCount,
        });
        
        // Если ошибка связана с недостаточным количеством выполненных заданий
        if (data.completedCount !== undefined && data.requiredCount !== undefined) {
          const errorMessage = data.error || `Вы можете отправить свою ссылку только после выполнения 10 заданий. Выполнено: ${data.completedCount}/10`;
          setError(errorMessage);
          setLoading(false);
          // Редиректим на страницу заданий через 3 секунды
          setTimeout(() => {
            router.push('/tasks');
          }, 3000);
          return;
        }
        
        // Если ошибка связана с недостаточным количеством ссылок от других пользователей
        if (data.otherLinksCount !== undefined && data.requiredCount !== undefined) {
          const errorMessage = data.error || `Вы можете отправить свою ссылку только после того, как в чат было отправлено 10 других ссылок. Отправлено другими пользователями: ${data.otherLinksCount}/10`;
          setError(errorMessage);
          setLoading(false);
          // Редиректим на страницу заданий через 3 секунды
          setTimeout(() => {
            router.push('/tasks');
          }, 3000);
          return;
        }
        
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
        // ⚠️ ОТКЛЮЧЕНО: Автоматическая публикация каста с текстом "Liked via mini-app" отключена
        // Пользователь не хочет автоматически создавать репост/рекаст
        // if (activity) {
        //   console.log('📤 [SUBMIT] Starting publishCastByActivityType (async, non-blocking):', {
        //     activity,
        //     castUrl: castUrl.substring(0, 50) + '...',
        //     flagBeforePublish: {
        //       sessionStorage: sessionStorage.getItem('link_published'),
        //       localStorage: localStorage.getItem('link_published'),
        //     },
        //     timestamp: new Date().toISOString(),
        //   });
        //   
        //   publishCastByActivityType(activity, castUrl).then((result) => {
        //     console.log('📤 [SUBMIT] publishCastByActivityType completed:', {
        //       success: result.success,
        //       error: result.error,
        //       flagAfterPublish: {
        //         sessionStorage: sessionStorage.getItem('link_published'),
        //         localStorage: localStorage.getItem('link_published'),
        //       },
        //       timestamp: new Date().toISOString(),
        //     });
        //     if (result.success) {
        //       console.log('✅ [SUBMIT] Cast published to Farcaster via MiniKit SDK');
        //     } else {
        //       console.warn('⚠️ [SUBMIT] Failed to publish cast to Farcaster:', result.error);
        //     }
        //   }).catch((publishError) => {
        //     console.error('❌ [SUBMIT] Error publishing cast to Farcaster:', {
        //       error: publishError,
        //       flagAfterError: {
        //         sessionStorage: sessionStorage.getItem('link_published'),
        //         localStorage: localStorage.getItem('link_published'),
        //       },
        //       timestamp: new Date().toISOString(),
        //     });
        //   });
        // }
        
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
      
      const errorMessage = err.message || 'An error occurred';
      setError(errorMessage);
      setLoading(false); // Разблокируем форму только при ошибке
      
      // Если ошибка связана с недостаточным количеством выполненных заданий или ссылок от других пользователей, редиректим на /tasks
      if (errorMessage.includes('10 заданий') || errorMessage.includes('10 других ссылок') || 
          errorMessage.includes('completedCount') || errorMessage.includes('otherLinksCount') || 
          errorMessage.includes('других пользователей')) {
        setTimeout(() => {
          router.push('/tasks');
        }, 3000);
      }
    }
    // finally блок убран - loading управляется вручную для предотвращения повторной отправки
  };

  // Если показывается поздравление, показываем полноэкранную страницу с поздравлением
  if (showSuccessModal) {
    return (
      <Layout title="Congratulations!">
        {/* Hero Section с градиентом */}
        <div className="relative min-h-screen overflow-hidden">
          {/* Анимированный градиент фон */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent animate-gradient bg-300%"></div>
          
          {/* Геометрические фигуры */}
          <div className="absolute top-20 right-20 w-32 h-32 bg-white bg-opacity-10 rounded-full animate-float"></div>
          <div className="absolute bottom-32 left-20 w-24 h-24 bg-white bg-opacity-15 rounded-full animate-float" style={{animationDelay: '2s'}}></div>
          
          <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
            {/* Заголовок в стиле модного сайта */}
            <div className="text-center mb-16">
              <div className="relative -mt-2 sm:mt-0">
                <h1 className="text-white mb-12 sm:mb-24 leading-none flex items-center justify-center gap-4 sm:gap-8 px-4 sm:px-16">
                  <span className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white">
                    SUCCESS
                  </span>
                </h1>
              </div>

              <div className="flex items-center justify-center gap-3 sm:gap-6 mt-12 sm:mt-24 mb-8 sm:mb-16">
                <div className="w-10 sm:w-20 h-1 bg-white"></div>
                <div className="flex items-center gap-4">
                  {/* Увеличенное фото Миссис Крипто */}
                  <div className="w-28 h-28 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-white shadow-2xl">
                    <Image
                      src="/images/mrs-crypto.jpg"
                      alt="Mrs. Crypto"
                      width={160}
                      height={160}
                      className="w-full h-full object-cover"
                      priority
                      unoptimized
                    />
                  </div>
                </div>
                <div className="w-10 sm:w-20 h-1 bg-white"></div>
              </div>
              <p className="text-xl sm:text-3xl md:text-4xl text-white font-bold mb-4 tracking-wide px-4">
                <span className="text-white">🎉</span> CONGRATULATIONS <span className="text-white">🎉</span>
              </p>
              <p className="text-lg text-white text-opacity-90 max-w-2xl mx-auto">
                Your task has been published successfully!
              </p>
            </div>

            {/* Модная карточка поздравления */}
            <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-3xl shadow-2xl p-6 sm:p-12 mb-12 border border-white border-opacity-20 mt-6 sm:mt-12">
              <div className="text-center">
                <h2 className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-red-500 via-purple-600 to-pink-500 bg-clip-text text-transparent mb-4">
                  Congratulations!
                </h2>
                <p className="text-2xl sm:text-3xl text-gray-800 font-bold mb-6">
                  Your task has been published!
                </p>
                <p className="text-lg text-gray-600 mb-8">
                  Your link is now available in the task list for other users.
                </p>
                <div className="bg-gradient-to-r from-red-500/10 via-purple-600/10 to-pink-500/10 rounded-2xl p-6 mb-8 border border-red-500/20">
                  <p className="text-base text-gray-700">
                    <strong>The next 10 users</strong> will go through your link and perform the selected activity.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    console.log('🔍 [SUBMIT] Button "Close" clicked - redirecting to / (home page)');
                    // Закрываем поздравление и сразу редиректим на главную страницу
                    // НЕ устанавливаем setShowSuccessModal(false) перед редиректом, чтобы useEffect не сработал
                    setLoading(false);
                    // Редиректим на главную страницу сразу, без задержки
                    router.replace('/');
                  }}
                  variant="primary"
                  fullWidth
                  className="text-lg py-4"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!canSubmit) {
    return (
      <Layout title="Checking Access...">
        <div className="relative min-h-screen overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent animate-gradient bg-300%"></div>
          <div className="relative z-10 flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white text-xl font-bold">Checking progress...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }


  return (
    <Layout title="Multi Like - Publish Link">
      {/* Hero Section с градиентом */}
      <div className="relative min-h-screen overflow-hidden">
        {/* Анимированный градиент фон */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent animate-gradient bg-300%"></div>
        
        {/* Геометрические фигуры */}
        <div className="absolute top-20 right-20 w-32 h-32 bg-white bg-opacity-10 rounded-full animate-float"></div>
        <div className="absolute bottom-32 left-20 w-24 h-24 bg-white bg-opacity-15 rounded-full animate-float" style={{animationDelay: '2s'}}></div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
          {/* Заголовок в стиле модного сайта */}
          <div className="text-center mb-16">
            <div className="relative -mt-2 sm:mt-0">
              <h1 className="text-white mb-12 sm:mb-24 leading-none flex items-center justify-center gap-4 sm:gap-8 px-4 sm:px-16">
                <span className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white">
                  PUBLISH
                </span>
                <span className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white">
                  LINK
                </span>
              </h1>
            </div>

            <div className="flex items-center justify-center gap-3 sm:gap-6 mt-12 sm:mt-24 mb-8 sm:mb-16">
              <div className="w-10 sm:w-20 h-1 bg-white"></div>
              <div className="flex items-center gap-4">
                {/* Увеличенное фото Миссис Крипто */}
                <div className="w-28 h-28 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-white shadow-2xl">
                  <Image
                    src="/images/mrs-crypto.jpg"
                    alt="Mrs. Crypto"
                    width={160}
                    height={160}
                    className="w-full h-full object-cover"
                    priority
                    unoptimized
                  />
                </div>
              </div>
              <div className="w-10 sm:w-20 h-1 bg-white"></div>
            </div>
            <p className="text-xl sm:text-3xl md:text-4xl text-white font-bold mb-4 tracking-wide px-4">
              <span className="text-white">🚀</span> PUBLISH YOUR LINK <span className="text-white">🚀</span>
            </p>
            <p className="text-lg text-white text-opacity-90 max-w-2xl mx-auto">
              Share your link for mutual support
            </p>
          </div>

          {/* Модная карточка публикации */}
          <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-3xl shadow-2xl p-6 sm:p-12 mb-12 border border-white border-opacity-20 mt-6 sm:mt-12">


            <div className="mb-8">
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-3 text-center">
                PUBLISH YOUR LINK
              </h2>
              <p className="text-lg text-gray-700 text-center">
                Insert your cast link from Farcaster
              </p>
            </div>

            {/* Информация о выбранной активности */}
            <div className="bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 rounded-xl p-6 mb-6 border border-primary/20">
              <p className="text-sm text-gray-700 mb-3 font-semibold">
                Selected activity:
              </p>
              <div className="flex items-center gap-3 text-primary font-bold text-xl">
                {activity === 'like' && (
                  <>
                    <span className="text-3xl">❤️</span>
                    <span>LIKE</span>
                  </>
                )}
                {activity === 'recast' && (
                  <>
                    <span className="text-3xl">🔄</span>
                    <span>RECAST</span>
                  </>
                )}
                {activity === 'comment' && (
                  <>
                    <span className="text-3xl">💬</span>
                    <span>COMMENT</span>
                  </>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-3">
                Other users will perform this activity on your link
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label
                  htmlFor="castUrl"
                  className="block text-lg font-bold text-gray-900 mb-3"
                >
                  Link to your cast:
                </label>
                <input
                  type="url"
                  id="castUrl"
                  value={castUrl}
                  onChange={(e) => setCastUrl(e.target.value)}
                  placeholder="https://farcaster.xyz/username/0x123abc..."
                  className="w-full px-6 py-4 border-2 border-gray-300 rounded-xl focus:border-primary focus:outline-none transition-colors text-lg"
                  required
                />
                <p className="text-sm text-gray-500 mt-2">
                  Example: https://farcaster.xyz/username/0x123abc
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 mb-6">
                  <p className="text-red-800 font-bold flex items-center gap-2 text-lg">
                    <span>❌</span>
                    {error}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !castUrl}
                style={{ background: (loading || !castUrl) ? 'linear-gradient(to right, #C0A030, #9A7308)' : 'linear-gradient(to right, #FFD700, #B8860B)' }}
                className={`
                  w-full text-base sm:text-xl px-8 sm:px-16 py-4 sm:py-6 font-bold rounded-2xl shadow-2xl 
                  transform transition-all duration-300 relative z-10 text-white
                  hover:shadow-xl hover:shadow-yellow-500/50
                  ${loading || !castUrl
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'opacity-100 cursor-pointer hover:scale-105 active:scale-95'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:transform-none
                `}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>PUBLISHING...</span>
                  </div>
                ) : (
                  '🚀 PUBLISH LINK'
                )}
              </button>
            </form>
          </div>

          {/* Модная инструкция */}
          <div className="bg-gradient-to-r from-primary via-secondary to-accent text-white rounded-3xl p-8 shadow-2xl mt-32">
            <h3 className="text-3xl font-black mb-6 flex items-center gap-3 font-display">
              <span className="text-4xl">📝</span>
              WHAT'S NEXT?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-white bg-opacity-20 rounded-xl">
                  <span className="text-3xl font-black text-accent">01</span>
                  <span className="font-bold text-xl">Your link will be added to queue</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white bg-opacity-20 rounded-xl">
                  <span className="text-3xl font-black text-accent">02</span>
                  <span className="font-bold text-xl">Next 10 users will complete your link</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-white bg-opacity-20 rounded-xl">
                  <span className="text-3xl font-black text-accent">03</span>
                  <span className="font-bold text-xl">They will perform your selected activity</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white bg-opacity-20 rounded-xl">
                  <span className="text-3xl font-black text-accent">04</span>
                  <span className="font-bold text-xl">You get mutual support from community</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </Layout>
  );
}

