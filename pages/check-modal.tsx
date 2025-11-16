// Страница для проверки модального окна
import { useEffect, useState } from 'react';
import Head from 'next/head';

export default function CheckModal() {
  const [results, setResults] = useState<any[]>([]);
  const [totalFound, setTotalFound] = useState(0);
  const [isRunning, setIsRunning] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const runCheck = () => {
      console.log('%c🔍 [CHECK-MODAL] Запуск проверки...', 'color: #0f0; font-size: 16px; font-weight: bold;');
      
      const found: any[] = [];
      let count = 0;

      // 1. Проверяем modal-root
      const modalRoot = document.getElementById('modal-root');
      if (modalRoot) {
        const text = modalRoot.textContent || '';
        if (text.includes('SYSTEM INITIALIZATION') || 
            text.includes('You are one of the first users') ||
            text.includes('Links in system: 0/10')) {
          count++;
          found.push({
            type: 'modal-root',
            id: 'modal-root',
            element: modalRoot,
            text: text.substring(0, 200),
            classes: modalRoot.className,
            children: modalRoot.children.length,
            outerHTML: modalRoot.outerHTML.substring(0, 500)
          });
          console.error('❌ НАЙДЕНО в modal-root:', modalRoot);
        }
      }

      // 2. Ищем все элементы с текстом
      const allElements = document.querySelectorAll('*');
      const foundElements: Element[] = [];
      
      allElements.forEach((el) => {
        const text = el.textContent || el.innerText || '';
        if (text.includes('SYSTEM INITIALIZATION') || 
            text.includes('You are one of the first users') ||
            text.includes('Links in system: 0/10')) {
          
          let isChild = false;
          foundElements.forEach(found => {
            if (found.contains(el)) isChild = true;
          });
          
          if (!isChild) {
            foundElements.push(el);
            count++;
            const style = window.getComputedStyle(el);
            found.push({
              type: 'text',
              tagName: el.tagName,
              id: el.id || 'none',
              className: el.className || 'none',
              position: style.position,
              display: style.display,
              zIndex: style.zIndex,
              text: text.substring(0, 150),
              outerHTML: el.outerHTML.substring(0, 500)
            });
            console.error('❌ НАЙДЕН элемент:', el);
          }
        }
      });

      // 3. Purple gradient
      const purpleElements = document.querySelectorAll('[class*="from-blue"], [class*="to-purple"]');
      purpleElements.forEach((el) => {
        const text = el.textContent || '';
        if (text.includes('SYSTEM INITIALIZATION')) {
          count++;
          found.push({
            type: 'purple',
            element: el,
            classes: el.className,
            text: text.substring(0, 150)
          });
          console.error('❌ НАЙДЕН purple gradient:', el);
        }
      });

      // 4. Fixed элементы
      const allDivs = document.querySelectorAll('div');
      allDivs.forEach((div) => {
        const style = window.getComputedStyle(div);
        if (style.position === 'fixed') {
          const text = div.textContent || '';
          if (text.includes('SYSTEM INITIALIZATION')) {
            count++;
            found.push({
              type: 'fixed',
              element: div,
              classes: div.className || 'none',
              zIndex: style.zIndex,
              text: text.substring(0, 150)
            });
            console.error('❌ НАЙДЕН fixed элемент:', div);
          }
        }
      });

      // 5. body.innerHTML
      const bodyHTML = document.body.innerHTML;
      if (bodyHTML.includes('SYSTEM INITIALIZATION')) {
        count++;
        const index = bodyHTML.indexOf('SYSTEM INITIALIZATION');
        found.push({
          type: 'body-html',
          index: index,
          context: bodyHTML.substring(Math.max(0, index - 100), index + 300)
        });
        console.error('❌ НАЙДЕНО в body.innerHTML');
      }

      console.log(`\n📊 ИТОГО: Найдено ${count} экземпляров`);
      if (count > 0) {
        console.error('⚠️ МОДАЛЬНОЕ ОКНО ВСЕ ЕЩЕ В DOM!');
      } else {
        console.log('✅ МОДАЛЬНОЕ ОКНО НЕ НАЙДЕНО В DOM');
      }

      setResults(found);
      setTotalFound(count);
      setIsRunning(false);
    };

    // Запускаем через небольшую задержку
    setTimeout(runCheck, 500);
  }, []);

  return (
    <>
      <Head>
        <title>🔍 Проверка модального окна</title>
      </Head>
      <div style={{ 
        fontFamily: 'monospace', 
        padding: '20px', 
        background: '#1a1a1a', 
        color: '#0f0',
        minHeight: '100vh'
      }}>
        <h1 style={{ color: '#0f0', marginBottom: '20px' }}>
          🔍 Проверка модального окна "SYSTEM INITIALIZATION"
        </h1>

        {isRunning ? (
          <div style={{ color: '#0ff' }}>
            <p>⏳ Проверка выполняется...</p>
            <p>Откройте консоль браузера (F12) для детальных логов</p>
          </div>
        ) : (
          <>
            <div style={{
              background: totalFound > 0 ? '#3a1a1a' : '#1a3a1a',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: `2px solid ${totalFound > 0 ? '#f00' : '#0f0'}`
            }}>
              <h2 style={{ color: totalFound > 0 ? '#faa' : '#0f0', fontSize: '24px' }}>
                📊 ИТОГОВЫЙ РЕЗУЛЬТАТ
              </h2>
              <p style={{ fontSize: '18px', fontWeight: 'bold' }}>
                Всего найдено: <span style={{ color: totalFound > 0 ? '#f00' : '#0f0' }}>{totalFound}</span>
              </p>
              <p style={{ fontSize: '16px', marginTop: '10px' }}>
                {totalFound > 0 ? (
                  <span style={{ color: '#f00' }}>⚠️ МОДАЛЬНОЕ ОКНО ВСЕ ЕЩЕ В DOM!</span>
                ) : (
                  <span style={{ color: '#0f0' }}>✅ МОДАЛЬНОЕ ОКНО НЕ НАЙДЕНО В DOM</span>
                )}
              </p>
            </div>

            {results.length > 0 && (
              <div>
                <h2 style={{ color: '#f00', marginBottom: '15px' }}>❌ Найденные элементы:</h2>
                {results.map((result, index) => (
                  <div key={index} style={{
                    background: '#2a1a1a',
                    padding: '15px',
                    marginBottom: '15px',
                    borderRadius: '4px',
                    borderLeft: '4px solid #f00'
                  }}>
                    <h3 style={{ color: '#faa', marginBottom: '10px' }}>
                      {result.type === 'modal-root' && '📍 modal-root'}
                      {result.type === 'text' && `📍 Элемент: ${result.tagName}`}
                      {result.type === 'purple' && '📍 Purple Gradient'}
                      {result.type === 'fixed' && '📍 Fixed Element'}
                      {result.type === 'body-html' && '📍 body.innerHTML'}
                    </h3>
                    <pre style={{
                      background: '#000',
                      padding: '10px',
                      overflow: 'auto',
                      fontSize: '12px',
                      color: '#0f0',
                      maxHeight: '300px'
                    }}>
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '30px', padding: '15px', background: '#2a2a2a', borderRadius: '4px' }}>
              <h3 style={{ color: '#0ff', marginBottom: '10px' }}>💡 Инструкция:</h3>
              <ul style={{ color: '#0f0', lineHeight: '1.8' }}>
                <li>Откройте консоль браузера (F12 → Console) для детальных логов</li>
                <li>Все найденные элементы также выведены в консоль</li>
                <li>Если найдено модальное окно, оно будет автоматически удалено скриптами из _document.tsx и _app.tsx</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </>
  );
}

