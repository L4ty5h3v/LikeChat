// Компонент для показа модального окна установки приложения
import { useState, useEffect } from 'react';

interface InstallPromptProps {
  onDismiss?: () => void;
}

const InstallPrompt: React.FC<InstallPromptProps> = ({ onDismiss }) => {
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const checkInstallation = async () => {
      try {
        if (typeof window === 'undefined') {
          return;
        }

        // Проверяем, что мы в iframe Farcaster Mini App
        const isInFarcasterFrame = window.self !== window.top;
        if (!isInFarcasterFrame) {
          setIsInstalled(null);
          setIsLoading(false);
          return;
        }

        // Импортируем SDK
        const { sdk } = await import('@farcaster/miniapp-sdk');

        // Проверяем, установлено ли приложение
        // Пробуем использовать метод isInstalled, если доступен
        let installed = false;
        if (sdk?.actions?.isInstalled && typeof sdk.actions.isInstalled === 'function') {
          try {
            installed = await sdk.actions.isInstalled();
            setIsInstalled(installed);
          } catch (error) {
            console.log('ℹ️ [INSTALL] isInstalled method error:', error);
            // Если метод не работает, предполагаем, что приложение не установлено
            installed = false;
            setIsInstalled(false);
          }
        } else {
          // Если метод isInstalled недоступен, проверяем через context
          // Если context.user отсутствует, возможно приложение не установлено
          try {
            const context = await sdk.context;
            installed = !!context?.user;
            setIsInstalled(installed);
          } catch (error) {
            console.log('ℹ️ [INSTALL] Context check error:', error);
            // Если не можем проверить, предполагаем, что приложение не установлено
            installed = false;
            setIsInstalled(false);
          }
        }
        
        // Показываем модальное окно, если приложение не установлено
        if (!installed) {
          // Проверяем, не было ли уже отклонено пользователем
          const dismissed = localStorage.getItem('install_prompt_dismissed');
          if (!dismissed) {
            // Небольшая задержка для лучшего UX
            setTimeout(() => {
              setShowModal(true);
            }, 1000);
          }
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
    try {
      if (typeof window === 'undefined') {
        return;
      }

      const { sdk } = await import('@farcaster/miniapp-sdk');

      // Вызываем установку через SDK
      if (sdk?.actions?.install && typeof sdk.actions.install === 'function') {
        try {
          await sdk.actions.install();
          setShowModal(false);
          setIsInstalled(true);
        } catch (error) {
          console.error('❌ [INSTALL] Error calling install:', error);
          // Если установка не удалась, просто закрываем модальное окно
          setShowModal(false);
        }
      } else {
        // Если метод install недоступен, просто закрываем модальное окно
        // Farcaster может показать свою собственную плашку установки
        console.log('ℹ️ [INSTALL] Install method not available, closing modal');
        setShowModal(false);
      }
    } catch (error) {
      console.error('❌ [INSTALL] Error installing app:', error);
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

  if (isLoading || !showModal || isInstalled) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
        onClick={handleDismiss}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md rounded-t-3xl shadow-2xl pointer-events-auto overflow-hidden animate-slide-up">
        {/* Градиентный фон */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent animate-gradient" style={{ backgroundSize: '300% 300%' }}></div>
        
        {/* Стеклянный эффект */}
        <div className="relative bg-white/10 backdrop-blur-md border-t border-white/30">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1 bg-white/50 rounded-full" />
          </div>

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
