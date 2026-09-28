# Cron jobs

This file is what `server/scheduler.ts` points at. It answers one question:
**which jobs run by themselves, and which need an external crontab entry.**

Every route below lives under `/api/cron/<name>` and is guarded by
`CRON_SECRET` (`server/cron-auth.ts`). The guard **fails closed**: if
`CRON_SECRET` is unset, every cron route refuses to run — silently, from the
outside. Check it is set on the deploy box before debugging anything else.

Call format (what the crontab entry runs):

```
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://dnms.digitallynext.com/api/cron/<name>
```

## Jobs that run BY THEMSELVES (in-process scheduler)

`instrumentation.ts` starts these when the server boots — no crontab needed.
Their `/api/cron/*` routes still exist as **manual triggers** for
re-running/backfilling, and they are disabled entirely when
`DISABLE_INLINE_SCHEDULER=1`.

| Job                           | Route (manual trigger)       |
| ----------------------------- | ---------------------------- |
| Task reminders                | `/api/cron/task-reminders`   |
| Work digest (weekly)          | `/api/cron/work-digest`      |
| SEO monitors (daily)          | `/api/cron/seo-daily`        |
| SEO monitors (weekly)         | `/api/cron/seo-weekly`       |
| Uptime / renewals / campaigns | (no route — in-process only) |

## Jobs that need an EXTERNAL crontab entry

Nothing in the repo or the app schedules these. **If the crontab entry is
missing on the deploy box, they never run** — leave balances stop accruing and
nobody gets an error. This has happened before (see the note in
`server/scheduler.ts` about `seo_monitor_runs` being empty).

| Route                             | What it does                  | Suggested schedule         |
| --------------------------------- | ----------------------------- | -------------------------- |
| `/api/cron/leave-accrual`         | Monthly leave accrual         | `0 1 1 * *` (1st, 01:00)   |
| `/api/cron/el-accrual`            | Earned-leave accrual          | `0 1 1 * *`                |
| `/api/cron/leave-rollover`        | Year-end balance rollover     | `0 2 1 1 *` (Jan 1, 02:00) |
| `/api/cron/birthdays`             | Birthday notifications        | `0 6 * * *` (daily, 06:00) |
| `/api/cron/document-expiry`       | Expiring-document alerts      | `0 7 * * *`                |
| `/api/cron/evaluation-autocreate` | Create due evaluations        | `0 5 * * *`                |
| `/api/cron/exit-deactivation`     | Deactivate on final exit date | `0 4 * * *`                |
| `/api/cron/referral-rewards`      | Referral reward maturation    | `0 5 * * *`                |
| `/api/cron/requirement-reminders` | Client requirement nudges     | `0 8 * * *`                |
| `/api/cron/attendance-sync`       | Pull from attendance devices  | every 15 min, if used      |

Suggested schedules are a starting point — the business owns the times. What
matters is that each entry EXISTS. To verify on the box: `crontab -l` (or the
systemd timers, if that is how it was set up).

## Checklist when a scheduled thing "stopped working"

1. Is `CRON_SECRET` set in the deployment env? (Unset = every job refuses.)
2. Does `crontab -l` show the entry, with the right URL and secret?
3. Did the route answer 200? (`curl -i` it by hand with the secret.)
4. For in-process jobs: is `DISABLE_INLINE_SCHEDULER` unset?
