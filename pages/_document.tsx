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
  
  return (
    <Html>
      <Head>
        <meta property="fc:miniapp" content="v1" />
        <meta property="fc:miniapp:title" content="LikeChat Farcaster" />
        <meta property="fc:miniapp:image" content={`${baseUrl}/og.png`} />
        <meta property="fc:miniapp:description" content="Взаимные лайки, рекасты и комментарии в Farcaster" />
        <meta property="fc:miniapp:button:1" content="Открыть LikeChat" />
        <meta property="fc:miniapp:button:1:action" content="link" />
        <meta property="fc:miniapp:button:1:target" content={baseUrl} />
        {/* КРИТИЧНО: Загружаем SDK и вызываем ready() как можно раньше, в <head> */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window === 'undefined') return;
                
                window.__FARCASTER_READY_CALLED__ = false;
                
                // Функция для загрузки SDK и вызова ready()
                async function loadSDKAndCallReady() {
                  if (window.__FARCASTER_READY_CALLED__) return;
                  
                  try {
                    // Пробуем через глобальный объект (если SDK уже загружен)
                    if (window.farcaster && window.farcaster.sdk && window.farcaster.sdk.actions && typeof window.farcaster.sdk.actions.ready === 'function') {
                      await window.farcaster.sdk.actions.ready();
                      console.log('✅ [_DOCUMENT] SDK ready() called via global object');
                      window.__FARCASTER_READY_CALLED__ = true;
                      return;
                    }
                    
                    // Если глобального объекта нет, пробуем загрузить SDK через динамический импорт
                    // Используем системный импорт, если доступен (в Next.js это будет работать через webpack)
                    if (typeof System !== 'undefined' && System.import) {
                      const sdkModule = await System.import('@farcaster/miniapp-sdk');
                      if (sdkModule && sdkModule.sdk && sdkModule.sdk.actions && typeof sdkModule.sdk.actions.ready === 'function') {
                        await sdkModule.sdk.actions.ready();
                        console.log('✅ [_DOCUMENT] SDK ready() called via System.import');
                        window.__FARCASTER_READY_CALLED__ = true;
                        return;
                      }
                    }
                  } catch (e) {
                    console.warn('⚠️ [_DOCUMENT] Error loading/calling SDK:', e);
                  }
                }
                
                // Пытаемся вызвать сразу
                loadSDKAndCallReady();
                
                // Также пробуем после загрузки DOM
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', loadSDKAndCallReady);
                }
                
                // Также пробуем после полной загрузки страницы
                window.addEventListener('load', loadSDKAndCallReady);
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
