/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow cross-origin requests to the dev server (`next dev`) from these
  // hosts. Only affects development; production (`next start`) ignores this.
  allowedDevOrigins: ["187.127.159.101", "digitallynext.tech"],
  // Keep these as Node externals so Turbopack doesn't try to bundle their
  // Node-only / native dependencies.
  //   exceljs - attendance + content-calendar import parsers
  //   sharp   - native image codec, used to downscale profile photos on upload
  serverExternalPackages: ["exceljs", "sharp"],
  experimental: {
    // Disable Turbopack's on-disk persistent dev cache. In Next 16.2.6 a
    // corrupted cache restore panics the tokio worker with
    // "Every task must have a task type". Trade-off: slightly slower cold
    // restarts, no more cache-restore panics.
    turbopackFileSystemCacheForDev: false,
    // Tree-shake heavy barrel imports so only the icons/utilities actually used
    // land in each route's bundle.
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      // Backblaze B2 (S3-compatible) signed URLs for profile photos / documents.
      {
        protocol: "https",
        hostname: "*.backblazeb2.com",
      },
    ],
  },
}

export default nextConfig
