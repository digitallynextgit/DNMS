export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Fail fast: these otherwise fail late (first query / sign-in / decrypt). Dev only warns.
    // Skipped during `next build`, which loads this file but has no runtime env.
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
          "[ENV] CRON_SECRET is unset - every /api/cron/* job will refuse to run (fails closed).",
        )
      }
    }

    // Sync config readers (e.g. the email logo via getConfigSync) only see the cache.
    const { warmConfig } = await import("@/server/app-config")
    await warmConfig()

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
      startUptimeScheduler()
      startRenewalScheduler()
      startSeoScheduler()
      startWorkDigestScheduler()
    }
  }
}
