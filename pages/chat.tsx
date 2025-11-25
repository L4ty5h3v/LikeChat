// Страница чата/ленты со всеми ссылками
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import LinkCard from '@/components/LinkCard';
import Button from '@/components/Button';
import { getAllLinks, subscribeToLinks, getUserProgress, submitLink } from '@/lib/db-config';
// import { publishCastToFarcaster } from '@/lib/farcaster-publish'; // Убрано - не нужно открывать Compose
import type { LinkSubmission, FarcasterUser, ActivityType } from '@/types';

export default function Chat() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [links, setLinks] = useState<LinkSubmission[]>([]);
  const [userLinkId, setUserLinkId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'like' | 'recast' | 'comment'>('all');
  const [castUrl, setCastUrl] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    // Проверяем, что код выполняется на клиенте
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('farcaster_user');

      if (!savedUser) {
        router.push('/');
        return;
      }

      const userData = JSON.parse(savedUser);
      setUser(userData);
      
      loadData(userData.fid);
      
      // Подписка на обновления в реальном времени
      const subscription = subscribeToLinks((payload: unknown) => {
        console.log('Change received!', payload);
        loadData(userData.fid);
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [router]);

  const loadData = async (userFid: number) => {
    setLoading(true);
    try {
      const allLinks = await getAllLinks();
      setLinks(allLinks);

      const progress = await getUserProgress(userFid);
      if (progress?.current_link_id) {
        setUserLinkId(progress.current_link_id);
      }
    } catch (error) {
      console.error('Error loading links:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLinks = links.filter((link) => {
    if (filter === 'all') return true;
    return link.activity_type === filter;
  });

  const userLink = links.find((link) => link.id === userLinkId);

  const validateUrl = (url: string): boolean => {
    const urlPattern = /^https?:\/\/(farcaster\.xyz)\/.+/i;
    return urlPattern.test(url);
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const savedActivity = typeof window !== 'undefined' ? localStorage.getItem('selected_activity') : null;
    if (!savedActivity) {
      router.push('/');
      return;
    }
    if (!validateUrl(castUrl)) {
      setSubmitError('Введите корректную ссылку на каст Farcaster');
      return;
    }
    setSubmitError('');
    setSubmitLoading(true);
    try {
      // Публикация cast убрана - чтобы избежать баннера "Upgrade to Pro"
      // Сохраняем ссылку в базе данных
      const res = await submitLink(
        user.fid,
        user.username,
        user.pfp_url,
        castUrl,
        savedActivity as any
      );
      if (res) {
        setCastUrl('');
        await loadData(user.fid);
        // Прокрутка к началу списка
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setSubmitError('Не удалось опубликовать ссылку');
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Ошибка при публикации');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <Layout title="Multi Like - Feed">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            Community Feed
            <span className="text-5xl animate-pulse-slow">💌</span>
          </h1>
          <p className="text-gray-600">
            All added links from community members
          </p>
        </div>

        {/* User Information */}
        {user && (
          <div className="bg-gradient-to-r from-primary to-pink-500 text-white rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-4">
              <img
                src={user.pfp_url}
                alt={user.username}
                className="w-16 h-16 rounded-full border-4 border-white"
              />
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-1">@{user.username}</h2>
                <p className="text-white text-opacity-90">
                  {userLink
                    ? '✅ Your link is added'
                    : 'Complete tasks to add your link'}
                </p>
              </div>
              {!userLink && (
                <Button
                  onClick={() => router.push('/')}
                  variant="secondary"
                  className="text-primary"
                >
                  Start →
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Your Link */}
        {userLink && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>⭐</span>
              Your Added Link
            </h2>
            <div className="border-4 border-primary border-opacity-30 rounded-2xl p-2">
              <LinkCard link={userLink} />
            </div>
          </div>
        )}

        {/* Быстрая публикация ссылки */}
        {user && !userLink && (
          <div className="bg-white rounded-xl shadow-md p-4 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Быстрая публикация ссылки</h3>
            <form onSubmit={handleQuickSubmit} className="flex flex-col md:flex-row gap-3">
              <input
                type="url"
                value={castUrl}
                onChange={(e) => setCastUrl(e.target.value)}
                placeholder="https://farcaster.xyz/username/0x123abc..."
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-primary focus:outline-none"
                required
              />
              <Button type="submit" loading={submitLoading} disabled={!castUrl}>
                Submit
              </Button>
            </form>
            {submitError && (
              <p className="text-red-600 text-sm mt-2">{submitError}</p>
            )}
            <p className="text-xs text-gray-500 mt-2">Ссылка на ваш каст Farcaster</p>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-gray-700">Filter:</span>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({links.length})
            </button>
            <button
              onClick={() => setFilter('like')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'like'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ❤️ Likes ({links.filter((l) => l.activity_type === 'like').length})
            </button>
            <button
              onClick={() => setFilter('recast')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'recast'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🔄 Recasts ({links.filter((l) => l.activity_type === 'recast').length})
            </button>
            <button
              onClick={() => setFilter('comment')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'comment'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              💬 Comments ({links.filter((l) => l.activity_type === 'comment').length})
            </button>
          </div>
        </div>

        {/* Links List */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading feed...</p>
            </div>
          </div>
        ) : filteredLinks.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              No links yet
            </h3>
            <p className="text-gray-600 mb-6">
              Be the first to add a link!
            </p>
            <Button
              onClick={() => router.push('/')}
              variant="primary"
            >
              Start →
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLinks.map((link) => (
              <LinkCard key={link.id} link={link} />
            ))}
          </div>
        )}

        {/* Community Statistics */}
        {links.length > 0 && (
          <div className="mt-12 bg-gray-50 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
              📊 Community Statistics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-1">
                  {links.length}
                </div>
                <div className="text-sm text-gray-600">Total Links</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-1">
                  {links.filter((l) => l.activity_type === 'like').length}
                </div>
                <div className="text-sm text-gray-600">❤️ Likes</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-1">
                  {links.filter((l) => l.activity_type === 'recast').length}
                </div>
                <div className="text-sm text-gray-600">🔄 Recasts</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-1">
                  {links.filter((l) => l.activity_type === 'comment').length}
                </div>
                <div className="text-sm text-gray-600">💬 Comments</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

