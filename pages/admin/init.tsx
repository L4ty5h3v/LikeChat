// Страница для инициализации начальных ссылок
import { useState } from 'react';
import Layout from '@/components/Layout';
import Button from '@/components/Button';

export default function InitLinks() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string; message?: string } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [secretKey, setSecretKey] = useState('');

  const [seedLoading, setSeedLoading] = useState(false);
  const [seedResult, setSeedResult] = useState<{ success?: boolean; error?: string; message?: string } | null>(null);
  const [seedReplace, setSeedReplace] = useState(true);
  const [seedInput, setSeedInput] = useState(
    [
      'https://base.app/content/EkUKQwoVbmV0d29ya3MvYmFzZS1tYWlubmV0EioweDA2NTkwZWViOWM5MThiYTU3YmFjYjcxZWZlZGRiZTAyNGE0OTk0ZDc 0x06590eeb9c918ba57bacb71efeddbe024a4994d7',
      'https://base.app/content/EkUKQwoVbmV0d29ya3MvYmFzZS1tYWlubmV0EioweGMwMjkyZjllODVkYWZiZGU1ZTEyYWIyNWMxYTcxNzEzNjY5YmQ3Y2M 0xc0292f9e85dafbde5e12ab25c1a71713669bd7cc',
    ].join('\n')
  );

  const handleInitClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirm = () => {
    setShowConfirmModal(false);
    performInit();
  };


  const performInit = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/init-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ secretKey: secretKey || '' }),
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
        setResult({ success: true, message: data.message || 'Ссылки успешно очищены!' });
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

  const parseSeedInput = (
    input: string
  ): Array<{ castUrl: string; tokenAddress: string }> => {
    const lines = input
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const links: Array<{ castUrl: string; tokenAddress: string }> = [];
    for (const line of lines) {
      // поддержка формата "url address" (пробел/таб/запятая)
      const parts = line.split(/[\s,]+/).filter(Boolean);
      if (parts.length < 2) continue;
      const castUrl = parts[0];
      const tokenAddress = parts[1];
      links.push({ castUrl, tokenAddress });
    }

    return links;
  };

  const handleSeed = async () => {
    setSeedLoading(true);
    setSeedResult(null);

    try {
      const links = parseSeedInput(seedInput);
      if (links.length === 0) {
        setSeedResult({ error: 'Не найдено ни одной строки формата: <url> <tokenAddress>' });
        setSeedLoading(false);
        return;
      }

      const response = await fetch('/api/seed-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secretKey: secretKey || '',
          replace: seedReplace,
          links,
        }),
      });

      const text = await response.text();
      let data: any;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.error('JSON parse error:', parseError, 'Response text:', text);
        setSeedResult({ error: `Ошибка ответа сервера: ${text || 'пустой ответ'}` });
        setSeedLoading(false);
        return;
      }

      if (response.ok) {
        const added = typeof data.added === 'number' ? data.added : undefined;
        const removed = typeof data.removed === 'number' ? data.removed : undefined;
        const message =
          added != null
            ? `Готово: добавлено ${added}${removed != null ? `, удалено ${removed}` : ''}`
            : 'Ссылки успешно загружены';
        setSeedResult({ success: true, message });
      } else {
        setSeedResult({ error: data.error || data.message || `Ошибка при загрузке (${response.status})` });
      }
    } catch (error: any) {
      console.error('Seed error:', error);
      setSeedResult({ error: error.message || 'Неизвестная ошибка' });
    } finally {
      setSeedLoading(false);
    }
  };

  return (
    <Layout title="Инициализация системы">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Очистка ссылок
        </h1>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Секретный ключ (если включён на Vercel)
          </h2>
          <p className="text-gray-600 mb-4">
            Если на Vercel задан <code className="px-2 py-1 bg-gray-100 rounded">INIT_LINKS_SECRET_KEY</code>, введи его сюда. Если ключ не задан — можно оставить пустым.
          </p>
          <input
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            placeholder="INIT_LINKS_SECRET_KEY (опционально)"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Засеять ссылки (Support посты)
          </h2>
          <p className="text-gray-600 mb-4">
            Формат: одна строка = <code className="px-2 py-1 bg-gray-100 rounded">&lt;url&gt; &lt;tokenAddress&gt;</code>. По умолчанию уже вставлены 2 ссылки, которые ты присылала.
          </p>

          {seedResult && (
            <div className={`p-4 rounded-xl mb-6 ${
              seedResult.success
                ? 'bg-green-50 border-2 border-green-300'
                : 'bg-red-50 border-2 border-red-300'
            }`}>
              {seedResult.success ? (
                <p className="text-green-800 font-semibold">{seedResult.message}</p>
              ) : (
                <p className="text-red-800 font-semibold">❌ {seedResult.error}</p>
              )}
            </div>
          )}

          <label className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              checked={seedReplace}
              onChange={(e) => setSeedReplace(e.target.checked)}
              className="h-5 w-5"
            />
            <span className="text-gray-800 font-semibold">
              Заменить весь список (удалить старые ссылки и оставить только эти)
            </span>
          </label>

          <textarea
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            rows={6}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none font-mono text-sm"
          />

          <div className="mt-4">
            <Button
              onClick={handleSeed}
              loading={seedLoading}
              variant="primary"
              fullWidth
              className="text-lg py-4"
            >
              {seedLoading ? 'Загрузка...' : 'Засеять ссылки'}
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Информация
          </h2>
          <p className="text-gray-600 mb-4">
            Эта страница очищает ВСЕ ссылки из базы. Список задач будет пустым, пока пользователи не начнут добавлять свои ссылки.
          </p>

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
              {loading ? 'Очистка...' : 'Очистить все ссылки (удаляет все существующие ссылки)'}
            </Button>
          </div>

          {/* Модальное окно подтверждения */}
          {showConfirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full mx-4">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                  Подтверждение
                </h3>
                <p className="text-gray-700 mb-6">
                  Вы уверены, что хотите очистить ВСЕ ссылки? Это действие нельзя отменить.
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
            <strong>Очистка:</strong> эта операция удаляет все ссылки из базы данных.
          </p>
          <p className="text-yellow-700 mt-2">
            Для работы этих действий необходим секретный ключ (установите его в переменную окружения INIT_LINKS_SECRET_KEY на Vercel).
          </p>
        </div>
      </div>
    </Layout>
  );
}

