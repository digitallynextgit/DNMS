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
    // Turbopack's on-disk cache. This was OFF because Next 16.2.6 panicked the tokio
    // worker ("Every task must have a task type") restoring a corrupted cache - which
    // meant EVERY route paid a full cold compile on every visit (~10s for a first hit
    // in `next dev`). Re-enabled on 16.2.10, where that restore bug is fixed. If the
    // panic ever returns, delete `.next/cache` before flipping this back off - a
    // corrupt cache, not the cache itself, was the problem.
    turbopackFileSystemCacheForDev: true,

    // Tree-shake heavy barrel imports so only the icons/utilities actually used land
    // in each route's bundle.
    //
    // NOTE: this only applies to npm PACKAGES. Adding the local `@/features/*` barrels
    // here was measured and made no difference (cold compile 5.7s vs 5.8s), so they are
    // deliberately not listed - Next ignores non-package specifiers.
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
