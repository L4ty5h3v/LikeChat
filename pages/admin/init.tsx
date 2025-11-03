// Страница для инициализации начальных ссылок
import { useState } from 'react';
import Layout from '@/components/Layout';
import Button from '@/components/Button';

export default function InitLinks() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string; message?: string } | null>(null);

  const handleInit = async () => {
    if (!confirm('Вы уверены, что хотите инициализировать систему начальными ссылками? Это действие нельзя отменить.')) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Если установлен INIT_LINKS_SECRET_KEY, запрашиваем его
      const secretKey = prompt('Введите секретный ключ для инициализации (если требуется):');
      
      const response = await fetch('/api/init-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ secretKey: secretKey || '' }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({ success: true, message: data.message || 'Ссылки успешно инициализированы!' });
      } else {
        setResult({ error: data.error || 'Ошибка при инициализации' });
      }
    } catch (error: any) {
      setResult({ error: error.message || 'Неизвестная ошибка' });
    } finally {
      setLoading(false);
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
            Эта страница позволяет инициализировать систему 10 начальными ссылками для заданий.
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

          <Button
            onClick={handleInit}
            loading={loading}
            variant="primary"
            fullWidth
            className="text-lg py-4"
          >
            {loading ? 'Инициализация...' : 'Инициализировать систему'}
          </Button>
        </div>

        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-yellow-800 mb-2">
            ⚠️ Внимание
          </h3>
          <p className="text-yellow-700">
            Эта операция добавляет 10 начальных ссылок в систему. Убедитесь, что система еще не инициализирована, 
            иначе будет возвращена ошибка. Для работы этого действия необходим секретный ключ (установите его в 
            переменную окружения INIT_LINKS_SECRET_KEY на Vercel).
          </p>
        </div>
      </div>
    </Layout>
  );
}

