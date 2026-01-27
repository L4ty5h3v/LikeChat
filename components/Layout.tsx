// Основной layout компонент
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import type { BaseUser } from '@/types';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

const APP_NAME = 'MULTI LIKE';

const Layout: React.FC<LayoutProps> = ({ children, title = APP_NAME }) => {
  const router = useRouter();
  const [user, setUser] = useState<BaseUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('base_user');
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
    
    console.log('🖱️ Avatar clicked, navigating to home...');
    
    // Пробуем несколько способов навигации для надёжности
    try {
      // Способ 1: router.replace
      if (router && router.replace) {
        router.replace('/').catch((err) => {
          console.warn('⚠️ router.replace failed, trying window.location:', err);
          // Fallback на window.location
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          }
        });
      } else {
        // Если router недоступен, используем window.location напрямую
        console.log('⚠️ Router not available, using window.location');
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      }
    } catch (error) {
      console.error('❌ Navigation error:', error);
      // Последний fallback
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  };
  return (
    <>
      <Head>
        <title>{APP_NAME}</title>
        <meta name="description" content="Mutual love from Mrs. Crypto" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="application-name" content={APP_NAME} />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
        <meta property="og:site_name" content={APP_NAME} />
        <meta property="og:title" content={APP_NAME} />
        <meta name="twitter:title" content={APP_NAME} />
        
        <meta property="og:type" content="website" />
        
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <div className="min-h-screen">
        <header className="absolute top-0 right-0 z-[9999] p-4">
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-3 sm:gap-4">
              {mounted && (
                <button
                  onClick={handleAvatarClick}
                  type="button"
                  className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden border-2 border-white hover:border-white transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 cursor-pointer z-[9999]"
                  style={{ pointerEvents: 'auto', position: 'relative', zIndex: 9999 }}
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

