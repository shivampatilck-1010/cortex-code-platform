/** @type {import('next').NextConfig} */
const nextConfig = {
  
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  allowedDevOrigins: ['*.run.app', 'localhost:3000', 'localhost:8080'],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      child_process: false,
    };
    return config;
  },
};

export default nextConfig;
