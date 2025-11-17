/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['i.imgur.com', 'res.cloudinary.com', 'imagedelivery.net', 'api.dicebear.com'],
  },
  generateBuildId: async () => {
    return Date.now().toString();
  },
}

module.exports = nextConfig
