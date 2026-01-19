// Основной layout компонент
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import type { FarcasterUser } from '@/types';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title = 'Like Chat 💌' }) => {
  const router = useRouter();
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('farcaster_user');
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }
    }
  }, []);

  const handleAvatarClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Используем replace вместо push, чтобы не добавлять в историю
    router.replace('/').catch((err) => {
      console.error('Navigation error:', err);
      // Fallback на window.location если router не работает
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    });
  };
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Mutual love from Mrs. Crypto" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        
        {/* Farcaster Mini App мета-теги - предотвращают распознавание как Frame */}
        <meta name="farcaster:miniapp" content="true" />
        <meta name="farcaster:frame" content="false" />
        <meta property="og:type" content="website" />
        
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <div className="min-h-screen">
        <header className="absolute top-0 right-0 z-50 p-4">
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-3 sm:gap-4">
              {mounted && (
                <button
                  onClick={handleAvatarClick}
                  type="button"
                  className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden border-2 border-white hover:border-white transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 cursor-pointer z-50"
                  style={{ pointerEvents: 'auto' }}
                  aria-label="Go to homepage"
                >
                  <Image
                    src="/images/mrs-crypto.jpg"
                    alt="Mrs. Crypto"
                    width={40}
                    height={40}
                    className="w-full h-full object-cover pointer-events-none"
                    priority
                    unoptimized
                  />
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="w-full">
          {children}
        </main>
      </div>
    </>
  );
};

export default Layout;

