import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect } from 'react';
import { base } from 'wagmi/chains';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { FarcasterAuthProvider } from '@/contexts/FarcasterAuthContext';
import { AuthSync } from '@/components/AuthSync';

export default function App({ Component, pageProps }: AppProps) {
  // Глобальный обработчик ошибок для отлова неперехваченных ошибок
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('🔴 [GLOBAL-ERROR] Unhandled error:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('🔴 [GLOBAL-ERROR] Unhandled promise rejection:', {
        reason: event.reason,
        promise: event.promise,
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // ⚠️ ГЛОБАЛЬНОЕ УДАЛЕНИЕ: Удаляем модальное окно "SYSTEM INITIALIZATION" на всех страницах
  // ⚠️ ВНИМАНИЕ: Inline скрипт в _document.tsx удаляет модальное окно ДО React hydration
  // Этот useEffect - дополнительная проверка на случай если inline скрипт не сработал
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Выполняем немедленно при монтировании (до того как React отрендерит компоненты)
    // УПРОЩЕННЫЙ ПОДХОД - такой же как в _document.tsx
    const immediateRemove = () => {
      try {
        const allElements = document.querySelectorAll('*');
        allElements.forEach((el) => {
          const text = el.textContent || '';
          if (text.includes('SYSTEM INITIALIZATION') || text.includes('0/10')) {
            let parent = el.closest('[class*="fixed"], [class*="backdrop"], [class*="modal"], [class*="z-50"]');
            if (parent) {
              console.log('🧹 [_APP] Found modal (immediateRemove):', parent);
              parent.style.display = 'none';
              parent.style.visibility = 'hidden';
              parent.style.opacity = '0';
              try {
                parent.remove();
              } catch (e) {
                if (parent.parentNode) {
                  parent.parentNode.removeChild(parent);
                }
              }
            }
          }
        });
      } catch (e) {
        // Игнорируем ошибки
      }
    };

    // ⚠️ АГРЕССИВНАЯ ОЧИСТКА: Удаляем ВСЕ возможные флаги system initialization из storage
    const allSystemInitFlags = [
      'systeminit', 'system_init', 'isInitializing', 'system_initialization',
      'showSystemInit', 'showSystemInitModal', 'systemInitModal',
      'showWarning', 'systemInit', 'earlyBird', 'early_bird'
    ];
    
    allSystemInitFlags.forEach(flag => {
      try {
        if (sessionStorage.getItem(flag)) {
          console.warn(`🧹 [_APP] Removing system init flag from sessionStorage: ${flag}`);
          sessionStorage.removeItem(flag);
        }
        if (localStorage.getItem(flag)) {
          console.warn(`🧹 [_APP] Removing system init flag from localStorage: ${flag}`);
          localStorage.removeItem(flag);
        }
      } catch (e) {
        // Игнорируем ошибки доступа к storage
      }
    });

    // Функция для удаления модального окна "SYSTEM INITIALIZATION" из DOM
    const removeSystemInitModal = () => {
      try {
        // 🔍 ДИАГНОСТИКА: Ищем и логируем все элементы с текстом модального окна
        const debugMode = window.location.search.includes('debug=modal');
        
        // УПРОЩЕННЫЙ ПОДХОД: Ищем по тексту и удаляем сразу
        const allElements = document.querySelectorAll('*');
        allElements.forEach((el) => {
          const text = el.textContent || '';
          if (text.includes('SYSTEM INITIALIZATION') || text.includes('0/10')) {
            let parent = el.closest('[class*="fixed"], [class*="backdrop"], [class*="modal"], [class*="z-50"]');
            if (parent) {
              if (debugMode) {
                console.error('🔴 [MODAL-DEBUG] Found modal:', {
                  element: parent,
                  className: parent.className,
                  id: parent.id,
                  textContent: text.substring(0, 200)
                });
              }
              console.warn('🧹 [_APP] Found and removing SYSTEM INITIALIZATION modal:', parent);
              parent.style.display = 'none';
              parent.style.visibility = 'hidden';
              parent.style.opacity = '0';
              try {
                parent.remove();
              } catch (e) {
                if (parent.parentNode) {
                  parent.parentNode.removeChild(parent);
                }
              }
              return; // Прерываем поиск после удаления
            }
          }
        });
        
        // Дополнительно: Ищем по специфичным селекторам (purple gradient modal)
        const purpleModals = document.querySelectorAll('[class*="from-blue"], [class*="to-purple"], [class*="bg-gradient"]');
        purpleModals.forEach((modal) => {
          const text = modal.textContent || '';
          if (text.includes('SYSTEM INITIALIZATION') || text.includes('0/10')) {
            console.warn('🧹 [_APP] Found and removing purple gradient modal:', modal);
            modal.style.display = 'none';
            modal.style.visibility = 'hidden';
            modal.style.opacity = '0';
            try {
              modal.remove();
            } catch (e) {
              if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
              }
            }
          }
        });
      } catch (error) {
        console.error('❌ [_APP] Error removing system init modal:', error);
      }
    };

    // Выполняем немедленно несколько раз
    immediateRemove();
    setTimeout(immediateRemove, 0);
    setTimeout(immediateRemove, 10);
    setTimeout(immediateRemove, 50);
    setTimeout(immediateRemove, 100);
    setTimeout(immediateRemove, 200);
    
    // Удаляем сразу при загрузке
    removeSystemInitModal();
    
    // Используем MutationObserver для отслеживания изменений DOM
    const observer = new MutationObserver(() => {
      removeSystemInitModal();
      immediateRemove();
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    } else {
      // Если body еще не готов, ждем
      const bodyObserver = new MutationObserver(() => {
        if (document.body) {
          observer.observe(document.body, {
            childList: true,
            subtree: true,
          });
          bodyObserver.disconnect();
        }
      });
      bodyObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    // Периодически проверяем (на случай если MutationObserver не сработал)
    const interval = setInterval(() => {
      removeSystemInitModal();
      immediateRemove();
    }, 100); // Увеличена частота проверки до 100ms

    // Останавливаем через 30 секунд
    setTimeout(() => {
      clearInterval(interval);
      observer.disconnect();
    }, 30000);

    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  // Вызываем sdk.actions.ready() для Farcaster Mini App
  useEffect(() => {
    let mounted = true;
    
    const callReady = async () => {
      try {
        if (typeof window === 'undefined' || !mounted) {
          return;
        }

        // Проверяем, что мы в iframe Farcaster Mini App
        const isInFarcasterFrame = window.self !== window.top;
        
        if (!isInFarcasterFrame) {
          console.log('ℹ️ [_APP] Not running in Farcaster Mini App frame, skipping ready()');
          return;
        }

        // Динамический импорт для избежания SSR проблем
        const { sdk } = await import('@farcaster/miniapp-sdk');
        
        if (!mounted) return;
        
        // Проверяем, что SDK доступен
        if (sdk && sdk.actions && typeof sdk.actions.ready === 'function') {
          await sdk.actions.ready();
          console.log('✅ [_APP] Farcaster Mini App SDK ready() called successfully');
        } else {
          console.warn('⚠️ [_APP] Farcaster Mini App SDK not properly initialized', { sdk });
        }
      } catch (error: any) {
        if (mounted) {
          console.log('ℹ️ [_APP] Farcaster Mini App SDK not available:', error?.message || 'running in regular browser');
        }
      }
    };

    callReady();
    
    return () => {
      mounted = false;
    };
  }, []);

      return (
        <>
          <Head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
            {/* ⚠️ ОТКЛЮЧАЕМ КЕШ: Добавляем meta теги для предотвращения кеширования */}
            <meta httpEquiv="Cache-Control" content="no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" />
            <meta httpEquiv="Pragma" content="no-cache" />
            <meta httpEquiv="Expires" content="0" />
          </Head>
      <OnchainKitProvider
        chain={base}
        config={{
          appearance: {
            name: 'Multi Like',
            logo: '/mrs-crypto.png',
            theme: 'default',
            mode: 'auto',
          },
        }}
        miniKit={{
          enabled: true,
        }}
      >
        <FarcasterAuthProvider>
          {/* Компонент для синхронизации user из SDK после connect */}
          <AuthSync />
      <Component {...pageProps} />
        </FarcasterAuthProvider>
      </OnchainKitProvider>
    </>
  );
}

