# Scheduled jobs

Every background job in DNMS is an HTTP route under `app/api/cron/*`, authenticated with
`Authorization: Bearer $CRON_SECRET`. The app does **not** schedule anything itself - something
outside it has to call these URLs, or the job simply never happens.

As of 12 Aug 2026 nothing was calling them: `requirement-reminders` had never stamped a
`remindedAt`, `seo_monitor_runs` was empty, and `task_reminder_states` had no rows. Installing the
crontab below is what turns all of this on.

## The jobs

| Job | Schedule | What it does | Safe to enable now? |
| --- | --- | --- | --- |
| `task-reminders` | every minute | Warns an assignee their booked time is nearly up | Yes |
| `attendance-sync` | every 30 min | Polls Hikvision devices for punches | Yes |
| `birthdays` | 09:00 daily | Birthday notifications | Yes |
| `content-reminders` | 09:00 daily | Nudges on content-calendar posts | Yes |
| `document-expiry` | 09:10 daily | Warns on expiring documents | Yes |
| `requirement-reminders` | 09:30 daily | Chases requirements due/overdue | Yes |
| `seo-daily` | 07:00 daily | SEO accident monitor | Yes |
| `seo-weekly` | Mon 06:00 | Search Console pull + audit + scorecard | Yes |
| `evaluation-autocreate` | 06:00 on 1st & 16th | Creates the period's evaluations | **Read note** |
| `leave-accrual` | 02:00 on the 1st | Monthly leave accrual | **Read note** |
| `leave-rollover` | 03:00 on 1 Jan | Carry-forward, lapses the rest | **Read note** |

`el-accrual` is deprecated - it delegates to `leave-accrual`. Do **not** schedule both, or accrual
runs twice.

### Note on the last three

These three write to leave balances and performance records, and they have never run on this
database. Turning them on means the first run does whatever it thinks is owed since the beginning.
`leave-accrual` claims to be idempotent and self-healing, and `leave-rollover` only fires on 1 Jan,
but neither has been exercised here. Run each one **manually once** and check the result before
letting cron own it:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://dnms.digitallynext.com/api/cron/leave-accrual
```

The other eight only send notifications or pull external data, so a surprise run costs nothing worse
than a notification.

## Installing

The secret lives in the crontab's environment rather than in each line, so it is not repeated eleven
times and does not show up in `ps` output for every job.

**The server runs on UTC** (`timedatectl` -> `Etc/UTC`), so every hour below is written in UTC with
its IST equivalent in the comment. Do NOT switch the box to Asia/Kolkata to make these read nicer:
the app's date handling is UTC-based (`todayUtc()`, `@db.Date` stored at UTC midnight), and moving
the system clock would shift attendance and leave dates by a day. Converting the schedule is the
change with no blast radius.

`task-reminders` and `attendance-sync` are interval jobs, so the timezone cannot affect them.

Write `curl` out in full on every line. It is repetitive, but a crontab variable holding another
crontab variable does NOT work: `man 5 crontab` says the value string "is not parsed for
environmental substitutions", so a `CURL=curl -H "Authorization: Bearer $CRON_SECRET"` line stores
`$CRON_SECRET` as literal text. The shell expanding `$CURL` in the command does not re-expand what
came out of it, and the embedded quotes stop being quotes - so curl sends a broken header and treats
`Bearer` as a URL. A variable used DIRECTLY in the command line (`$CRON_SECRET`, `$DNMS` below) is
fine, because the shell expands that itself.

```cron
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin
CRON_SECRET=paste-the-value-from-.env-here
DNMS=https://dnms.digitallynext.com/api/cron

# Task time reminders - must be every minute; the interval IS the precision.
*     *  *  *  *  curl -sS -m 60 -o /dev/null -H "Authorization: Bearer $CRON_SECRET" $DNMS/task-reminders
# Attendance devices
*/30  *  *  *  *  curl -sS -m 60 -o /dev/null -H "Authorization: Bearer $CRON_SECRET" $DNMS/attendance-sync
# Daily (times in UTC; IST = UTC + 5:30)
30    1  *  *  *  curl -sS -m 60 -o /dev/null -H "Authorization: Bearer $CRON_SECRET" $DNMS/seo-daily
30    3  *  *  *  curl -sS -m 60 -o /dev/null -H "Authorization: Bearer $CRON_SECRET" $DNMS/birthdays
35    3  *  *  *  curl -sS -m 60 -o /dev/null -H "Authorization: Bearer $CRON_SECRET" $DNMS/content-reminders
40    3  *  *  *  curl -sS -m 60 -o /dev/null -H "Authorization: Bearer $CRON_SECRET" $DNMS/document-expiry
0     4  *  *  *  curl -sS -m 60 -o /dev/null -H "Authorization: Bearer $CRON_SECRET" $DNMS/requirement-reminders
# Weekly
30    0  *  *  1  curl -sS -m 60 -o /dev/null -H "Authorization: Bearer $CRON_SECRET" $DNMS/seo-weekly
# Twice a month / monthly / yearly - enable only after a manual test run
30    0  1,16 * * curl -sS -m 60 -o /dev/null -H "Authorization: Bearer $CRON_SECRET" $DNMS/evaluation-autocreate
30    2  1  *  *  curl -sS -m 60 -o /dev/null -H "Authorization: Bearer $CRON_SECRET" $DNMS/leave-accrual
30    3  1  1  *  curl -sS -m 60 -o /dev/null -H "Authorization: Bearer $CRON_SECRET" $DNMS/leave-rollover
```

IST equivalents for the daily/weekly lines above: seo-daily 07:00, birthdays 09:00,
content-reminders 09:05, document-expiry 09:10, requirement-reminders 09:30, seo-weekly Mon 06:00,
evaluation-autocreate 06:00 on the 1st and 16th, leave-accrual 08:00 on the 1st, leave-rollover
09:00 on 1 Jan.

The monthly and yearly jobs are scheduled for a UTC hour that still lands on the intended IST
**date**. An early-morning IST time like 02:00 on the 1st would be 20:30 UTC on the last day of the
previous month, which is a different cron date entirely - hence 08:00/09:00 IST for those two.

Install it as the app user:

```bash
crontab -e          # paste, save
crontab -l          # confirm
```

## Checking it works

`task-reminders` is the easiest to verify because it runs every minute and reports what it did:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://dnms.digitallynext.com/api/cron/task-reminders
# {"data":{"scanned":3,"sent":0,"pruned":0}}
```

`scanned` is how many tasks are running with hours booked, `sent` how many reminders went out. A 200
with `scanned: 0` means cron and auth are fine and nobody is working right now. A 401 means the
secret does not match; a 404 means the deploy is missing the route.

To confirm cron itself is firing rather than just the URL working:

```bash
grep CRON /var/log/syslog | tail -20
```
