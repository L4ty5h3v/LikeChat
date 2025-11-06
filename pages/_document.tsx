import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="ru">
      <Head>
        <meta charSet="utf-8" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="icon" href="/favicon.ico" />
        {/* Скрипт для вызова Vercel SDK ready() */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Shim для окружений, где SDK не инжектится, но Dev overlay его ожидает
                if (!window.sdk) {
                  window.sdk = { actions: { ready: function() { try { console.log('✅ sdk.actions.ready() shim called'); window.__READY_CALLED__ = true; } catch(e){} } } };
                } else if (!window.sdk.actions) {
                  window.sdk.actions = { ready: function() { try { console.log('✅ sdk.actions.ready() shim called'); window.__READY_CALLED__ = true; } catch(e){} } };
                } else if (!window.sdk.actions.ready) {
                  window.sdk.actions.ready = function() { try { console.log('✅ sdk.actions.ready() shim called'); window.__READY_CALLED__ = true; } catch(e){} };
                }
                
                function callVercelReady() {
                  try {
                    // Проверяем различные возможные пути к Vercel SDK
                    if (window.__VERCEL_SDK__?.actions?.ready) {
                      console.log('✅ Calling Vercel SDK ready() via __VERCEL_SDK__');
                      window.__VERCEL_SDK__.actions.ready();
                      return true;
                    }
                    if (window.vercel?.sdk?.actions?.ready) {
                      console.log('✅ Calling Vercel SDK ready() via vercel.sdk');
                      window.vercel.sdk.actions.ready();
                      return true;
                    }
                    if (window.sdk?.actions?.ready) {
                      console.log('✅ Calling Vercel SDK ready() via sdk');
                      window.sdk.actions.ready();
                      return true;
                    }
                    // Пробуем найти SDK через события
                    if (window.parent && window.parent !== window) {
                      try {
                        if (window.parent.__VERCEL_SDK__?.actions?.ready) {
                          console.log('✅ Calling Vercel SDK ready() via parent window');
                          window.parent.__VERCEL_SDK__.actions.ready();
                          return true;
                        }
                      } catch (e) {
                        // Cross-origin, игнорируем
                      }
                    }
                    return false;
                  } catch (error) {
                    console.warn('⚠️ Error calling Vercel SDK ready():', error);
                    return false;
                  }
                }
                
                // Пытаемся вызвать сразу
                if (!callVercelReady()) {
                  // Если не получилось, ждем загрузки DOM
                  if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', function() {
                      setTimeout(callVercelReady, 100);
                    });
                  } else {
                    setTimeout(callVercelReady, 100);
                  }
                  
                  // Также пробуем после полной загрузки
                  window.addEventListener('load', function() {
                    setTimeout(callVercelReady, 200);
                  });
                }
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

