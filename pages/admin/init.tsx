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
      '0xf45d09963807f7a80aa164eab5da1488dafccdb8',
      '0x657275c7a7b0ce6fa82d79d6aae36a536af6084e',
      '0xfa81fea4854f0ead4462aa9dff783f742ff79721',
      '0x46ceb7dc97ca354c7a23d581c6d392c0e7fcaf76',
      '0xe69ecebbee60e4ce04cd6a38a9a897082605368b',
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
        setResult({ error: `Server response error: ${text || 'empty response'}` });
        setLoading(false);
        return;
      }

      if (response.ok) {
        setResult({ success: true, message: data.message || 'Links cleared successfully!' });
      } else {
        setResult({ error: data.error || data.message || `Init error (${response.status})` });
      }
    } catch (error: any) {
      console.error('Init error:', error);
      setResult({ error: error.message || 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const parseSeedInput = (
    input: string
  ): Array<{ castUrl?: string; tokenAddress: string }> => {
    const lines = input
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const isAddress = (value?: string) => !!value && /^0x[a-fA-F0-9]{40}$/.test(value);

    const links: Array<{ castUrl?: string; tokenAddress: string }> = [];
    for (const line of lines) {
      // поддержка формата:
      // - "<tokenAddress>"
      // - "<url> <tokenAddress>" (пробел/таб/запятая)
      const parts = line.split(/[\s,]+/).filter(Boolean);
      if (parts.length === 1 && isAddress(parts[0])) {
        links.push({ tokenAddress: parts[0] });
        continue;
      }
      if (parts.length >= 2) {
        const castUrl = parts[0];
        const tokenAddress = parts[1];
        links.push({ castUrl, tokenAddress });
      }
    }

    return links;
  };

  const handleSeed = async () => {
    setSeedLoading(true);
    setSeedResult(null);

    try {
      const links = parseSeedInput(seedInput);
      if (links.length === 0) {
        setSeedResult({ error: 'No valid lines found. Format: <tokenAddress> OR <url> <tokenAddress>' });
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
        setSeedResult({ error: `Server response error: ${text || 'empty response'}` });
        setSeedLoading(false);
        return;
      }

      if (response.ok) {
        const added = typeof data.added === 'number' ? data.added : undefined;
        const removed = typeof data.removed === 'number' ? data.removed : undefined;
        const message =
          added != null
            ? `Done: added ${added}${removed != null ? `, removed ${removed}` : ''}`
            : 'Links seeded successfully';
        setSeedResult({ success: true, message });
      } else {
        setSeedResult({ error: data.error || data.message || `Seed error (${response.status})` });
      }
    } catch (error: any) {
      console.error('Seed error:', error);
      setSeedResult({ error: error.message || 'Unknown error' });
    } finally {
      setSeedLoading(false);
    }
  };

  return (
    <Layout title="Admin">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Admin tools
        </h1>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Secret key (if enabled on Vercel)
          </h2>
          <p className="text-gray-600 mb-4">
            If Vercel has <code className="px-2 py-1 bg-gray-100 rounded">INIT_LINKS_SECRET_KEY</code> set, enter it here. Otherwise, leave empty.
          </p>
          <input
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            placeholder="INIT_LINKS_SECRET_KEY (optional)"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Seed links (posts to buy)
          </h2>
          <p className="text-gray-600 mb-4">
            Format: one line = <code className="px-2 py-1 bg-gray-100 rounded">&lt;tokenAddress&gt;</code> OR{' '}
            <code className="px-2 py-1 bg-gray-100 rounded">&lt;url&gt; &lt;tokenAddress&gt;</code>.
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
              Replace entire list (delete old links and keep only these)
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
              {seedLoading ? 'Seeding...' : 'Seed links'}
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Clear links
          </h2>
          <p className="text-gray-600 mb-4">
            This will remove ALL links from the database. Tasks will be empty until you seed or users add new posts.
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
              {loading ? 'Clearing...' : 'Clear all links (deletes everything)'}
            </Button>
          </div>

          {/* Модальное окно подтверждения */}
          {showConfirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full mx-4">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                  Confirmation
                </h3>
                <p className="text-gray-700 mb-6">
                  Are you sure you want to clear ALL links? This cannot be undone.
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
            ⚠️ Important
          </h3>
          <p className="text-yellow-700 mb-2">
            <strong>Clear:</strong> this deletes all links from the database.
          </p>
          <p className="text-yellow-700 mt-2">
            If you enable protection, set <code className="px-1 py-0.5 bg-yellow-100 rounded">INIT_LINKS_SECRET_KEY</code> on Vercel.
          </p>
        </div>
      </div>
    </Layout>
  );
}

