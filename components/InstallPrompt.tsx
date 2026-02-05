// Компонент для показа модального окна установки приложения
import { useState, useEffect } from 'react';

interface InstallPromptProps {
  onDismiss?: () => void;
}

const InstallPrompt: React.FC<InstallPromptProps> = ({ onDismiss }) => {
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Для отладки: глобальная функция для принудительного показа модального окна
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).showInstallModal = () => {
        console.log('🔧 [INSTALL] Force showing modal via window.showInstallModal()');
        setShowModal(true);
        setIsLoading(false);
        setIsInstalled(false);
      };
      console.log('🔧 [INSTALL] Added window.showInstallModal() function for testing');
      
      // Также проверяем URL параметр
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('showInstall') === 'true') {
        console.log('🔧 [INSTALL] Force showing modal via URL parameter ?showInstall=true');
        setTimeout(() => {
          setShowModal(true);
          setIsLoading(false);
          setIsInstalled(false);
        }, 500);
      }
    }
  }, []);

  useEffect(() => {
    const checkInstallation = async () => {
      try {
        if (typeof window === 'undefined') {
          return;
        }

        // Проверяем, что мы в iframe Farcaster Mini App
        const isInFarcasterFrame = window.self !== window.top;
        if (!isInFarcasterFrame) {
          console.log('ℹ️ [INSTALL] Not in Farcaster frame');
          setIsInstalled(null);
          setIsLoading(false);
          return;
        }

        // Импортируем SDK
        const { sdk } = await import('@farcaster/miniapp-sdk');

        // Получаем username из SDK context или localStorage для проверки (делаем это ДО проверки установки)
        let currentUsername: string | null = null;
        try {
          const context = await sdk.context;
          currentUsername = context?.user?.username || null;
          console.log('🔍 [INSTALL] Username from SDK context:', currentUsername);
        } catch (error) {
          console.log('ℹ️ [INSTALL] Could not get username from SDK context:', error);
        }
        
        // Если не получили из SDK, пробуем из localStorage
        if (!currentUsername) {
          try {
            const savedUserStr = localStorage.getItem('farcaster_user');
            if (savedUserStr) {
              const savedUser = JSON.parse(savedUserStr);
              currentUsername = savedUser?.username || null;
              console.log('🔍 [INSTALL] Username from localStorage:', currentUsername);
            }
          } catch (e) {
            console.log('ℹ️ [INSTALL] Could not get username from localStorage:', e);
          }
        }
        
        // Список пользователей, которым всегда показываем модальное окно (для тестирования)
        const testUsers = ['svs-smm', 'svs-smr'];
        const isTestUser = currentUsername && testUsers.includes(currentUsername.toLowerCase());
        
        console.log('🧪 [INSTALL] User check:', {
          currentUsername,
          usernameLowercase: currentUsername?.toLowerCase(),
          testUsers,
          isTestUser
        });
        
        // Для тестовых пользователей ВСЕГДА показываем модальное окно, независимо от других условий
        if (isTestUser) {
          console.log('🧪 [INSTALL] Test user detected, ALWAYS showing modal');
          setIsInstalled(false);
          setIsLoading(false);
          // Небольшая задержка для лучшего UX
          setTimeout(() => {
            console.log('✅ [INSTALL] Showing install prompt modal for test user');
            setShowModal(true);
          }, 1000);
          return; // Выходим раньше, не проверяем установку
        }
        
        // Для обычных пользователей проверяем установку
        let installed = false;
        const actions = sdk.actions as any;
        
        if (actions?.isInstalled && typeof actions.isInstalled === 'function') {
          try {
            installed = await actions.isInstalled();
            setIsInstalled(installed);
            console.log('✅ [INSTALL] isInstalled check result:', installed);
          } catch (error) {
            console.log('ℹ️ [INSTALL] isInstalled method error:', error);
            installed = false;
            setIsInstalled(false);
          }
        } else {
          try {
            const context = await sdk.context;
            installed = false;
            setIsInstalled(false);
            console.log('ℹ️ [INSTALL] isInstalled method not available, assuming not installed');
          } catch (error) {
            console.log('ℹ️ [INSTALL] Context check error:', error);
            installed = false;
            setIsInstalled(false);
          }
        }
        
        // Показываем модальное окно, если приложение не установлено
        if (!installed) {
          // Проверяем, не было ли уже отклонено пользователем
          const dismissed = localStorage.getItem('install_prompt_dismissed');
          
          console.log('🔍 [INSTALL] Installation check:', {
            installed,
            currentUsername,
            dismissed: !!dismissed,
            willShow: !dismissed
          });
          
          if (!dismissed) {
            setTimeout(() => {
              console.log('✅ [INSTALL] Showing install prompt modal');
              setShowModal(true);
            }, 1000);
          } else {
            console.log('ℹ️ [INSTALL] Install prompt was dismissed, not showing');
          }
        } else {
          console.log('✅ [INSTALL] App is installed, not showing prompt');
        }
      } catch (error) {
        console.log('ℹ️ [INSTALL] Error checking installation status:', error);
        setIsInstalled(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkInstallation();
  }, []);

  const handleInstall = async () => {
    console.log('🔧 [INSTALL] handleInstall called');
    try {
      if (typeof window === 'undefined') {
        console.error('❌ [INSTALL] window is undefined');
        return;
      }

      // Проверяем, что мы в iframe Farcaster Mini App
      const isInFarcasterFrame = window.self !== window.top;
      if (!isInFarcasterFrame) {
        console.warn('⚠️ [INSTALL] Not in Farcaster frame, install may not work');
        setShowModal(false);
        return;
      }

      console.log('📦 [INSTALL] Importing SDK...');
      const { sdk } = await import('@farcaster/miniapp-sdk');
      
      console.log('🔍 [INSTALL] SDK loaded:', {
        hasSDK: !!sdk,
        hasActions: !!sdk?.actions,
        actionsKeys: sdk?.actions ? Object.keys(sdk.actions) : []
      });

      // Вызываем установку через SDK (через any для обхода типов)
      const actions = sdk.actions as any;
      
      // Логируем все доступные методы для отладки
      console.log('🔍 [INSTALL] All available methods:', {
        hasActions: !!actions,
        allMethods: actions ? Object.keys(actions) : [],
        hasInstall: !!actions?.install,
        hasRequestInstall: !!actions?.requestInstall,
        hasAddToHomeScreen: !!actions?.addToHomeScreen,
        installType: typeof actions?.install,
        requestInstallType: typeof actions?.requestInstall
      });

      // Пробуем разные методы установки
      let installSuccess = false;

      // Метод 1: install()
      if (actions?.install && typeof actions.install === 'function') {
        try {
          console.log('✅ [INSTALL] Trying install() method...');
          const result = await actions.install();
          console.log('✅ [INSTALL] install() completed:', result);
          installSuccess = true;
        } catch (error: any) {
          console.error('❌ [INSTALL] Error calling install():', {
            error,
            message: error?.message,
            stack: error?.stack,
            name: error?.name
          });
        }
      }

      // Метод 2: requestInstall()
      if (!installSuccess && actions?.requestInstall && typeof actions.requestInstall === 'function') {
        try {
          console.log('✅ [INSTALL] Trying requestInstall() method...');
          const result = await actions.requestInstall();
          console.log('✅ [INSTALL] requestInstall() completed:', result);
          installSuccess = true;
        } catch (error: any) {
          console.error('❌ [INSTALL] Error calling requestInstall():', {
            error,
            message: error?.message
          });
        }
      }

      // Метод 3: addToHomeScreen()
      if (!installSuccess && actions?.addToHomeScreen && typeof actions.addToHomeScreen === 'function') {
        try {
          console.log('✅ [INSTALL] Trying addToHomeScreen() method...');
          const result = await actions.addToHomeScreen();
          console.log('✅ [INSTALL] addToHomeScreen() completed:', result);
          installSuccess = true;
        } catch (error: any) {
          console.error('❌ [INSTALL] Error calling addToHomeScreen():', {
            error,
            message: error?.message
          });
        }
      }

      // Метод 4: Попробуем через openUrl с текущим URL (может триггерить установку)
      if (!installSuccess && actions?.openUrl && typeof actions.openUrl === 'function') {
        try {
          console.log('🔄 [INSTALL] Trying openUrl with current URL...');
          await actions.openUrl({ url: window.location.href });
          console.log('✅ [INSTALL] openUrl completed');
          installSuccess = true;
        } catch (error: any) {
          console.error('❌ [INSTALL] Error with openUrl:', {
            error,
            message: error?.message
          });
        }
      }

      // Метод 5: Попробуем через postMessage к родительскому окну
      if (!installSuccess && isInFarcasterFrame) {
        try {
          console.log('🔄 [INSTALL] Trying postMessage to parent window...');
          window.parent.postMessage({
            type: 'farcaster:install',
            url: window.location.href
          }, '*');
          console.log('✅ [INSTALL] postMessage sent');
          // Не считаем успешным, так как не получили ответ
        } catch (error: any) {
          console.error('❌ [INSTALL] Error with postMessage:', {
            error,
            message: error?.message
          });
        }
      }

      // Метод 6: Попробуем использовать window.location для перезагрузки (может триггерить установку)
      if (!installSuccess) {
        try {
          console.log('🔄 [INSTALL] Trying to trigger install via page interaction...');
          // Пробуем вызвать событие, которое может триггерить установку
          const event = new CustomEvent('farcaster:install-request', {
            detail: { url: window.location.href }
          });
          window.dispatchEvent(event);
          console.log('✅ [INSTALL] Custom event dispatched');
        } catch (error: any) {
          console.error('❌ [INSTALL] Error dispatching custom event:', {
            error,
            message: error?.message
          });
        }
      }

      // Если ни один метод не сработал, просто закрываем модальное окно
      // Farcaster может показать свою собственную кнопку установки внизу экрана
      if (!installSuccess) {
        console.log('ℹ️ [INSTALL] No install method worked, closing modal. Farcaster may show native install button.');
        console.log('ℹ️ [INSTALL] User should look for the native "Add" button at the bottom of the screen.');
      }

      // Закрываем модальное окно в любом случае
      setShowModal(false);
      
      // Если установка прошла успешно, обновляем состояние
      if (installSuccess) {
        setIsInstalled(true);
      }
    } catch (error: any) {
      console.error('❌ [INSTALL] Error installing app:', {
        error,
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      });
      // В случае ошибки все равно закрываем модальное окно
      setShowModal(false);
    }
  };

  const handleDismiss = () => {
    setShowModal(false);
    // Сохраняем, что пользователь отклонил предложение
    localStorage.setItem('install_prompt_dismissed', 'true');
    if (onDismiss) {
      onDismiss();
    }
  };

  // Для отладки: проверяем URL параметр для принудительного показа
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('showInstall') === 'true') {
        console.log('🔧 [INSTALL] Force showing modal via URL parameter');
        setShowModal(true);
        setIsLoading(false);
        setIsInstalled(false);
      }
    }
  }, []);

  // Показываем модальное окно ТОЛЬКО если showModal === true
  if (!showModal) {
    console.log('❌ [INSTALL] showModal is false, not rendering', { isLoading, showModal, isInstalled });
    return null;
  }
  
  console.log('🎨 [INSTALL] Rendering install prompt modal', {
    isLoading,
    showModal,
    isInstalled
  });

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
        onClick={handleDismiss}
      />
      
      {/* Modal - позиционируем явно сверху */}
      <div 
        className="absolute left-1/2 transform -translate-x-1/2 w-full max-w-md rounded-3xl shadow-2xl pointer-events-auto overflow-hidden animate-slide-up p-4"
        style={{ top: '30vh', maxHeight: '60vh', overflowY: 'auto' }}
      >
        {/* Градиентный фон */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent animate-gradient" style={{ backgroundSize: '300% 300%' }}></div>
        
        {/* Стеклянный эффект */}
        <div className="relative bg-white/10 backdrop-blur-md border border-white/30 rounded-3xl">
          {/* Drag handle - убираем, так как теперь модальное окно по центру */}

          {/* Header */}
          <div className="px-6 pt-4 pb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative">
                <img 
                  src="/images/icon.png" 
                  alt="MULTI LIKE" 
                  className="w-12 h-12 rounded-xl border-2 border-white/30 shadow-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-primary text-xs font-bold">+</span>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white drop-shadow-lg">Add MULTI LIKE to Farcaster</h2>
            </div>

            {/* Options */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 hover:bg-white/15 transition-colors">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border border-white/30">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-white font-medium">Add to Farcaster</span>
              </div>

              <div className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 hover:bg-white/15 transition-colors">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border border-white/30">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <span className="text-white font-medium">Enable notifications</span>
              </div>
            </div>

            {/* Info text */}
            <div className="mb-4 px-2">
              <p className="text-white/80 text-sm text-center">
                After clicking "Add", look for the native install button at the bottom of the screen
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleDismiss}
                className="flex-1 px-6 py-3 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-xl border border-white/20 hover:bg-white/20 transition-all hover:scale-105"
              >
                Not now
              </button>
              <button
                onClick={handleInstall}
                className="flex-1 px-6 py-3 btn-gold-glow font-bold text-white rounded-xl hover:scale-105 transition-all relative overflow-hidden group"
              >
                <span className="relative z-10">Add</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default InstallPrompt;
