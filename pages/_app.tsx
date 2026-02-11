import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { base } from 'wagmi/chains';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FarcasterAuthProvider } from '@/contexts/FarcasterAuthContext';
import { AuthSync } from '@/components/AuthSync';
import InstallPrompt from '@/components/InstallPrompt';

// IMPORTANT: Do NOT mount OnchainKit/Privy globally: it triggers CORS failures in Farcaster web contexts
// (origin `wallet.farcaster.xyz` -> `auth.privy.io`) and can break page scripts (Tasks stuck loading).
const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    // Prefer Farcaster wallet when available, but allow injected fallback on desktop
    farcasterMiniApp(),
    injected(),
  ],
  transports: {
    [base.id]: http(),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

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
  // ⚠️ КРИТИЧНО: Вызываем ready() как можно раньше, чтобы скрыть заставку
  // Вызываем синхронно при загрузке модуля, не ждём useEffect
  if (typeof window !== 'undefined') {
    // Немедленный вызов при загрузке модуля
    (async () => {
      try {
        // Небольшая задержка для инициализации
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const { sdk } = await import('@farcaster/miniapp-sdk');
        
        if (sdk && sdk.actions && typeof sdk.actions.ready === 'function') {
          await sdk.actions.ready();
          (window as any).__FARCASTER_READY_CALLED__ = true;
          console.log('✅ [_APP] Farcaster Mini App SDK ready() called immediately on module load');
        }
      } catch (error: any) {
        // Игнорируем ошибки - SDK будет вызван в useEffect
        console.log('ℹ️ [_APP] Immediate SDK call failed, will retry in useEffect:', error?.message);
      }
    })();
  }

  // Дублируем вызов в useEffect для надёжности
  useEffect(() => {
    let mounted = true;
    
    const callReady = async () => {
      try {
        if (typeof window === 'undefined' || !mounted) {
          return;
        }

        // Проверяем, не был ли уже вызван ready()
        if ((window as any).__FARCASTER_READY_CALLED__) {
          console.log('ℹ️ [_APP] ready() already called, skipping');
          return;
        }

        // Небольшая задержка, чтобы дать время SDK загрузиться
        await new Promise(resolve => setTimeout(resolve, 200));

        if (!mounted) return;

        // Динамический импорт для избежания SSR проблем
        const { sdk } = await import('@farcaster/miniapp-sdk');
        
        if (!mounted) return;
        
        // Проверяем, что SDK доступен и вызываем ready()
        if (sdk && sdk.actions && typeof sdk.actions.ready === 'function') {
          await sdk.actions.ready();
          (window as any).__FARCASTER_READY_CALLED__ = true;
          console.log('✅ [_APP] Farcaster Mini App SDK ready() called successfully in useEffect');
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

    // Вызываем сразу при монтировании
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
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <FarcasterAuthProvider>
            <AuthSync />
            <Component {...pageProps} />
            <InstallPrompt />
          </FarcasterAuthProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </>
  );
}
