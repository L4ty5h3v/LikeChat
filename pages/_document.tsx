import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="ru">
      <Head>
        <meta charSet="utf-8" />
        
        {/* Farcaster Mini App мета-теги - важно для правильной работы в Warpcast */}
        <meta name="farcaster:miniapp" content="true" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="LikeChat Farcaster - Multi Like" />
        <meta property="og:description" content="Mutual love from Mrs. Crypto 💌" />
        <meta property="og:image" content="https://likechat-farcaster.vercel.app/images/mrs-crypto.jpg" />
        
        {/* Явно указываем, что это НЕ Frame */}
        <meta name="farcaster:frame" content="false" />
        
        {/* Mobile мета-теги */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
