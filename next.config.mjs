/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["187.127.159.101", "digitallynext.tech", "dnms.digitallynext.com"],
  serverExternalPackages: ["exceljs", "sharp"],
  experimental: {
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
