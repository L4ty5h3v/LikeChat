// Главная страница: авторизация и выбор активности
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Layout from '@/components/Layout';
import ActivityButton from '@/components/ActivityButton';
import Button from '@/components/Button';
import { setUserActivity } from '@/lib/db-config';
import { getUserByFid } from '@/lib/neynar';
import type { ActivityType, FarcasterUser } from '@/types';
import { useFarcasterAuth } from '@/contexts/FarcasterAuthContext';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { user, setUser, isLoading: authLoading, isInitialized } = useFarcasterAuth();
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(null);
  const [mounted, setMounted] = useState(false);
  const [errorModal, setErrorModal] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [success, setSuccess] = useState(false);

  // Проверка сохраненной сессии
  useEffect(() => {
    // Устанавливаем mounted сразу, чтобы кнопка была видна
    setMounted(true);
    
    // Проверяем localStorage только на клиенте
    if (typeof window !== 'undefined') {
      // ⚠️ КРИТИЧЕСКИ ВАЖНО: Очищаем link_published флаг при загрузке главной страницы
      // Это позволяет пользователю начать новый цикл публикации
      // Делаем это СРАЗУ при монтировании компонента, до любой другой логики
      const linkPublishedFlag = sessionStorage.getItem('link_published') || localStorage.getItem('link_published');
      if (linkPublishedFlag === 'true') {
        console.log('🧹 [INDEX] Clearing link_published flag on home page mount (new cycle can start)', {
          sessionStorage: sessionStorage.getItem('link_published'),
          localStorage: localStorage.getItem('link_published'),
          timestamp: new Date().toISOString(),
        });
        sessionStorage.removeItem('link_published');
        localStorage.removeItem('link_published');
        console.log('✅ [INDEX] Flag cleared - new publication cycle can start', {
          sessionStorageAfter: sessionStorage.getItem('link_published'),
          localStorageAfter: localStorage.getItem('link_published'),
          timestamp: new Date().toISOString(),
        });
      }
      
    const savedUser = localStorage.getItem('farcaster_user');
    const savedActivity = localStorage.getItem('selected_activity');
    
    if (savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          console.log('🔍 Loading saved user from localStorage:', parsedUser);
          
          // Проверяем валидность данных пользователя
          // Если данные не валидны (например, случайный пользователь), очищаем их
          if (parsedUser && parsedUser.fid && parsedUser.username) {
            // Проверяем, что это не случайный пользователь (например, user_176369225243)
            const isRandomUser = parsedUser.username.startsWith('user_') && 
                                 parsedUser.username.match(/^user_\d+$/);
            
            if (isRandomUser) {
              console.warn('⚠️ Random user detected in localStorage, clearing...');
              localStorage.removeItem('farcaster_user');
              setUser(null);
            } else {
              console.log('✅ Valid user data loaded from localStorage');
              setUser(parsedUser);
            }
          } else {
            console.warn('⚠️ Invalid user data in localStorage, clearing...');
            localStorage.removeItem('farcaster_user');
            setUser(null);
          }
        } catch (error) {
          console.error('❌ Error parsing saved user:', error);
          localStorage.removeItem('farcaster_user');
          setUser(null);
        }
    }
    
    if (savedActivity) {
      setSelectedActivity(savedActivity as ActivityType);
      }
    }
  }, []);

  // Авторизация через Farcaster кошелек
  const handleConnect = async () => {
    console.log('🔗 Farcaster authorization called');
    console.log('🔍 Current state:', { loading, user, mounted });
    
    // Предотвращаем повторные вызовы
    if (loading) {
      console.warn('⚠️ Already loading');
      return;
    }
    
    // Очищаем старые данные перед подключением
    if (typeof window !== 'undefined') {
      console.log('🧹 Clearing old user data from localStorage');
      localStorage.removeItem('farcaster_user');
      setUser(null);
    }
    
    // Сбрасываем состояние ошибки и успеха
    setErrorModal({ show: false, message: '' });
    setSuccess(false);
    setLoading(true);
    
    try {
      let farcasterUser: FarcasterUser | null = null;
      let walletAddress: string | null = null;
      
      // Пытаемся получить адрес кошелька через Farcaster Mini App SDK
      try {
        console.log('🔄 Connecting Farcaster wallet via SDK...');
        console.log('🔍 [WALLET-CONNECT] Starting wallet connection process...', {
          timestamp: new Date().toISOString(),
          windowAvailable: typeof window !== 'undefined',
        });
        
        // Используем Farcaster Mini App SDK для получения адреса кошелька
        if (typeof window !== 'undefined') {
          try {
            // Динамический импорт SDK с таймаутом
            console.log('📦 [WALLET-CONNECT] Importing Farcaster SDK...');
            const sdkModule = await Promise.race([
              import('@farcaster/miniapp-sdk'),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('SDK import timeout (5s)')), 5000)
              )
            ]) as any;
            const { sdk } = sdkModule;
            console.log('✅ [WALLET-CONNECT] SDK imported successfully');
            
            // Пробуем получить Ethereum провайдер через SDK
            console.log('🔄 Trying to get Ethereum provider via SDK...');
            try {
              // Импортируем getEthereumProvider напрямую из ethereumProvider
              const { getEthereumProvider } = await import('@farcaster/miniapp-sdk/dist/ethereumProvider');
              const provider = await getEthereumProvider();
              if (provider) {
                console.log('✅ Ethereum provider obtained from SDK');
                // Получаем адрес кошелька через провайдер
                try {
                  const accounts = await provider.request({ method: 'eth_requestAccounts' });
                  if (accounts && accounts.length > 0) {
                    walletAddress = accounts[0];
                    console.log('✅ Wallet address from SDK provider:', walletAddress);
                  }
                } catch (requestError: any) {
                  if (requestError.code === 4001) {
                    console.log('ℹ️ User rejected wallet connection');
                    setLoading(false);
                    return;
                  }
                  console.warn('⚠️ Provider request error:', requestError.message);
                }
              } else {
                console.log('ℹ️ SDK provider not available, trying window.ethereum...');
              }
            } catch (providerError: any) {
              console.log('ℹ️ Failed to get SDK provider, trying window.ethereum:', providerError.message);
            }
            
            // Fallback на window.ethereum если SDK провайдер недоступен
            if (!walletAddress) {
              const ethereum = (window as any).ethereum;
              if (ethereum) {
                console.log('🔄 Trying window.ethereum...');
                try {
                  if (ethereum.selectedAddress) {
                    walletAddress = ethereum.selectedAddress;
                    console.log('📍 Using already selected address:', walletAddress);
                  } else {
                    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                    if (accounts && accounts.length > 0) {
                      walletAddress = accounts[0];
                      console.log('📍 Wallet address from ethereum.request:', walletAddress);
                    }
                  }
                } catch (ethError: any) {
                  if (ethError.code === 4001) {
                    console.log('ℹ️ User rejected wallet connection');
                    setLoading(false);
                    return;
                  }
                  console.warn('⚠️ Ethereum provider error:', ethError.message);
                }
              }
            }
            
            // Также пробуем получить информацию о пользователе из SDK context
            console.log('🔄 Attempting to get SDK context...');
            try {
              const context = await sdk.context;
              console.log('📊 Farcaster SDK context received:', JSON.stringify(context, null, 2));
              console.log('📊 SDK context.user:', context?.user);
              console.log('📊 SDK context.user type:', typeof context?.user);
              
              // Если получили context с пользователем, используем его данные напрямую
              if (context?.user && context.user.fid) {
                console.log('✅ Farcaster user found in SDK context:', {
                  fid: context.user.fid,
                  username: context.user.username,
                  displayName: (context.user as any).displayName,
                  hasPfp: !!(context.user as any).pfp || !!(context.user as any).pfpUrl,
                });
                
                // Используем данные пользователя из SDK context
                farcasterUser = {
                  fid: Number(context.user.fid),
                  username: context.user.username || `user_${context.user.fid}`,
                  pfp_url: (context.user as any).pfp?.url || (context.user as any).pfpUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${context.user.fid}`,
                  display_name: (context.user as any).displayName || context.user.username || `User ${context.user.fid}`,
                };
                
                console.log('✅ Using Farcaster user from SDK context:', farcasterUser);
              } else {
                console.warn('⚠️ SDK context does not contain user data:', {
                  hasContext: !!context,
                  hasUser: !!context?.user,
                  userFid: context?.user?.fid,
                });
              }
            } catch (contextError: any) {
              console.error('❌ SDK context error:', {
                message: contextError.message,
                stack: contextError.stack,
                name: contextError.name,
              });
            }
          } catch (importError: any) {
            console.log('ℹ️ SDK import failed, trying window.ethereum:', importError.message);
            
            // Fallback на window.ethereum
            const ethereum = (window as any).ethereum;
            if (ethereum) {
              try {
                if (ethereum.selectedAddress) {
                  walletAddress = ethereum.selectedAddress;
                  console.log('📍 Using already selected address (fallback):', walletAddress);
                } else {
                  const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                  if (accounts && accounts.length > 0) {
                    walletAddress = accounts[0];
                    console.log('📍 Wallet address from ethereum.request (fallback):', walletAddress);
                  }
                }
              } catch (ethError: any) {
                if (ethError.code === 4001) {
                  console.log('ℹ️ User rejected wallet connection');
                  setLoading(false);
                  return;
                }
              }
            }
          }
        }
        
        // Если получили пользователя из SDK context, не требуем адрес кошелька
        if (farcasterUser && farcasterUser.fid) {
          console.log('✅ User obtained from SDK context, skipping wallet address requirement');
        } else {
          // Проверяем валидность адреса только если не получили пользователя из SDK
          if (walletAddress) {
            if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
              console.warn('⚠️ Invalid wallet address format:', walletAddress);
              walletAddress = null;
            } else {
              console.log('✅ Valid wallet address:', walletAddress);
            }
          }
          
          if (!walletAddress) {
            // Если кошелек не найден и нет пользователя из SDK, показываем ошибку
            console.error('❌ Farcaster wallet not detected and no user from SDK context');
            setErrorModal({
              show: true,
              message: '❌ Farcaster wallet not detected.\n\nPlease make sure:\n1. You are using Farcaster Mini App\n2. Wallet is connected and unlocked\n3. Connection requests are allowed\n\nTry refreshing the page and connecting the wallet again.'
            });
            setLoading(false);
            return;
          }
        }
      } catch (walletError: any) {
        console.error('❌ Wallet connection error:', {
          message: walletError.message,
          code: walletError.code,
          stack: walletError.stack,
        });
        setErrorModal({
          show: true,
          message: `❌ Wallet connection error:\n\n${walletError.message}\n\nCheck browser console for details.`
        });
        setLoading(false);
        return;
      }
      
      // Ищем пользователя Farcaster по адресу кошелька (если есть и еще не получили из SDK context)
      if (walletAddress && !farcasterUser) {
        console.log('🔍 Looking for Farcaster user by wallet address:', walletAddress);
        console.log('🔍 Wallet address validation:', {
          startsWith0x: walletAddress.startsWith('0x'),
          length: walletAddress.length,
          isValid: walletAddress.startsWith('0x') && walletAddress.length === 42,
        });
        
        try {
          console.log('📡 Sending request to /api/farcaster-user...');
          const response = await fetch('/api/farcaster-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ walletAddress }),
          });

          console.log('📡 Response status:', response.status);
          console.log('📡 Response ok:', response.ok);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ HTTP error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
          }

          const data = await response.json();
          console.log('📊 Full API response:', JSON.stringify(data, null, 2));
          console.log('📊 API response data.user:', data.user);
          console.log('📊 API response data.user type:', typeof data.user);
          console.log('📊 API response data.user value:', data.user);
          
          if (data.user && data.user.fid) {
            // Используем реальные данные из API
            console.log('✅ Valid user data received from API:', {
              fid: data.user.fid,
              username: data.user.username,
              pfp_url: data.user.pfp_url,
              display_name: data.user.display_name,
            });
            
            farcasterUser = {
              fid: Number(data.user.fid),
              username: data.user.username || `user_${data.user.fid}`,
              pfp_url: data.user.pfp_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.user.fid}`,
              display_name: data.user.display_name || data.user.username || `User ${data.user.fid}`,
            };
            
            console.log('✅ Farcaster user object created:', farcasterUser);
            console.log('✅ Real user data validation:', {
              hasFid: !!farcasterUser.fid,
              hasUsername: !!farcasterUser.username,
              hasPfpUrl: !!farcasterUser.pfp_url,
              hasDisplayName: !!farcasterUser.display_name,
            });
          } else {
            console.warn('⚠️ Farcaster user not found for wallet address:', walletAddress);
            console.warn('⚠️ API response structure:', {
              hasUser: !!data.user,
              userValue: data.user,
              userType: typeof data.user,
              hasWarning: !!data.warning,
              hasError: !!data.error,
            });
            console.warn('⚠️ Full API response:', JSON.stringify(data, null, 2));
            
            // Если API вернул предупреждение, выводим его
            if (data.warning) {
              console.warn('⚠️ API warning:', data.warning);
              setErrorModal({
                show: true,
                message: `⚠️ Warning: ${data.warning}\n\nMake sure Neynar API key is configured in environment variables.`
              });
            }
            
            // Если API вернул ошибку, выводим её
            if (data.error) {
              console.error('❌ API error:', data.error);
              setErrorModal({
                show: true,
                message: `❌ API error: ${data.error}`
              });
            }
          }
        } catch (error: any) {
          console.error('❌ Failed to fetch Farcaster user by address:', error);
          console.error('❌ Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
          });
          
          // Показываем пользователю детальную ошибку
          setErrorModal({
            show: true,
            message: `❌ Error fetching Farcaster user data:\n\n${error.message}\n\nCheck browser console for details.`
          });
        }
      }
      
      // Если не нашли по адресу, пробуем другие способы
      if (!farcasterUser) {
        if (walletAddress) {
          console.error('❌ Farcaster user not found for wallet:', walletAddress);
          setErrorModal({
            show: true,
            message: `Farcaster user not found for address ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}.\n\nPossible reasons:\n1. Wallet is not linked to Farcaster account\n2. Neynar API key is not configured\n3. API cannot find user by this address\n\nCheck browser console for details.`
          });
          setLoading(false);
          return;
      } else {
          console.error('❌ Farcaster wallet not detected');
          setErrorModal({
            show: true,
            message: 'Farcaster wallet not detected. Please use Farcaster wallet for authorization.'
          });
          setLoading(false);
          return;
        }
      }
      
      // Проверяем, что данные пользователя валидны
      if (!farcasterUser.fid || !farcasterUser.username) {
        console.error('❌ Invalid Farcaster user data:', farcasterUser);
        setErrorModal({
          show: true,
          message: 'Invalid Farcaster user data received. Please try again.'
        });
        setLoading(false);
        return;
      }
      
      // Валидируем fid
      if (typeof farcasterUser.fid !== 'number' || farcasterUser.fid <= 0) {
        console.error('❌ [INDEX] Invalid FID:', farcasterUser.fid);
        setErrorModal({
          show: true,
          message: `Invalid user FID: ${farcasterUser.fid}. Please reload the page.`
        });
        setLoading(false);
        return;
      }
      
      console.log('✅ [INDEX] Setting Farcaster user via context:', {
        fid: farcasterUser.fid,
        username: farcasterUser.username,
        hasPfp: !!farcasterUser.pfp_url,
      });
      
      // Сохраняем через контекст (автоматически сохранит в localStorage)
      setUser(farcasterUser);
      
      console.log('✅ [INDEX] User saved via context (should be in localStorage now)');
      
      if (typeof window !== 'undefined') {
        // ⚠️ ДОПОЛНИТЕЛЬНАЯ ОЧИСТКА ФЛАГА: Очищаем link_published флаг после успешной авторизации
        // (основная очистка уже выполнена в useEffect при монтировании, но на всякий случай)
        const linkPublishedFlag = sessionStorage.getItem('link_published') || localStorage.getItem('link_published');
        if (linkPublishedFlag === 'true') {
          console.log('🧹 [INDEX] Clearing link_published flag after successful auth (backup cleanup)');
          sessionStorage.removeItem('link_published');
          localStorage.removeItem('link_published');
        }
        
        // Проверяем, есть ли уже выбранная активность
        const savedActivity = localStorage.getItem('selected_activity');
        console.log('📋 [INDEX] Saved activity:', savedActivity);
        
        if (savedActivity) {
          // Если активность уже выбрана, переходим на страницу задач
          console.log('✅ [INDEX] Activity already selected, redirecting to /tasks');
          setTimeout(() => {
            console.log('🚀 [INDEX] Navigating to /tasks');
            router.push('/tasks');
          }, 500); // Небольшая задержка для плавного перехода
        } else {
          // Если активности нет, остаемся на странице для выбора
          console.log('✅ [INDEX] User authorized, waiting for activity selection');
          console.log('👤 [INDEX] Current user state:', farcasterUser);
        }
      }
      console.log('✅ Farcaster user authorized successfully:', farcasterUser);
      setSuccess(true);
    } catch (error: any) {
      console.error('❌ Error during Farcaster authorization:', error);
      console.error('❌ Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        code: error?.code,
      });
      
      // Убеждаемся, что loading сбрасывается в любом случае
      setLoading(false);
      
      setErrorModal({
        show: true,
        message: `Ошибка при авторизации: ${error?.message || 'Неизвестная ошибка'}\n\nПроверьте консоль браузера для деталей.`
      });
      setSuccess(false);
      return; // Явно выходим из функции
    } finally {
      // Проверяем успешность авторизации по наличию пользователя
      const wasSuccessful = typeof window !== 'undefined' && localStorage.getItem('farcaster_user');
      if (wasSuccessful) {
        console.log('✅ Farcaster authorization completed');
      } else {
        console.log('❌ Farcaster authorization failed');
      }
      // Убеждаемся, что loading сбрасывается в finally
      setLoading(false);
    }
  };

  // Сохранение выбранной активности
  const handleActivitySelect = (activity: ActivityType) => {
    setSelectedActivity(activity);
    localStorage.setItem('selected_activity', activity);
    
    // Сохраняем активность в БД
    if (user) {
      setUserActivity(user.fid, activity);
    }
    
    // Автоматически переходим на страницу задач после выбора активности
    console.log('✅ Activity selected, redirecting to /tasks');
    setTimeout(() => {
      router.push('/tasks');
    }, 500); // Небольшая задержка для плавного перехода
  };

  // ⚠️ УДАЛЕНО: handleContinue больше не нужен, так как переход происходит автоматически при выборе активности

  return (
    <Layout title="Multi Like - Authorization">
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
                  MULTI
                </span>
                <span className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white">
                  LIKE
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
              <span className="text-white">♡</span> MUTUAL LOVE FROM MRS. CRYPTO <span className="text-white">♡</span>
            </p>
            <p className="text-lg text-white text-opacity-90 max-w-2xl mx-auto">
              Complete tasks to get collective support
            </p>
          </div>

          {/* Модная карточка авторизации */}
          <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-3xl shadow-2xl p-6 sm:p-12 mb-12 border border-white border-opacity-20 mt-6 sm:mt-12">
            {!user ? (
              <div className="text-center">
                <div className="mb-6 sm:mb-8">
                  {/* Фото Миссис Крипто */}
                  
                  <h2 className="text-2xl sm:text-4xl font-black text-dark mb-4 font-display tracking-tight px-4">
                    FARCASTER AUTHORIZATION
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔘 Button clicked');
                    console.log('🔍 State before click:', { loading, user, mounted });
                    if (!loading) {
                      handleConnect();
                    } else {
                      console.warn('⚠️ Already loading, ignoring click');
                    }
                  }}
                  disabled={loading}
                  style={{ 
                    pointerEvents: loading ? 'none' : 'auto',
                    cursor: loading ? 'wait' : 'pointer'
                  }}
                  className={`
                    text-base sm:text-xl px-8 sm:px-16 py-4 sm:py-6 font-bold rounded-2xl shadow-2xl 
                    transform transition-all duration-300 relative z-10
                    bg-gradient-to-r from-primary via-red-600 to-accent text-white
                    hover:from-red-500 hover:via-purple-500 hover:to-accent
                    ${loading 
                      ? 'opacity-50 cursor-wait' 
                      : 'opacity-100 cursor-pointer hover:scale-105 active:scale-95'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:transform-none
                  `}
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>AUTHORIZING...</span>
                    </div>
                  ) : (
                    'CONNECT FARCASTER'
                  )}
                </button>
              </div>
          ) : (
            <div>
              {/* Информация о пользователе */}
              <div className="flex items-center gap-4 mb-8 p-4 bg-gray-50 rounded-xl">
                <img
                  src={user.pfp_url}
                  alt={user.username}
                  className="w-16 h-16 rounded-full border-4 border-primary"
                />
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">
                    @{user.username}
                  </h3>
                  <p className="text-sm text-gray-600">FID: {user.fid}</p>
                </div>
                <div className="text-green-500 text-2xl">✓</div>
              </div>

              {/* Выбор активности */}
              <div>
                <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 text-center font-display">
                  SELECT ACTIVITY TYPE
                </h2>
                <p className="text-base sm:text-xl md:text-2xl text-gray-700 mb-6 sm:mb-8 text-center font-bold px-4">
                  You will perform this activity on all 10 links
                </p>

                {/* Стеклянные кнопки активности в стиле glassmorphism */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
                  {/* Кнопка Лайк */}
                  <button
                    onClick={() => handleActivitySelect('like')}
                    className={`
                      relative group px-4 sm:px-8 py-4 sm:py-6 rounded-2xl text-white font-bold text-base sm:text-lg
                      transition-all duration-300 transform hover:scale-105 overflow-hidden
                      backdrop-blur-md border border-white/30 shadow-2xl
                      ${selectedActivity === 'like' 
                        ? 'shadow-2xl shadow-purple-500/50 ring-4 ring-purple-500/30' 
                        : 'hover:shadow-2xl hover:shadow-purple-500/30'
                      }
                    `}
                    style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.5), rgba(147, 51, 234, 0.5))' }}
                  >
                    {/* Переливающийся эффект */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    {/* Внутреннее свечение */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
                    
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="text-2xl sm:text-3xl drop-shadow-lg">❤️</span>
                        <span className="drop-shadow-lg">LIKE NOW</span>
                      </div>
                      <div className="text-xl sm:text-2xl drop-shadow-lg">💫</div>
                    </div>
                    {selectedActivity === 'like' && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg z-20">
                        <span className="text-white text-sm font-bold">✓</span>
                      </div>
                    )}
                  </button>

                  {/* Кнопка Рекаст */}
                  <button
                    onClick={() => handleActivitySelect('recast')}
                    className={`
                      relative group px-4 sm:px-8 py-4 sm:py-6 rounded-2xl text-white font-bold text-base sm:text-lg
                      transition-all duration-300 transform hover:scale-105 overflow-hidden
                      backdrop-blur-md border border-white/30 shadow-2xl
                      ${selectedActivity === 'recast' 
                        ? 'shadow-2xl shadow-purple-500/50 ring-4 ring-purple-500/30' 
                        : 'hover:shadow-2xl hover:shadow-purple-500/30'
                      }
                    `}
                    style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.5), rgba(147, 51, 234, 0.5))' }}
                  >
                    {/* Переливающийся эффект */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    {/* Внутреннее свечение */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
                    
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="text-2xl sm:text-3xl drop-shadow-lg">🔄</span>
                        <span className="drop-shadow-lg">RECAST NOW</span>
                      </div>
                      <div className="text-xl sm:text-2xl drop-shadow-lg">⚡</div>
                    </div>
                    {selectedActivity === 'recast' && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg z-20">
                        <span className="text-white text-sm font-bold">✓</span>
                      </div>
                    )}
                  </button>

                  {/* Кнопка Комментарий */}
                  <button
                    onClick={() => handleActivitySelect('comment')}
                    className={`
                      relative group px-4 sm:px-8 py-4 sm:py-6 rounded-2xl text-white font-bold text-base sm:text-lg
                      transition-all duration-300 transform hover:scale-105 overflow-hidden
                      backdrop-blur-md border border-white/30 shadow-2xl
                      ${selectedActivity === 'comment' 
                        ? 'shadow-2xl shadow-purple-500/50 ring-4 ring-purple-500/30' 
                        : 'hover:shadow-2xl hover:shadow-purple-500/30'
                      }
                    `}
                    style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.5), rgba(147, 51, 234, 0.5))' }}
                  >
                    {/* Переливающийся эффект */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    {/* Внутреннее свечение */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
                    
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="text-2xl sm:text-3xl drop-shadow-lg">💬</span>
                        <span className="drop-shadow-lg">COMMENT NOW</span>
                      </div>
                      <div className="text-xl sm:text-2xl drop-shadow-lg">✨</div>
                    </div>
                    {selectedActivity === 'comment' && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg z-20">
                        <span className="text-white text-sm font-bold">✓</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

          {/* Модная инструкция */}
          <div className="bg-gradient-to-r from-primary via-secondary to-accent text-white rounded-3xl p-8 shadow-2xl mt-32">
            <h3 className="text-3xl font-black mb-6 flex items-center gap-3 font-display">
              <span className="text-4xl">📋</span>
              HOW IT WORKS
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-white bg-opacity-20 rounded-xl">
                  <span className="text-3xl font-black text-accent">01</span>
                  <span className="font-bold text-xl">Select activity type</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white bg-opacity-20 rounded-xl">
                  <span className="text-3xl font-black text-accent">02</span>
                  <span className="font-bold text-xl">Complete tasks on 10 participants links</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-white bg-opacity-20 rounded-xl">
                  <span className="text-3xl font-black text-accent">03</span>
                  <span className="font-bold text-xl">Buy Mrs. Crypto token $0.10</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white bg-opacity-20 rounded-xl">
                  <span className="text-3xl font-black text-accent">04</span>
                  <span className="font-bold text-xl">Add link to a cast you want to promote</span>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3 p-3 bg-gradient-to-r from-accent to-secondary rounded-xl col-span-1 md:col-span-2 text-center">
                <span className="text-3xl">💎</span>
                <span className="font-bold text-xl">Get mutual support!</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Модальное окно для ошибок */}
      {errorModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full mx-4 border-2 border-red-200">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl sm:text-2xl font-bold text-red-600">Error</h3>
              <button
                onClick={() => setErrorModal({ show: false, message: '' })}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="mb-6">
              <p className="text-sm sm:text-base text-gray-700 whitespace-pre-line">
                {errorModal.message}
              </p>
            </div>
            <button
              onClick={() => setErrorModal({ show: false, message: '' })}
              className="w-full px-6 py-3 bg-gradient-to-r from-primary to-accent text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}

