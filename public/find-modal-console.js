// 🔍 СКРИПТ ДЛЯ КОНСОЛИ БРАУЗЕРА: Поиск модального окна "SYSTEM INITIALIZATION"
// Скопируйте весь этот код и вставьте в консоль браузера (F12 → Console) на странице, где видно модальное окно

(function() {
  console.log('%c🔍 ПОИСК МОДАЛЬНОГО ОКНА "SYSTEM INITIALIZATION"', 'color: #0f0; font-size: 16px; font-weight: bold;');
  console.log('='.repeat(80));
  
  let totalFound = 0;
  const foundElements = [];
  
  // 1. Проверяем modal-root, popover-root
  console.log('\n1️⃣ Проверка Root элементов:');
  const rootIds = ['modal-root', 'popover-root', 'hover-popover-root', 'root', '__next'];
  rootIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const text = el.textContent || '';
      const hasModal = text.includes('SYSTEM INITIALIZATION') || 
                      text.includes('You are one of the first users') ||
                      text.includes('Links in system: 0/10');
      
      if (hasModal) {
        totalFound++;
        foundElements.push({ type: 'root', id, element: el });
        console.error(`❌ FOUND in #${id}:`, {
          element: el,
          text: text.substring(0, 200),
          children: el.children.length,
          classes: el.className,
          outerHTML: el.outerHTML.substring(0, 500)
        });
      } else {
        console.log(`✅ #${id}: OK (${el.children.length} children)`);
      }
    } else {
      console.log(`ℹ️ #${id}: не существует`);
    }
  });
  
  // 2. Ищем все элементы с текстом "SYSTEM INITIALIZATION"
  console.log('\n2️⃣ Поиск всех элементов с текстом "SYSTEM INITIALIZATION":');
  const allElements = document.querySelectorAll('*');
  const modalElements = [];
  
  allElements.forEach(el => {
    const text = el.textContent || el.innerText || '';
    if (text.includes('SYSTEM INITIALIZATION') || 
        text.includes('You are one of the first users') ||
        text.includes('Links in system: 0/10')) {
      
      // Проверяем, что это не дочерний элемент уже найденного
      let isChild = false;
      modalElements.forEach(found => {
        if (found.contains(el)) {
          isChild = true;
        }
      });
      
      if (!isChild) {
        modalElements.push(el);
        totalFound++;
        foundElements.push({ type: 'text', element: el });
        
        const parent = el.parentElement;
        const computedStyle = window.getComputedStyle(el);
        
        console.error(`❌ FOUND Element: ${el.tagName}`, {
          tagName: el.tagName,
          id: el.id || 'none',
          className: el.className || 'none',
          position: computedStyle.position,
          display: computedStyle.display,
          visibility: computedStyle.visibility,
          zIndex: computedStyle.zIndex,
          parent: parent ? `${parent.tagName}${parent.id ? '#' + parent.id : ''}${parent.className ? '.' + parent.className.split(' ')[0] : ''}` : 'none',
          text: text.substring(0, 200),
          element: el,
          outerHTML: el.outerHTML.substring(0, 500)
        });
      }
    }
  });
  
  if (modalElements.length === 0) {
    console.log('✅ Элементы с текстом модального окна не найдены');
  }
  
  // 3. Ищем purple gradient элементы
  console.log('\n3️⃣ Поиск элементов с purple gradient:');
  const purpleSelectors = [
    '[class*="from-blue"]',
    '[class*="to-purple"]',
    '[class*="bg-gradient"]'
  ];
  
  const purpleElements = [];
  purpleSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (!purpleElements.includes(el)) {
          purpleElements.push(el);
          const text = el.textContent || '';
          if (text.includes('SYSTEM INITIALIZATION')) {
            totalFound++;
            foundElements.push({ type: 'purple', element: el });
            console.error(`❌ FOUND Purple Gradient: ${selector}`, {
              element: el,
              classes: el.className,
              text: text.substring(0, 200),
              outerHTML: el.outerHTML.substring(0, 500)
            });
          }
        }
      });
    } catch(e) {
      console.warn(`⚠️ Ошибка с селектором ${selector}:`, e.message);
    }
  });
  
  if (purpleElements.length === 0) {
    console.log('✅ Элементы с purple gradient не найдены');
  } else {
    console.log(`ℹ️ Всего элементов с purple gradient: ${purpleElements.length}`);
  }
  
  // 4. Ищем fixed элементы
  console.log('\n4️⃣ Поиск fixed элементов:');
  const allDivs = document.querySelectorAll('div');
  const fixedElements = [];
  
  allDivs.forEach(div => {
    const computedStyle = window.getComputedStyle(div);
    if (computedStyle.position === 'fixed') {
      fixedElements.push(div);
      const text = div.textContent || '';
      if (text.includes('SYSTEM INITIALIZATION') || 
          text.includes('You are one of the first users')) {
        totalFound++;
        foundElements.push({ type: 'fixed', element: div });
        console.error(`❌ FOUND Fixed Element`, {
          element: div,
          classes: div.className || 'none',
          id: div.id || 'none',
          zIndex: computedStyle.zIndex,
          text: text.substring(0, 200),
          outerHTML: div.outerHTML.substring(0, 500)
        });
      }
    }
  });
  
  console.log(`ℹ️ Всего fixed элементов: ${fixedElements.length}`);
  
  // 5. Проверяем body.innerHTML
  console.log('\n5️⃣ Проверка document.body.innerHTML:');
  const bodyHTML = document.body.innerHTML;
  if (bodyHTML.includes('SYSTEM INITIALIZATION')) {
    totalFound++;
    const index = bodyHTML.indexOf('SYSTEM INITIALIZATION');
    console.error(`❌ FOUND в body.innerHTML`, {
      index: index,
      context: bodyHTML.substring(Math.max(0, index - 200), index + 500)
    });
  } else {
    console.log('✅ Не найдено в body.innerHTML');
  }
  
  // 6. Итоговый результат
  console.log('\n' + '='.repeat(80));
  console.log('%c📊 ИТОГОВЫЙ РЕЗУЛЬТАТ', 'color: #0ff; font-size: 14px; font-weight: bold;');
  console.log(`Всего найдено экземпляров модального окна: ${totalFound}`);
  
  if (totalFound > 0) {
    console.error('%c⚠️ МОДАЛЬНОЕ ОКНО ВСЕ ЕЩЕ В DOM!', 'color: #f00; font-size: 16px; font-weight: bold;');
    console.log('\nНайденные элементы сохранены в переменной foundElements');
    console.log('Вы можете удалить их командой: removeFoundModals()');
    
    // Создаем функцию для удаления
    window.removeFoundModals = function() {
      let removed = 0;
      foundElements.forEach(({ element }) => {
        try {
          const style = window.getComputedStyle(element);
          if (style.position === 'fixed' || element.id === 'modal-root') {
            element.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; position: absolute !important; left: -9999px !important; top: -9999px !important; width: 0 !important; height: 0 !important; overflow: hidden !important; z-index: -9999 !important;';
            try {
              element.remove();
              removed++;
              console.log('✅ Удален элемент:', element);
            } catch(e) {
              if (element.parentNode) {
                element.parentNode.removeChild(element);
                removed++;
                console.log('✅ Удален элемент через parentNode:', element);
              }
            }
          }
        } catch(e) {
          console.warn('⚠️ Не удалось удалить элемент:', e);
        }
      });
      console.log(`\n✅ Удалено элементов: ${removed}`);
      return removed;
    };
    
    console.log('\n💡 Для удаления всех найденных модальных окон выполните: removeFoundModals()');
  } else {
    console.log('%c✅ МОДАЛЬНОЕ ОКНО НЕ НАЙДЕНО В DOM', 'color: #0f0; font-size: 16px; font-weight: bold;');
  }
  
  console.log('='.repeat(80));
  
  // Возвращаем результаты
  return {
    totalFound,
    foundElements,
    removeFoundModals: window.removeFoundModals
  };
})();

