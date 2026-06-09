/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Optimizaciones para Vercel
  // output: 'standalone' solo en producción (Vercel lo detecta automáticamente)
  poweredByHeader: false,
  // Asegurar que use App Router correctamente
  experimental: {
    // No necesario en Next.js 15, pero por si acaso
  },
};

module.exports = nextConfig; 