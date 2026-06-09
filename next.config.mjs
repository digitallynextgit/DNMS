/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep exceljs as a Node external so Turbopack doesn't try to bundle its
  // Node-only dependencies (used by the attendance import parser).
  serverExternalPackages: ["exceljs"],
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
