/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    // Base App / in-app WebViews can aggressively cache HTML. Force no-store for key pages
    // so users always get the latest build (new chunk hashes).
    const noStore = [
      { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
      { key: 'Pragma', value: 'no-cache' },
      { key: 'Expires', value: '0' },
    ];

    // CORS headers для Farcaster Mini App
    const corsHeaders = [
      { key: 'Access-Control-Allow-Origin', value: '*' },
      { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
      { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
    ];

    return [
      { 
        source: '/', 
        headers: [...noStore, ...corsHeaders] 
      },
      { 
        source: '/tasks', 
        headers: [...noStore, ...corsHeaders] 
      },
      {
        source: '/api/:path*',
        headers: corsHeaders,
      },
    ];
  },
  webpack: (config) => {
    // wagmi/connectors может подтягивать MetaMask SDK, который пытается импортировать RN storage.
    // Для web-сборки это не нужно — просто отключаем резолв этого модуля.
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
  images: {
    domains: ['i.imgur.com', 'res.cloudinary.com', 'imagedelivery.net', 'api.dicebear.com'],
    unoptimized: process.env.NODE_ENV === 'production', // Отключаем оптимизацию на Vercel для избежания 401 ошибок
  },
  generateBuildId: async () => {
    return Date.now().toString();
  },
}

module.exports = nextConfig
