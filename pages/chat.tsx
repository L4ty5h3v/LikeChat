// Страница ленты (Base): показываем последние посты для поддержки (support)
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import LinkCard from '@/components/LinkCard';
import Button from '@/components/Button';
import type { BaseUser, LinkSubmission } from '@/types';

export default function Chat() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<BaseUser | null>(null);
  const [links, setLinks] = useState<LinkSubmission[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks?t=${Date.now()}&taskType=support`);
      const json = await res.json();
      setLinks(Array.isArray(json?.links) ? json.links : []);
    } catch (e) {
      console.error('Error loading feed:', e);
      setLinks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedUser = localStorage.getItem('base_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        // ignore
      }
    }
    loadData();
    const t = setInterval(() => loadData(), 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout title="LikeChat Base - Feed">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
              Feed <span className="text-4xl">💎</span>
            </h1>
            <p className="text-gray-600">Latest posts to buy (buy $0.10)</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => router.push('/tasks')}>Tasks</Button>
            <Button onClick={() => router.push('/submit')} disabled={!user}>
              Submit
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading feed...</p>
            </div>
          </div>
        ) : links.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No links yet</h3>
            <p className="text-gray-600 mb-6">Be the first to add a post link + token address.</p>
            <Button onClick={() => router.push('/submit')} disabled={!user}>
              Submit first link
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {links.map((link) => (
              <LinkCard key={link.id} link={link} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

