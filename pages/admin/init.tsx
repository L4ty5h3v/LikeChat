// Страница для инициализации начальных ссылок
import { useState } from 'react';
import Layout from '@/components/Layout';
import Button from '@/components/Button';

export default function InitLinks() {
  const [loading, setLoading] = useState(false);
  const [addLinksLoading, setAddLinksLoading] = useState<{ like?: boolean; recast?: boolean }>({});
  const [result, setResult] = useState<{ success?: boolean; error?: string; message?: string } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleInitClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirm = () => {
    setShowConfirmModal(false);
    // Секретный ключ запрашивается только если он установлен на сервере
    // На клиенте мы не можем проверить это, поэтому просто отправляем пустую строку
    // Сервер сам проверит, нужен ли ключ
    performInit('');
  };


  const performInit = async (secretKeyValue: string) => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/init-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ secretKey: secretKeyValue || '' }),
      });

      // Проверяем, есть ли содержимое в ответе
      const text = await response.text();
      let data;
      
      try {
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.error('JSON parse error:', parseError, 'Response text:', text);
        setResult({ error: `Ошибка ответа сервера: ${text || 'пустой ответ'}` });
        setLoading(false);
        return;
      }

      if (response.ok) {
        setResult({ success: true, message: data.message || 'Ссылки успешно инициализированы!' });
      } else {
        setResult({ error: data.error || data.message || `Ошибка при инициализации (${response.status})` });
      }
    } catch (error: any) {
      console.error('Init error:', error);
      setResult({ error: error.message || 'Неизвестная ошибка' });
    } finally {
      setLoading(false);
    }
  };

  const performAddLinks = async (taskType: 'like' | 'recast') => {
    setAddLinksLoading({ [taskType]: true });
    setResult(null);

    try {
      const response = await fetch('/api/add-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          taskType,
          secretKey: '' // Секретный ключ проверяется на сервере
        }),
      });

      const text = await response.text();
      let data;
      
      try {
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.error('JSON parse error:', parseError, 'Response text:', text);
        setResult({ error: `Ошибка ответа сервера: ${text || 'пустой ответ'}` });
        setAddLinksLoading({ [taskType]: false });
        return;
      }

      if (response.ok) {
        setResult({ 
          success: true, 
          message: data.message || `Успешно добавлено ${data.count || 0} ссылок для типа "${taskType}"!` 
        });
      } else {
        setResult({ error: data.error || data.message || `Ошибка при добавлении ссылок (${response.status})` });
      }
    } catch (error: any) {
      console.error('Add links error:', error);
      setResult({ error: error.message || 'Неизвестная ошибка' });
    } finally {
      setAddLinksLoading({ [taskType]: false });
    }
  };

  return (
    <Layout title="Инициализация системы">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Инициализация начальных ссылок
        </h1>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Информация
          </h2>
          <p className="text-gray-600 mb-4">
            Эта страница позволяет инициализировать систему 20 начальными ссылками (по 10 для каждого типа активности: like, recast).
          </p>
          <ul className="list-disc list-inside text-gray-600 mb-6 space-y-2">
            <li>https://base.app/post/0x0c9e45b37e2db246d9544689bfbed28bca434be</li>
            <li>https://base.app/post/0x06ec6e3b5d340f8f7197324a96bf870265e78c2a</li>
            <li>https://base.app/post/0xfb1f9d9f118290a0657a9d68d6ce0ac09d6d44ba</li>
            <li>https://base.app/post/0x641593bd41eb199d5e6930e0d519d685ec7a9436</li>
            <li>https://base.app/post/0xd02763287849293a7a6cdb7104ee5513d318abaf</li>
            <li>https://base.app/post/0x8409b3edbfb9d07a3cc9dbe53927b33d9b02d9c1</li>
            <li>https://base.app/post/0xdc51c8f0091d16bb0c7b866b52cdde3457ce848c</li>
            <li>https://base.app/post/0x2cb6509bc661eb2f08588d8f8de3c4e7d83fdfb5</li>
            <li>https://base.app/post/0x9a33dc3ee6cf006ce8efe990293f5e38be152ee9</li>
            <li>https://base.app/post/0x281b68bb29c5b64194a580da8f678db4831cc1c1</li>
          </ul>

          {result && (
            <div className={`p-4 rounded-xl mb-6 ${
              result.success 
                ? 'bg-green-50 border-2 border-green-300' 
                : 'bg-red-50 border-2 border-red-300'
            }`}>
              {result.success ? (
                <p className="text-green-800 font-semibold">✅ {result.message}</p>
              ) : (
                <p className="text-red-800 font-semibold">❌ {result.error}</p>
              )}
            </div>
          )}

          <div className="space-y-4">
            <Button
              onClick={handleInitClick}
              loading={loading}
              variant="primary"
              fullWidth
              className="text-lg py-4"
            >
              {loading ? 'Инициализация...' : 'Инициализировать систему (удаляет все существующие ссылки)'}
            </Button>

            <div className="border-t pt-4">
              <h3 className="text-lg font-bold text-gray-900 mb-3">
                Добавить ссылки только для одного типа (без удаления существующих)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => performAddLinks('like')}
                  loading={addLinksLoading.like}
                  variant="secondary"
                  className="text-base py-3"
                >
                  {addLinksLoading.like ? 'Добавление...' : '➕ Добавить 10 ссылок для LIKE'}
                </Button>
                <Button
                  onClick={() => performAddLinks('recast')}
                  loading={addLinksLoading.recast}
                  variant="secondary"
                  className="text-base py-3"
                >
                  {addLinksLoading.recast ? 'Добавление...' : '➕ Добавить 10 ссылок для RECAST'}
                </Button>
              </div>
            </div>
          </div>

          {/* Модальное окно подтверждения */}
          {showConfirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full mx-4">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                  Подтверждение
                </h3>
                <p className="text-gray-700 mb-6">
                  Вы уверены, что хотите инициализировать систему начальными ссылками? Это действие нельзя отменить.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 font-bold rounded-xl hover:bg-gray-300 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-primary to-accent text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
                  >
                    Подтвердить
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-bold text-yellow-800 mb-2">
            ⚠️ Внимание
          </h3>
          <p className="text-yellow-700 mb-2">
            <strong>Инициализация системы:</strong> Эта операция добавляет 20 начальных ссылок в систему (10 для like, 10 для recast). 
            Если система уже инициализирована, старые ссылки будут удалены перед добавлением новых.
          </p>
          <p className="text-yellow-700">
            <strong>Добавление ссылок по типам:</strong> Эти кнопки добавляют 10 ссылок только для указанного типа (like или recast) 
            БЕЗ удаления существующих ссылок. Это безопасный способ заполнить пустые разделы.
          </p>
          <p className="text-yellow-700 mt-2">
            Для работы этих действий необходим секретный ключ (установите его в переменную окружения INIT_LINKS_SECRET_KEY на Vercel).
          </p>
        </div>
      </div>
    </Layout>
  );
}

