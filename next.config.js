/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Optimizaciones para Vercel
  output: 'standalone',
  poweredByHeader: false,
};

module.exports = nextConfig; 