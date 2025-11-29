/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Optimizaciones para Vercel
  output: 'standalone',
  poweredByHeader: false,
};

module.exports = nextConfig; 