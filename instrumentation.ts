// Next.js instrumentation: runs once when a server instance starts.
//
// We warm the runtime config cache (the app_settings DB table) at boot so that
// SYNCHRONOUS config readers see admin-configured values immediately. In
// particular, email templates resolve the logo via logoUrl() -> getConfigSync,
// which reads only the in-memory cache (it can't await). Without warming, the
// first email rendered on a cold process would fall back to the bundled logo
// instead of the EMAIL_LOGO_URL configured in Admin → Integrations.
//
// warmConfig() never throws (a DB hiccup just leaves the cache cold and the next
// getConfig retries), so this is safe to run unconditionally at startup.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warmConfig } = await import("@/server/app-config")
    await warmConfig()
  }
}
