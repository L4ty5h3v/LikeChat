import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="ru">
      <Head>
        <meta charSet="utf-8" />
        
        {/* Farcaster Mini App мета-теги - важно для правильной работы в Warpcast */}
        <meta property="fc:miniapp" content="v1" />
        <meta property="fc:miniapp:title" content="LikeChat Farcaster" />
        <meta property="fc:miniapp:image" content="https://likechat-farcaster.vercel.app/og.png" />
        <meta property="fc:miniapp:description" content="Взаимные лайки, рекасты и комментарии в Farcaster" />
        <meta property="fc:miniapp:button:1" content="Открыть LikeChat" />
        <meta property="fc:miniapp:button:1:action" content="link" />
        <meta property="fc:miniapp:button:1:target" content="https://likechat-farcaster.vercel.app/" />
        
        {/* Open Graph мета-теги */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="LikeChat Farcaster - Multi Like" />
        <meta property="og:description" content="Mutual love from Mrs. Crypto 💌" />
        <meta property="og:image" content="https://likechat-farcaster.vercel.app/images/mrs-crypto.jpg" />
        
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
