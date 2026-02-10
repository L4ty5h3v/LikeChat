// Компонент для показа модального окна установки приложения
import { useState, useEffect } from 'react';

interface InstallPromptProps {
  onDismiss?: () => void;
}

const InstallPrompt: React.FC<InstallPromptProps> = ({ onDismiss }) => {
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActionBusy, setIsActionBusy] = useState(false);
  
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

        // Импортируем SDK
        const { sdk } = await import('@farcaster/miniapp-sdk');
        await sdk.actions?.ready?.();

        // Проверяем, что мы реально внутри Farcaster Mini App окружения (на iOS/веб это не всегда iframe)
        try {
          await sdk.context;
        } catch (e) {
          console.log('ℹ️ [INSTALL] Not in Farcaster Mini App environment (no sdk.context)', e);
          setIsInstalled(null);
          setIsLoading(false);
          return;
        }

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
    if (isActionBusy) return;
    try {
      if (typeof window === 'undefined') {
        console.error('❌ [INSTALL] window is undefined');
        return;
      }

      setIsActionBusy(true);
      const isRejectedByUser = (err: any) => {
        const name = String(err?.name || '');
        const msg = String(err?.message || '');
        return name.includes('RejectedByUser') || msg.includes('RejectedByUser');
      };

      console.log('📦 [INSTALL] Importing SDK...');
      const { sdk } = await import('@farcaster/miniapp-sdk');
      await sdk.actions?.ready?.();
      setActionError(null);
      setActionMessage('Sending Add request…');

      // Проверяем окружение Farcaster
      try {
        // context can be flaky in some Farcaster web shells; fail fast with a timeout
        await Promise.race([
          sdk.context,
          new Promise((_, reject) => setTimeout(() => reject(new Error('SDK_CONTEXT_TIMEOUT')), 2000)),
        ]);
      } catch (e) {
        console.warn('⚠️ [INSTALL] Not in Farcaster Mini App environment, aborting install', e);
        setActionError('Install is available only inside Farcaster/Warpcast Mini Apps.');
        setActionMessage(null);
        return;
      }
      
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
          if (isRejectedByUser(error)) {
            console.log('ℹ️ [INSTALL] User rejected install request');
            setActionError('You cancelled the Add request. Please tap "Add" (native prompt) to confirm installation.');
            return;
          }
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
          if (isRejectedByUser(error)) {
            console.log('ℹ️ [INSTALL] User rejected requestInstall()');
            setActionError('You cancelled the Add request. Please tap "Add" (native prompt) to confirm installation.');
            return;
          }
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
          if (isRejectedByUser(error)) {
            console.log('ℹ️ [INSTALL] User rejected addToHomeScreen()');
            setActionError('You cancelled the Add request. Please tap "Add" (native prompt) to confirm installation.');
            return;
          }
          console.error('❌ [INSTALL] Error calling addToHomeScreen():', {
            error,
            message: error?.message
          });
        }
      }

      // Если ни один метод не сработал — НЕ закрываем модалку, чтобы пользователь мог повторить
      // Farcaster может показать свою собственную кнопку установки внизу экрана
      if (!installSuccess) {
        console.log('ℹ️ [INSTALL] No install method worked. Farcaster may show native install button.');
        console.log('ℹ️ [INSTALL] User should look for the native "Add" button at the bottom of the screen.');
        setActionMessage(
          'If nothing happened, look for the native "Add" button at the bottom of the Farcaster screen. If you already tapped it, wait a moment…'
        );

        // If Farcaster shows a native install bar, the actual install can happen outside our JS call.
        // Re-check installation status a few times and close the modal if it becomes installed.
        if (typeof actions?.isInstalled === 'function') {
          const delays = [800, 2000, 4000];
          for (const d of delays) {
            await new Promise(resolve => setTimeout(resolve, d));
            try {
              const installed = await actions.isInstalled();
              if (installed) {
                setIsInstalled(true);
                setShowModal(false);
                return;
              }
            } catch (e) {
              // ignore and keep modal open
            }
          }
        }

        return;
      }
      
      // Если установка прошла успешно, обновляем состояние
      if (installSuccess) {
        setIsInstalled(true);
        setShowModal(false);
      }
    } catch (error: any) {
      console.error('❌ [INSTALL] Error installing app:', {
        error,
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      });
      setActionError(error?.message || 'Failed to send Add request. Please try again.');
      setActionMessage(null);
    } finally {
      setIsActionBusy(false);
    }
  };

  const handleEnableNotifications = async () => {
    if (isActionBusy) return;
    try {
      if (typeof window === 'undefined') return;
      setIsActionBusy(true);
      setActionError(null);
      setActionMessage('Requesting notifications…');

      const { sdk } = await import('@farcaster/miniapp-sdk');
      await sdk.actions?.ready?.();

      try {
        await Promise.race([
          sdk.context,
          new Promise((_, reject) => setTimeout(() => reject(new Error('SDK_CONTEXT_TIMEOUT')), 2000)),
        ]);
      } catch (e) {
        setActionError('Notifications can be enabled only inside Farcaster/Warpcast Mini Apps.');
        setActionMessage(null);
        return;
      }

      const actions = sdk.actions as any;
      console.log('🔔 [NOTIFICATIONS] Available actions:', actions ? Object.keys(actions) : []);

      const candidates: Array<{ name: string; fn?: (...args: any[]) => Promise<any> | any; args?: any[] }> = [
        { name: 'requestNotificationPermission', fn: actions?.requestNotificationPermission, args: [] },
        { name: 'requestNotificationPermissions', fn: actions?.requestNotificationPermissions, args: [] },
        { name: 'requestPushNotificationPermission', fn: actions?.requestPushNotificationPermission, args: [] },
        { name: 'enableNotifications', fn: actions?.enableNotifications, args: [] },
        { name: 'subscribeToNotifications', fn: actions?.subscribeToNotifications, args: [] },
        { name: 'subscribeNotifications', fn: actions?.subscribeNotifications, args: [] },
      ];

      for (const c of candidates) {
        if (typeof c.fn === 'function') {
          console.log(`✅ [NOTIFICATIONS] Trying ${c.name}()...`);
          await c.fn(...(c.args ?? []));
          setActionMessage('Notifications request sent. Please confirm in Farcaster.');
          // Close the modal shortly after success (user asked for this behavior)
          setTimeout(() => setShowModal(false), 800);
          return;
        }
      }

      setActionMessage('Notifications are not supported by this Farcaster client / SDK version.');
    } catch (e: any) {
      console.error('❌ [NOTIFICATIONS] Error enabling notifications:', e);
      setActionError(e?.message || 'Failed to enable notifications');
      setActionMessage(null);
    } finally {
      setIsActionBusy(false);
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
    <div className="fixed inset-0 z-50 pointer-events-auto">
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
        <div
          className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent animate-gradient pointer-events-none"
          style={{ backgroundSize: '300% 300%' }}
        />
        
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
              <button
                type="button"
                onClick={handleInstall}
                disabled={isActionBusy}
                className={`w-full text-left flex items-center gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 transition-colors ${
                  isActionBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/15'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border border-white/30">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-white font-medium">Add to Farcaster</span>
              </button>

              <button
                type="button"
                onClick={handleEnableNotifications}
                disabled={isActionBusy}
                className={`w-full text-left flex items-center gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 transition-colors ${
                  isActionBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/15'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border border-white/30">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <span className="text-white font-medium">Enable notifications</span>
              </button>
            </div>

            {(actionMessage || actionError) && (
              <div className="mb-4 px-2">
                {actionError && <p className="text-red-100 text-sm text-center">{actionError}</p>}
                {actionMessage && <p className="text-white/90 text-sm text-center">{actionMessage}</p>}
              </div>
            )}

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
                disabled={isActionBusy}
                className="flex-1 px-6 py-3 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-xl border border-white/20 hover:bg-white/20 transition-all hover:scale-105"
              >
                Not now
              </button>
              <button
                onClick={handleInstall}
                disabled={isActionBusy}
                className={`flex-1 px-6 py-3 btn-gold-glow font-bold text-white rounded-xl transition-all relative overflow-hidden group ${
                  isActionBusy ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105'
                }`}
              >
                <span className="relative z-10">{isActionBusy ? 'Working…' : 'Add'}</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none"></div>
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default InstallPrompt;
