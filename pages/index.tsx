// Главная страница: авторизация и выбор активности
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Layout from '@/components/Layout';
import ActivityButton from '@/components/ActivityButton';
import Button from '@/components/Button';
import { connectWallet } from '@/lib/web3';
import { setUserActivity } from '@/lib/db-config';
import type { ActivityType, FarcasterUser } from '@/types';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Проверка сохраненной сессии
  useEffect(() => {
    setMounted(true);
    
    const savedUser = localStorage.getItem('farcaster_user');
    const savedActivity = localStorage.getItem('selected_activity');
    
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    
    if (savedActivity) {
      setSelectedActivity(savedActivity as ActivityType);
    }
  }, []);

  // Подключение кошелька (симуляция Farcaster авторизации)
  const handleConnect = async () => {
    console.log('🔗 handleConnect called');
    setLoading(true);
    try {
      // Попытка подключения к кошельку
      console.log('🔄 Connecting wallet...');
      const address = await connectWallet();
      console.log('📍 Wallet address:', address);
      
      if (address) {
        setWalletAddress(address);
        
        // В реальном приложении здесь будет интеграция с Farcaster API
        // Для демонстрации создаем тестового пользователя
        const mockUser: FarcasterUser = {
          fid: 12345, // Фиксированный ID для демонстрации
          username: address.slice(0, 8),
          pfp_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${address}`,
          display_name: `User ${address.slice(0, 6)}`,
        };

        setUser(mockUser);
        if (typeof window !== 'undefined') {
          localStorage.setItem('farcaster_user', JSON.stringify(mockUser));
        }
      } else {
        // Если кошелёк не подключился, создаём демо-пользователя
        const demoUser: FarcasterUser = {
          fid: 67890, // Фиксированный ID для демонстрации
          username: 'demo123',
          pfp_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
          display_name: 'Demo User',
        };

        setUser(demoUser);
        if (typeof window !== 'undefined') {
          localStorage.setItem('farcaster_user', JSON.stringify(demoUser));
        }
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      
      // В случае ошибки создаём демо-пользователя
      const demoUser: FarcasterUser = {
        fid: 11111, // Фиксированный ID для демонстрации
        username: 'demo456',
        pfp_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=error',
        display_name: 'Demo User',
      };

      setUser(demoUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('farcaster_user', JSON.stringify(demoUser));
      }
    } finally {
      console.log('✅ handleConnect completed');
      setLoading(false);
    }
  };

  // Сохранение выбранной активности
  const handleActivitySelect = (activity: ActivityType) => {
    setSelectedActivity(activity);
    localStorage.setItem('selected_activity', activity);
  };

  // Переход к заданиям
  const handleContinue = async () => {
    if (!user || !selectedActivity) return;

    setLoading(true);
    try {
      await setUserActivity(user.fid, selectedActivity);
      router.push('/tasks');
    } catch (error) {
      console.error('Error saving activity:', error);
      alert('Ошибка сохранения настроек');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Multi Like - Authorization">
      {/* Hero Section с градиентом */}
      <div className="relative min-h-screen overflow-hidden">
        {/* Анимированный градиент фон */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent animate-gradient bg-300%"></div>
        
        {/* Геометрические фигуры */}
        <div className="absolute top-20 right-20 w-32 h-32 bg-white bg-opacity-10 rounded-full animate-float"></div>
        <div className="absolute bottom-32 left-20 w-24 h-24 bg-white bg-opacity-15 rounded-full animate-float" style={{animationDelay: '2s'}}></div>
        
        
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
          {/* Заголовок в стиле модного сайта */}
          <div className="text-center mb-16">


            <div className="relative mt-4 sm:mt-8">
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
                  />
                </div>
              </div>
              <div className="w-10 sm:w-20 h-1 bg-white"></div>
            </div>
            <p className="text-xl sm:text-3xl md:text-4xl text-white font-bold mb-4 tracking-wide px-4">
              <span className="text-white">♡</span> MUTUAL LOVE FROM MRS. CRYPTO <span className="text-white">♡</span>
            </p>
            <p className="text-lg text-white text-opacity-90 max-w-2xl mx-auto">
              Complete tasks to get mutual support
            </p>
          </div>

          {/* Модная карточка авторизации */}
          <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-3xl shadow-2xl p-6 sm:p-12 mb-12 border border-white border-opacity-20 mt-6 sm:mt-12">
            {!mounted || !user ? (
              <div className="text-center">
                <div className="mb-6 sm:mb-8">
                  {/* Фото Миссис Крипто */}
                  
                  <h2 className="text-2xl sm:text-4xl font-black text-dark mb-4 font-display tracking-tight px-4">
                    FARCASTER AUTHORIZATION
                  </h2>
                </div>

                <Button
                  onClick={handleConnect}
                  loading={loading}
                  variant="primary"
                  className="text-base sm:text-xl px-8 sm:px-16 py-4 sm:py-6 font-bold rounded-2xl shadow-2xl transform hover:scale-105 transition-all duration-300"
                >
                  CONNECT FARCASTER WALLET
                </Button>

                <div className="mt-6 p-3 sm:p-4 bg-gradient-to-r from-accent to-secondary rounded-xl">
                  <p className="text-base sm:text-xl text-white font-bold">
                    We'll save your FID, username and avatar
                  </p>
                </div>
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
                      transition-all duration-300 transform hover:scale-105
                      backdrop-blur-sm border border-white border-opacity-20
                      ${selectedActivity === 'like' 
                        ? 'shadow-2xl shadow-primary/50' 
                        : 'hover:shadow-xl hover:shadow-primary/30'
                      }
                      bg-gradient-to-r from-primary/80 via-red-600/80 to-accent/80
                      hover:from-red-500/90 hover:via-purple-500/90 hover:to-accent/90
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="text-2xl sm:text-3xl">❤️</span>
                        <span>LIKE NOW</span>
                      </div>
                      <div className="text-xl sm:text-2xl">💫</div>
                    </div>
                    {selectedActivity === 'like' && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                        <span className="text-green-500 text-sm">✓</span>
                      </div>
                    )}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </button>

                  {/* Кнопка Рекаст */}
                  <button
                    onClick={() => handleActivitySelect('recast')}
                    className={`
                      relative group px-4 sm:px-8 py-4 sm:py-6 rounded-2xl text-white font-bold text-base sm:text-lg
                      transition-all duration-300 transform hover:scale-105
                      backdrop-blur-sm border border-white border-opacity-20
                      ${selectedActivity === 'recast' 
                        ? 'shadow-2xl shadow-secondary/50' 
                        : 'hover:shadow-xl hover:shadow-secondary/30'
                      }
                      bg-gradient-to-r from-primary/80 via-red-600/80 to-accent/80
                      hover:from-red-500/90 hover:via-purple-500/90 hover:to-accent/90
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="text-2xl sm:text-3xl">🔄</span>
                        <span>RECAST NOW</span>
                      </div>
                      <div className="text-xl sm:text-2xl">⚡</div>
                    </div>
                    {selectedActivity === 'recast' && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                        <span className="text-green-500 text-sm">✓</span>
                      </div>
                    )}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </button>

                  {/* Кнопка Комментарий */}
                  <button
                    onClick={() => handleActivitySelect('comment')}
                    className={`
                      relative group px-4 sm:px-8 py-4 sm:py-6 rounded-2xl text-white font-bold text-base sm:text-lg
                      transition-all duration-300 transform hover:scale-105
                      backdrop-blur-sm border border-white border-opacity-20
                      ${selectedActivity === 'comment' 
                        ? 'shadow-2xl shadow-accent/50' 
                        : 'hover:shadow-xl hover:shadow-accent/30'
                      }
                      bg-gradient-to-r from-primary/80 via-red-600/80 to-accent/80
                      hover:from-red-500/90 hover:via-purple-500/90 hover:to-accent/90
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="text-2xl sm:text-3xl">💬</span>
                        <span>COMMENT NOW</span>
                      </div>
                      <div className="text-xl sm:text-2xl">✨</div>
                    </div>
                    {selectedActivity === 'comment' && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                        <span className="text-green-500 text-sm">✓</span>
                      </div>
                    )}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </button>
                </div>

                {/* Главная кнопка в стиле glassmorphism */}
                <button
                  onClick={handleContinue}
                  disabled={!selectedActivity}
                  className={`
                    relative group w-full px-12 py-6 rounded-2xl text-white font-black text-xl
                    transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                    backdrop-blur-sm border border-white border-opacity-20
                    ${selectedActivity 
                      ? 'shadow-2xl shadow-primary/50 bg-gradient-to-r from-primary/80 via-red-600/80 to-accent/80 hover:from-red-500/90 hover:via-purple-500/90 hover:to-accent/90' 
                      : 'bg-gradient-to-r from-gray-500/50 to-gray-600/50'
                    }
                  `}
                >
                  <div className="flex items-center justify-center gap-3">
                    {loading ? (
                      <>
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>LOADING...</span>
                      </>
                    ) : (
                      <>
                        <span>CONTINUE TO TASKS</span>
                        <span className="text-2xl">🚀</span>
                      </>
                    )}
                  </div>
                  {selectedActivity && !loading && (
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  )}
                </button>
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
    </Layout>
  );
}

