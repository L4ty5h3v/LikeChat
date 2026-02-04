import { Html, Head, Main, NextScript, DocumentContext } from 'next/document';

function getFarcasterUrl(): string {
  // КРИТИЧНО: Всегда используем Farcaster production домен для мета-тегов
  // Это гарантирует, что приложение определяется как Farcaster Mini App, а не Base App
  return 'https://likechat-farcaster.vercel.app';
}

Document.getInitialProps = async (ctx: DocumentContext) => {
  const initialProps = await ctx.defaultGetInitialProps(ctx);
  return initialProps;
};

export default function Document() {
  const farcasterUrl = getFarcasterUrl();
  const imageUrl = `${farcasterUrl}/images/image%20(3).png`;
  
  return (
    <Html>
      <Head>
        {/* Farcaster Mini App мета-теги */}
        <meta property="fc:miniapp" content="v1" />
        <meta property="fc:miniapp:title" content="MULTI LIKE" />
        <meta property="fc:miniapp:image" content={imageUrl} />
        <meta property="fc:miniapp:description" content="You like, they like back" />
        <meta property="fc:miniapp:button:1" content="Открыть MULTI LIKE" />
        <meta property="fc:miniapp:button:1:action" content="link" />
        <meta property="fc:miniapp:button:1:target" content={farcasterUrl} />
        
        {/* Open Graph мета-теги для обложки при шаринге */}
        <meta property="og:title" content="MULTI LIKE - Farcaster Mini App" />
        <meta property="og:description" content="You like, they like back. Gain likes and recasts through mutual activity." />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={farcasterUrl} />
        <meta property="og:site_name" content="MULTI LIKE" />
        
        {/* Twitter Card мета-теги */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="MULTI LIKE - Farcaster Mini App" />
        <meta name="twitter:description" content="You like, they like back. Gain likes and recasts through mutual activity." />
        <meta name="twitter:image" content={imageUrl} />
        
        {/* КРИТИЧНО: Устанавливаем флаг для вызова ready() в _app.tsx */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window === 'undefined') return;
                window.__FARCASTER_READY_CALLED__ = false;
                // Устанавливаем флаг, что нужно вызвать ready() как можно скорее
                window.__FARCASTER_NEEDS_READY__ = true;
              })();
            `,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
