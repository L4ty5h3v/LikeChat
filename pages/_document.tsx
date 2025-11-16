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
                    
                    // ⚠️ МЕТОД 4: КРИТИЧЕСКИ ВАЖНО - Проверяем и удаляем из modal-root, popover-root
                    // Модальное окно может рендериться через React Portal в эти элементы
                    // ⚠️ НЕМЕДЛЕННО УДАЛЯЕМ modal-root если он существует
                    var modalRoot = document.getElementById('modal-root');
                    if (modalRoot) {
                      var modalRootText = modalRoot.textContent || modalRoot.innerText || '';
                      if (modalRootText.indexOf('SYSTEM INITIALIZATION') !== -1 || 
                          modalRootText.indexOf('You are one of the first users') !== -1 ||
                          modalRootText.indexOf('Links in system: 0/10') !== -1) {
                        console.warn('🧹 [_DOCUMENT] Found SYSTEM INITIALIZATION in modal-root, removing entire modal-root');
                        try {
                          modalRoot.remove();
                          foundCount++;
                        } catch(e4) {
                          try {
                            modalRoot.innerHTML = '';
                            modalRoot.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
                            foundCount++;
                          } catch(e5) {}
                        }
                      } else {
                        // Даже если нет текста, удаляем все children с purple gradient
                        var modalRootChildren = modalRoot.querySelectorAll('[class*="from-blue"], [class*="to-purple"], [class*="bg-gradient"]');
                        for (var mrc = 0; mrc < modalRootChildren.length; mrc++) {
                          var modalChild = modalRootChildren[mrc];
                          var modalChildText = modalChild.textContent || modalChild.innerText || '';
                          if (modalChildText.indexOf('SYSTEM INITIALIZATION') !== -1) {
                            try {
                              modalChild.remove();
                              foundCount++;
                            } catch(e6) {}
                          }
                        }
                      }
                    }
                    
                    // ⚠️ ДОПОЛНИТЕЛЬНО: Удаляем все элементы с purple gradient из ВСЕГО документа
                    var purpleGradientElements = document.querySelectorAll('[class*="from-blue"]');
                    for (var pge = 0; pge < purpleGradientElements.length; pge++) {
                      var purpleEl = purpleGradientElements[pge];
                      var purpleText = purpleEl.textContent || purpleEl.innerText || '';
                      if (purpleText.indexOf('SYSTEM INITIALIZATION') !== -1) {
                        console.warn('🧹 [_DOCUMENT] Found purple gradient element with SYSTEM INITIALIZATION, removing:', purpleEl);
                        try {
                          purpleEl.remove();
                          foundCount++;
                        } catch(e7) {
                          try {
                            if (purpleEl.parentNode) {
                              purpleEl.parentNode.removeChild(purpleEl);
                              foundCount++;
                            }
                          } catch(e8) {}
                        }
                      }
                    }
                    
                    // Проверяем и другие root элементы
                    var otherRoots = ['popover-root', 'hover-popover-root'];
                    for (var or = 0; or < otherRoots.length; or++) {
                      var otherRootEl = document.getElementById(otherRoots[or]);
                      if (otherRootEl) {
                        var otherRootText = otherRootEl.textContent || otherRootEl.innerText || '';
                        if (otherRootText.indexOf('SYSTEM INITIALIZATION') !== -1) {
                          try {
                            otherRootEl.innerHTML = '';
                            foundCount++;
                          } catch(e9) {}
                        }
                      }
                    }
                    
                    // ⚠️ МЕТОД 5: Ищем ВСЕ div с fixed позиционированием и проверяем их содержимое
                    var allFixedDivs = document.querySelectorAll('div');
                    for (var fd = 0; fd < allFixedDivs.length; fd++) {
                      var fixedDiv = allFixedDivs[fd];
                      var fixedStyle = window.getComputedStyle ? window.getComputedStyle(fixedDiv) : null;
                      if (fixedStyle && fixedStyle.position === 'fixed') {
                        var fixedText = fixedDiv.textContent || fixedDiv.innerText || '';
                        if (fixedText.indexOf('SYSTEM INITIALIZATION') !== -1 || 
                            fixedText.indexOf('You are one of the first users') !== -1 ||
                            fixedText.indexOf('Links in system: 0/10') !== -1) {
                          // ПРИНУДИТЕЛЬНО скрываем и удаляем
                          fixedDiv.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; position: absolute !important; left: -9999px !important; top: -9999px !important; width: 0 !important; height: 0 !important; overflow: hidden !important;';
                          try {
                            fixedDiv.remove();
                            foundCount++;
                          } catch(e7) {
                            try {
                              if (fixedDiv.parentNode) {
                                fixedDiv.parentNode.removeChild(fixedDiv);
                                foundCount++;
                              }
                            } catch(e8) {}
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
                
                // ⚠️ КРИТИЧЕСКИ ВАЖНО: Выполняем НЕМЕДЛЕННО, ДО React hydration
                // Это гарантирует удаление модального окна даже из старого билда
                removeSystemInitModal();
                
                // Выполняем при разных состояниях загрузки
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', removeSystemInitModal);
                } else {
                  removeSystemInitModal();
                }
                
                // Повторяем через небольшие интервалы - МАКСИМАЛЬНО АГРЕССИВНО
                setTimeout(removeSystemInitModal, 0);
                setTimeout(removeSystemInitModal, 1);
                setTimeout(removeSystemInitModal, 5);
                setTimeout(removeSystemInitModal, 10);
                setTimeout(removeSystemInitModal, 20);
                setTimeout(removeSystemInitModal, 50);
                setTimeout(removeSystemInitModal, 100);
                setTimeout(removeSystemInitModal, 200);
                setTimeout(removeSystemInitModal, 500);
                setTimeout(removeSystemInitModal, 1000);
                
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
                
                // ⚠️ Периодическая проверка - МАКСИМАЛЬНАЯ ЧАСТОТА
                var interval = setInterval(removeSystemInitModal, 25); // Проверяем каждые 25ms (максимально агрессивно)
                setTimeout(function() {
                  clearInterval(interval);
                }, 60000); // Останавливаем через 60 секунд (увеличено)
                
                // ⚠️ ДОПОЛНИТЕЛЬНАЯ ПОСТОЯННАЯ ПРОВЕРКА: Проверяем каждую секунду на случай если модальное окно появляется позже
                var longInterval = setInterval(removeSystemInitModal, 1000); // Каждую секунду
                setTimeout(function() {
                  clearInterval(longInterval);
                }, 300000); // Останавливаем через 5 минут
                
                // ⚠️ ВСЕГДА ВКЛЮЧЕНА ДИАГНОСТИКА: Логируем все найденные элементы с текстом модального окна
                // Это поможет понять, откуда рендерится модальное окно
                setTimeout(function() {
                  console.log('%c🔍 [_DOCUMENT] Starting modal diagnostic scan...', 'color: #f00; font-size: 14px; font-weight: bold;');
                  var allElsForDiagnostic = document.querySelectorAll('*');
                  var foundInDiagnostic = 0;
                  for (var di = 0; di < allElsForDiagnostic.length; di++) {
                    var diEl = allElsForDiagnostic[di];
                    var diText = diEl.textContent || diEl.innerText || '';
                    if (diText.indexOf('SYSTEM INITIALIZATION') !== -1 || 
                        diText.indexOf('You are one of the first users') !== -1 ||
                        diText.indexOf('Links in system: 0/10') !== -1) {
                      foundInDiagnostic++;
                      var diStyle = window.getComputedStyle ? window.getComputedStyle(diEl) : null;
                      console.error('🔴 [_DOCUMENT-DIAGNOSTIC] Found modal text in element:', {
                        tagName: diEl.tagName,
                        id: diEl.id || 'none',
                        className: diEl.className || 'none',
                        position: diStyle ? diStyle.position : 'unknown',
                        display: diStyle ? diStyle.display : 'unknown',
                        zIndex: diStyle ? diStyle.zIndex : 'unknown',
                        textPreview: diText.substring(0, 100),
                        element: diEl,
                        outerHTML: diEl.outerHTML.substring(0, 500),
                        parentElement: diEl.parentElement ? {
                          tagName: diEl.parentElement.tagName,
                          id: diEl.parentElement.id || 'none',
                          className: diEl.parentElement.className || 'none'
                        } : 'none'
                      });
                    }
                  }
                  if (foundInDiagnostic > 0) {
                    console.error('🔴 [_DOCUMENT-DIAGNOSTIC] Total elements with modal text found:', foundInDiagnostic);
                  } else {
                    console.log('✅ [_DOCUMENT-DIAGNOSTIC] No modal elements found in DOM');
                  }
                }, 2000); // Даем время на рендеринг
                
                // ⚠️ ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Следим за созданием modal-root элемента
                if (typeof MutationObserver !== 'undefined') {
                  var modalRootObserver = new MutationObserver(function(mutations) {
                    var modalRoot = document.getElementById('modal-root');
                    if (modalRoot) {
                      removeSystemInitModal(); // Немедленно проверяем modal-root
                    }
                  });
                  if (document.body) {
                    modalRootObserver.observe(document.body, {
                      childList: true,
                      subtree: true,
                      attributes: false
                    });
                  }
                  setTimeout(function() {
                    modalRootObserver.disconnect();
                  }, 60000); // Увеличено до 60 секунд
                }
                
                // ⚠️ КРИТИЧЕСКИ ВАЖНО: Удаляем modal-root ПРИНУДИТЕЛЬНО, даже если он пустой
                // Это предотвращает рендеринг модального окна через React Portal
                var forceRemoveModalRoot = function() {
                  var modalRoot = document.getElementById('modal-root');
                  if (modalRoot) {
                    var modalRootText = modalRoot.textContent || modalRoot.innerText || '';
                    if (modalRootText.indexOf('SYSTEM INITIALIZATION') !== -1 || 
                        modalRootText.indexOf('You are one of the first users') !== -1 ||
                        modalRootText.indexOf('Links in system') !== -1 ||
                        modalRootText.indexOf('Early Bird') !== -1) {
                      console.warn('🧹 [FORCE] Found modal in modal-root, removing entire modal-root');
                      try {
                        modalRoot.innerHTML = '';
                        modalRoot.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; height: 0 !important; width: 0 !important; overflow: hidden !important;';
                      } catch(e) {
                        try {
                          modalRoot.remove();
                        } catch(e2) {}
                      }
                    }
                  }
                };
                
                // Выполняем принудительное удаление сразу и периодически
                forceRemoveModalRoot();
                setInterval(forceRemoveModalRoot, 100); // Каждые 100ms
                setTimeout(function() {
                  clearInterval(forceRemoveModalRoot);
                }, 60000);
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


