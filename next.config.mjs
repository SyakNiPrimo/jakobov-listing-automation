/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.photos.sparkplatform.com' },
      { protocol: 'https', hostname: '**.canva.com' },
      { protocol: 'https', hostname: '**.insforge.io' },
      { protocol: 'https', hostname: '**.vercel-storage.com' },
    ],
  },
}

export default nextConfig
