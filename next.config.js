/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['i.imgur.com', 'res.cloudinary.com', 'imagedelivery.net', 'api.dicebear.com'],
    unoptimized: process.env.NODE_ENV === 'production', // Отключаем оптимизацию на Vercel для избежания 401 ошибок
  },
  generateBuildId: async () => {
    return Date.now().toString();
  },
  webpack: (config) => {
    // Some wallet/connectors (e.g. MetaMask SDK) reference AsyncStorage even in web bundles.
    // Provide a lightweight shim so Next build doesn't fail with "Can't resolve '@react-native-async-storage/async-storage'".
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias['@react-native-async-storage/async-storage'] = require('path').resolve(
      __dirname,
      'lib/async-storage-shim.ts'
    );
    return config;
  },
}

module.exports = nextConfig
