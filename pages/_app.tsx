import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { base } from 'wagmi/chains';
import { OnchainKitProvider } from '@coinbase/onchainkit';

export default function App({ Component, pageProps }: AppProps) {
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
        <Component {...pageProps} />
      </OnchainKitProvider>
    </>
  );
}

