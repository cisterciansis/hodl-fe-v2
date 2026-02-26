const webpack = require('webpack')

const PROD_API_ORIGIN = process.env.NEXT_PUBLIC_API_URL || "https://api.subnet118.com";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${PROD_API_ORIGIN}/:path*`,
      },
    ];
  },
  webpack: (config, { isServer }) => {
    
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
       
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ws: false,
        'ws/browser': false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
      };
      
    }
    
    return config
  }
}

module.exports = nextConfig

