/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  // Disable segment explorer devtools — avoids SegmentViewNode manifest errors on Windows HMR
  experimental: {
    devtoolSegmentExplorer: false,
  },
  devIndicators: false,
};

export default nextConfig;
