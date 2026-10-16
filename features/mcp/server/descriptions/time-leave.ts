import type { DescriptionMap } from "./types"

// Time & leave: attendance (punches, devices, holidays, floating holidays), leave and WFH.
// See ./types.ts for the format.
export const TIME_LEAVE: DescriptionMap = {
  "DELETE /api/attendance/[id]": {
    summary:
      "Delete one attendance log (a single employee-day). Only rows HR created or corrected by hand (isManual) can be deleted; device-synced rows cannot. Needs attendance:write. id = attendance log id from GET /api/attendance.",
    keywords: ["delete attendance entry", "remove manual attendance", "undo attendance correction"],
    notes: "Irreversible. Confirm with the user first.",
  },
  "DELETE /api/attendance/devices/[id]": {
    summary:
      "Remove a biometric attendance device (Hikvision punch machine) from DNMS. Needs attendance:write. id from GET /api/attendance/devices.",
    keywords: ["remove biometric device", "delete punch machine", "delete attendance device"],
    notes: "Irreversible; punches already synced stay. Confirm with the user first.",
  },
  "DELETE /api/attendance/floating-holidays": {
    summary:
      "Withdraw your OWN floating (optional) holiday request for a given holiday. Works on your own requests only, whatever their status.",
    query:
      "holidayId (required): the HOLIDAY's id (optionalHolidays[].id / selections[].holidayId from GET /api/attendance/floating-holidays), NOT the request id",
    keywords: ["withdraw floating holiday", "cancel optional holiday", "remove floating holiday"],
    notes:
      "Deletes the request row outright - even an already APPROVED one, which frees that allowance. Confirm first.",
  },
  "DELETE /api/attendance/holidays/[id]": {
    summary:
      "Delete a company holiday (fixed or floating/optional) from the holiday calendar. Needs holiday:write. id from GET /api/attendance/holidays.",
    keywords: ["delete holiday", "remove public holiday", "remove from holiday calendar"],
    notes:
      "Irreversible. Also deletes every employee's floating-holiday request for that holiday. Confirm first.",
  },
  "DELETE /api/leave/types/[id]": {
    summary:
      "Deactivate a leave type (default) so nobody can apply for it, or permanently delete it with ?permanent=1. Needs leave:policy; permanent delete also needs the HR Manager or Admin role. id from GET /api/leave/types.",
    query:
      "permanent: 1 = hard delete (otherwise it is only deactivated, reversible via PATCH isActive:true)",
    keywords: ["deactivate leave type", "delete leave type", "remove leave category"],
    notes:
      "permanent=1 is irreversible and ALSO deletes every leave request, balance and policy cell of that type. Always confirm; prefer deactivate.",
  },
  "GET /api/attendance": {
    summary:
      "List attendance logs (one row per employee per day: check-in, check-out, work hours, status) for everyone, newest first. HR/admin view - needs attendance:write. For your own attendance use GET /api/attendance/me.",
    query:
      "employeeId; status: PRESENT|ABSENT|HALF_DAY|LATE|ON_LEAVE|HOLIDAY|WEEKEND; dateFrom, dateTo: YYYY-MM-DD; page, limit (default 20, max 100)",
    keywords: [
      "attendance logs",
      "punch records",
      "check in check out",
      "employee attendance history",
      "biometric logs",
    ],
  },
  "GET /api/attendance/[id]": {
    summary:
      "Get one attendance log (one employee-day) with the employee and department. Your own log, or anyone's with attendance:write. id = attendance log id from GET /api/attendance or GET /api/attendance/me.",
    keywords: ["attendance record", "attendance entry details"],
  },
  "GET /api/attendance/devices": {
    summary:
      "List the biometric attendance devices (Hikvision punch machines): name, serial, IP, port, location, active flag, last sync and last push time. Passwords are never returned (hasPassword only). Needs attendance:write.",
    keywords: ["biometric devices", "punch machines", "attendance machines", "hikvision"],
  },
  "GET /api/attendance/devices/[id]": {
    summary:
      "Get one biometric attendance device's settings and last sync/push time (password redacted). Needs attendance:write. id from GET /api/attendance/devices.",
    keywords: ["biometric device details", "punch machine settings"],
  },
  "GET /api/attendance/devices/[id]/events": {
    summary:
      "Read raw punch events straight from a biometric device for the last N days, each matched to an employee by employee code; lists unmatched codes. Diagnostic tool - does not save anything. Needs attendance:write.",
    query:
      "days: how many days back (default 7); major: 0 = all event types (default), 5 = access-control punches only",
    keywords: ["raw punches", "device events", "unmatched employee codes", "debug biometric"],
    notes:
      "The DNMS server must be able to reach the device on the office network; otherwise deviceError is set and no events come back.",
  },
  "GET /api/attendance/directory": {
    summary:
      "Company attendance roster: every active employee's attendance for one day (check-in/out, hours, status PRESENT|HALF_DAY|MISSING_PUNCH|ABSENT) or for a date range (present/half/missing/absent day counts, average hours), plus totals. Needs attendance:write.",
    query: "from, to: YYYY-MM-DD (default today; to defaults to from; max 92 days)",
    keywords: [
      "who came in today",
      "who is absent today",
      "attendance report",
      "office attendance",
      "attendance roster",
    ],
  },
  "GET /api/attendance/directory/[employeeId]/calendar": {
    summary:
      "Month calendar of one employee's attendance, one status per day: PRESENT, HALF_DAY, MISSING_PUNCH, LEAVE, WFH, HOLIDAY (incl. birthday/floating), WEEKEND, UPCOMING or NONE (no record), with punch times. Needs attendance:write. employeeId from GET /api/employees.",
    query: "month: YYYY-MM (default current month)",
    keywords: ["employee attendance calendar", "monthly attendance of employee", "missing punches"],
  },
  "GET /api/attendance/employees/summary": {
    summary:
      "Every active employee with their device code (employeeNo/deviceId, hasCode), total attendance days logged, present days, half days and last punch date. Used to find who is not syncing from the biometric device. Needs attendance:write.",
    keywords: ["attendance sync status", "employees without device code", "last punch date"],
  },
  "GET /api/attendance/export": {
    summary:
      "Download attendance logs as a CSV (employee no, name, department, date, check in/out, hours, status, source). Needs attendance:write.",
    query:
      "dateFrom, dateTo: YYYY-MM-DD (both required, max 366 days); employeeId; status: PRESENT|ABSENT|HALF_DAY|LATE|ON_LEAVE|HOLIDAY|WEEKEND",
    keywords: ["export attendance", "attendance csv", "download attendance", "attendance excel"],
    notes: "Returns a file - use dnms_download.",
  },
  "GET /api/attendance/floating-holidays": {
    summary:
      "Your floating (optional) holidays for a year: the optional holidays on offer, your requests and their status, the yearly limit (3) and how many you have left, and whether you approve others' requests.",
    query: "year: e.g. 2026 (default current year)",
    keywords: [
      "optional holidays",
      "floating holiday balance",
      "my floating holidays",
      "restricted holiday",
    ],
  },
  "GET /api/attendance/floating-holidays/requests": {
    summary:
      "Floating (optional) holiday requests waiting for review. HR Manager/Admin see everyone's; anyone else sees only their direct reports' requests (empty if they manage nobody). id of each row is used to approve/reject.",
    query: "status: PENDING|APPROVED|REJECTED|CANCELLED; page, limit (default 10, max 100)",
    keywords: [
      "floating holiday approvals",
      "optional holiday requests",
      "pending floating holidays",
    ],
  },
  "GET /api/attendance/holidays": {
    summary:
      "The company holiday calendar: public/fixed holidays and floating (optional) ones (isOptional=true). Any employee.",
    query: "year: e.g. 2026 (omit for all years)",
    keywords: [
      "holiday list",
      "public holidays",
      "holiday calendar",
      "festival holidays",
      "office closed days",
    ],
  },
  "GET /api/attendance/me": {
    summary:
      "Your own attendance logs (check-in, check-out, work hours, status) for the last N days, newest first.",
    query:
      "days: 1-365 (default 30); status: PRESENT|ABSENT|HALF_DAY|LATE|ON_LEAVE|HOLIDAY|WEEKEND; page, limit (default 30, max 100)",
    keywords: ["my attendance", "my punch in time", "my check in", "my working hours"],
  },
  "GET /api/attendance/me/calendar": {
    summary:
      "Your own attendance for a month, one status per day: PRESENT, HALF_DAY, MISSING_PUNCH (forgot to punch in/out), LEAVE, WFH, HOLIDAY (incl. birthday/floating), WEEKEND, UPCOMING or NONE. Includes punch times and hours.",
    query: "month: YYYY-MM (default current month)",
    keywords: ["my attendance calendar", "my missing punches", "my monthly attendance"],
  },
  "GET /api/attendance/summary": {
    summary:
      "One employee's attendance totals for a month: present, absent, late (late marks), half-day, on-leave, holiday and weekend day counts, total and average hours. Counts stored log rows only. Needs attendance:write.",
    query:
      "employeeId (required, from GET /api/employees); month: 1-12 (required); year: e.g. 2026 (required)",
    keywords: [
      "monthly attendance summary",
      "late marks",
      "days present",
      "attendance totals",
      "working hours total",
    ],
  },
  "GET /api/leave/apply/preview": {
    summary:
      "Before applying for leave: shows who your leave email will go to (your manager, else HR), the HR inbox that is cc'd, whether your leave would be auto-approved, and your email signature. Read-only.",
    keywords: ["leave approver", "who approves my leave", "leave email recipient"],
  },
  "GET /api/leave/balances": {
    summary:
      "Leave balance per leave type for a year: allocated, accrued, used, pending, carried. Available = accrued + carried - used - pending. Your own by default; another employee's needs leave:approve.",
    query: "employeeId (default you; from GET /api/employees); year: e.g. 2026 (default current)",
    keywords: [
      "leave balance",
      "how many leaves left",
      "remaining leave",
      "casual leave balance",
      "earned leave balance",
    ],
  },
  "GET /api/leave/balances/directory": {
    summary:
      "Every active employee's leave balances for a year (allocated, accrued, used, pending, carried per leave type). HR view - needs leave:approve.",
    query: "year: e.g. 2026 (default current)",
    keywords: ["all leave balances", "company leave balances", "leave balance report"],
  },
  "GET /api/leave/day-status": {
    summary:
      "Which days one or more colleagues are away in a date range: leave, half-day, holiday (incl. approved floating) or birthday. Any employee may ask about anyone; the leave type is never revealed. WFH is not counted as away.",
    query:
      "from, to: YYYY-MM-DD (both required); employeeId (default you) OR employeeIds: comma-separated ids (max 100, result keyed by id)",
    keywords: ["is he on leave", "who is off", "away days", "availability", "out of office"],
  },
  "GET /api/leave/decision/preview": {
    summary:
      "The email signature (your name, designation, contact, company links) that will be appended to a leave approval/rejection email you send. Read-only helper for the decision letter.",
    query: "requestId: leave request id (optional; used only if you have no employee record)",
    keywords: ["leave decision signature", "approval email signature"],
  },
  "GET /api/leave/my-team": {
    summary:
      "Leave requests of your direct reports (by reporting line, no permission needed). viewerRole FINAL on a row means you can approve/reject it. Returns { requests, isManager, pagination }; isManager false if you manage nobody.",
    query: "status: PENDING|APPROVED|REJECTED|CANCELLED; page, limit (default 10, max 100)",
    keywords: [
      "team leave requests",
      "my reports leave",
      "pending leave approvals",
      "manager leave inbox",
    ],
  },
  "GET /api/leave/policies": {
    summary:
      "The leave policy matrix: active leave types and the days per year each employment type (FULL_TIME, PART_TIME, CONTRACT, INTERN) gets. Needs leave:policy.",
    keywords: ["leave policy", "leave entitlement", "leave days per year", "leave matrix"],
  },
  "GET /api/leave/requests": {
    summary:
      "List leave requests, newest first. Ordinary employees get only their own. With leave:approve you see everyone's and can filter by employee and dates. viewerRole FINAL marks requests you can decide.",
    query:
      "status: PENDING|APPROVED|REJECTED|CANCELLED; leaveTypeId; employeeId, from, to (YYYY-MM-DD, matched on start date) - leave:approve only; page, limit (default 20, max 100)",
    keywords: ["my leave requests", "leave history", "leave applications", "all leave requests"],
  },
  "GET /api/leave/team": {
    summary:
      "Your leave approval queue: requests routed to you, your direct reports' requests, and the HR queue (HR roles) or Admin queue (Admins). Excludes your own. Needs leave:approve.",
    query: "status: PENDING|APPROVED|REJECTED|CANCELLED; page, limit (default 20, max 100)",
    keywords: [
      "leave approval queue",
      "pending leave approvals",
      "leave inbox",
      "approve leave list",
    ],
  },
  "GET /api/leave/types": {
    summary:
      "All active leave types (Casual CL, Sick SL, Earned EL, Personal PL, Leave Without Pay LWP, Maternity ML, ...) with paid flag, max days per year and carry-forward settings. Any employee.",
    keywords: ["leave types", "kinds of leave", "leave categories"],
  },
  "GET /api/leave/types/eligible": {
    summary:
      "The leave types YOU can apply for right now: paid types you have an allocation for this year, plus unpaid ones (LWP). Use its ids as leaveTypeId when applying.",
    keywords: ["which leave can I take", "eligible leave types", "available leave types"],
  },
  "GET /api/wfh/apply/preview": {
    summary:
      "Before applying for work from home: shows who the WFH email will go to (your manager, else HR/Admin), the HR inbox cc'd, and your email signature. Read-only.",
    keywords: ["wfh approver", "who approves my wfh", "work from home email recipient"],
  },
  "GET /api/wfh/eligibility": {
    summary:
      "Your work-from-home eligibility: tier (1 = on probation, 2 = within 6 months after probation - emergency WFH only; 3 = 1 ordinary WFH day per month), days used this month, max days per request (14) and when you become fully eligible.",
    keywords: ["wfh eligibility", "can I work from home", "wfh quota", "wfh days left"],
  },
  "GET /api/wfh/my-team": {
    summary:
      "WFH request inbox. scope=team: your direct reports' requests (empty if you manage nobody). scope=all: every employee's requests, for HR Manager/Admin or wfh:approve holders. Returns { requests, isApprover, pagination }.",
    query:
      "scope: team|all (default team); status: PENDING|APPROVED|REJECTED|CANCELLED; page, limit (default 10, max 100)",
    keywords: ["team wfh requests", "pending wfh approvals", "work from home requests of my team"],
  },
  "GET /api/wfh/requests": {
    summary:
      "List work-from-home requests, newest first. Ordinary employees get only their own; with wfh:approve you see everyone's and can filter by employee and dates.",
    query:
      "status: PENDING|APPROVED|REJECTED|CANCELLED; employeeId, from, to (YYYY-MM-DD, overlapping the range) - wfh:approve only; page, limit (default 20, max 100)",
    keywords: ["my wfh requests", "work from home history", "wfh list", "remote work requests"],
  },
  "PATCH /api/attendance/[id]": {
    summary:
      "Correct one attendance log (regularise a missed punch or wrong status). Only the fields sent change and they are pinned so the device sync will not overwrite them. Needs attendance:write. id from GET /api/attendance.",
    body: "{ checkIn?: ISO datetime with offset e.g. 2026-10-14T09:30:00+05:30 (null clears), checkOut?: same, status?: PRESENT|ABSENT|HALF_DAY|LATE|ON_LEAVE|HOLIDAY|WEEKEND, onDuty?: boolean (true = out of office on official work: stored as PRESENT, shown as 'Out of office'; false = back to an ordinary day), notes?: string (for on duty: the purpose / where) }",
    keywords: [
      "regularize attendance",
      "fix missing punch",
      "correct check in time",
      "edit attendance",
      "mark present",
    ],
    notes:
      "Work hours are recomputed; if times change without a status, status is re-derived from hours (<4h ABSENT, <8h HALF_DAY).",
  },
  "PATCH /api/attendance/devices/[id]": {
    summary:
      "Update a biometric attendance device's settings or turn it on/off. Needs attendance:write. id from GET /api/attendance/devices.",
    body: "{ name?, deviceSerial? (unique), ipAddress?, port?: number, username?, password?: device admin password, location?, isActive?: boolean }",
    keywords: ["edit biometric device", "change device ip", "disable punch machine"],
  },
  "PATCH /api/attendance/floating-holidays/requests/[id]": {
    summary:
      "Approve or reject a floating (optional) holiday request. HR Manager/Admin decide finally (max 3 approved per year); the employee's manager's decision is only advisory and leaves it PENDING for HR. Nobody can review their own. id from GET /api/attendance/floating-holidays/requests.",
    body: "{ action: APPROVE|REJECT (required), rejectionReason?: string (required for REJECT) }",
    keywords: ["approve floating holiday", "reject optional holiday", "floating holiday decision"],
    notes: "Notifies the employee in-app.",
  },
  "PATCH /api/attendance/holidays/[id]": {
    summary:
      "Edit a company holiday: rename, move the date, change description, or switch it between fixed and floating/optional. Needs holiday:write. id from GET /api/attendance/holidays.",
    body: "{ name?: string, date?: YYYY-MM-DD, description?: string|null, isOptional?: boolean (true = floating holiday) }",
    keywords: ["edit holiday", "change holiday date", "make holiday optional"],
  },
  "PATCH /api/leave/requests/[id]": {
    summary:
      "Approve, reject or cancel a PENDING leave request. The applicant's manager can decide; HR Manager/HR Employee decide ordinary employees' leave; Admins decide anything (incl. HR's own). An employee can only cancel their own. id from GET /api/leave/requests or /api/leave/team.",
    body: "{ action: APPROVE|REJECT|CANCEL (required), rejectionReason?: string (required for REJECT), emailBody?: custom letter text for the decision email }",
    keywords: ["approve leave", "reject leave", "cancel leave", "leave decision", "withdraw leave"],
    notes:
      "First decision is final and updates the leave balance. Approve/reject emails the employee from the decider's mailbox (cc HR, manager) and notifies them. Cannot be undone.",
  },
  "PATCH /api/leave/types/[id]": {
    summary:
      "Edit a leave type's settings or reactivate it. Needs leave:policy. id from GET /api/leave/types.",
    body: "{ name?, code? (uppercased), description?, isPaid?: boolean, maxDaysPerYear?: number, carryForward?: boolean, maxCarryDays?: number, requiresApproval?: boolean, isActive?: boolean }",
    keywords: ["edit leave type", "change leave days", "reactivate leave type"],
    notes:
      "Built-in leave rules are keyed on codes CL, SL, EL, LWP, ML, SHORT - changing those codes switches the rules off. requiresApproval is stored but not enforced.",
  },
  "PATCH /api/wfh/requests/[id]": {
    summary:
      "Approve, reject or cancel a PENDING work-from-home request. HR Manager/Admin or wfh:approve holders decide anyone's; the employee's manager decides their reports'; an employee can only cancel their own. First decision is final. id from GET /api/wfh/requests or /api/wfh/my-team.",
    body: "{ action: APPROVE|REJECT|CANCEL (required), rejectionReason?: string (required for REJECT) }",
    keywords: ["approve wfh", "reject work from home", "cancel wfh", "wfh decision"],
    notes: "Approve/reject notifies and emails the employee. Cannot be undone.",
  },
  "POST /api/attendance": {
    summary:
      "Add or overwrite an employee's attendance for one day by hand (manual entry). Upserts on employee + date. Needs attendance:write. For changing one field of an existing day use PATCH /api/attendance/[id].",
    body: "{ employeeId (required), date: YYYY-MM-DD (required), checkIn?: ISO datetime with offset e.g. 2026-10-14T09:30:00+05:30, checkOut?: same, status?: PRESENT|ABSENT|HALF_DAY|LATE|ON_LEAVE|HOLIDAY|WEEKEND, onDuty?: boolean (true = out of office on official work: a present day shown as 'Out of office', times optional), notes?: string (for on duty: the purpose / where) }",
    keywords: [
      "add attendance",
      "manual attendance",
      "mark attendance",
      "mark present",
      "enter punch",
      "out of office",
      "on duty",
      "official duty",
      "out of office for work",
    ],
    notes:
      "If a row exists for that day it is fully replaced - omitted checkIn/checkOut/notes become empty. Without status it is derived from hours worked.",
  },
  "POST /api/attendance/devices": {
    summary:
      "Register a new biometric attendance device (Hikvision punch machine) so its punches can be synced. Needs attendance:write.",
    body: "{ name (required), deviceSerial (required, unique), ipAddress (required), password (required, device admin password), port?: number (default 8000), username?: string (default admin), location?: string }",
    keywords: ["add biometric device", "add punch machine", "new attendance device"],
  },
  "POST /api/attendance/devices/[id]/sync": {
    summary:
      "Pull punches from one biometric device into attendance logs (all employees, or one). Needs attendance:write. id from GET /api/attendance/devices.",
    query:
      "employeeNo: sync only this employee code; full: 1 = full re-backfill instead of incremental",
    keywords: ["sync biometric device", "pull punches", "import attendance from device"],
    notes:
      "Only works when the DNMS server can reach the device on the office network (502 otherwise). Can take a while.",
  },
  "POST /api/attendance/devices/[id]/test": {
    summary:
      "Test the connection to a biometric attendance device; if it has moved to a new IP on the network, the stored address is updated. Needs attendance:write.",
    keywords: ["test biometric device", "device connection", "is punch machine online"],
    notes: "Needs the DNMS server to be on the device's network.",
  },
  "POST /api/attendance/floating-holidays": {
    summary:
      "Apply for a floating (optional) holiday for yourself. Only optional holidays, only on or before the date, max 3 approved per year. Re-applying after a rejection reopens the request.",
    body: "{ holidayId (required): an optional holiday's id from GET /api/attendance/floating-holidays (optionalHolidays[].id), reason?: string }",
    keywords: ["apply floating holiday", "take optional holiday", "request restricted holiday"],
    notes: "Notifies your approvers and emails the request letter.",
  },
  "POST /api/attendance/holidays": {
    summary:
      "Add a holiday to the company holiday calendar - a fixed public holiday, or a floating/optional one employees can apply for. Needs holiday:write.",
    body: "{ name (required), date: YYYY-MM-DD (required), description?: string, isOptional?: boolean (default false; true = floating holiday) }",
    keywords: ["add holiday", "new public holiday", "add optional holiday", "declare holiday"],
  },
  "POST /api/attendance/sync": {
    summary:
      "Refresh attendance: pull the latest punches from every active biometric device into attendance logs. Any employee can trigger it (the Refresh button).",
    keywords: ["refresh attendance", "sync attendance", "update punches"],
    notes:
      "Only works when the DNMS server can reach the devices on the office network; returns 503 otherwise.",
  },
  "POST /api/leave/balances": {
    summary:
      "Set an employee's leave allocation (and carry-forward) for one leave type and year; accrued is recomputed. Needs leave:approve.",
    body: "{ employeeId (required), leaveTypeId (required), year: number (required), allocated: number (days; treated as 0 if omitted), carried?: number (treated as 0 if omitted) }",
    keywords: [
      "allocate leave",
      "adjust leave balance",
      "add leave days",
      "credit leave",
      "set carry forward",
    ],
    notes:
      "Overwrites both allocated and carried - send the current carried value to keep it. A later POST /api/leave/balances/resync recalculates from policy and can undo this.",
  },
  "POST /api/leave/balances/resync": {
    summary:
      "Recalculate every active employee's leave balances for a year from the leave policy matrix (allocation, accrual, probation, gender rules). Restricted to the HR Manager and Admin roles.",
    body: "{ year?: number (default current year) } - body optional",
    keywords: ["recalculate leave balances", "resync leave", "regenerate leave allocation"],
    notes:
      "Company-wide: overwrites allocated/accrued for everyone (wiping manual allocations) and removes balances for types an employee is not entitled to. Confirm first.",
  },
  "POST /api/leave/decision/polish": {
    summary:
      "AI helper: rewrites an approver's leave approval/decline letter in three tones (Warm, Neutral, Formal). Nothing is saved or sent.",
    body: "{ message: string (required, max 4000 chars), approved: boolean }",
    keywords: ["improve approval message", "rewrite leave reply"],
    notes: "Uses DNMS's own AI; you can usually just write the text yourself.",
  },
  "POST /api/leave/polish-reason": {
    summary:
      "AI helper: rewrites the reason on a leave or WFH request into three versions (Concise, Formal, Detailed) without adding facts. Nothing is saved or sent.",
    body: "{ reason: string (required, max 1000 chars), kind?: leave|wfh (default leave), leaveType?: leave type name, days?: number }",
    keywords: ["improve leave reason", "rewrite wfh reason"],
    notes: "Uses DNMS's own AI; you can usually just write the text yourself.",
  },
  "POST /api/leave/requests": {
    summary:
      "Apply for leave for yourself. Checks balance, probation, notice-period and company rules (EL: 60 days notice, 3-7 days, 7 per half-year; CL: 2 days notice, max 2/month; no overlap; CL/SL not next to EL). Days are calendar days incl. weekends (sandwich rule).",
    body: "{ leaveTypeId (required, from GET /api/leave/types/eligible), startDate: YYYY-MM-DD (required), endDate: YYYY-MM-DD (required), reason?: string, isHalfDay?: boolean (single day only), emailSubject?: string, emailBody?: string (custom letter text) }",
    keywords: [
      "apply leave",
      "request leave",
      "take day off",
      "sick leave",
      "casual leave",
      "half day leave",
    ],
    notes:
      "Emails your manager (sent from your mailbox, cc HR) and notifies approvers; see GET /api/leave/apply/preview for recipients. Holds the days as pending on your balance.",
  },
  "POST /api/leave/types": {
    summary: "Create a new leave type. Needs leave:policy.",
    body: "{ name (required), code (required, uppercased, unique), description?, isPaid?: boolean (default true), maxDaysPerYear?: number (default 0), carryForward?: boolean (default false), maxCarryDays?: number (default 0), requiresApproval?: boolean (default true) }",
    keywords: ["add leave type", "new leave category", "create leave type"],
    notes:
      "Accrual method cannot be set here (defaults to upfront). Set per-employment-type days with PUT /api/leave/policies, then resync balances.",
  },
  "POST /api/wfh/requests": {
    summary:
      "Apply for work from home for yourself, one day or a range (max 14 calendar days; weekends/holidays inside are skipped). Start and end must be working days, not past. Fully eligible staff get 1 ordinary WFH day a month; probationers need isEmergency.",
    body: "{ date: YYYY-MM-DD (required, first day), endDate?: YYYY-MM-DD (default = date), reason?: string, isEmergency?: boolean, emailSubject?: string, emailBody?: string (custom letter text) }",
    keywords: ["apply wfh", "work from home request", "remote work", "emergency wfh"],
    notes:
      "Cannot overlap a leave or another WFH. Notifies your manager/HR and emails them from your mailbox. Check GET /api/wfh/eligibility first.",
  },
  "PUT /api/leave/policies": {
    summary:
      "Set how many days per year each employment type gets for each leave type (the leave policy matrix). Needs leave:policy.",
    body: "{ entries: [{ employmentType: FULL_TIME|PART_TIME|CONTRACT|INTERN, leaveTypeId, daysPerYear: number|null (null or negative clears the cell, falling back to the type's maxDaysPerYear) }] (required) }",
    keywords: ["edit leave policy", "change leave entitlement", "leave days per employment type"],
    notes:
      "Only cells sent are changed. Existing balances are NOT updated - run POST /api/leave/balances/resync afterwards.",
  },
}
