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

  // Вызываем sdk.actions.ready() для Farcaster Mini App
  // ⚠️ ВАЖНО: Всегда вызываем ready(), даже если не в iframe - SDK сам определит контекст
  useEffect(() => {
    let mounted = true;
    
    const callReady = async () => {
      try {
        if (typeof window === 'undefined' || !mounted) {
          return;
        }

        // Динамический импорт для избежания SSR проблем
        const { sdk } = await import('@farcaster/miniapp-sdk');
        
        if (!mounted) return;
        
        // Проверяем, что SDK доступен и вызываем ready()
        if (sdk && sdk.actions && typeof sdk.actions.ready === 'function') {
          await sdk.actions.ready();
          console.log('✅ [_APP] Farcaster Mini App SDK ready() called successfully');
        } else {
          console.warn('⚠️ [_APP] Farcaster Mini App SDK not properly initialized', { sdk });
        }
      } catch (error: any) {
        if (mounted) {
          // Не логируем ошибку как критическую - приложение может работать и без SDK
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
        chain={base} // КРИТИЧНО: base из wagmi/chains имеет chainId 8453
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
          <Component {...pageProps} />
        </FarcasterAuthProvider>
      </OnchainKitProvider>
    </>
  );
}
