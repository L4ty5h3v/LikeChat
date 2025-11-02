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

const Layout: React.FC<LayoutProps> = ({ children, title = 'Multi Like 💌' }) => {
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

  const handleAvatarClick = () => {
    router.push('/');
  };

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Mutual love from Mrs. Crypto" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <div className="min-h-screen bg-background">
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 lg:px-8">
            <div className="flex items-center justify-between">
              <h1 className="text-lg sm:text-2xl font-bold text-primary flex items-center gap-1.5 sm:gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border border-primary">
                  <Image
                    src="/images/mrs-crypto.jpg"
                    alt="Mrs. Crypto"
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                    priority
                  />
                </div>
                <span className="hidden xs:inline">Multi Like</span>
                <span className="xs:hidden">ML</span>
                <span className="animate-pulse-slow">💌</span>
              </h1>
              <div className="flex items-center gap-3 sm:gap-4">
                <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">
                  Mutual love from Mrs. Crypto
                </p>
                {mounted && user && (
                  <button
                    onClick={handleAvatarClick}
                    className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden border-2 border-primary hover:border-primary-dark transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    aria-label="Go to homepage"
                  >
                    <Image
                      src={user.pfp_url || '/images/mrs-crypto.jpg'}
                      alt={user.display_name || user.username || 'User'}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8 lg:px-8">
          {children}
        </main>

        <footer className="bg-white border-t border-gray-200 mt-8 sm:mt-12">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:px-8">
            <p className="text-center text-gray-500 text-xs sm:text-sm">
              © 2024 Multi Like. Created with ❤️ for Farcaster community
            </p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Layout;

