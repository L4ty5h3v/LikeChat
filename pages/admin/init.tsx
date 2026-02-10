// Страница для инициализации начальных ссылок
import { useState } from 'react';
import Layout from '@/components/Layout';
import { TASK_LINKS_LIMIT } from '@/lib/task-limits';
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
        setResult({ error: `Server response error: ${text || 'empty response'}` });
        setLoading(false);
        return;
      }

      if (response.ok) {
        setResult({ success: true, message: data.message || 'Links successfully initialized!' });
      } else {
        setResult({ error: data.error || data.message || `Initialization error (${response.status})` });
      }
    } catch (error: any) {
      console.error('Init error:', error);
      setResult({ error: error.message || 'Unknown error' });
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
        setResult({ error: `Server response error: ${text || 'empty response'}` });
        setAddLinksLoading({ [taskType]: false });
        return;
      }

      if (response.ok) {
        setResult({ 
          success: true, 
          message: data.message || `Successfully added ${data.count || 0} links for type "${taskType}"!` 
        });
      } else {
        setResult({ error: data.error || data.message || `Error adding links (${response.status})` });
      }
    } catch (error: any) {
      console.error('Add links error:', error);
      setResult({ error: error.message || 'Unknown error' });
    } finally {
      setAddLinksLoading({ [taskType]: false });
    }
  };

  return (
    <Layout title="System Initialization">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Initialize Initial Links
        </h1>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Information
          </h2>
          <p className="text-gray-600 mb-4">
            This page allows you to initialize the system with {TASK_LINKS_LIMIT * 2} initial links ({TASK_LINKS_LIMIT} for each activity type: like, recast).
          </p>
          <ul className="list-disc list-inside text-gray-600 mb-6 space-y-2">
            <li>https://farcaster.xyz/svs-smm/0xf9660a16</li>
            <li>https://farcaster.xyz/svs-smm/0xf17842cb</li>
            <li>https://farcaster.xyz/svs-smm/0x4fce02cd</li>
            <li>https://farcaster.xyz/svs-smm/0xd976e9a8</li>
            <li>https://farcaster.xyz/svs-smm/0x4349a0e0</li>
            <li>https://farcaster.xyz/svs-smm/0x3bfa3788</li>
            <li>https://farcaster.xyz/svs-smm/0xef39e991</li>
            <li>https://farcaster.xyz/svs-smm/0xea43ddbf</li>
            <li>https://farcaster.xyz/svs-smm/0x31157f15</li>
            <li>https://farcaster.xyz/svs-smm/0xd4a09fb3</li>
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
              {loading ? 'Initializing...' : 'Initialize system (deletes all existing links)'}
            </Button>

            <div className="border-t pt-4">
              <h3 className="text-lg font-bold text-gray-900 mb-3">
                Add links for one type only (without deleting existing)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => performAddLinks('like')}
                  loading={addLinksLoading.like}
                  variant="secondary"
                  className="text-base py-3"
                >
                  {addLinksLoading.like ? 'Adding...' : `➕ Add ${TASK_LINKS_LIMIT} links for LIKE`}
                </Button>
                <Button
                  onClick={() => performAddLinks('recast')}
                  loading={addLinksLoading.recast}
                  variant="secondary"
                  className="text-base py-3"
                >
                  {addLinksLoading.recast ? 'Adding...' : `➕ Add ${TASK_LINKS_LIMIT} links for RECAST`}
                </Button>
              </div>
            </div>
          </div>

          {/* Модальное окно подтверждения */}
          {showConfirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full mx-4">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                  Confirmation
                </h3>
                <p className="text-gray-700 mb-6">
                  Are you sure you want to initialize the system with initial links? This action cannot be undone.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 font-bold rounded-xl hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-primary to-accent text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-bold text-yellow-800 mb-2">
            ⚠️ Warning
          </h3>
          <p className="text-yellow-700 mb-2">
            <strong>System Initialization:</strong> This operation adds {TASK_LINKS_LIMIT * 2} initial links to the system ({TASK_LINKS_LIMIT} for like, {TASK_LINKS_LIMIT} for recast). 
            If the system is already initialized, old links will be deleted before adding new ones.
          </p>
          <p className="text-yellow-700">
            <strong>Adding links by type:</strong> These buttons add {TASK_LINKS_LIMIT} links only for the specified type (like or recast) 
            WITHOUT deleting existing links. This is a safe way to fill empty sections.
          </p>
          <p className="text-yellow-700 mt-2">
            A secret key is required for these actions (set it in the INIT_LINKS_SECRET_KEY environment variable on Vercel).
          </p>
        </div>
      </div>
    </Layout>
  );
}

