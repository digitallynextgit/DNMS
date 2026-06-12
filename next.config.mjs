/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep exceljs as a Node external so Turbopack doesn't try to bundle its
  // Node-only dependencies (used by the attendance import parser).
  serverExternalPackages: ["exceljs"],
  experimental: {
    // Disable Turbopack's on-disk persistent dev cache. In Next 16.2.6 a
    // corrupted cache restore panics the tokio worker with
    // "Every task must have a task type". Trade-off: slightly slower cold
    // restarts, no more cache-restore panics.
    turbopackFileSystemCacheForDev: false,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
}

export default nextConfig
