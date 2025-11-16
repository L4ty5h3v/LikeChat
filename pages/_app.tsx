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
  useEffect(() => {
    if (typeof window === 'undefined') return;

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
        
        // Ищем по специфичным селекторам (purple gradient modal)
        const purpleModals = document.querySelectorAll('[class*="from-blue"], [class*="to-purple"], [class*="bg-gradient"]');
        purpleModals.forEach((modal) => {
          const text = modal.textContent || '';
          if (text.includes('SYSTEM INITIALIZATION') || text.includes('0/10')) {
            if (debugMode) {
              console.error('🔴 [MODAL-DEBUG] Found purple gradient modal:', {
                element: modal,
                className: modal.className,
                id: modal.id,
                parent: modal.parentElement,
                computedStyle: window.getComputedStyle(modal),
                textContent: text.substring(0, 200)
              });
            }
            console.warn('🧹 [_APP] Found and removing purple gradient SYSTEM INITIALIZATION modal:', modal);
            modal.remove();
            return;
          }
        });

        // Ищем любые элементы, содержащие текст модального окна
        const allElements = document.querySelectorAll('*');
        let foundCount = 0;
        allElements.forEach((el) => {
          const text = el.textContent || '';
          if (text.includes('SYSTEM INITIALIZATION') || 
              text.includes('You are one of the first users') ||
              text.includes('collecting the first 10 links') ||
              text.includes('Links in system: 0/10') ||
              text.includes('Links in system') ||
              text.includes('Early Bird Bonus')) {
            foundCount++;
            
            if (debugMode) {
              console.warn('🔍 [MODAL-DEBUG] Found element with modal text:', {
                element: el,
                tagName: el.tagName,
                className: el.className,
                id: el.id,
                parent: el.parentElement,
                textContent: text.substring(0, 100)
              });
            }
            // Ищем родительский элемент модального окна (backdrop или fixed)
            // Проверяем несколько уровней вверх
            let current = el;
            let parent = null;
            
            // Ищем родителя с fixed позиционированием или backdrop классом
            for (let i = 0; i < 10; i++) {
              if (!current || !current.parentElement) break;
              current = current.parentElement;
              
              const classes = current.className || '';
              const style = window.getComputedStyle(current);
              
              if (classes.includes('fixed') || 
                  classes.includes('backdrop') || 
                  classes.includes('modal') ||
                  classes.includes('z-50') ||
                  style.position === 'fixed') {
                parent = current;
                break;
              }
            }
            
            if (parent) {
              console.warn('🧹 [_APP] Found and removing SYSTEM INITIALIZATION modal from DOM:', {
                element: parent,
                className: parent.className,
                id: parent.id,
                textContent: parent.textContent?.substring(0, 100),
                foundAt: new Date().toISOString()
              });
              
              // Принудительно скрываем перед удалением
              (parent as HTMLElement).style.display = 'none';
              (parent as HTMLElement).style.visibility = 'hidden';
              (parent as HTMLElement).style.opacity = '0';
              
              parent.remove();
              return; // Прерываем, если удалили
            } else if (el.classList.contains('fixed') || el.classList.contains('backdrop')) {
              // Если сам элемент является модальным окном
              console.warn('🧹 [_APP] Found and removing SYSTEM INITIALIZATION modal (direct element):', {
                element: el,
                className: el.className,
                id: el.id,
                foundAt: new Date().toISOString()
              });
              
              // Принудительно скрываем перед удалением
              (el as HTMLElement).style.display = 'none';
              (el as HTMLElement).style.visibility = 'hidden';
              (el as HTMLElement).style.opacity = '0';
              
              el.remove();
              return;
            }
          }
        });
        
        if (foundCount > 0 && debugMode) {
          console.error(`🔴 [MODAL-DEBUG] Found ${foundCount} elements with modal text, but could not remove modal parent`);
        }
      } catch (error) {
        console.error('❌ [_APP] Error removing system init modal:', error);
      }
    };

    // Удаляем сразу при загрузке
    removeSystemInitModal();
    
    // Используем MutationObserver для отслеживания изменений DOM
    const observer = new MutationObserver(() => {
      removeSystemInitModal();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Периодически проверяем (на случай если MutationObserver не сработал)
    const interval = setInterval(removeSystemInitModal, 500);

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

