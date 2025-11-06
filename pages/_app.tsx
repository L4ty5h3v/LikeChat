import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient());

  // Вызываем sdk.actions.ready() для Farcaster Mini App согласно документации
  // https://miniapps.farcaster.xyz/docs/getting-started#making-your-app-display
  useEffect(() => {
    const callReady = async () => {
      try {
        // Проверяем, что мы в окружении Farcaster Mini App
        if (typeof window !== 'undefined') {
          // Динамический импорт для избежания SSR проблем
          const { sdk } = await import('@farcaster/miniapp-sdk');
          
          // Проверяем, что SDK доступен
          if (sdk && sdk.actions && sdk.actions.ready) {
            await sdk.actions.ready();
            console.log('✅ Farcaster Mini App SDK ready() called successfully');
          } else {
            console.warn('⚠️ Farcaster Mini App SDK not properly initialized');
          }
        }
      } catch (error: any) {
        // Если SDK не доступен (например, в обычном браузере), это нормально
        console.log('ℹ️ Farcaster Mini App SDK not available:', error?.message || 'running in regular browser');
      }
    };

    // Вызываем сразу
    callReady();
    
    // Также пробуем вызвать после небольшой задержки на случай, если SDK загружается асинхронно
    const timeout = setTimeout(() => {
      callReady();
    }, 100);
    
    return () => clearTimeout(timeout);
  }, []);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>
      <QueryClientProvider client={queryClient}>
        <Component {...pageProps} />
      </QueryClientProvider>
    </>
  );
}

