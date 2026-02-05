// Админ-страница для удаления ссылок на приложения
import { useState } from 'react';
import Layout from '@/components/Layout';

export default function DeleteAppLinks() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const handleDelete = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/delete-app-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to delete app links');
      }
    } catch (err: any) {
      setError(err.message || 'Error deleting app links');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Delete App Links - Admin">
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Удаление ссылок на приложения</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <p className="text-gray-700 mb-4">
            Эта страница удаляет все ссылки, содержащие <code className="bg-gray-100 px-2 py-1 rounded">/miniapps/</code> из базы данных.
          </p>
          
          <button
            onClick={handleDelete}
            disabled={loading}
            className={`px-6 py-3 rounded-lg font-semibold ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {loading ? 'Удаление...' : 'Удалить все ссылки на приложения'}
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong>Ошибка:</strong> {error}
          </div>
        )}

        {result && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            <strong>Результат:</strong>
            <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    </Layout>
  );
}
