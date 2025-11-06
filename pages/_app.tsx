import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { sdk } from '@farcaster/miniapp-sdk';

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient());

  // Вызываем sdk.actions.ready() для Farcaster Mini App согласно документации
  // https://miniapps.farcaster.xyz/docs/getting-started#making-your-app-display
  useEffect(() => {
    const callReady = async () => {
      try {
        // Проверяем, что мы в окружении Farcaster Mini App
        if (typeof window !== 'undefined') {
          await sdk.actions.ready();
          console.log('✅ Farcaster Mini App SDK ready() called successfully');
        }
      } catch (error) {
        // Если SDK не доступен (например, в обычном браузере), это нормально
        console.log('ℹ️ Farcaster Mini App SDK not available (running in regular browser)');
      }
    };

    callReady();
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

