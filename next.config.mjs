/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["187.127.159.101", "digitallynext.tech", "dnms.digitallynext.com"],
  serverExternalPackages: ["exceljs", "sharp"],
  experimental: {
    // This app has a proxy (middleware) at proxy.ts, so Next BUFFERS every request
    // body for the proxy to read - and silently TRUNCATES it at 10 MB by default.
    // A truncated multipart upload loses its closing boundary, so req.formData()
    // dies with "expected boundary after body" and the route 500s. That is what
    // broke every upload over 10 MB, no matter what the route limit or nginx's
    // client_max_body_size said.
    //
    // Keep this >= the largest upload the routes accept (250 MB in
    // projects/[id]/drive and projects/[id]/resources) and <= nginx's
    // client_max_body_size (250M), or uploads silently break again.
    // NOTE: `middlewareClientMaxBodySize` is the deprecated alias of this key.
    proxyClientMaxBodySize: "260mb",
    turbopackFileSystemCacheForDev: true,
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
  typescript: {
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
}

export default nextConfig
