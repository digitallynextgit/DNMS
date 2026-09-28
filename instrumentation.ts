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
    // ── Fail-fast env check ──────────────────────────────────────────────────
    // Every one of these otherwise fails LATE: DATABASE_URL on the first query,
    // AUTH_SECRET on the first sign-in, ENCRYPTION_KEY on the first decrypt.
    // A misconfigured production box must refuse to boot, not serve pages that
    // die one feature at a time. Dev only warns, so a fresh clone still starts.
    // (Skipped during `next build`, which loads this file but has no runtime env.)
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      const required = ["DATABASE_URL", "AUTH_SECRET", "ENCRYPTION_KEY"] as const
      const missing = required.filter((name) => !process.env[name])
      if (missing.length > 0) {
        const message = `[ENV] missing required environment variable(s): ${missing.join(", ")}`
        if (process.env.NODE_ENV === "production") throw new Error(message)
        console.warn(message)
      }
      if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET) {
        console.warn(
          "[ENV] CRON_SECRET is unset - every /api/cron/* job will refuse to run (fails closed). " +
            "See docs/cron-jobs.md.",
        )
      }
    }

    const { warmConfig } = await import("@/server/app-config")
    await warmConfig()

    // Task reminders schedule themselves in-process, so deploying the code is all
    // it takes to turn them on - no crontab entry to remember. Skipped during the
    // production build, which also loads this file but is not a running server.
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      const {
        startTaskReminderScheduler,
        startUptimeScheduler,
        startRenewalScheduler,
        startCampaignScheduler,
        startSeoScheduler,
        startWorkDigestScheduler,
      } = await import("@/server/scheduler")
      startTaskReminderScheduler()
      startCampaignScheduler()
      // Same reasoning, and for monitoring it is the whole point: the cron
      // routes have never been called on this deployment (seo_monitor_runs was
      // empty), so anything relying on them would never have run either.
      startUptimeScheduler()
      startRenewalScheduler()
      startSeoScheduler()
      // Weekly, and weekly jobs are the easiest to lose: a once-a-week timer
      // does not survive a deploy, and nobody notices a digest that stopped
      // arriving until a month has gone by.
      startWorkDigestScheduler()
    }
  }
}
