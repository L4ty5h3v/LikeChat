import React from 'react';
import Head from 'next/head';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

const APP_URL = 'https://project2-omega-rosy.vercel.app';

const miniAppEmbed = JSON.stringify({
  version: "1",
  imageUrl: `${APP_URL}/mrs-crypto-cover.png`,
  button: {
    title: "💕 Get Flirting Tips",
    action: {
      type: "launch_miniapp",
      name: "Mrs. Crypto's Flirting Tips",
      url: APP_URL,
      splashImageUrl: `${APP_URL}/mrs-crypto-cover.png`,
      splashBackgroundColor: "#B71C1C"
    }
  }
});

const Layout: React.FC<LayoutProps> = ({ children, title = "Mrs. Crypto's Flirting Tips 💌" }) => {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Get personalized flirting tips from Mrs. Crypto" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#B71C1C" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="icon" href="/favicon.ico" />
        
        {/* Farcaster Mini App embed meta tags */}
        <meta name="fc:miniapp" content={miniAppEmbed} />
        <meta name="fc:frame" content={miniAppEmbed} />
        
        {/* Open Graph tags */}
        <meta property="og:title" content="Mrs. Crypto's Flirting Tips 💌" />
        <meta property="og:description" content="Get personalized flirting tips from Mrs. Crypto" />
        <meta property="og:image" content={`${APP_URL}/mrs-crypto-cover.png`} />
      </Head>
      
      <div className="min-h-screen">
        <main className="w-full">
          {children}
        </main>
      </div>
    </>
  );
};

export default Layout;

