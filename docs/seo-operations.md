# SEO Operations Runbook (DNMS)

How the 12-step minimal-cost SEO plan (`seo-plan.txt`) actually runs day-to-day
inside DNMS: what the app automates, what a human still does, and in what order
to roll a new project on. Steps 11 and 12 of the plan are process, not code - this file is their implementation.

---

## 1. What DNMS automates (steps 1 to 10)

| Plan step                 | Built in DNMS                                                                                    | Where                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------- |
| 3 - Baseline / config     | Per-site config: domain, GSC property, GA4 id, money keywords, money pages, competitors, targets | SEO tab → Add/Edit site                 |
| 4 - Keyword research      | Backlog auto-scored from real GSC queries (demand × opportunity × winnability × value)           | SEO → **Backlog** tab                   |
| 5 - Competitor comparison | Crawls competitors, diffs their topics vs ours → content-gap list                                | SEO → **Competitors** tab               |
| 6 - Technical             | Money-page crawl + sitemap/robots checks; IndexNow ping                                          | SEO → **Technical** tab, weekly cron    |
| 7 - Content loop          | Brief → QA gate → 30-day GSC position check                                                      | SEO → **Content** tab, weekly cron      |
| 8 - Off-page              | Backlink export import + monthly diff (new/lost referring domains)                               | SEO → **Backlinks** tab                 |
| 9 - Monitoring            | Daily uptime + noindex + robots accident check, alert on change                                  | health strip on SEO tab, **daily cron** |
| 10 - Scorecard            | 10-metric weighted scorecard with honest `coverage`                                              | SEO → **Scorecard** tab, weekly cron    |

### Automated jobs (external scheduler → `Authorization: Bearer $CRON_SECRET`)

| Job                                              | Route                      | Suggested schedule (IST) |
| ------------------------------------------------ | -------------------------- | ------------------------ |
| Daily accident monitor                           | `GET /api/cron/seo-daily`  | every day 07:00          |
| Weekly pull + audit + scorecard + content review | `GET /api/cron/seo-weekly` | Monday 06:00             |

Both iterate every **active** property, do the work, and notify the project
owner. The daily job alerts only on a _change_ of state (newly down / recovered);
the weekly job alerts on actionable scorecard/growth issues and settles due
30-day content checks.

---

## 2. Human time budget (plan step 11)

The tools remove the busywork; these hours are the real currency and go into the
two things no tool buys - **better content and real links**.

### Weekly, per project (~2 to 3 h)

1. **Triage alerts** (5 min) - clear the daily/weekly notifications; a red health
   strip is a drop-everything fix (money page down / noindex / robots block).
2. **Rank spot-check** (15 min) - Backlog tab, filter _striking distance_
   (position 5 to 20); confirm a couple in incognito.
3. **One content brief** (60 to 90 min) - pick the top Backlog or Competitor-gap
   item, open a brief, write/edit the page, run **QA** on the live URL.
4. **Community / outreach** (30 min) - one genuine Reddit/Quora/LinkedIn answer;
   one personal outreach email to a competitor's linking domain (Backlinks tab
   shows their referring domains).

### Monthly, per project (~half day)

- Read the **Scorecard**; write the _why_ behind the number (1 paragraph).
- Re-import the **backlink export** (full-snapshot) → review new/lost domains.
- Re-run **Competitors**; move any newly-winnable gaps into Backlog.
- Pick **5 outreach targets** and **5 SERP eye-checks**.

### Quarterly, per project

- Regenerate the Backlog (keyword refresh), prune losing content
  (Content tab → `LOST` outcomes → rewrite queue), competitor re-check,
  strategy call.

> Rule of thumb from the plan: **rankings lead, clicks prove, conversions pay.**
> Don't judge a project before month 3.

---

## 3. Rollout order (plan step 12)

Onboard one project at a time; don't pre-share effort across projects.

1. **Week 1 - Baseline.** Create/verify GSC + GA4 + Bing WMT. Add the site in
   DNMS with money keywords, money pages, competitors. Grant the service account
   on the GSC property. Run **Backfill 8 weeks**.
2. **Week 2 - Signal.** Generate the **Backlog**. Run a **Technical** audit and
   a **Vitals** check. Import the current **backlink** export (baseline).
3. **Week 3 - Guardrails.** Confirm the daily + weekly crons are hitting this
   project (owner is set, notifications arrive). Fix any red scorecard metric
   that's cheap (schema, titles, canonicals).
4. **Week 4 - Content.** Run **Competitors**; open the first **Content** brief on
   the highest-value winnable gap. Ship it, QA it.
5. **Month 2+.** Content loop live (flagship 4 pages/mo, small sites 1/mo).
   Onboard the next project. Add a DataForSEO deposit only once manual rank
   checks exceed ~30 min/week (plan Stage 2).

---

## 4. Manual setup still required (one-time, outside code)

These are Google/ops actions the app cannot do for you:

- [ ] Enable **Search Console API** + **GA4 Data API** on Cloud project
      `dnms-502507`.
- [ ] Grant the service account (`dnms-drive@dnms-502507.iam.gserviceaccount.com`)
      read access on every GSC property, and Viewer on every GA4 property.
- [ ] Paste each site's **GA4 numeric property id** in its SEO config.
- [ ] Set `CRON_SECRET` and point the VPS scheduler at the two cron routes above.
- [ ] Set `INDEXNOW_KEY` (+ host key file) to enable IndexNow pings.
- [ ] Confirm every SEO property has a **project owner** - that's who alerts go to.

---

## 5. What is deliberately NOT automated

- **Publishing content.** The plan flags auto-publish as a spam risk; a human
  always writes and ships. DNMS only briefs, QA-checks, and measures.
- **Bulk outreach.** Personal emails only, never bulk.
- **Buying tools.** No monthly subscriptions; pay-per-use APIs (DataForSEO) only
  when a manual step genuinely exceeds its cost in time.
- **AI-citation checks.** A monthly manual spot-check (ask ChatGPT / Perplexity /
  Gemini the money questions); GA4 AI-referral sessions are tracked automatically
  and feed the scorecard, but the citation check itself stays human.
