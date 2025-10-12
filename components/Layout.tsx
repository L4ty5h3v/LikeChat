// Основной layout компонент
import React from 'react';
import Head from 'next/head';
import Image from 'next/image';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title = 'Like Chat 💌' }) => {
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
                <span className="hidden xs:inline">Like Chat</span>
                <span className="xs:hidden">LC</span>
                <span className="animate-pulse-slow">💌</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">
                Mutual love from Mrs. Crypto
              </p>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8 lg:px-8">
          {children}
        </main>

        <footer className="bg-white border-t border-gray-200 mt-8 sm:mt-12">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:px-8">
            <p className="text-center text-gray-500 text-xs sm:text-sm">
              © 2024 Like Chat. Created with ❤️ for Farcaster community
            </p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Layout;

