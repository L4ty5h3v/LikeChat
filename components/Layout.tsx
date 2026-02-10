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

  const handleOpenInstall = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window === 'undefined') return;
    try {
      window.dispatchEvent(new CustomEvent('likechat:showInstallModal'));
    } catch (err) {
      // very old webviews fallback
      try {
        (window as any).showInstallModal?.();
      } catch {}
    }
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
        
        {/* Farcaster Mini App мета-теги */}
        <meta property="fc:miniapp" content="v1" />
        <meta property="fc:miniapp:title" content="MULTI LIKE" />
        <meta property="fc:miniapp:image" content="https://likechat-farcaster.vercel.app/images/image%20(3).png" />
        <meta property="fc:miniapp:description" content="You like, they like back" />
        
        {/* Кнопка рядом с обложкой */}
        <meta property="fc:miniapp:button:1" content="MUTUAL LOVE" />
        <meta property="fc:miniapp:button:1:action" content="link" />
        <meta property="fc:miniapp:button:1:target" content="https://likechat-farcaster.vercel.app" />
        
        {/* Open Graph мета-теги для обложки - дублируем из _document.tsx для всех страниц */}
        <meta property="og:title" content="MULTI LIKE" />
        <meta property="og:description" content="You like, they like back. Gain likes and recasts through mutual activity." />
        <meta property="og:image" content="https://likechat-farcaster.vercel.app/images/image%20(3).png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="https://likechat-farcaster.vercel.app" />
        <meta property="og:site_name" content="MULTI LIKE" />
        
        {/* Twitter Card мета-теги */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="MULTI LIKE" />
        <meta name="twitter:description" content="You like, they like back. Gain likes and recasts through mutual activity." />
        <meta name="twitter:image" content="https://likechat-farcaster.vercel.app/images/image%20(3).png" />
        
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <div className="min-h-screen">
        <header className="absolute top-0 right-0 z-50 p-4">
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-3 sm:gap-4">
              {mounted && (
                <button
                  onClick={handleOpenInstall}
                  type="button"
                  className="px-3 py-2 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white font-bold text-sm hover:bg-white/30 transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
                  style={{ pointerEvents: 'auto' }}
                  aria-label="Open install modal"
                >
                  Add
                </button>
              )}
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

