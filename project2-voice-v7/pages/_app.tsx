import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    const initSDK = async () => {
      try {
        if (typeof window !== 'undefined') {
          const { sdk } = await import('@farcaster/miniapp-sdk');
          if (sdk && sdk.actions && sdk.actions.ready) {
            await sdk.actions.ready();
            console.log('✅ Farcaster MiniApp SDK ready');
          }
        }
      } catch (error) {
        console.log('ℹ️ Running outside Farcaster:', error);
      }
    };
    initSDK();
  }, []);

  return <Component {...pageProps} />;
}

