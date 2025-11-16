import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  // ⚠️ КРИТИЧЕСКИ ВАЖНО: Добавляем версию для предотвращения кеша браузера
  const version = Date.now(); // Уникальная версия при каждой сборке

  return (
    <Html lang="ru">
      <Head>
        <meta charSet="utf-8" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* ⚠️ ОТКЛЮЧАЕМ КЕШ: Добавляем meta теги для предотвращения кеширования */}
        <meta httpEquiv="Cache-Control" content="no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <link rel="icon" href={`/favicon.ico?v=${version}`} />
      </Head>
      <body>
        {/* ⚠️ КРИТИЧЕСКИ ВАЖНО: Inline скрипт, который выполняется ДО React hydration */}
        {/* Этот скрипт удаляет модальное окно "SYSTEM INITIALIZATION" немедленно */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                'use strict';
                
                // ⚠️ ФУНКЦИЯ УДАЛЕНИЯ: Удаляет модальное окно "SYSTEM INITIALIZATION" - МАКСИМАЛЬНО АГРЕССИВНО
                function removeSystemInitModal() {
                  try {
                    // Очищаем storage
                    try {
                      const flags = ['systeminit', 'system_init', 'isInitializing', 'system_initialization', 'showWarning', 'showSystemInit', 'totalLinks'];
                      flags.forEach(flag => {
                        sessionStorage.removeItem(flag);
                        localStorage.removeItem(flag);
                      });
                    } catch(e) {}
                    
                    var foundCount = 0;
                    
                    // МЕТОД 1: Ищем по тексту - проверяем ВСЕ элементы
                    var allElements = document.querySelectorAll('*');
                    
                    for (var i = 0; i < allElements.length; i++) {
                      var el = allElements[i];
                      var text = el.textContent || el.innerText || '';
                      
                      if (text.includes('SYSTEM INITIALIZATION') || 
                          text.includes('You are one of the first users') ||
                          text.includes('collecting the first 10 links') ||
                          text.includes('Links in system: 0/10') ||
                          text.includes('Links in system') ||
                          text.includes('Early Bird Bonus') ||
                          text.includes('0/10')) {
                        
                        // Ищем родителя с fixed позиционированием
                        var parent = el;
                        var foundParent = false;
                        
                        // Проверяем до 20 уровней вверх
                        for (var j = 0; j < 20; j++) {
                          if (!parent || !parent.parentElement) break;
                          
                          var classes = parent.className || parent.getAttribute('class') || '';
                          var style = window.getComputedStyle ? window.getComputedStyle(parent) : null;
                          
                          if (classes.indexOf('fixed') !== -1 || 
                              classes.indexOf('backdrop') !== -1 || 
                              classes.indexOf('modal') !== -1 ||
                              classes.indexOf('z-50') !== -1 ||
                              (style && style.position === 'fixed')) {
                            foundParent = true;
                            break;
                          }
                          
                          parent = parent.parentElement;
                        }
                        
                        if (foundParent && parent) {
                          // ПРИНУДИТЕЛЬНО скрываем через inline стили
                          parent.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; position: absolute !important; left: -9999px !important; top: -9999px !important; width: 0 !important; height: 0 !important; overflow: hidden !important;';
                          
                          // Удаляем из DOM
                          try {
                            parent.remove();
                            foundCount++;
                          } catch(e) {
                            try {
                              if (parent.parentNode) {
                                parent.parentNode.removeChild(parent);
                                foundCount++;
                              }
                            } catch(e2) {
                              // Если не удалось удалить, просто скрываем
                            }
                          }
                          break; // Прерываем после первого найденного
                        }
                      }
                    }
                    
                    // МЕТОД 2: Ищем по стилю (purple gradient) - проверяем все div с градиентом
                    var purpleDivs = document.querySelectorAll('div[class*="from-blue"], div[class*="to-purple"], div[class*="bg-gradient"]');
                    for (var k = 0; k < purpleDivs.length; k++) {
                      var modal = purpleDivs[k];
                      var modalText = modal.textContent || modal.innerText || '';
                      if (modalText.indexOf('SYSTEM INITIALIZATION') !== -1 || 
                          modalText.indexOf('0/10') !== -1 ||
                          modalText.indexOf('You are one of the first users') !== -1) {
                        // ПРИНУДИТЕЛЬНО скрываем через inline стили
                        modal.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; position: absolute !important; left: -9999px !important; top: -9999px !important; width: 0 !important; height: 0 !important; overflow: hidden !important;';
                        try {
                          modal.remove();
                          foundCount++;
                        } catch(e) {
                          try {
                            if (modal.parentNode) {
                              modal.parentNode.removeChild(modal);
                              foundCount++;
                            }
                          } catch(e2) {
                            // Если не удалось удалить, просто скрываем
                          }
                        }
                      }
                    }
                    
                    // МЕТОД 3: Применяем CSS правило ко ВСЕМ элементам с текстом модального окна
                    // Это гарантирует скрытие даже если parent не найден
                    for (var m = 0; m < allElements.length; m++) {
                      var el2 = allElements[m];
                      var text2 = el2.textContent || el2.innerText || '';
                      if (text2.indexOf('SYSTEM INITIALIZATION') !== -1 || 
                          text2.indexOf('Links in system: 0/10') !== -1) {
                        // Применяем стили напрямую к элементу
                        el2.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
                        // Также проверяем и скрываем родителей
                        var p = el2;
                        for (var n = 0; n < 15; n++) {
                          if (!p || !p.parentElement) break;
                          p = p.parentElement;
                          var classes2 = p.className || p.getAttribute('class') || '';
                          if (classes2.indexOf('fixed') !== -1 || classes2.indexOf('backdrop') !== -1) {
                            p.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
                            try {
                              p.remove();
                              foundCount++;
                            } catch(e3) {}
                            break;
                          }
                        }
                      }
                    }
                    
                    if (foundCount > 0) {
                      console.warn('🧹 [_DOCUMENT] Removed ' + foundCount + ' SYSTEM INITIALIZATION modal(s)');
                    }
                  } catch(error) {
                    console.error('❌ [_DOCUMENT] Error removing modal:', error);
                  }
                }
                
                // Выполняем немедленно
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', removeSystemInitModal);
                } else {
                  removeSystemInitModal();
                }
                
                // Повторяем через небольшие интервалы
                setTimeout(removeSystemInitModal, 0);
                setTimeout(removeSystemInitModal, 10);
                setTimeout(removeSystemInitModal, 50);
                setTimeout(removeSystemInitModal, 100);
                setTimeout(removeSystemInitModal, 200);
                setTimeout(removeSystemInitModal, 500);
                
                // Используем MutationObserver для отслеживания изменений
                if (typeof MutationObserver !== 'undefined') {
                  var observer = new MutationObserver(function(mutations) {
                    removeSystemInitModal();
                  });
                  
                  // Начинаем наблюдение сразу, как только DOM готов
                  if (document.body) {
                    observer.observe(document.body, {
                      childList: true,
                      subtree: true
                    });
                  } else {
                    if (document.readyState === 'loading') {
                      document.addEventListener('DOMContentLoaded', function() {
                        if (document.body) {
                          observer.observe(document.body, {
                            childList: true,
                            subtree: true
                          });
                        }
                      });
                    }
                  }
                  
                  // Останавливаем через 10 секунд
                  setTimeout(function() {
                    observer.disconnect();
                  }, 10000);
                }
                
                // Периодическая проверка
                var interval = setInterval(removeSystemInitModal, 100);
                setTimeout(function() {
                  clearInterval(interval);
                }, 10000);
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


