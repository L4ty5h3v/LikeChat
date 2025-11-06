import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient());

  // Вызываем sdk.actions.ready() для Vercel Preview
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Небольшая задержка, чтобы убедиться, что SDK загружен
      const timer = setTimeout(() => {
        try {
          // Проверяем различные возможные пути к Vercel SDK
          const win = window as any;
          
          // Вариант 1: __VERCEL_SDK__
          if (win.__VERCEL_SDK__?.actions?.ready) {
            console.log('✅ Calling Vercel SDK ready() via __VERCEL_SDK__');
            win.__VERCEL_SDK__.actions.ready();
            return;
          }
          
          // Вариант 2: vercel.sdk
          if (win.vercel?.sdk?.actions?.ready) {
            console.log('✅ Calling Vercel SDK ready() via vercel.sdk');
            win.vercel.sdk.actions.ready();
            return;
          }
          
          // Вариант 3: прямой доступ к sdk
          if (win.sdk?.actions?.ready) {
            console.log('✅ Calling Vercel SDK ready() via sdk');
            win.sdk.actions.ready();
            return;
          }
          
          // Вариант 4: через document
          const sdkScript = document.querySelector('script[data-vercel-sdk]');
          if (sdkScript) {
            const sdk = (sdkScript as any).sdk;
            if (sdk?.actions?.ready) {
              console.log('✅ Calling Vercel SDK ready() via script tag');
              sdk.actions.ready();
              return;
            }
          }
          
          console.log('ℹ️ Vercel SDK not found, app is ready anyway');
        } catch (error) {
          console.warn('⚠️ Error calling Vercel SDK ready():', error);
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
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

