/** @type {import('next').NextConfig} */
const nextConfig = {
  // A build into .next while `next dev` runs corrupts Turbopack's dev cache, so verification
  // builds use their own dir: NEXT_DIST_DIR=.next-verify pnpm build
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  reactStrictMode: true,
  allowedDevOrigins: ["187.127.159.101", "dnms.digitallynext.com"],
  // Not bundled: these do dynamic requires or read files from their own package dir at runtime
  // (pdfjs workers, pdfkit .afm font metrics) and break silently when bundled.
  serverExternalPackages: ["exceljs", "sharp", "pdf-parse", "mammoth", "pptxgenjs", "pdfkit"],
  experimental: {
    // Next buffers request bodies for proxy.ts and silently truncates them at 10 MB by default,
    // which breaks multipart uploads. Keep >= the largest route upload limit (250 MB) and in
    // line with nginx's client_max_body_size.
    proxyClientMaxBodySize: "260mb",
    turbopackFileSystemCacheForDev: true,
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
  typescript: {
    // Keep true: the build worker runs out of heap type-checking this project. Types are
    // enforced by `pnpm type-check` (8 GB heap) - run it before deploying.
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.backblazeb2.com",
      },
    ],
  },
  // SAMEORIGIN, not DENY: the app iframes its own routes (mailer preview, file preview).
  // CSP is report-only until nonces are wired in (Next inlines scripts and styles).
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()",
          },
          { key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains" },
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
    ]
  },
}

export default nextConfig
