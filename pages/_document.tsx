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
                
                // Функция для вызова ready()
                function callReady() {
                  try {
                    // Пробуем через глобальный объект (если SDK уже загружен)
                    if (window.farcaster && window.farcaster.sdk && window.farcaster.sdk.actions && typeof window.farcaster.sdk.actions.ready === 'function') {
                      window.farcaster.sdk.actions.ready().then(function() {
                        console.log('✅ [_DOCUMENT] SDK ready() called via global object');
                        window.__FARCASTER_READY_CALLED__ = true;
                      }).catch(function(err) {
                        console.warn('⚠️ [_DOCUMENT] Error calling ready() via global:', err);
                      });
                      return true;
                    }
                  } catch (e) {
                    console.warn('⚠️ [_DOCUMENT] Error accessing global SDK:', e);
                  }
                  return false;
                }
                
                // Пытаемся вызвать сразу
                if (callReady()) return;
                
                // Если не получилось, пробуем после загрузки DOM
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', function() {
                    if (!window.__FARCASTER_READY_CALLED__) {
                      callReady();
                    }
                  });
                } else {
                  // DOM уже загружен
                  callReady();
                }
                
                // Также пробуем после полной загрузки страницы
                window.addEventListener('load', function() {
                  if (!window.__FARCASTER_READY_CALLED__) {
                    callReady();
                  }
                });
              })();
            `,
          }}
        />
      </Head>
      <body>
        {/* КРИТИЧНО: Вызываем sdk.actions.ready() как можно раньше, до рендеринга компонентов */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window === 'undefined') return;
                // Устанавливаем флаг, что ready() должен быть вызван
                window.__FARCASTER_READY_CALLED__ = false;
                // Пытаемся вызвать ready() сразу после загрузки страницы
                window.addEventListener('DOMContentLoaded', function() {
                  if (window.__FARCASTER_READY_CALLED__) return;
                  try {
                    // Проверяем, доступен ли SDK через глобальный объект
                    if (window.farcaster && window.farcaster.sdk && window.farcaster.sdk.actions && typeof window.farcaster.sdk.actions.ready === 'function') {
                      window.farcaster.sdk.actions.ready().then(function() {
                        window.__FARCASTER_READY_CALLED__ = true;
                      }).catch(function() {});
                    }
                  } catch (e) {
                    // Игнорируем ошибки - SDK будет вызван в _app.tsx
                  }
                });
              })();
            `,
          }}
        />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
