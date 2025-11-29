/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
};

const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1icndkcHFuZGFzYm9yaG9zZXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgxNDI3MzEsImV4cCI6MjA2MzcxODczMX0.ouRWHqrXv0Umk8SfbyGJoc-TA2vPaGDoC_OS-auj1-A';

module.exports = nextConfig; 