# App issues found while writing the Help guides (2026-10-07)

While writing the in-app Help & Guides, the writers read every module's code and
the reviewers looked at every screenshot. These are the places where the app is
wrong, inconsistent, or says something its code doesn't do. The guides describe
what the code ACTUALLY does, so fixing any of these may need a matching guide
edit (`features/help/guides/...`).

Fixed during this work: Google Drive being used by companies other than the
founding one (`lib/google-drive.ts`), project team members always showing "No
designation" (`app/api/projects/[id]/teams/route.ts`), and public image folders
being redirected by the tenant proxy (`lib/tenant-url.ts`).

## Serious

1. **New chat leaks across companies.** Starting a new one-to-one chat from any
   company other than the founding one creates the conversation participants in
   the founding company (tenant). Removing that company does not clean them up.
2. **Payslip header is hard-coded.** `features/payroll/components/payslip-document.tsx`
   prints "BFG Market Consult Pvt Limited", its Pitam Pura address and a "BFG/"
   code prefix on every company's payslips. It should come from company settings.
3. **Email templates are never used.** Admin → Email Templates saves templates,
   but no sending code reads them (`renderTemplate` in `lib/mailer.ts` has no
   callers). Every DNMS email's wording is built into the code.
4. **Storage acts on the wrong bucket.** In Admin → Storage, inside a non-default
   bucket, View / Download / Delete / "Clean up orphans" act on the DEFAULT bucket
   (no account id reaches `/api/admin/storage/object`).
5. **Payroll may under-pay.** The generator (`app/api/payroll/records/route.ts`)
   doesn't count approved WFH days or the birthday day off as paid days.
6. **WFH approval rule mismatch.** The screen says Tier 1/2 and emergency requests
   need BOTH manager and HR approval; `updateWfhRequest` makes the first decision final.

## Wrong or misleading text in the app

- My Attendance day window says "Raise a regularization request" - no such feature exists.
- New Task dialog says the task "goes to your manager for approval" - tasks are created already approved.
- Resignation dialog says the account is deactivated once approved - access actually continues through the notice period.
- Announcement draft switch says "only you can see it" - everyone with announcement:write sees drafts.
- Generate Evaluations confirm says "every active employee" - only people with a KPI profile get one.
- Leave type "Max Days to Carry Forward" says "0 for unlimited" - 0 carries nothing over.
- Stock search placeholder says it searches items - it only matches holder and employee names.
- Analytics "Last Payroll Net" sums last month's payroll but labels it with the current month.
- Insights empty state points to an "Integration tab" that no longer exists (it's the Connections dialog).
- Role change notification says to sign out for it to apply - it applies within ~15 minutes anyway.
- Delete-role confirmation says holders "lose its permissions immediately" - a role anyone holds can't be deleted.
- Content calendar column-edge tooltip says "reset" - double-click fits the column to its text.
- Portal "Content plan" description says clients can finalise or send back work - that's staff-only in code.

## Permissions shown but refused (UI and API disagree)

- HR Employee sees "New Leave Type", but the API needs `leave:policy`.
- HR Employee sees WFH Approve/Reject, but the API only allows HR Manager, Admin or the person's own manager.
- Sidebar shows Careers and Referrals to `recruitment:read`, but `proxy.ts`'s `/admin` rule blocks HR Employee from `/admin/careers` and `/admin/referrals`.
- Holidays add/edit and Floating Requests are gated by `attendance:write`, not `holiday:write`.
- Deliverables: team members see edit/delete on unassigned items; the server (`canEditDeliverable`) refuses.
- Insights "Sync now" and "Explain with AI" show for everyone; both APIs are manager-only.
- Monitoring and Mailer hard-code `canManage` to true, so any project member can change the mailer's SMTP settings.
- Content calendar: a calendar manager who isn't a project manager sees "See the plan" but can still edit it.
- Integrations and Storage stay in the sidebar for other companies' admins, but the pages never load for them (platform-only).

## Behaviour gaps

- Leave type "Requires Approval" switch is saved but never read when applying.
- HR's "Allow editing past tasks" isn't read by the task sheet's edit checks.
- Late arrivals aren't marked on the attendance calendar (late detection is switched off).
- Employees can see Draft and Processing payslips (`/api/payroll/me` doesn't filter by status).
- Earned Leave starts at probation + 6 months in code; comments say at probation end.
- "Upload a sheet instead" on Calendars creates a calendar with no month ("Not monthly").
- Brand files are deleted immediately, with no confirmation.
- The evaluation-autocreate cron creates batches for ALL active employees, with no KPI-profile filter (unlike Generate).
- HR opening a "Self done" evaluation sees a live "0 / 100" score with the lowest band before rating.
- A runtime error ("1 Issue" in the Next dev overlay) appears in My Tasks → Card view; cause not found.

## Accessibility

- Login form: the Password input isn't tied to its label (no id), so screen readers and label lookups miss it.
- DataTable puts `role="button"` on clickable `<tr>` rows, hiding the row/cell structure.
- Icon-only buttons without labels: objective/colour bins (Brand), the SEO site bin, project Passwords pencil/bin.

## Unlinked pages

`/admin/permissions` (Permission Matrix), `/documents/employee/[id]`, `/attendance/floating-holidays`,
and the old `/recruitment` + `/recruitment/jobs/[id]` job board are reachable by URL but not linked anywhere.
