// Страница чата/ленты со всеми ссылками
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import LinkCard from '@/components/LinkCard';
import Button from '@/components/Button';
import { getAllLinks, subscribeToLinks, getUserProgress } from '@/lib/db-config';
import type { LinkSubmission, FarcasterUser } from '@/types';

export default function Chat() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [links, setLinks] = useState<LinkSubmission[]>([]);
  const [userLinkId, setUserLinkId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'like' | 'recast' | 'comment'>('all');

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

  return (
    <Layout title="LikeChat - Feed">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            Community Feed
            <span className="text-5xl animate-pulse-slow">💌</span>
          </h1>
          <p className="text-gray-600">
            All published links from community members
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
                    ? '✅ Your link is published'
                    : 'Complete tasks to publish your link'}
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
              Your Published Link
            </h2>
            <div className="border-4 border-primary border-opacity-30 rounded-2xl p-2">
              <LinkCard link={userLink} />
            </div>
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
              Be the first to publish a link!
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

