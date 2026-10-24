import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
  headers() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const connections = ["'self'"];
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      const url = new URL(supabaseUrl);
      connections.push(url.origin, `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`);
    }
    if (isDevelopment) connections.push('ws:', 'wss:');
    // Inline hydration/styles are required by the current prerendered Next.js/React UI.
    // A nonce-based strict script policy requires a reviewed dynamic-rendering change.
    const policy = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      `connect-src ${connections.join(' ')}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ');
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: policy },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ...(!isDevelopment ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : []),
      ],
    }];
  },
};

export default nextConfig;
