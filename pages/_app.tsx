import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { FarcasterAuthProvider } from '@/contexts/FarcasterAuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const AuthSyncNoSSR = dynamic(() => import('@/components/AuthSync').then((m) => m.AuthSync), { ssr: false });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Создаем wagmiConfig всегда (для SSR), но делаем его безопасным
const wagmiConfig = createConfig({
  chains: [base],
  connectors: [injected()],
  transports: {
    [base.id]: http(),
  },
  ssr: true, // Включаем SSR, но провайдеры будут работать только на клиенте
});

export default function App({ Component, pageProps }: AppProps) {
  // Глобальный обработчик ошибок для отлова неперехваченных ошибок
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleError = (event: ErrorEvent) => {
      console.error('🔴 [GLOBAL-ERROR] Unhandled error:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
      });
      // Предотвращаем полный краш приложения
      event.preventDefault();
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('🔴 [GLOBAL-ERROR] Unhandled promise rejection:', {
        reason: event.reason,
        promise: event.promise,
      });
      // Предотвращаем полный краш приложения
      event.preventDefault();
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Base-версия: Farcaster Mini App SDK не используем

  return (
    <ErrorBoundary>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>
      <ErrorBoundary fallback={<div style={{ padding: '20px' }}>Wagmi initialization failed. Please reload.</div>}>
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            <ErrorBoundary fallback={<div style={{ padding: '20px' }}>OnchainKit initialization failed. Please reload.</div>}>
              <OnchainKitProvider
                chain={base}
                miniKit={{
                  enabled: true,
                  // У нас есть стабильный endpoint; нужен только чтобы библиотека не ходила в /api/notify по умолчанию.
                  notificationProxyUrl: '/api/webhook',
                  autoConnect: false,
                }}
              >
                <FarcasterAuthProvider>
                  <AuthSyncNoSSR />
                  <Component {...pageProps} />
                </FarcasterAuthProvider>
              </OnchainKitProvider>
            </ErrorBoundary>
          </QueryClientProvider>
        </WagmiProvider>
      </ErrorBoundary>
    </ErrorBoundary>
  );
}
