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
            if (parent && parent instanceof HTMLElement) {
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
            if (parent && parent instanceof HTMLElement) {
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
          if (!(modal instanceof HTMLElement)) return;
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

        // ⚠️ КРИТИЧЕСКИ ВАЖНО: Проверяем modal-root, popover-root - модальное окно может рендериться туда
        // ⚠️ НЕМЕДЛЕННО УДАЛЯЕМ modal-root если он содержит модальное окно
        const modalRoot = document.getElementById('modal-root');
        if (modalRoot) {
          const modalRootText = modalRoot.textContent || '';
          if (modalRootText.includes('SYSTEM INITIALIZATION') || 
              modalRootText.includes('You are one of the first users') ||
              modalRootText.includes('Links in system: 0/10')) {
            console.warn('🧹 [_APP] Found SYSTEM INITIALIZATION in modal-root, removing entire modal-root');
            try {
              modalRoot.remove();
            } catch (e) {
              try {
                modalRoot.innerHTML = '';
                modalRoot.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
              } catch (e2) {}
            }
          } else {
            // Даже если нет текста, удаляем все children с purple gradient
            const modalRootPurple = modalRoot.querySelectorAll('[class*="from-blue"], [class*="to-purple"]');
            modalRootPurple.forEach((purpleEl) => {
              const purpleText = purpleEl.textContent || '';
              if (purpleText.includes('SYSTEM INITIALIZATION')) {
                console.warn('🧹 [_APP] Found purple gradient in modal-root with SYSTEM INITIALIZATION, removing:', purpleEl);
                try {
                  purpleEl.remove();
                } catch (e3) {}
              }
            });
          }
        }

        // ⚠️ ДОПОЛНИТЕЛЬНО: Удаляем все элементы с purple gradient из ВСЕГО документа
        const allPurpleGradient = document.querySelectorAll('[class*="from-blue"]');
        allPurpleGradient.forEach((el) => {
          if (el.textContent?.includes('SYSTEM INITIALIZATION')) {
            console.warn('🧹 [_APP] Found purple gradient element with SYSTEM INITIALIZATION, removing:', el);
            try {
              el.remove();
            } catch (e) {
              try {
                if (el.parentNode) {
                  el.parentNode.removeChild(el);
                }
              } catch (e2) {}
            }
          }
        });

        // Проверяем другие root элементы
        const otherRoots = ['popover-root', 'hover-popover-root'];
        otherRoots.forEach((rootId) => {
          const rootEl = document.getElementById(rootId);
          if (rootEl) {
            const rootText = rootEl.textContent || '';
            if (rootText.includes('SYSTEM INITIALIZATION')) {
              try {
                rootEl.innerHTML = '';
              } catch (e) {}
            }
          }
        });

        // ⚠️ ДОПОЛНИТЕЛЬНО: Ищем ВСЕ div с fixed позиционированием
        const allDivs = document.querySelectorAll('div');
        allDivs.forEach((div) => {
          const computedStyle = window.getComputedStyle(div);
          if (computedStyle.position === 'fixed') {
            const divText = div.textContent || '';
            if (divText.includes('SYSTEM INITIALIZATION') || 
                divText.includes('You are one of the first users') ||
                divText.includes('Links in system: 0/10')) {
              console.warn('🧹 [_APP] Found fixed div with modal text, removing:', div);
              div.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important;';
              try {
                div.remove();
              } catch (e) {
                try {
                  if (div.parentNode) {
                    div.parentNode.removeChild(div);
                  }
                } catch (e2) {}
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
        }, 25); // МАКСИМАЛЬНАЯ ЧАСТОТА: проверяем каждые 25ms

        // Останавливаем через 5 минут (увеличено)
        setTimeout(() => {
          clearInterval(interval);
          observer.disconnect();
        }, 300000); // 5 минут
        
        // ⚠️ ДОПОЛНИТЕЛЬНАЯ ПОСТОЯННАЯ ПРОВЕРКА: Каждую секунду на случай позднего появления
        const longInterval = setInterval(() => {
          removeSystemInitModal();
          immediateRemove();
        }, 1000); // Каждую секунду
        setTimeout(() => {
          clearInterval(longInterval);
        }, 300000); // 5 минут
        
        // ⚠️ КРИТИЧЕСКИ ВАЖНО: Принудительно очищаем modal-root постоянно
        const forceClearModalRoot = () => {
          const modalRoot = document.getElementById('modal-root');
          if (modalRoot) {
            const text = modalRoot.textContent || '';
            if (text.includes('SYSTEM INITIALIZATION') || 
                text.includes('You are one of the first users') ||
                text.includes('Links in system') ||
                text.includes('Early Bird')) {
              console.warn('🧹 [_APP FORCE] Clearing modal-root with modal content');
              try {
                modalRoot.innerHTML = '';
                modalRoot.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important;';
              } catch (e) {
                try {
                  modalRoot.remove();
                } catch (e2) {}
              }
            }
          }
        };
        
        // Выполняем принудительную очистку постоянно
        const forceInterval = setInterval(forceClearModalRoot, 100); // Каждые 100ms
        setTimeout(() => {
          clearInterval(forceInterval);
        }, 300000); // 5 минут

        // ⚠️ ДОПОЛНИТЕЛЬНО: Следим за созданием modal-root элемента
        const modalRootObserver = new MutationObserver(() => {
          const modalRoot = document.getElementById('modal-root');
          if (modalRoot) {
            removeSystemInitModal(); // Немедленно проверяем modal-root
            immediateRemove();
          }
        });

        if (document.body) {
          modalRootObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
          });
        }

        setTimeout(() => {
          modalRootObserver.disconnect();
        }, 60000);

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

