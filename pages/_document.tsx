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
      </Head>
      <body>
        {/* ⚠️ КРИТИЧЕСКИ ВАЖНО: Inline скрипт, который выполняется ДО React hydration */}
        {/* Этот скрипт удаляет модальное окно "SYSTEM INITIALIZATION" немедленно */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                'use strict';
                
                // ⚠️ ФУНКЦИЯ УДАЛЕНИЯ: Удаляет модальное окно "SYSTEM INITIALIZATION"
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
                    
                    // Ищем по тексту - УПРОЩЕННЫЙ ПОДХОД
                    const allElements = document.querySelectorAll('*');
                    const found = [];
                    
                    allElements.forEach(function(el) {
                      const text = el.textContent || '';
                      if (text.includes('SYSTEM INITIALIZATION') || text.includes('0/10')) {
                        // ПРОСТОЕ УДАЛЕНИЕ: Ищем родителя с fixed позиционированием и удаляем сразу
                        let parent = el.closest('[class*="fixed"], [class*="backdrop"], [class*="modal"], [class*="z-50"]');
                        if (parent) {
                          console.log('🧹 [_DOCUMENT] Found modal:', parent);
                          parent.style.display = 'none';
                          parent.style.visibility = 'hidden';
                          parent.style.opacity = '0';
                          try {
                            parent.remove();
                            found.push(parent);
                          } catch(e) {
                            if (parent.parentNode) {
                              parent.parentNode.removeChild(parent);
                              found.push(parent);
                            }
                          }
                        }
                      }
                    });
                    
                    // Дополнительная проверка для других текстов
                    allElements.forEach(function(el) {
                      const text = el.textContent || '';
                      if (!text.includes('SYSTEM INITIALIZATION') && !text.includes('0/10')) {
                        if (text.includes('You are one of the first users') ||
                            text.includes('collecting the first 10 links') ||
                            text.includes('Early Bird Bonus')) {
                          let parent = el.closest('[class*="fixed"], [class*="backdrop"], [class*="modal"], [class*="z-50"]');
                          if (parent) {
                            console.log('🧹 [_DOCUMENT] Found modal by secondary text:', parent);
                            parent.style.display = 'none';
                            parent.style.visibility = 'hidden';
                            parent.style.opacity = '0';
                            try {
                              parent.remove();
                              found.push(parent);
                            } catch(e) {
                              if (parent.parentNode) {
                                parent.parentNode.removeChild(parent);
                                found.push(parent);
                              }
                            }
                          }
                        }
                      }
                    });
                    
                    // Ищем по стилю (purple gradient)
                    const purpleModals = document.querySelectorAll('[class*="from-blue"], [class*="to-purple"], [class*="bg-gradient"]');
                    purpleModals.forEach(function(modal) {
                      const text = modal.textContent || '';
                      if (text.includes('SYSTEM INITIALIZATION') || text.includes('0/10')) {
                        found.push(modal);
                      }
                    });
                    
                    // Элементы уже удалены выше, этот блок больше не нужен
                    
                    if (found.length > 0) {
                      console.warn('🧹 [_DOCUMENT] Removed ' + found.length + ' SYSTEM INITIALIZATION modal(s)');
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


