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

// Создаем wagmiConfig с обработкой ошибок
let wagmiConfig: ReturnType<typeof createConfig>;
try {
  wagmiConfig = createConfig({
    chains: [base],
    connectors: [injected()],
    transports: {
      [base.id]: http(),
    },
    ssr: true, // Включаем SSR, но провайдеры будут работать только на клиенте
  });
} catch (error) {
  console.error('❌ [APP] Failed to create wagmi config:', error);
  // Создаем минимальный конфиг в случае ошибки
  wagmiConfig = createConfig({
    chains: [base],
    connectors: [],
    transports: {
      [base.id]: http(),
    },
    ssr: true,
  });
}

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
      // Игнорируем ошибки загрузки изображений (они не критичны)
      const reason = event.reason;
      if (reason && typeof reason === 'object' && 'target' in reason) {
        const target = (reason as any).target;
        if (target && target.tagName === 'IMG') {
          // Это ошибка загрузки изображения - не логируем, чтобы не засорять консоль
          event.preventDefault();
          return;
        }
      }
      
      // Игнорируем ошибки из Farcaster компонентов (UnfocusedCast и т.д.)
      if (reason && typeof reason === 'object' && 'isTrusted' in reason) {
        const errorEvent = reason as ErrorEvent;
        if (errorEvent.target && (errorEvent.target as any).tagName === 'IMG') {
          event.preventDefault();
          return;
        }
      }

      console.error('🔴 [GLOBAL-ERROR] Unhandled promise rejection:', {
        reason: event.reason,
        promise: event.promise,
      });
      // Предотвращаем полный краш приложения
      event.preventDefault();
    };

    // Обработка ошибок загрузки изображений
    const handleImageError = (event: Event) => {
      // Тихо обрабатываем ошибки загрузки изображений
      const img = event.target as HTMLImageElement;
      if (img && img.tagName === 'IMG') {
        // Устанавливаем fallback или скрываем изображение
        if (img.src && !img.src.includes('data:')) {
          img.style.display = 'none';
        }
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    document.addEventListener('error', handleImageError, true); // Используем capture phase

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
