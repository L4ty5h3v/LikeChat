// Страница публикации ссылки
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { useAccount } from 'wagmi';
import Layout from '@/components/Layout';
import Button from '@/components/Button';
import { useFarcasterAuth } from '@/contexts/FarcasterAuthContext';
import type { TaskType } from '@/types';
import { REQUIRED_BUYS_TO_PUBLISH, TASKS_LIMIT } from '@/lib/app-config';
import { isAddress } from 'viem';
import { baseAppContentUrlFromTokenAddress, tokenAddressFromBaseAppContentUrl } from '@/lib/base-content';
import { setFlowStep } from '@/lib/flow';

// Base-версия: публикация "каста" через Farcaster SDK отключена
async function publishCastByActivityType(_taskType: TaskType, _castUrl: string): Promise<{ success: boolean; error?: string }> {
      return { success: true };
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
  const { user, isInitialized } = useFarcasterAuth();
  const { address, chainId, isConnected } = useAccount();
  const [activity, setActivity] = useState<TaskType | null>(null);
  const [tokenAddress, setTokenAddress] = useState('');
  const [error, setError] = useState('');
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [canSubmit, setCanSubmit] = useState(true); // Публикация разрешена всегда
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [publishedLinkId, setPublishedLinkId] = useState<string | null>(null);
  const DRAFT_KEY = 'likechat:draft_token_address_v1';

  // In WebViews wagmi's `address` can be empty even when the wallet is connected.
  // Use the same "effective address" strategy as /tasks so on-chain verification works reliably.
  const effectiveAddress = useMemo(() => {
    if (address && isAddress(address)) return address;
    const ua = (user as any)?.address;
    if (typeof ua === 'string' && isAddress(ua)) return ua;

    // Fallback: localStorage base_user may contain address (set by auth flow on /).
    try {
    if (typeof window !== 'undefined') {
        const raw = window.localStorage?.getItem('base_user');
        if (raw) {
          const parsed: any = JSON.parse(raw);
          const la = parsed?.address;
          if (typeof la === 'string' && isAddress(la)) return la;
      }
    }
    } catch {
      // ignore
    }

    // Fallback: window.ethereum (non-interactive: eth_accounts)
    try {
      if (typeof window !== 'undefined') {
        const eth = (window as any).ethereum;
        const sa = eth?.selectedAddress;
        if (typeof sa === 'string' && isAddress(sa)) return sa;
      }
    } catch {
      // ignore
    }

    return '';
  }, [address, user]);


  // IMPORTANT: Do not use a client-side "link_published" flag.
  // It can get stuck in WebViews and incorrectly block publishing.
  // We rely on server-side checks in /api/submit-link (403/409) instead.

  // Fail-safe: never let the page spin forever in a WebView.
  useEffect(() => {
    if (!isCheckingAccess) return;
    const t = setTimeout(() => {
      setIsCheckingAccess(false);
      setCanSubmit(false);
      setError((prev) => prev || 'Unable to check access. Please reopen the app inside Base/Farcaster MiniApp and try again.');
    }, 6000);
    return () => clearTimeout(t);
  }, [isCheckingAccess]);

  useEffect(() => {
    if (showSuccessModal) return;
    
    // Base-версия: активность всегда support - устанавливаем сразу, не ждём isInitialized
    if (typeof window !== 'undefined') {
      localStorage.setItem('selected_activity', 'support');
    }
    setActivity('support');
    console.log('✅ [SUBMIT] Activity set to "support" for Base App');
    
    if (!isInitialized) {
      console.log('⏳ [SUBMIT] Waiting for auth initialization...');
      return;
    }

    if (!user || !user.fid) {
      setCanSubmit(false);
      setError('Publish is available only inside Base / Farcaster MiniApp. Please open the app there and try again.');
      setIsCheckingAccess(false);
      return;
    }
      
    void checkProgress(user.fid);
  }, [user, isInitialized, showSuccessModal]);

  // Persist step + draft so users don't lose context when leaving to create a tokenized post / confirm tx.
  useEffect(() => {
    setFlowStep('submit');
    if (typeof window === 'undefined') return;
    try {
      const draft = window.localStorage.getItem(DRAFT_KEY);
      if (draft && !tokenAddress) {
        // If draft is a Base URL, try to decode to token address.
        const decoded = tokenAddressFromBaseAppContentUrl(draft);
        setTokenAddress((decoded || draft).toString());
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, user?.fid]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (tokenAddress) window.localStorage.setItem(DRAFT_KEY, tokenAddress);
    } catch {
      // ignore
    }
  }, [tokenAddress]);

  const checkProgress = async (userFid: number) => {
    setIsCheckingAccess(true);
    
    // ✅ ИСКЛЮЧЕНИЕ: Пользователи svs-smm и assayer всегда могут вносить ссылки без ограничений
    const usernameLower = user?.username ? user.username.toLowerCase() : '';
    const isPrivilegedUser = usernameLower === 'svs-smm' || usernameLower === 'assayer';
    if (isPrivilegedUser) {
      console.log(`✅ [SUBMIT] Privileged user detected (${usernameLower}) - bypassing all checks`);
      setCanSubmit(true);
      setError('');
      setIsCheckingAccess(false);
      return;
    }
    
    // Require: user must complete REQUIRED_BUYS_TO_PUBLISH buys before publishing.
    try {
      const progressRes = await fetch(`/api/user-progress?userFid=${userFid}&t=${Date.now()}`);
      const progressJson = await progressRes.json();
      const completedCount = Array.isArray(progressJson?.progress?.completed_links)
        ? progressJson.progress.completed_links.length
        : 0;

      if (completedCount < REQUIRED_BUYS_TO_PUBLISH) {
        // Fallback: if DB progress is missing (common when Upstash isn't configured),
        // verify buys onchain using the connected wallet.
        const wallet = (effectiveAddress || '').toString().trim();
        if (wallet) {
          try {
            const vr = await fetch('/api/verify-buys', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ walletAddress: wallet, taskType: activity || 'support' }),
            });
            const vj = await vr.json();
            const verified = typeof vj?.verifiedOnchainCount === 'number' ? vj.verifiedOnchainCount : 0;
            if (vr.ok && vj?.success && verified >= REQUIRED_BUYS_TO_PUBLISH) {
              setCanSubmit(true);
              setError('');
      return;
    }
            setCanSubmit(false);
            setError(
              `You need to buy ${REQUIRED_BUYS_TO_PUBLISH} posts first. Progress: ${completedCount}/${REQUIRED_BUYS_TO_PUBLISH}.`
            );
        return;
          } catch {
            // fall through to default error below
          }
        }

        setCanSubmit(false);
        setError(`You need to buy ${REQUIRED_BUYS_TO_PUBLISH} posts first. Progress: ${completedCount}/${REQUIRED_BUYS_TO_PUBLISH}.`);
      return;
    }

    setCanSubmit(true);
    } catch (e: any) {
      // Fail safe: do not allow submit if we cannot verify progress.
      setCanSubmit(false);
      setError('Unable to verify progress. Please return to tasks and try again.');
    } finally {
      setIsCheckingAccess(false);
    }
  };

  const validateUrl = (url: string): boolean => {
    const trimmed = (url || '').trim();
    // Base posts are usually shared as base.app/content/... (or base.app/post/...).
    const urlPattern = /^https?:\/\/(www\.)?base\.app\/(content|post)\/.+/i;
    return urlPattern.test(trimmed);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Network guard: publishing is for Base.
    // In some WebViews chainId can be undefined; only block when we *know* it's not Base.
    if (isConnected && chainId && chainId !== 8453) {
      setError('Switch network to Base (8453) and try again.');
      return;
    }
    
    // ⚠️ ДЕТАЛЬНАЯ ПРОВЕРКА: Проверяем наличие всех необходимых данных
    console.log('🔍 [SUBMIT] Starting submission process...');
    console.log('🔍 [SUBMIT] User data:', {
      user: user ? {
        fid: user.fid,
        username: user.username,
        hasPfp: !!user.pfp_url,
      } : 'NULL',
      activity,
      castUrl: 'REMOVED',
    });
    
    // Проверяем наличие user из контекста
    if (!user) {
      console.error('❌ [SUBMIT] User is null in context!');
      setError('Error: user data not found. Please authorize again.');
      return;
    }
    
    // Для Base App activity всегда должен быть 'support'
    const finalActivity = activity || 'support';
    
    if (!finalActivity || !tokenAddress) {
      console.error('❌ [SUBMIT] Missing required data:', {
        hasUser: !!user,
        hasActivity: !!finalActivity,
        activityValue: finalActivity,
        hasCastUrl: false,
        hasTokenAddress: !!tokenAddress,
        tokenAddressValue: tokenAddress,
      });
      setError('Please fill in all required fields');
      return;
    }
    
    console.log('✅ [SUBMIT] All required fields present:', {
      hasUser: !!user,
      activity: finalActivity,
      hasTokenAddress: !!tokenAddress,
    });

    // Normalize: allow pasting a Base content URL; decode it to token address.
    const maybeDecoded = tokenAddressFromBaseAppContentUrl(tokenAddress);
    const normalizedTokenAddress = (maybeDecoded || tokenAddress).toString().trim().toLowerCase();
    if (!isAddress(normalizedTokenAddress)) {
      setError('Please enter a valid ERC-20 token address (0x...) or paste a valid https://base.app/content/... URL.');
      return;
    }
    
    // ⚠️ ПРОВЕРКА FID: Убеждаемся, что fid существует и валиден
    if (!user.fid || typeof user.fid !== 'number') {
      console.error('❌ [SUBMIT] Invalid or missing user.fid:', user.fid);
      setError('Error: missing user id. Please refresh and try again.');
      return;
    }
    
    if (!user.username) {
      console.warn('⚠️ [SUBMIT] Missing username, using fallback');
      user.username = `user_${user.fid}`;
    }

    setError('');

    // Critical UX: Base App doesn't provide a clear tokenized-post URL.
    // Publishing requires only token address.

    setLoading(true);

    try {
      // Публикация cast убрана - чтобы избежать баннера "Upgrade to Pro"
      // Сохраняем ссылку в базе данных через API endpoint
      // ⚠️ ВАЖНО: Используем finalActivity (выбранный тип заданий) как taskType для публикации
      // Это гарантирует, что ссылка публикуется с тем же типом, который пользователь прошел
      const submissionData = {
        userFid: user.fid,
        username: user.username,
        pfpUrl: user.pfp_url || '',
        castUrl: '', // removed from UI; keep field for backward compatibility
        taskType: finalActivity, // Используем taskType вместо activityType для ясности
        activityType: finalActivity, // Оставляем для обратной совместимости
        tokenAddress: normalizedTokenAddress,
        // Wallet is needed for onchain verification fallback (when DB is not persistent).
        walletAddress: (effectiveAddress || '').toString(),
      };
      
      console.log('📝 [SUBMIT] Publishing link with taskType:', {
        taskType: finalActivity,
        userFid: user.fid,
        username: user.username,
      });
      
      console.log('📝 [SUBMIT] Submitting link via API...', {
        ...submissionData,
        taskType: finalActivity,
        activityType: finalActivity,
        castUrl: 'EMPTY (removed)',
      });

      const response = await fetch('/api/submit-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...submissionData,
          taskType: finalActivity,
          activityType: finalActivity,
        }),
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
          const errorMessage = data.error || `You can submit only after completing ${REQUIRED_BUYS_TO_PUBLISH} buys. Completed: ${data.completedCount}/${REQUIRED_BUYS_TO_PUBLISH}`;
          setError(errorMessage);
          setLoading(false);
          return;
        }
        
        // Если ошибка связана с недостаточным количеством ссылок от других пользователей
        if (data.otherLinksCount !== undefined && data.requiredCount !== undefined) {
          const errorMessage = data.error || `You can submit only after ${TASKS_LIMIT} other posts are in the queue. Other posts: ${data.otherLinksCount}/${TASKS_LIMIT}`;
          setError(errorMessage);
          setLoading(false);
          return;
        }
        
        throw new Error(data.error || 'Failed to submit link');
      }

      if (data.link) {
        // Успешная публикация
        console.log('✅ [SUBMIT] Link saved to database via API:', data.link.id);
        console.log('📊 [SUBMIT] Saved link data:', {
          id: data.link.id,
          task_type: data.link.task_type,
          user_fid: data.link.user_fid,
          cast_url: data.link.cast_url?.substring(0, 50) + '...',
        });
        
        setPublishedLinkId(data.link.id);
        setShowSuccessModal(true);
        
        // Clear draft once published.
        try {
          if (typeof window !== 'undefined') window.localStorage.removeItem(DRAFT_KEY);
        } catch {
          // ignore
        }
        
        // Очищаем форму, чтобы предотвратить повторную отправку
        setTokenAddress('');
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
      setLoading(false); // Unlock the form only on error
    }
    // finally блок убран - loading управляется вручную для предотвращения повторной отправки
  };

  // Если показывается поздравление, показываем полноэкранную страницу с поздравлением
  if (showSuccessModal) {
    return (
      <Layout title="Success!">
        {/* Hero Section с градиентом */}
        <div className="relative min-h-screen overflow-x-hidden">
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
                  <span className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white">Success!</span>
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
            </div>

            {/* Модная карточка поздравления */}
            <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-3xl shadow-2xl p-6 sm:p-12 mb-12 border border-white border-opacity-20 mt-6 sm:mt-12">
              <div className="text-center">
                <h2 className="text-2xl sm:text-5xl font-black bg-gradient-to-r from-red-500 via-purple-600 to-pink-500 bg-clip-text text-transparent mb-4 leading-tight break-words px-3 py-1 overflow-visible">
                  Congratulations!
                </h2>
                <p className="text-2xl sm:text-3xl text-gray-800 font-bold mb-8">
                  Your link has been added!
                </p>
                <div className="bg-gradient-to-r from-red-500/10 via-purple-600/10 to-pink-500/10 rounded-2xl p-6 mb-8 border border-red-500/20">
                  <p className="text-base text-gray-700">
                    <strong>The next 4 users</strong> will buy your post.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    console.log('🔍 [SUBMIT] Button "Close" clicked - redirecting to / (home page)');
                    // Закрываем поздравление и сразу редиректим на главную страницу
                    // НЕ устанавливаем setShowSuccessModal(false) перед редиректом, чтобы useEffect не сработал
                    setLoading(false);
                    // Редиректим на главную страницу сразу, без задержки
                    router.replace(`/tasks?published=1${publishedLinkId ? `&linkId=${encodeURIComponent(publishedLinkId)}` : ''}`);
                  }}
                  variant="primary"
                  fullWidth
                  className="text-lg py-4"
                >
                  Back to tasks
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (isCheckingAccess) {
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

  if (!canSubmit) {
    return (
      <Layout title="Add Your Post">
        <div className="relative min-h-screen overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent animate-gradient bg-300%"></div>
          <div className="relative z-10 flex items-center justify-center min-h-screen px-6">
            <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-3xl shadow-2xl p-6 sm:p-10 border border-white/30 max-w-xl w-full">
              <div className="text-center">
                <h2 className="text-2xl sm:text-4xl font-black text-gray-900 mb-4">Can’t publish yet</h2>
                <p className="text-gray-700 font-bold mb-8">{error || 'Access is not available.'}</p>
                <div className="flex flex-col gap-3">
                  <Button
                    onClick={() => {
                      setError('');
                      setIsCheckingAccess(true);
                      if (user?.fid) void checkProgress(user.fid);
                    }}
                    variant="primary"
                    fullWidth
                  >
                    Retry
                  </Button>
                  <Button onClick={() => router.push('/tasks')} variant="secondary" fullWidth>
                    Back to tasks
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-6">
                  Tip: this page requires your Farcaster/Base MiniApp profile (FID). If you opened the site in a regular browser,
                  please open it inside the Base / Farcaster app.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }


  return (
    <Layout title="MULTI LIKE - Add Your Post">
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
                  POST
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
              <span className="text-white">🚀</span> ADD YOUR POST <span className="text-white">🚀</span>
            </p>
            <p className="text-lg text-white text-opacity-90 max-w-2xl mx-auto">
              Add link to post you want to sell
            </p>
          </div>

          {/* Модная карточка публикации */}
          <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-3xl shadow-2xl p-6 sm:p-12 mb-12 border border-white border-opacity-20 mt-6 sm:mt-12">

            {/* Информация о выбранной активности */}
            <div className="bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 rounded-xl p-6 mb-6 border border-primary/20">
              <p className="text-sm text-gray-700 mb-3 font-semibold">You accepted task:</p>
              <div className="flex items-center gap-3 text-primary font-bold text-xl flex-wrap">
                <span className="text-3xl">💎</span>
                <span>BUY $0.10</span>
                <span className="text-gray-600 font-semibold">– Other users will buy your post</span>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label
                  htmlFor="tokenAddress"
                  className="block text-lg font-bold text-gray-900 mb-3"
                >
                  Your tokenized post (ERC-20 address or base.app/content URL)
                </label>
                <input
                  type="text"
                  id="tokenAddress"
                  name="erc20_token_address"
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  onPaste={(e) => {
                    // Разрешаем стандартную вставку
                    const pastedText = e.clipboardData.getData('text');
                    if (pastedText) {
                      e.preventDefault();
                      setTokenAddress(pastedText.trim());
                    }
                  }}
                  placeholder="0x... or https://base.app/content/..."
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  inputMode="text"
                  className="w-full px-6 py-4 border-2 border-gray-300 rounded-xl focus:border-primary focus:outline-none transition-colors text-lg"
                  required
                />

                {isAddress(tokenAddress.trim().toLowerCase() as any) && (
                  <p className="text-sm text-gray-600 mt-3 break-all">
                    Base content URL (auto):{' '}
                    <span className="font-mono">
                      {baseAppContentUrlFromTokenAddress(tokenAddress.trim().toLowerCase())}
                    </span>
                  </p>
                )}
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
                disabled={loading || !tokenAddress}
                className={`btn-gold-glow w-full text-base sm:text-xl px-8 sm:px-16 py-4 sm:py-6 font-bold text-white group ${
                  loading || !tokenAddress ? 'disabled' : ''
                }`}
              >
                {/* Переливающийся эффект */}
                {!loading && tokenAddress && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                )}
                {/* Внутреннее свечение */}
                {!loading && tokenAddress && (
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
                )}
                <span className="relative z-20 drop-shadow-lg">
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>PUBLISHING...</span>
                  </div>
                ) : (
                  '🚀 ADD YOUR POST'
                )}
                </span>
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
                  <span className="font-bold text-xl">The next 4 users will buy your post</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-white bg-opacity-20 rounded-xl">
                  <span className="text-3xl font-black text-accent">03</span>
                  <span className="font-bold text-xl">They will perform your selected task</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white bg-opacity-20 rounded-xl">
                  <span className="text-3xl font-black text-accent">04</span>
                  <span className="font-bold text-xl">You get multiple buyers</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </Layout>
  );
}

