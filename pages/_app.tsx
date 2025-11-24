import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { base } from 'wagmi/chains';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { FarcasterAuthProvider } from '@/contexts/FarcasterAuthContext';
import { AuthSync } from '@/components/AuthSync';

// Компонент для обработки возврата в приложение после закрытия уведомления
function NotificationRedirectHandler() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // Проверяем, что мы в iframe Farcaster Mini App
    const isInFarcasterFrame = window.self !== window.top;
    if (!isInFarcasterFrame) {
      return;
    }

    let wasHidden = false;
    let hideTimestamp = 0;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Окно стало скрытым (пользователь ушел из приложения, возможно, открыл уведомление)
        wasHidden = true;
        hideTimestamp = Date.now();
        console.log('🔔 [NOTIFICATION] App hidden - user may have opened notification');
      } else if (wasHidden && !document.hidden) {
        // Окно снова видимо (пользователь вернулся в приложение)
        const timeHidden = Date.now() - hideTimestamp;
        console.log('🔔 [NOTIFICATION] App visible again after', timeHidden, 'ms');
        
        // Редиректим только если:
        // 1. Пользователь не на главной странице
        // 2. Пользователь не на странице задач (чтобы не мешать открытию заданий)
        // 3. Прошло достаточно времени (больше 1 секунды) - это указывает на закрытие уведомления, а не простое переключение вкладок
        if (router.pathname !== '/' && router.pathname !== '/tasks' && timeHidden > 1000) {
          console.log('🏠 [NOTIFICATION] Redirecting to home page after notification close');
          router.replace('/');
        }
        
        wasHidden = false;
      }
    };

    const handleFocus = () => {
      // Когда окно получает фокус (пользователь вернулся в приложение)
      // Редиректим только если прошло достаточно времени и не на странице задач
      if (wasHidden && router.pathname !== '/' && router.pathname !== '/tasks') {
        const timeHidden = Date.now() - hideTimestamp;
        if (timeHidden > 1000) {
          console.log('🏠 [NOTIFICATION] Redirecting to home page after focus (notification closed)');
          router.replace('/');
        }
        wasHidden = false;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [router]);

  return null;
}

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
          <AuthSync />
          <NotificationRedirectHandler />
          <Component {...pageProps} />
        </FarcasterAuthProvider>
      </OnchainKitProvider>
    </>
  );
}
