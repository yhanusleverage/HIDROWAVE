/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactStrictMode: true,
  swcMinify: true,
  // Permite conexiones desde cualquier IP
  async rewrites() {
    return [
      {
        source: '/:path*',
        destination: '/:path*',
      },
    ];
  },
  // Configuración del servidor de desarrollo
  serverRuntimeConfig: {
    hostname: '0.0.0.0',
  },
};

module.exports = nextConfig; 