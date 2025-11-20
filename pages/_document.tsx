import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        <meta property="fc:miniapp" content="v1" />
        <meta property="fc:miniapp:title" content="LikeChat Farcaster" />
        <meta property="fc:miniapp:image" content="https://likechat-farcaster.vercel.app/og.png" />
        <meta property="fc:miniapp:description" content="Взаимные лайки, рекасты и комментарии в Farcaster" />
        <meta property="fc:miniapp:button:1" content="Открыть LikeChat" />
        <meta property="fc:miniapp:button:1:action" content="link" />
        <meta property="fc:miniapp:button:1:target" content="https://likechat-farcaster.vercel.app/" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
