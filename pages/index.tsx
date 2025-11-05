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

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showFidModal, setShowFidModal] = useState(false);
  const [fidInput, setFidInput] = useState('');
  const [showDemoModal, setShowDemoModal] = useState(false);

  // Проверка сохраненной сессии
  useEffect(() => {
    // Устанавливаем mounted сразу, чтобы кнопка была видна
    setMounted(true);
    
    // Проверяем localStorage только на клиенте
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('farcaster_user');
      const savedActivity = localStorage.getItem('selected_activity');
      
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (error) {
          console.error('Error parsing saved user:', error);
        }
      }
      
      if (savedActivity) {
        setSelectedActivity(savedActivity as ActivityType);
      }
    }
  }, []);

  // Авторизация через Farcaster (только FID)
  const handleConnect = () => {
    console.log('🔗 Farcaster authorization called');
    console.log('🔍 Current state:', { loading, user, mounted });
    
    // Предотвращаем повторные вызовы
    if (loading) {
      console.warn('⚠️ Already loading');
      return;
    }
    
    // Показываем модальное окно для ввода FID
    setShowFidModal(true);
  };

  // Обработка ввода FID из модального окна
  const handleFidSubmit = async () => {
    if (!fidInput || isNaN(Number(fidInput))) {
      alert('Пожалуйста, введите корректный FID (число)');
      return;
    }

    setLoading(true);
    setShowFidModal(false);
    
    try {
      let farcasterUser: FarcasterUser | null = null;
      
      const inputFid = Number(fidInput);
      console.log(`🔍 Fetching Farcaster user data for FID: ${inputFid}`);
      
      try {
        // Используем серверный API для получения данных пользователя
        const response = await fetch('/api/farcaster-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fid: inputFid }),
        });

        const data = await response.json();
        console.log('📊 API response:', data);
        console.log('📊 API response data.user:', data.user);
        
        if (data.user && data.user.fid) {
          // Используем FID из ответа API (он должен совпадать с введенным)
          const apiFid = Number(data.user.fid);
          if (apiFid !== inputFid) {
            console.warn(`⚠️ FID mismatch: input=${inputFid}, API returned=${apiFid}. Using API FID.`);
          }
          
          farcasterUser = {
            fid: apiFid, // Используем FID из API ответа
            username: data.user.username || `user${apiFid}`,
            pfp_url: data.user.pfp_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${apiFid}`,
            display_name: data.user.display_name || data.user.username || `User ${apiFid}`,
          };
          
          console.log('✅ Farcaster user data loaded:', farcasterUser);
          console.log(`✅ FID verified: ${farcasterUser.fid} (input: ${inputFid})`);
        } else {
          console.error('❌ Farcaster user not found in API response:', {
            hasUser: !!data.user,
            userFid: data.user?.fid,
            fullResponse: data
          });
          alert(`Пользователь с FID ${inputFid} не найден в Farcaster.\n\nПроверьте правильность FID и попробуйте снова.\n\nОтвет API: ${JSON.stringify(data)}`);
          setLoading(false);
          setFidInput('');
          return;
        }
      } catch (error: any) {
        console.error('❌ Failed to fetch Farcaster user data:', error);
        alert(`Ошибка при получении данных пользователя Farcaster: ${error.message || 'Неизвестная ошибка'}`);
        setLoading(false);
        setFidInput('');
        return;
      }
      
      if (farcasterUser && farcasterUser.fid) {
        console.log('✅ Setting user state:', farcasterUser);
        setUser(farcasterUser);
        
        if (typeof window !== 'undefined') {
          const userJson = JSON.stringify(farcasterUser);
          console.log('💾 Saving user to localStorage:', userJson);
          localStorage.setItem('farcaster_user', userJson);
          
          // Проверяем, что данные действительно сохранились
          const savedUserCheck = localStorage.getItem('farcaster_user');
          console.log('✅ Saved user check:', savedUserCheck);
          
          if (!savedUserCheck) {
            console.error('❌ Failed to save user to localStorage');
            alert('Ошибка при сохранении данных пользователя. Попробуйте снова.');
            setLoading(false);
            return;
          }
          
          // Проверяем, есть ли уже выбранная активность
          const savedActivity = localStorage.getItem('selected_activity');
          console.log('📋 Saved activity:', savedActivity);
          
          if (savedActivity) {
            // Если активность уже выбрана, переходим на страницу задач
            console.log('✅ Activity already selected, redirecting to /tasks');
            setTimeout(() => {
              console.log('🚀 Navigating to /tasks');
              router.push('/tasks');
            }, 500); // Небольшая задержка для плавного перехода
          } else {
            // Если активности нет, остаемся на странице для выбора
            console.log('✅ User authorized, waiting for activity selection');
            console.log('👤 Current user state:', farcasterUser);
          }
        }
        console.log('✅ Farcaster user authorized successfully:', farcasterUser);
      } else {
        console.error('❌ Invalid farcasterUser:', farcasterUser);
        alert('Ошибка: данные пользователя не получены. Попробуйте снова.');
      }
    } catch (error: any) {
      console.error('❌ Error during Farcaster authorization:', error);
      alert(`Ошибка при авторизации: ${error.message || 'Неизвестная ошибка'}`);
    } finally {
      console.log('✅ Farcaster authorization completed');
      setLoading(false);
      setFidInput('');
    }
  };

  // Обработка демо-режима
  const handleDemoMode = () => {
    setShowFidModal(false);
    setShowDemoModal(false);
    setLoading(true);
    
    const farcasterUser: FarcasterUser = {
      fid: Math.floor(Math.random() * 1000000) + 100000,
      username: 'demo_user',
      pfp_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
      display_name: 'Demo User',
    };
    
    console.log('📝 Using demo user:', farcasterUser);
    
    setUser(farcasterUser);
    if (typeof window !== 'undefined') {
      localStorage.setItem('farcaster_user', JSON.stringify(farcasterUser));
    }
    
    setLoading(false);
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

                <div className="mt-6 p-3 sm:p-4 bg-gradient-to-r from-accent to-secondary rounded-xl">
                  <p className="text-base sm:text-xl text-white font-bold">
                    Enter your Farcaster FID to authorize
                  </p>
                  <p className="text-sm text-white text-opacity-90 mt-2">
                    We'll save your FID, username and avatar from Farcaster
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

      {/* Модальное окно для ввода FID */}
      {showFidModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full">
            <h3 className="text-2xl font-black text-dark mb-4">Farcaster Authorization</h3>
            <p className="text-gray-600 mb-4">
              Введите ваш Farcaster FID (FID) для авторизации:
            </p>
            <p className="text-sm text-gray-500 mb-6">
              FID - это ваш уникальный идентификатор в Farcaster. Вы можете найти его в профиле Warpcast или других Farcaster приложений.
            </p>
            
            <input
              type="number"
              value={fidInput}
              onChange={(e) => setFidInput(e.target.value)}
              placeholder="Введите FID"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-lg mb-4 focus:outline-none focus:border-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleFidSubmit();
                } else if (e.key === 'Escape') {
                  setShowFidModal(false);
                  setFidInput('');
                }
              }}
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowFidModal(false);
                  setFidInput('');
                }}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  setShowFidModal(false);
                  setShowDemoModal(true);
                }}
                className="flex-1 px-4 py-3 bg-gray-300 text-gray-800 rounded-xl font-semibold hover:bg-gray-400 transition-colors"
              >
                Демо
              </button>
              <button
                onClick={handleFidSubmit}
                disabled={!fidInput || isNaN(Number(fidInput))}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для демо-режима */}
      {showDemoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full">
            <h3 className="text-2xl font-black text-dark mb-4">Demo Mode</h3>
            <p className="text-gray-600 mb-6">
              Для тестирования можно использовать демо-режим. Вы будете использовать демо-аккаунт без реального Farcaster FID.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDemoModal(false);
                  setShowFidModal(true);
                }}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
              >
                Назад
              </button>
              <button
                onClick={handleDemoMode}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
              >
                Использовать демо
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

