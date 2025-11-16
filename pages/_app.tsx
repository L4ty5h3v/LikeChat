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

    // Функция для удаления модального окна "SYSTEM INITIALIZATION" из DOM
    const removeSystemInitModal = () => {
      try {
        // Ищем любые элементы, содержащие текст модального окна
        const allElements = document.querySelectorAll('*');
        allElements.forEach((el) => {
          const text = el.textContent || '';
          if (text.includes('SYSTEM INITIALIZATION') || 
              text.includes('You are one of the first users') ||
              text.includes('collecting the first 10 links') ||
              text.includes('Links in system') ||
              text.includes('Early Bird Bonus')) {
            // Ищем родительский элемент модального окна (backdrop или fixed)
            let parent = el.closest('[class*="fixed"]');
            if (!parent) {
              parent = el.closest('[class*="backdrop"]');
            }
            if (!parent) {
              parent = el.closest('[class*="modal"]');
            }
            if (!parent && (el.classList.contains('fixed') || el.classList.contains('backdrop'))) {
              parent = el;
            }
            
            if (parent) {
              console.warn('🧹 [_APP] Found and removing SYSTEM INITIALIZATION modal from DOM:', parent);
              parent.remove();
            }
          }
        });
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

