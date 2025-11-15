// Страница публикации ссылки
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Button from '@/components/Button';
import { submitLink, getUserProgress, getTotalLinksCount } from '@/lib/db-config';
import { publishCastToFarcaster } from '@/lib/farcaster-publish';
import type { FarcasterUser, ActivityType } from '@/types';

export default function Submit() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [activity, setActivity] = useState<ActivityType | null>(null);
  const [castUrl, setCastUrl] = useState('');
  const [error, setError] = useState('');
  const [canSubmit, setCanSubmit] = useState(false);
  const [totalLinks, setTotalLinks] = useState(0);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    // Проверяем, что код выполняется на клиенте
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('farcaster_user');
      const savedActivity = localStorage.getItem('selected_activity');

      if (!savedUser || !savedActivity) {
        router.push('/');
        return;
      }

      const userData = JSON.parse(savedUser);
      setUser(userData);
      setActivity(savedActivity as ActivityType);
      
      checkProgress(userData.fid);
    }
  }, [router]);

  const checkProgress = async (userFid: number) => {
    const progress = await getUserProgress(userFid);
    
    if (!progress) {
      router.push('/');
      return;
    }

    // Проверка: все 10 ссылок пройдены
    if (progress.completed_links.length < 10) {
      router.push('/tasks');
      return;
    }

    // Проверка: токен куплен
    if (!progress.token_purchased) {
      router.push('/buyToken');
      return;
    }

    // Проверка: в системе должно быть минимум 10 ссылок
    const count = await getTotalLinksCount();
    setTotalLinks(count);
    
    // Показываем предупреждение только если меньше 10 ссылок
    // Но разрешаем первым 10 пользователям добавлять
    if (count < 10) {
      setShowWarning(true);
    }

    setCanSubmit(true);
  };

  const validateUrl = (url: string): boolean => {
    // Проверка формата URL Farcaster/Warpcast
    const urlPattern = /^https?:\/\/(warpcast\.com|farcaster\.xyz)\/.+/i;
    return urlPattern.test(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !activity || !castUrl) return;

    setError('');

    // Валидация URL
    if (!validateUrl(castUrl)) {
      setError('Please enter a valid Farcaster/Warpcast cast link');
      return;
    }

    setLoading(true);

    try {
      // Сначала публикуем каст в Farcaster через SDK
      console.log('🔄 Publishing cast to Farcaster...');
      const castResult = await publishCastToFarcaster(castUrl, activity);
      
      if (!castResult.success) {
        console.warn('⚠️ Failed to publish cast to Farcaster, but continuing with link submission:', castResult.error);
        // Продолжаем даже если публикация каста не удалась
      } else {
        console.log('✅ Cast published to Farcaster:', castResult.castHash);
      }

      // Сохраняем ссылку в базе данных
      const result = await submitLink(
        user.fid,
        user.username,
        user.pfp_url,
        castUrl,
        activity
      );

      if (result) {
        // Успешная публикация
        console.log('✅ Link saved to database:', result.id);
        // Редирект на tasks, чтобы пользователь увидел свою ссылку в списке
        router.push('/tasks');
      } else {
        setError('Error publishing link');
      }
    } catch (err: any) {
      console.error('Error submitting link:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!canSubmit) {
    return (
      <Layout title="Проверка доступа...">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Проверка прогресса...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Multi Like - Publish Link">
      <div className="max-w-3xl mx-auto">
        {/* Заголовок с анимацией */}
        <div className="text-center mb-8">
          <div className="flex justify-center gap-2 text-6xl mb-4 animate-pulse-slow">
            <span>🎉</span>
            <span>💌</span>
            <span>🎊</span>
          </div>
          <h1 className="text-4xl font-bold text-primary mb-2">
            Поздравляем!
          </h1>
          <p className="text-xl text-gray-600">
            Вы выполнили все задания и купили токен
          </p>
          <p className="text-gray-500 mt-2">
            Теперь опубликуйте свою ссылку
          </p>
        </div>

        {/* Прогресс пользователя */}
        <div className="bg-gradient-to-r from-success to-green-400 text-white rounded-2xl p-6 mb-8">
          <h3 className="text-xl font-bold mb-4">Ваш прогресс:</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
              <div className="text-4xl mb-2">✅</div>
              <p className="font-semibold">10 ссылок</p>
              <p className="text-sm">пройдено</p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
              <div className="text-4xl mb-2">💎</div>
              <p className="font-semibold">Токен куплен</p>
              <p className="text-sm">$0.10</p>
            </div>
          </div>
        </div>

        {/* Информация о системе для первых пользователей */}
        {showWarning && totalLinks < 10 && (
          <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-sm border-2 border-blue-400 rounded-2xl p-6 mb-8 shadow-xl">
            <h3 className="font-black text-blue-800 mb-3 flex items-center gap-3 text-xl">
              <span className="text-3xl">🚀</span>
              SYSTEM INITIALIZATION
            </h3>
            <p className="text-blue-800 mb-3 font-bold text-lg">
              You are one of the first users!
            </p>
            <p className="text-blue-700 mb-4">
              The system is collecting the first <strong>10 links</strong>. You can submit your link now and help initialize the platform!
            </p>
            <div className="bg-white bg-opacity-70 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-gray-800">Links in system:</span>
                <span className="text-2xl font-black text-blue-600">{totalLinks}/10</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-500"
                  style={{ width: `${(totalLinks / 10) * 100}%` }}
                ></div>
              </div>
            </div>
            <p className="text-blue-700 mt-4 text-sm">
              💡 <strong>Early Bird Bonus:</strong> As one of the first 10 users, you can submit your link immediately!
            </p>
          </div>
        )}

        {/* Форма публикации */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Опубликуйте вашу ссылку
            </h2>
            <p className="text-gray-600">
              Вставьте ссылку на ваш каст в Farcaster/Warpcast
            </p>
          </div>

          {/* Информация о выбранной активности */}
          <div className="bg-primary bg-opacity-10 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-700 mb-2">
              <strong>Выбранная активность:</strong>
            </p>
            <div className="flex items-center gap-2 text-primary font-semibold text-lg">
              {activity === 'like' && (
                <>
                  <span className="text-2xl">❤️</span>
                  <span>Лайк</span>
                </>
              )}
              {activity === 'recast' && (
                <>
                  <span className="text-2xl">🔄</span>
                  <span>Рекаст</span>
                </>
              )}
              {activity === 'comment' && (
                <>
                  <span className="text-2xl">💬</span>
                  <span>Комментарий</span>
                </>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Другие пользователи будут выполнять эту активность на вашей ссылке
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label
                htmlFor="castUrl"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Ссылка на ваш каст:
              </label>
              <input
                type="url"
                id="castUrl"
                value={castUrl}
                onChange={(e) => setCastUrl(e.target.value)}
                placeholder="https://warpcast.com/username/0x123abc..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-primary focus:outline-none transition-colors"
                required
              />
              <p className="text-xs text-gray-500 mt-2">
                Пример: https://warpcast.com/username/0x123abc
              </p>
            </div>

            {error && (
              <div className="bg-gold-50 border-2 border-gold-300 rounded-xl p-4 mb-6">
                <p className="text-gold-800 font-semibold flex items-center gap-2">
                  <span>❌</span>
                  {error}
                </p>
              </div>
            )}

            <Button
              type="submit"
              loading={loading}
              disabled={!castUrl}
              variant="success"
              fullWidth
              className="text-xl py-5"
            >
              {totalLinks < 10 ? '🚀 Publish Link (Early Bird)' : '🚀 Publish Link'}
            </Button>
          </form>
        </div>

        {/* Инструкция */}
        <div className="bg-gray-50 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">
            📝 Что дальше?
          </h3>
          <ol className="space-y-2 text-gray-700 list-decimal list-inside">
            <li>Ваша ссылка будет добавлена в очередь</li>
            <li>Следующие 10 пользователей пройдут вашу ссылку</li>
            <li>Они выполнят выбранную вами активность</li>
            <li>Вы получите взаимную поддержку от сообщества</li>
          </ol>
        </div>
      </div>
    </Layout>
  );
}

