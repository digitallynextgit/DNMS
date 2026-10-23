import type { DescriptionMap } from "./types"

// Project tools (SEO, email mailer, uptime/renewal monitoring, brand kit, logo, Meta ads,
// password vault) and the clients module. See ./types.ts for the format.
//
// "[id]" on /api/projects/... is the project id or slug (from GET /api/projects).
// "[id]" on /api/clients/... is the client id or slug (from GET /api/clients).
// Mailer "accounts" are SMTP email-sending accounts, never the project's Account Manager.
export const PROJECT_TOOLS: DescriptionMap = {
  "DELETE /api/clients/[id]": {
    summary:
      "Delete a client company from the clients directory. Only works when the client has no projects and no portal contacts left; otherwise it is refused (409) - set status INACTIVE with PATCH /api/clients/[id] instead. [id] is the client id or slug from GET /api/clients.",
    keywords: ["remove client", "delete customer", "delete client company"],
    notes: "Permanent. Needs client:write. Refused while projects or contacts are attached.",
  },
  "DELETE /api/clients/[id]/grants/[grantId]": {
    summary:
      "Revoke a client contact's client-portal access to one project. Their portal login and their other project grants stay. [grantId] is an access id from a contact's access list in GET /api/clients/[id].",
    keywords: [
      "revoke client portal access",
      "remove client from project",
      "client portal grant",
      "take away project access",
    ],
    notes: "Needs client:write. The client person loses that project in the portal at once.",
  },
  "DELETE /api/projects/[id]/brand/assets/[assetId]": {
    summary:
      "Delete one uploaded brand file (brand guidelines PDF, logo file, brief deck...) from a project's brand kit / strategy page. [assetId] comes from the assets list in GET /api/projects/[id]/brand.",
    keywords: ["delete brand file", "remove brand guidelines document", "brand asset"],
    notes:
      "Permanent - the stored file is deleted. Only the project's Account Manager or a project:write holder.",
  },
  "DELETE /api/projects/[id]/integration": {
    summary:
      "Disconnect the Meta ads (Facebook / Instagram Ads) integration from a project and delete all of its synced Meta campaigns and daily ad metrics.",
    keywords: ["disconnect meta ads", "remove facebook ads integration", "unlink ad account"],
    notes:
      "Irreversible: synced ad data is deleted; reconnecting needs the access token again plus a re-sync. Account Manager or project:write only.",
  },
  "DELETE /api/projects/[id]/logo": {
    summary: "Remove a project's logo (the client / brand logo shown on the projects list).",
    keywords: ["remove project logo", "delete client logo"],
    notes: "Deletes the stored image. Account Manager or project:write only.",
  },
  "DELETE /api/projects/[id]/mailer/accounts/[mailerId]": {
    summary:
      "Delete an SMTP email-sending account (sender address + SMTP server login) from a project's email mailer. This is a 'send from' account for campaigns, NOT the project's Account Manager. [mailerId] from mailers in GET /api/projects/[id]/mailer.",
    keywords: ["delete smtp account", "remove sender email", "remove sending account"],
    notes:
      "Refused (409) while a campaign is still queued or sending from it. Past campaign history is kept.",
  },
  "DELETE /api/projects/[id]/mailer/campaigns/[campaignId]": {
    summary:
      "Cancel an email campaign / newsletter that is still queued or sending (remaining emails are dropped; already-sent ones cannot be recalled). With ?purge=1 it instead permanently deletes a finished campaign and its send log. [campaignId] from campaigns in GET /api/projects/[id]/mailer.",
    query:
      "purge: 1 = delete the campaign record and its per-recipient log (finished or cancelled campaigns only; 409 while still sending). Omit to cancel.",
    keywords: ["cancel campaign", "stop email blast", "stop newsletter", "delete campaign"],
    notes: "Cancel fails (400) if the campaign already finished. purge=1 is irreversible.",
  },
  "DELETE /api/projects/[id]/mailer/images/[assetId]": {
    summary:
      "Delete an image that was uploaded for a project's email campaigns or templates. [assetId] is the id at the end of the image URL (/api/public/mailer-image/<assetId>) inside the email HTML.",
    keywords: ["delete email image", "remove campaign image"],
    notes:
      "Refused (409) if a queued, sending or sent campaign uses it, since that would break the image in recipients' inboxes. An already-deleted image counts as success.",
  },
  "DELETE /api/projects/[id]/mailer/recipients/[recipientId]": {
    summary:
      "Remove one recipient (subscriber email address) from a project's mailing list. [recipientId] from recipients in GET /api/projects/[id]/mailer. To stop emailing someone but keep them listed, unsubscribe them with PATCH instead.",
    keywords: ["remove subscriber", "delete recipient", "remove from mailing list"],
    notes: "Permanent; their past send-log rows are kept.",
  },
  "DELETE /api/projects/[id]/mailer/recipients/bulk": {
    summary:
      "Remove several recipients (subscribers) from a project's mailing list at once, by recipient id.",
    body: "{ ids: recipient id (uuid)[] (required, 1-500) }",
    keywords: ["bulk delete subscribers", "remove many recipients", "clean mailing list"],
    notes:
      "The ids go in the request BODY of this DELETE. Permanent. Returns { deleted, requested }. Confirm the list with the user first.",
  },
  "DELETE /api/projects/[id]/mailer/templates/[templateId]": {
    summary:
      "Delete a saved email template from a project's mailer. [templateId] from templates in GET /api/projects/[id]/mailer.",
    keywords: ["delete email template", "remove newsletter template"],
    notes: "Permanent.",
  },
  "DELETE /api/projects/[id]/monitoring/assets/[assetId]": {
    summary:
      "Delete an entry from a project's renewal register (domain, SSL certificate, hosting plan, licence), which stops its expiry reminders. [assetId] from assets in GET /api/projects/[id]/monitoring.",
    keywords: ["delete domain renewal", "remove ssl expiry reminder", "remove hosting renewal"],
    notes: "Permanent. Any member of the project can do this.",
  },
  "DELETE /api/projects/[id]/monitoring/monitors/[monitorId]": {
    summary:
      "Delete a website uptime monitor from a project, stopping 'website down' checks and alerts for that URL. [monitorId] from monitors in GET /api/projects/[id]/monitoring.",
    keywords: ["delete uptime monitor", "stop monitoring website", "remove site check"],
    notes:
      "Permanent; to pause instead, PATCH it with isActive:false. Any member of the project can do this.",
  },
  "DELETE /api/projects/[id]/passwords/[entryId]": {
    summary:
      "Delete one entry from a project's password vault (stored client logins). [entryId] from GET /api/projects/[id]/passwords.",
    keywords: ["delete saved password", "remove vault entry", "delete client login"],
    notes:
      "Permanent - the stored password is lost. Account Manager or project:write only. Recorded in the audit log (who, and the entry's label).",
  },
  "DELETE /api/projects/[id]/seo/[propertyId]": {
    summary:
      "Stop tracking a website in a project's SEO module and delete everything stored for it: Google Search Console snapshots, keyword backlog, content briefs, backlinks, audits, Core Web Vitals and scorecards. [propertyId] from GET /api/projects/[id]/seo.",
    keywords: ["remove seo site", "stop tracking website", "delete seo property"],
    notes:
      "Irreversible - all SEO history for the site is deleted. Account Manager or project:write only. Confirm first.",
  },
  "DELETE /api/projects/[id]/seo/[propertyId]/content/[briefId]": {
    summary:
      "Delete an SEO content brief (a planned article/page for a target keyword) on a tracked site. If it came from a backlog keyword, that keyword is released from IN_PROGRESS. [briefId] from GET /api/projects/[id]/seo/[propertyId]/content.",
    keywords: ["delete content brief", "remove article brief", "seo content plan"],
    notes: "Permanent. Account Manager or project:write only.",
  },
  "DELETE /api/projects/[id]/seo/[propertyId]/keywords/[keywordId]": {
    summary:
      "Delete one keyword from a tracked site's SEO keyword backlog. [keywordId] from GET /api/projects/[id]/seo/[propertyId]/keywords.",
    keywords: ["delete keyword", "remove seo keyword", "keyword backlog"],
    notes:
      "It can reappear when the backlog is regenerated from Search Console; to keep it out, PATCH its status to PARKED instead. Account Manager or project:write only.",
  },
  "GET /api/clients": {
    summary:
      "List client companies in the clients directory (the customers the agency works for) with project and portal-contact counts, last portal sign-in, the client's account manager, and whole-book totals. Needs client:read.",
    query:
      "search: matches name, client code (e.g. CL00012), email or website; status: PROSPECT|ACTIVE|INACTIVE; ownerId: employee id of the client's account manager; page (default 1), limit (1-100, default 20)",
    keywords: [
      "clients list",
      "customers",
      "client directory",
      "find client",
      "brands we work with",
    ],
  },
  "GET /api/clients/[id]": {
    summary:
      "Full details of one client company: contact info, status, account manager, its projects, and its client-portal contacts (people with portal logins) with each person's project access grants (grant ids, modules, status). [id] is the client id or slug from GET /api/clients.",
    keywords: ["client details", "client contacts", "client projects", "customer profile"],
  },
  "GET /api/clients/[id]/activity": {
    summary:
      "Client-portal activity log for one client: what the client's own people did in the client portal (sign-ins, uploads, approvals...), newest first. [id] is the client id or slug.",
    query: "page (default 1), limit (default 25, max 100)",
    keywords: ["client portal activity", "what did the client do", "client log"],
  },
  "GET /api/projects/[id]/brand": {
    summary:
      "A project's brand kit / strategy page: brand brief, brand overview, digital objectives (per-platform targets), brand manifestation themes, brand guidelines (colours, fonts, logo notes, UI/UX notes) and uploaded brand files with temporary view/download links. Any project member can read it.",
    keywords: [
      "brand guidelines",
      "brand kit",
      "brand brief",
      "brand colours and fonts",
      "project strategy",
    ],
    notes:
      "File links expire after about an hour; to hand the user a file, use dnms_download on GET /api/projects/[id]/brand/assets/[assetId].",
  },
  "GET /api/projects/[id]/brand/assets/[assetId]": {
    summary:
      "Download one brand file (brand guidelines PDF, logo, brief deck...) from a project's brand kit. [assetId] from the assets list in GET /api/projects/[id]/brand.",
    keywords: ["download brand guidelines", "brand file", "logo file download"],
    notes: "Returns a file - use dnms_download (readText:true to read a PDF or Word file).",
  },
  "GET /api/projects/[id]/integration": {
    summary:
      "Meta ads (Facebook / Instagram Ads) performance for a project from its connected ad account: connection status, last sync, totals (spend, impressions, clicks, CTR, purchases, purchase value, ROAS, reach), a daily series and top campaigns. Shows the last synced data - POST .../integration/sync to refresh.",
    query:
      "days: last N days (1-365); or from, to: YYYY-MM-DD inclusive (win over days). Omit all for every synced day.",
    keywords: [
      "meta ads report",
      "facebook ads spend",
      "instagram ads performance",
      "roas",
      "ad campaigns",
    ],
    notes: "Spend is in the ad account's currency. Never returns the access token or app secret.",
  },
  "GET /api/projects/[id]/logo": {
    summary: "The project's logo image (client / brand logo). 404 when the project has no logo.",
    keywords: ["project logo", "client logo", "brand logo image"],
    notes: "Returns a file - use dnms_download.",
  },
  "GET /api/projects/[id]/sales/leads": {
    summary:
      "A project's sales leads (the Sales tab, for projects with the BD / Sales service): business, contact, phone, email, category, area, city, stage (NEW, CONTACTED, INTERESTED, VISIT, QUOTATION, WON, LOST), assignee, next follow-up, deal value, do-not-contact and the last activity. Also canManage (may the caller add, import, assign and delete). Anyone on the project.",
    keywords: ["sales leads", "pipeline", "prospects", "follow ups", "bd leads"],
  },
  "POST /api/projects/[id]/sales/leads": {
    summary:
      "Add a sales lead. Account Managers, project admins and the BD / Sales service owner. Refused (409) if a lead with the same phone - or the same business in the same area - exists.",
    body: "{ business (required); contactName?; phone?; email?; website?; category?; area?; city?; address?; mapsUrl?; rating?: 0-5; reviewsCount?; stage?: NEW|CONTACTED|INTERESTED|VISIT|QUOTATION|WON|LOST; lostReason?; value?: rupees; assigneeId?; nextFollowUp?: YYYY-MM-DD; doNotContact?: boolean; notes? }",
    keywords: ["add lead", "new prospect"],
  },
  "PATCH /api/projects/[id]/sales/leads/[leadId]": {
    summary:
      "Edit a lead: details, stage (a change is logged), next follow-up, value, do-not-contact, notes. Its assignee or the sales managers; only managers reassign (the new assignee is notified).",
    body: "Any field of POST /api/projects/[id]/sales/leads.",
    keywords: ["update lead", "move lead stage", "assign lead", "set follow up"],
  },
  "DELETE /api/projects/[id]/sales/leads/[leadId]": {
    summary: "Delete a lead and its history. Sales managers only.",
    notes: "Irreversible. Confirm the business name first.",
    keywords: ["delete lead"],
  },
  "GET /api/projects/[id]/sales/leads/[leadId]/activities": {
    summary:
      "A lead's history, newest first: calls, WhatsApps, emails, visits, notes and stage changes, with who did each. Anyone on the project.",
    keywords: ["lead history", "lead activity", "call log"],
  },
  "POST /api/projects/[id]/sales/leads/[leadId]/activities": {
    summary:
      "Log what happened with a lead - and optionally move its stage and set the next follow-up in the same step. Its assignee or the sales managers.",
    body: "{ kind (required): CALL|WHATSAPP|EMAIL|VISIT|NOTE; note?; stage?; nextFollowUp?: YYYY-MM-DD or null }",
    keywords: ["log call", "log visit", "lead note"],
  },
  "POST /api/projects/[id]/sales/leads/import": {
    summary:
      "Import leads already mapped from a spreadsheet (up to 2,000 rows). Rows matching an existing lead - the same phone, or the same business in the same area - are skipped. Sales managers only. Returns { added, duplicates }.",
    body: "{ rows (required): [{ business (required), contactName?, phone?, email?, website?, category?, area?, city?, address?, mapsUrl?, rating?, reviewsCount?, notes? }]; assigneeId? }",
    keywords: ["import leads", "bulk add leads", "upload lead list"],
  },
  "GET /api/projects/[id]/mailer": {
    summary:
      "Everything in a project's email mailer (newsletter / email campaign tool): SMTP sending accounts (no passwords), email templates, recipients/subscribers (newest 500) with tags, the 25 latest campaigns with sent/failed counts, and subscriber and tag counts. Mailer 'accounts' are SMTP senders, not the project's Account Manager.",
    keywords: [
      "email campaigns",
      "newsletter",
      "mailing list",
      "subscribers",
      "email templates",
      "smtp accounts",
    ],
  },
  "GET /api/projects/[id]/mailer/campaigns/[campaignId]": {
    summary:
      "Per-recipient delivery log of one email campaign: each address with status PENDING|SENT|FAILED, the error if it failed, and when it was sent (up to 1000 rows). [campaignId] from campaigns in GET /api/projects/[id]/mailer.",
    keywords: [
      "campaign report",
      "email delivery status",
      "who received the newsletter",
      "failed emails",
    ],
  },
  "GET /api/projects/[id]/monitoring": {
    summary:
      "A project's Monitoring tab: the renewal register (domains, SSL certificates, hosting, licences with expiry date, auto-renew, payment card expiry, owner), website uptime monitors with current UP/DOWN state, last check, status code and any open incident, plus the 10 latest resolved outages.",
    keywords: [
      "website down",
      "uptime monitor",
      "domain expiry",
      "ssl expiry",
      "hosting renewal",
      "site status",
    ],
  },
  "GET /api/projects/[id]/passwords": {
    summary:
      "List a project's password vault entries (stored client logins: label, username, URL, notes, who added it). The passwords themselves are NOT included and cannot be revealed through the AI connector. Account Manager or project:write only.",
    keywords: ["password vault", "client logins", "saved credentials", "account logins"],
    notes:
      "To see a password the person must use Reveal on the project's Passwords tab in the DNMS web app (each reveal is audit-logged); do not offer to fetch it.",
  },
  "GET /api/projects/[id]/seo": {
    summary:
      "List the websites tracked in a project's SEO module (SEO properties): domain, Google Search Console property, GA4 property id, money keywords, money pages, competitors, targets and last sync time/error. Also says whether Search Console is configured and the service-account email to grant access to. Use the returned ids as [propertyId].",
    keywords: ["seo sites", "search console properties", "tracked websites", "seo setup"],
  },
  "GET /api/projects/[id]/seo/[propertyId]/backlinks": {
    summary:
      "Backlink report for one tracked site: referring domains and headline counts of active, new and lost backlinks, from imported backlink exports. [propertyId] from GET /api/projects/[id]/seo.",
    keywords: ["backlinks", "referring domains", "link profile", "inbound links"],
    notes: "Needs the project:read permission (project team membership alone is not enough).",
  },
  "GET /api/projects/[id]/seo/[propertyId]/competitors": {
    summary:
      "Latest competitor gap analysis for a tracked site: the competitor sites crawled and the topics they cover that this site doesn't (content gaps). Null if it was never run - run it with POST.",
    keywords: ["competitor analysis", "content gap", "competitor seo", "what competitors rank for"],
    notes: "Needs the project:read permission (project team membership alone is not enough).",
  },
  "GET /api/projects/[id]/seo/[propertyId]/content": {
    summary:
      "SEO content briefs (content plan) for a tracked site: target query, intent, status BRIEF / WRITING / REVIEW / PUBLISHED / MEASURED / PARKED, outline, QA results and published URL, most recently touched first.",
    keywords: ["content briefs", "seo content plan", "blog plan", "articles to write"],
    notes: "Needs the project:read permission (project team membership alone is not enough).",
  },
  "GET /api/projects/[id]/seo/[propertyId]/keywords": {
    summary:
      "Keyword backlog for a tracked site: Google Search Console queries scored by demand, ranking-position opportunity, winnability and business value, highest priority first, with intent and status. Use for 'keywords ranking' and 'what should we target next'.",
    keywords: ["keywords ranking", "keyword backlog", "keyword opportunities", "search queries"],
    notes: "Needs the project:read permission (project team membership alone is not enough).",
  },
  "GET /api/projects/[id]/seo/[propertyId]/monitor": {
    summary:
      "Latest daily SEO accident check for a tracked site: whether money pages return 200, have gone noindex, or robots.txt blocks crawling. Null if never run.",
    keywords: ["seo health check", "noindex check", "robots.txt blocked", "pages down seo"],
    notes: "Needs the project:read permission (project team membership alone is not enough).",
  },
  "GET /api/projects/[id]/seo/[propertyId]/overview": {
    summary:
      "SEO performance overview for one tracked site from Google Search Console: clicks, impressions, CTR and average position vs the previous period, top queries and pages, money keywords, striking-distance queries (positions 8-30), trend, alerts and open SEO tasks.",
    query:
      "end: YYYY-MM-DD - show the weekly window ending on or before this date (default latest); weeks: how many stored weeks to combine (default 1)",
    keywords: [
      "seo report",
      "google search console",
      "organic clicks",
      "search rankings",
      "seo performance",
    ],
    notes: "Needs the project:read permission (project team membership alone is not enough).",
  },
  "GET /api/projects/[id]/seo/[propertyId]/scorecard": {
    summary:
      "Latest monthly SEO scorecard for a tracked site: a 0-100 score from ten weighted metrics over 28 days, its band (80+ healthy, 60-79 watch, 40-59 intervene, under 40 escalate) and how much was measurable. Null if there is no Search Console data yet.",
    keywords: ["seo score", "seo scorecard", "monthly seo health"],
    notes:
      "If none is stored yet but data exists, this read builds and saves the first one. Needs the project:read permission.",
  },
  "GET /api/projects/[id]/seo/[propertyId]/setup": {
    summary:
      "SEO setup checklist for a tracked site: ordered steps (Search Console access, money keywords, competitors, GA4...) showing which are done and which is next, plus scorecard points blocked by missing setup.",
    keywords: ["seo setup checklist", "what to do next seo", "seo onboarding"],
    notes: "Needs the project:read permission (project team membership alone is not enough).",
  },
  "GET /api/projects/[id]/seo/[propertyId]/technical": {
    summary:
      "Latest technical SEO audit for a tracked site: crawl results for its money pages, sitemap.xml and robots.txt checks, and the critical issue count. Null if never run.",
    keywords: ["technical seo audit", "site audit", "sitemap check", "crawl issues"],
    notes: "Needs the project:read permission (project team membership alone is not enough).",
  },
  "GET /api/projects/[id]/seo/[propertyId]/vitals": {
    summary:
      "Core Web Vitals / page speed for a tracked site: the latest reading per URL (LCP, INP, CLS, FCP, TTFB, performance score, GOOD / NEEDS_IMPROVEMENT / POOR verdict) from Google field data or PageSpeed Insights.",
    keywords: [
      "core web vitals",
      "page speed",
      "pagespeed insights",
      "lighthouse score",
      "site speed",
    ],
    notes: "Needs the project:read permission (project team membership alone is not enough).",
  },
  "GET /api/projects/[id]/seo/rollup": {
    summary:
      "SEO summary across every website tracked on a project: each site's latest Search Console totals (clicks, impressions, position) compared with the week before, plus combined project totals.",
    keywords: ["seo summary", "all sites seo", "project seo totals"],
    notes: "Needs the project:read permission (project team membership alone is not enough).",
  },
  "PATCH /api/clients/[id]": {
    summary:
      "Update a client company: name, status, contact details, notes, or the client's account manager (ownerId). This is the client relationship owner; a PROJECT's Account Manager is set on the project itself. [id] is the client id or slug. Only fields sent change.",
    body: "{ name?: string (2-120), status?: PROSPECT|ACTIVE|INACTIVE, industry?, website?, email?, phone?, address?, taxId? (GST / tax number), notes?: string ('' clears), ownerId?: active employee id, or null to clear }",
    keywords: [
      "edit client",
      "update client details",
      "client account manager",
      "deactivate client",
    ],
    notes: "Needs client:write.",
  },
  "PATCH /api/clients/[id]/contacts/[contactId]": {
    summary:
      "Edit a client contact (a person at the client with a client-portal login): fix their name or phone, or switch their portal login off and on. [contactId] from contacts in GET /api/clients/[id].",
    body: "{ name?: string (2-120), phone?: string ('' clears), isActive?: boolean (false blocks their portal sign-in) }",
    keywords: ["edit client contact", "disable client login", "client portal user"],
    notes: "Email cannot be changed here. Needs client:write.",
  },
  "PATCH /api/clients/[id]/grants/[grantId]": {
    summary:
      "Change which client-portal sections (modules) a client contact sees for one project, or suspend / resume that access. [grantId] from a contact's access list in GET /api/clients/[id].",
    body: "{ modules?: (plan|documents|calendars|products|channels|inventory|mailer|activity)[] (at least one; replaces the list), status?: ACTIVE|SUSPENDED }",
    keywords: ["client portal permissions", "suspend client access", "change portal modules"],
    notes:
      "The 'mailer' module lets the client send email campaigns to real people. Needs client:write.",
  },
  "PATCH /api/projects/[id]/mailer/accounts/[mailerId]": {
    summary:
      "Edit an SMTP email-sending account on a project's mailer (sender name/address, reply-to, SMTP host/port/login, on/off). This is an email 'send from' account, NOT the project's Account Manager. [mailerId] from GET /api/projects/[id]/mailer.",
    body: "{ name: string (2-60, required), fromName: string (required), fromEmail: email (required), replyTo?: email, host: SMTP host (required), port?: number (default 587), secure?: boolean (default false; true for port 465), username: string (required), password?: string (blank keeps the stored one), isActive?: boolean (default true) }",
    keywords: ["edit smtp settings", "change sender email", "update sending account"],
    notes:
      "Full replace: send ALL fields, not just the changed one - omitted port/secure/isActive reset to 587/false/true and an omitted replyTo is cleared. Stores an SMTP password when one is given.",
  },
  "PATCH /api/projects/[id]/mailer/recipients/[recipientId]": {
    summary:
      "Subscribe or unsubscribe one recipient on a project's mailing list. Unsubscribed people are skipped by every campaign, even one already sending. [recipientId] from GET /api/projects/[id]/mailer.",
    body: "{ isSubscribed: boolean (required - leaving it out UNSUBSCRIBES) }",
    keywords: ["unsubscribe", "resubscribe", "opt out of newsletter"],
  },
  "PATCH /api/projects/[id]/mailer/templates/[templateId]": {
    summary:
      "Edit a saved email template on a project's mailer. [templateId] from templates in GET /api/projects/[id]/mailer.",
    body: "{ name: string (2-80, required), subject: string (required), bodyHtml: string (required, 10+ chars; merge tags {{name}}, {{first_name}}, {{email}}, {{company}}, custom fields, {{var|fallback}}), bodyMode?: RICH|HTML (default RICH), isActive?: boolean (default true) }",
    keywords: ["edit email template", "update newsletter template"],
    notes: "Full replace - send all fields; omitted bodyMode/isActive reset to their defaults.",
  },
  "PATCH /api/projects/[id]/monitoring/assets/[assetId]": {
    summary:
      "Update a renewal-register entry (domain, SSL certificate, hosting, licence) - e.g. record a renewal by moving the expiry date later, or change provider, owner or auto-renew. [assetId] from GET /api/projects/[id]/monitoring.",
    body: "{ kind: DOMAIN|SSL|HOSTING|LICENSE|OTHER (required), name: string (required), provider?: string, url?: URL, expiresAt: YYYY-MM-DD (required), autoRenew?: boolean (default true), paymentMethod?: string, paymentExpiresAt?: YYYY-MM-DD, ownerId?: employee id, notes?: string }",
    keywords: ["renew domain", "update ssl expiry", "domain renewed", "hosting renewal date"],
    notes:
      "Full replace - send every field; omitted optional fields are cleared and autoRenew defaults to true. A later expiresAt resets the reminder schedule. Any project member can do this.",
  },
  "PATCH /api/projects/[id]/monitoring/monitors/[monitorId]": {
    summary:
      "Update a website uptime monitor: change its URL, label or alert owner, or pause / resume it. [monitorId] from GET /api/projects/[id]/monitoring.",
    body: "{ url: full http(s) URL (required), label?: string, ownerId?: employee id who always gets its alerts, isActive?: boolean (default true) }",
    keywords: ["pause uptime monitor", "edit site monitor", "change monitored url"],
    notes:
      "Full replace - always send url and every field; leaving out isActive RE-ACTIVATES the monitor and omitted label/ownerId are cleared.",
  },
  "PATCH /api/projects/[id]/passwords/[entryId]": {
    summary:
      "Edit a project password-vault entry (stored client login): label, username, URL, notes, or set a new password. [entryId] from GET /api/projects/[id]/passwords.",
    body: "{ label?: string (blank keeps the current one), username?: string, password?: string (new password; blank keeps the current one), url?: string, notes?: string } - empty string or null clears username, url or notes",
    keywords: ["update saved password", "edit client login", "change vault entry"],
    notes:
      "Stores a secret (encrypted). Account Manager or project:write only. The response never includes the password. Recorded in the audit log: which fields changed, never their values.",
  },
  "PATCH /api/projects/[id]/seo/[propertyId]/content/[briefId]": {
    summary:
      "Update an SEO content brief (status, outline, angle, notes, published URL), or with action 'qa' re-crawl the live page and grade it - the first QA marks the brief PUBLISHED and schedules a 30-day ranking check. [briefId] from GET .../content.",
    body: "{ action?: update|qa (default update), url?: live page URL (required for qa), status?: BRIEF|WRITING|REVIEW|PUBLISHED|MEASURED|PARKED, outline?: string[] (max 30), angle?: string|null, notes?: string|null, publishedUrl?: URL|null }",
    keywords: ["update content brief", "content qa", "mark article published"],
    notes: "Account Manager or project:write only.",
  },
  "PATCH /api/projects/[id]/seo/[propertyId]/keywords/[keywordId]": {
    summary:
      "Adjust a keyword in a tracked site's SEO keyword backlog (the human judgement fields) and recompute its priority score. [keywordId] from GET .../keywords.",
    body: "{ winnable?: boolean|null, businessValue?: 1-5, intent?: commercial|informational|branded|navigational|other, status?: BACKLOG|IN_PROGRESS|PUBLISHED|PARKED, notes?: string|null }",
    keywords: ["update keyword", "park keyword", "keyword priority"],
    notes: "Account Manager or project:write only.",
  },
  "POST /api/clients": {
    summary:
      "Add a new client company to the clients directory. It gets an automatic code (e.g. CL00012) and a URL slug.",
    body: "{ name: string (2-120, required), status?: PROSPECT|ACTIVE|INACTIVE (default ACTIVE), industry?, website?, email?, phone?, address?, taxId?, notes?: string, ownerId?: active employee id - the client's account manager }",
    keywords: ["create client", "new customer", "add client company"],
    notes: "Needs client:write.",
  },
  "POST /api/clients/[id]/contacts": {
    summary:
      "Give a person at a client company a client-portal login (client contact), optionally with access to one of that client's projects. A new login gets a generated password EMAILED to them.",
    body: "{ name: string (required), email: email (required), phone?: string, forcePasswordChange?: boolean (default true), grant?: { projectId: a project of this client, modules: (plan|documents|calendars|products|channels|inventory|mailer|activity)[] } }",
    keywords: ["invite client", "add client contact", "client portal login", "give client access"],
    notes:
      "SENDS AN EMAIL with login credentials to the client. 409 if the email belongs to an employee or to a login at another client; an existing login of this client is reused without a new password. Needs client:write.",
  },
  "POST /api/clients/[id]/grants": {
    summary:
      "Give an existing client contact access to one of this client's projects in the client portal, choosing which sections (modules) they see.",
    body: "{ contactId: contact id from GET /api/clients/[id] (required), projectId: a project belonging to this client (required), modules: (plan|documents|calendars|products|channels|inventory|mailer|activity)[] (required, at least one) }",
    keywords: ["grant client portal access", "share project with client", "client portal"],
    notes:
      "409 if they already have access to that project - PATCH the grant instead. 'mailer' lets the client send emails to real people. Needs client:write.",
  },
  "POST /api/projects/[id]/brand/analyse": {
    summary:
      "AI-read a project's uploaded brand documents and draft a brand brief (markdown), strategy recommendations and questions to ask the client. Nothing is saved - save the brief with PUT /api/projects/[id]/brand.",
    body: "{ assetIds?: brand file ids from GET /api/projects/[id]/brand (default: all uploaded documents) }",
    keywords: ["draft brand brief", "analyse brand documents", "ai brand strategy"],
    notes:
      "Slow AI call (up to about 2 minutes). 503 if AI is not configured. Account Manager or project:write only.",
  },
  "POST /api/projects/[id]/brand/assets": {
    summary:
      "Upload a brand file (guidelines PDF, logo, brief deck...) to a project's brand kit, filed under a strategy section.",
    body: "multipart form: file (max 250 MB), kind: BRIEF|OBJECTIVES|MANIFESTATION|OVERVIEW|LOGO (default LOGO)",
    keywords: ["upload brand guidelines", "add brand file"],
    notes: "File upload - not possible through the AI connector.",
  },
  "POST /api/projects/[id]/integration": {
    summary:
      "Connect or update a project's Meta ads (Facebook / Instagram Ads) integration by saving the ad account id and access token; the token is checked against Meta before the integration is marked connected.",
    body: "{ adAccountId: string (required, with or without 'act_'), accessToken: string (required on first connect; blank keeps the stored one), appId?: string, appSecret?: string (blank keeps the stored one) }",
    keywords: [
      "connect meta ads",
      "facebook ads integration",
      "link ad account",
      "meta access token",
    ],
    notes:
      "Stores credentials (encrypted). If Meta rejects the token it returns 400 but the credentials are still saved with status 'pending'. Account Manager or project:write only. Then POST .../integration/sync to pull data.",
  },
  "POST /api/projects/[id]/integration/sync": {
    summary:
      "Pull fresh Meta ads data (campaigns plus daily spend, impressions, clicks, purchases and reach) from the project's connected Meta ad account.",
    body: "{ lookbackDays?: number (default 30; use 7, 14, 28, 30 or 90 - Meta's supported windows) }",
    keywords: ["sync meta ads", "refresh facebook ads data", "update ad spend"],
    notes: "Calls Meta's API and can take a while. Account Manager or project:write only.",
  },
  "POST /api/projects/[id]/logo": {
    summary: "Upload or replace a project's logo image.",
    body: "multipart form: file (JPG, PNG, WEBP, GIF or SVG, max 5 MB)",
    keywords: ["upload project logo", "change client logo"],
    notes: "File upload - not possible through the AI connector.",
  },
  "POST /api/projects/[id]/mailer/accounts": {
    summary:
      "Add an SMTP email-sending account to a project's mailer - the 'send from' address campaigns go out from, with its SMTP server login. Not the project's Account Manager.",
    body: "{ name: string (2-60, required, unique per project, e.g. 'Newsletter'), fromName: string (required), fromEmail: email (required), replyTo?: email, host: SMTP host (required), port?: number (default 587), secure?: boolean (default false), username: string (required), password: string (required), isActive?: boolean (default true) }",
    keywords: ["add smtp account", "add sender email", "set up email sending"],
    notes:
      "Stores an SMTP password (encrypted). Check it works with POST .../accounts/[mailerId]/test.",
  },
  "POST /api/projects/[id]/mailer/accounts/[mailerId]/test": {
    summary:
      "Send a real test email through one SMTP sending account to check its settings work; the success or SMTP error is recorded on the account. [mailerId] from GET /api/projects/[id]/mailer.",
    body: "{ to: email address to send the test to (required) }",
    keywords: ["test smtp", "send test email", "verify email account"],
    notes: "SENDS A REAL EMAIL to 'to'.",
  },
  "POST /api/projects/[id]/mailer/campaigns": {
    summary:
      "Send an email campaign / newsletter from a project's mailer to every subscribed recipient, or only those carrying given tags. It is queued and sent in the background by the scheduler.",
    body: "{ mailerId: SMTP sending account id (required), name: string (required), subject: string (required), bodyHtml: string (required; merge tags {{name}}, {{first_name}}, {{email}}, {{company}}, custom fields, {{var|fallback}}), bodyMode?: RICH|HTML (default RICH), templateId?: template id (recorded only - bodyHtml is still required), tags?: string[] (empty = every subscribed recipient) }",
    keywords: ["send newsletter", "email blast", "send campaign", "mass email", "bulk email"],
    notes:
      "SENDS EMAILS TO REAL RECIPIENTS and cannot be recalled once sent. Always confirm the sender, audience size and content with the user first. Stop it with DELETE .../campaigns/[campaignId].",
  },
  "POST /api/projects/[id]/mailer/images": {
    summary:
      "Upload an image to use inside a project's email campaigns or templates; returns its public URL for an <img src>.",
    body: "multipart form: file (JPG, PNG, WEBP or GIF, max 10 MB)",
    keywords: ["upload email image", "campaign image"],
    notes: "File upload - not possible through the AI connector.",
  },
  "POST /api/projects/[id]/mailer/recipients": {
    summary: "Add one recipient (subscriber) to a project's mailing list.",
    body: "{ email: email (required), name?: string, company?: string, tags?: string[], fields?: { [key]: string } (custom merge fields usable as {{key}}) }",
    keywords: ["add subscriber", "add recipient", "add to mailing list"],
    notes: "409 if the address is already on the list.",
  },
  "POST /api/projects/[id]/mailer/recipients/bulk": {
    summary:
      "Add many recipients to a project's mailing list from pasted text, one per line as 'email', 'Name <email>' or 'Name,email'. Duplicates and invalid lines are skipped.",
    body: "{ raw: string (required, newline-separated addresses), tags?: string[] (applied to the new recipients) }",
    keywords: ["paste email list", "bulk add subscribers", "add many recipients"],
    notes: "Returns { parsed, added, skipped }.",
  },
  "POST /api/projects/[id]/mailer/recipients/import": {
    summary:
      "Import recipients into a project's mailing list from spreadsheet-style rows sent as JSON. New addresses are created, existing ones can gain the tags, and invalid emails are counted and skipped.",
    body: "{ rows: [{ email: string (required), name?: string, company?: string, fields?: { [column]: string } }] (1-5000), tags?: string[], tagExisting?: boolean (default true - also tag addresses already on the list) }",
    keywords: ["import subscribers", "import mailing list", "upload contacts csv"],
    notes:
      "Rows must already be parsed (no file upload). Returns { parsed, added, tagged, existing, invalid }.",
  },
  "POST /api/projects/[id]/mailer/templates": {
    summary: "Create a reusable email template in a project's mailer.",
    body: "{ name: string (2-80, required, unique per project), subject: string (required), bodyHtml: string (required, 10+ chars; merge tags {{name}}, {{first_name}}, {{email}}, {{company}}, custom fields, {{var|fallback}}), bodyMode?: RICH|HTML (default RICH), isActive?: boolean (default true) }",
    keywords: ["create email template", "newsletter template"],
    notes: "409 if a template with that name already exists.",
  },
  "POST /api/projects/[id]/monitoring/assets": {
    summary:
      "Add an item to a project's renewal register so the team is reminded before it expires: a domain, SSL certificate, hosting plan, licence or other renewal.",
    body: "{ kind: DOMAIN|SSL|HOSTING|LICENSE|OTHER (required), name: string (required, e.g. the domain), provider?: string (GoDaddy, AWS...), url?: URL, expiresAt: YYYY-MM-DD (required), autoRenew?: boolean (default true), paymentMethod?: string, paymentExpiresAt?: YYYY-MM-DD (card expiry), ownerId?: employee id who gets reminders, notes?: string }",
    keywords: [
      "track domain expiry",
      "add ssl certificate",
      "hosting renewal reminder",
      "licence renewal",
    ],
    notes:
      "Reminders (in-app and email) go out 60, 30, 14, 7, 3, 1 and 0 days before expiry, escalating to the Account Manager and admins near or after expiry. Any project member can add.",
  },
  "POST /api/projects/[id]/monitoring/incidents/[incidentId]/ack": {
    summary:
      "Acknowledge an open website-down incident ('I'm on it'): stops the alert escalating further to the Account Manager and admins, without closing it. [incidentId] is the open incident on a monitor in GET /api/projects/[id]/monitoring.",
    keywords: ["acknowledge outage", "ack incident", "site down alert", "i'm on it"],
    notes: "The incident closes by itself when the site is back up.",
  },
  "POST /api/projects/[id]/monitoring/monitors": {
    summary:
      "Start watching a website URL for downtime (uptime monitor). After two failed checks in a row an incident opens and alerts go to the project team, escalating every 30 minutes until someone acknowledges it.",
    body: "{ url: full http(s) URL (required), label?: string, ownerId?: employee id who always gets its alerts, isActive?: boolean (default true) }",
    keywords: ["monitor website", "add uptime check", "alert if site goes down"],
    notes: "409 if the URL is already watched on this project. Any project member can add.",
  },
  "POST /api/projects/[id]/passwords": {
    summary:
      "Save a new client login in a project's password vault (label, username, password, URL, notes).",
    body: "{ label: string (required), password: string (required), username?: string, url?: string, notes?: string }",
    keywords: ["save password", "add client login", "store credentials"],
    notes:
      "Stores a secret (encrypted). Account Manager or project:write only. Passwords cannot be read back through the AI connector. Recorded in the audit log (label only, never the password).",
  },
  "POST /api/projects/[id]/seo": {
    summary:
      "Start tracking a website in a project's SEO module (add an SEO property linked to Google Search Console). The first site added becomes the primary.",
    body: "{ label: string (required), domain: string (required, e.g. example.com), siteUrl?: Search Console property ('sc-domain:example.com' or 'https://example.com/'; default is the domain property), gaPropertyId?: GA4 property id, moneyKeywords?: string[], moneyPages?: URL[], competitors?: domain[] (max 200 each), targetClicks?: int, targetPosition?: 1-100, isActive?: boolean, isPrimary?: boolean }",
    keywords: ["add seo site", "track website seo", "connect search console"],
    notes:
      "409 if the same Search Console property is already tracked. Then POST .../seo/[propertyId]/sync (backfill:true for history). Account Manager or project:write only.",
  },
  "POST /api/projects/[id]/seo/[propertyId]/ai": {
    summary:
      "AI suggestions for a tracked site, grounded in its Search Console data: task 'keywords' proposes money keywords, 'competitors' proposes competitor domains, 'explain' explains the site's SEO position in plain language. Nothing is saved.",
    body: "{ task: keywords|competitors|explain (required) }",
    keywords: ["suggest keywords", "find competitors", "explain seo", "ai seo"],
    notes:
      "To keep suggestions, save them with PUT /api/projects/[id]/seo/[propertyId]. 503 if AI is not configured. Account Manager or project:write only.",
  },
  "POST /api/projects/[id]/seo/[propertyId]/backlinks": {
    summary:
      "Import backlinks for a tracked site by pasting an export (Ahrefs Webmaster Tools, Search Console links, or a manual list): one source URL per line, or CSV rows 'sourceUrl, anchor, targetUrl, domainRating'.",
    body: "{ text: string (required, up to 500k chars), source?: AWT|GSC|MANUAL (default MANUAL; AWT = Ahrefs Webmaster Tools), fullSnapshot?: boolean (default false; true = this is the complete current set and links missing from it are marked LOST) }",
    keywords: ["import backlinks", "add backlinks", "paste ahrefs export"],
    notes: "Account Manager or project:write only.",
  },
  "POST /api/projects/[id]/seo/[propertyId]/competitors": {
    summary:
      "Run a competitor gap analysis for a tracked site: crawls a sample of each configured competitor's pages and lists topics they cover that this site doesn't. The site must have competitors set.",
    keywords: ["run competitor analysis", "content gap analysis", "competitor crawl"],
    notes:
      "Slow - live crawls of several sites (up to 5 minutes). Account Manager or project:write only.",
  },
  "POST /api/projects/[id]/seo/[propertyId]/content": {
    summary:
      "Create an SEO content brief (plan for a new article or page) for a tracked site, from a backlog keyword or a typed target query. The outline is built from related Search Console queries; a backlog keyword moves to IN_PROGRESS.",
    body: "{ keywordId?: id from GET .../keywords, targetQuery?: string (2-200) } - one of the two is required",
    keywords: ["create content brief", "plan blog post", "write article for keyword"],
    notes: "Account Manager or project:write only.",
  },
  "POST /api/projects/[id]/seo/[propertyId]/keywords": {
    summary:
      "Regenerate a tracked site's keyword backlog from its latest Search Console data (existing keywords keep their human edits; nothing is deleted), or with from:'competitors' mine keyword candidates from the latest competitor gap crawl.",
    body: "{ from?: 'competitors' (anything else, or no body, = from Search Console) }",
    keywords: ["generate keyword backlog", "refresh keywords", "keyword research"],
    notes:
      "Sync Search Console first (or run the competitor analysis for from:'competitors'). Account Manager or project:write only.",
  },
  "POST /api/projects/[id]/seo/[propertyId]/monitor": {
    summary:
      "Run the SEO accident check now for a tracked site: money pages return 200 and aren't noindexed, and robots.txt doesn't block crawling. Stores the result.",
    keywords: ["run seo check", "check noindex", "check robots.txt"],
    notes: "Also runs daily on its own. Account Manager or project:write only.",
  },
  "POST /api/projects/[id]/seo/[propertyId]/scorecard": {
    summary:
      "Rebuild and store the monthly SEO scorecard (last 28 days) for a tracked site from the latest data.",
    keywords: ["refresh seo score", "rebuild scorecard"],
    notes: "Account Manager or project:write only.",
  },
  "POST /api/projects/[id]/seo/[propertyId]/sync": {
    summary:
      "Pull fresh Google Search Console data (clicks, impressions, queries, pages, positions) for one tracked site for the last complete 7 days; with backfill:true also fetch the 8 weeks before so trends have history.",
    body: "{ backfill?: boolean }",
    keywords: ["sync search console", "refresh seo data", "update gsc data"],
    notes:
      "Calls Google; a backfill can take up to 2 minutes. Account Manager or project:write only.",
  },
  "POST /api/projects/[id]/seo/[propertyId]/technical": {
    summary:
      "Run a technical SEO audit now for a tracked site: crawls its money pages, checks sitemap.xml and robots.txt, stores the result and notifies IndexNow (Bing etc.) of the pages when configured.",
    keywords: ["run technical seo audit", "site audit", "crawl website"],
    notes: "Slow - live crawl (up to 2 minutes). Account Manager or project:write only.",
  },
  "POST /api/projects/[id]/seo/[propertyId]/vitals": {
    summary:
      "Measure Core Web Vitals / page speed now for a tracked site's money pages via Google PageSpeed Insights (mobile); with traffic:true also pull the last 28 days of organic traffic from GA4.",
    body: "{ traffic?: boolean }",
    keywords: ["check page speed", "run pagespeed", "measure core web vitals", "ga4 traffic"],
    notes:
      "Slow - one Lighthouse run per URL (up to 5 minutes). Account Manager or project:write only.",
  },
  "POST /api/projects/[id]/seo/sync": {
    summary:
      "Pull fresh Google Search Console data for every active website tracked on a project (last complete 7 days each).",
    keywords: ["sync all seo sites", "refresh search console", "update seo data"],
    notes:
      "Slow - one Google round trip per site (up to 5 minutes). Returns per-site results; 404 if no sites are set up. Account Manager or project:write only.",
  },
  "PUT /api/projects/[id]/brand": {
    summary:
      "Save a project's brand kit / strategy content: brand brief, overview, digital objectives, brand manifestation themes and brand guidelines (colours, fonts, logo notes, UI/UX). Only the sections sent are changed.",
    body: "{ brief?: markdown string, overview?: string, objectives?: [{ id, platform: Instagram|Meta|LinkedIn|YouTube|Website|Other, metric, current, target, deadline }], manifestation?: { AWARENESS|DEMAND|THOUGHT|COMMUNITY: { social, website } }, guidelines?: { colors: [{ name, hex }], fonts, logoNotes, uiux } }",
    keywords: ["update brand guidelines", "save brand brief", "edit brand colours"],
    notes:
      "Each section sent replaces that whole section - read GET first and send the full section. Shapes are not validated. Account Manager or project:write only.",
  },
  "PUT /api/projects/[id]/seo/[propertyId]": {
    summary:
      "Edit a tracked SEO site's settings: label, domain, Search Console property, GA4 property, money keywords, money pages, competitors, click/position targets, active or primary. [propertyId] from GET /api/projects/[id]/seo.",
    body: "{ label: string (required), domain: string (required), siteUrl?: Search Console property, gaPropertyId?: string, moneyKeywords?: string[], moneyPages?: URL[], competitors?: domain[], targetClicks?: int, targetPosition?: 1-100, isActive?: boolean, isPrimary?: boolean }",
    keywords: ["edit seo site", "set money keywords", "add seo competitors", "seo targets"],
    notes:
      "label and domain are required every time. siteUrl, gaPropertyId, targetClicks and targetPosition are CLEARED if omitted; the lists are kept if omitted. Account Manager or project:write only.",
  },
}
