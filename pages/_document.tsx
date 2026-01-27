import { Html, Head, Main, NextScript, DocumentContext } from 'next/document';

function getBaseUrl(): string {
  // Используем переменную окружения или Vercel URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL;
  
  if (baseUrl) {
    // Если VERCEL_URL, добавляем https://
    return baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
  }
  
  // Fallback на дефолтный домен
  return 'https://likechat-farcaster.vercel.app';
}

Document.getInitialProps = async (ctx: DocumentContext) => {
  const initialProps = await ctx.defaultGetInitialProps(ctx);
  return initialProps;
};

export default function Document() {
  const baseUrl = getBaseUrl();
  // Включаем base:app_id ТОЛЬКО для Base версии.
  // 1) Можно явно включить через NEXT_PUBLIC_APP_VARIANT=base
  // 2) Или автоматически по домену проекта (например: likechat-base-app.vercel.app
  //    или Vercel preview домен вида likechat-base-<hash>-....vercel.app)
  const envVariant = process.env.NEXT_PUBLIC_APP_VARIANT;
  const inferredHost = (process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL || '').toString();
  const isBaseApp =
    envVariant === 'base' ||
    inferredHost.includes('likechat-base-app') ||
    inferredHost.includes('likechat-base-') ||
    inferredHost.startsWith('likechat-base') ||
    baseUrl.includes('likechat-base-app.vercel.app') ||
    baseUrl.includes('likechat-base-') ||
    baseUrl.includes('likechat-base');
  
  return (
    <Html>
      <Head>
        <meta name="application-name" content="MULTI LIKE" />
        <meta name="apple-mobile-web-app-title" content="MULTI LIKE" />
        <meta name="theme-color" content="#ef4444" />
        <link rel="manifest" href="/site.webmanifest" />
        {isBaseApp && (
          <meta name="base:app_id" content="693c50258a7c4e55fec73fe1" />
        )}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
