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
}

module.exports = nextConfig
