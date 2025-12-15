/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
