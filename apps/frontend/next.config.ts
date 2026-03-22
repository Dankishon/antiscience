import type { NextConfig } from 'next';

function buildContentSecurityPolicy() {
  const backendOrigin = process.env.BACKEND_ORIGIN ?? 'http://127.0.0.1:4000';
  const isProduction = process.env.NODE_ENV === 'production';
  const directives = [
    "default-src 'self'",
    `script-src 'self'${isProduction ? '' : " 'unsafe-inline' 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${backendOrigin} ws://localhost:3000 ws://127.0.0.1:3000 wss: https:`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ];

  return directives.join('; ');
}

function buildSecurityHeaders() {
  const headers = [
    {
      key: 'Content-Security-Policy',
      value: buildContentSecurityPolicy(),
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
    },
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
  ];

  if (process.env.NODE_ENV === 'production') {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains',
    });
  }

  return headers;
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ['http://127.0.0.1:3000', 'http://localhost:3000'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: buildSecurityHeaders(),
      },
    ];
  },
  transpilePackages: ['@flower-survey/shared'],
};

export default nextConfig;
