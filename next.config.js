/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['i.imgur.com', 'res.cloudinary.com', 'imagedelivery.net', 'api.dicebear.com'],
  },
  // ⚠️ КРИТИЧЕСКИ ВАЖНО: Принудительный clean deploy - используем timestamp как build ID
  // Это гарантирует, что каждый deploy будет полностью новым без кеша
  generateBuildId: async () => {
    // Используем timestamp напрямую - это самый агрессивный способ принудить Vercel к пересборке
    const buildId = Date.now().toString();
    console.log('🔨 [BUILD] Generating timestamp-based build ID (FORCE CLEAN REBUILD):', buildId);
    return buildId;
  },
  // ⚠️ КРИТИЧЕСКИ ВАЖНО: Отключаем кеширование для ВСЕХ страниц и JavaScript файлов
  // Это предотвращает загрузку старых JavaScript файлов со статусом 304 (Not Modified)
  async headers() {
    const noCacheHeaders = [
      {
        key: 'Cache-Control',
        value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
      },
      {
        key: 'Pragma',
        value: 'no-cache',
      },
      {
        key: 'Expires',
        value: '0',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
    ];

    return [
      // Отключаем кеш для страницы submit
      {
        source: '/submit',
        headers: noCacheHeaders,
      },
      // ⚠️ ОТКЛЮЧАЕМ КЕШ ДЛЯ ВСЕХ СТРАНИЦ - предотвращаем загрузку старого кода
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
          },
        ],
      },
      // ⚠️ КРИТИЧЕСКИ ВАЖНО: Отключаем кеш для всех JavaScript файлов из _next/static
      // Это предотвращает загрузку старых JS файлов со статусом 304
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
        ],
      },
      // Отключаем кеш для всех JavaScript/TypeScript файлов
      {
        source: '/:path*\\.(js|mjs|jsx|ts|tsx)',
        headers: noCacheHeaders,
      },
      // Отключаем кеш для HTML файлов
      {
        source: '/:path*\\.html',
        headers: noCacheHeaders,
      },
    ];
  },
}

module.exports = nextConfig
