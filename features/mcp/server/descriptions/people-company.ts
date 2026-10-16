import type { DescriptionMap } from "./types"

// Filled in by the endpoint-description pass. See ./types.ts for the format.
export const PEOPLE_COMPANY: DescriptionMap = {
  "DELETE /api/announcements/[id]": {
    summary:
      "Permanently delete a company announcement from the noticeboard. Needs announcement:write. id is the announcement id from GET /api/announcements.",
    keywords: ["remove announcement", "delete notice", "noticeboard post"],
    notes: "Irreversible. To hide it without deleting, PATCH it with isPublished: false instead.",
  },
  "DELETE /api/departments/[id]": {
    summary:
      "Deactivate a department (and all its sub-departments), or permanently delete it with ?permanent=true. Needs employee:write. id from GET /api/departments.",
    query:
      "permanent: true = hard delete (only allowed when no employees, job postings or sub-departments reference it); omitted = soft-deactivate",
    keywords: ["remove department", "deactivate department", "close team"],
    notes:
      "Soft delete leaves employees assigned to it. permanent=true cannot be undone. Reactivate a soft-deleted one with PATCH { isActive: true }.",
  },
  "DELETE /api/designations/[id]": {
    summary:
      "Deactivate a designation (job title such as 'Senior Executive'), or permanently delete it with ?permanent=true. Needs employee:write. id from GET /api/designations.",
    query:
      "permanent: true = hard delete (only when no employee has this designation); omitted = soft-deactivate",
    keywords: ["remove designation", "delete job title", "deactivate title"],
    notes:
      "permanent=true cannot be undone. Reactivate a soft-deleted one with PATCH { isActive: true }.",
  },
  "DELETE /api/employees/[id]": {
    summary:
      "Permanently delete an employee record. Needs employee:delete. The employee must already be deactivated (POST /api/employees/[id]/deactivate) and you cannot delete yourself. id is the employee id from GET /api/employees.",
    keywords: ["hard delete employee", "remove employee permanently", "purge employee"],
    notes:
      "IRREVERSIBLE - wipes the person's record. Prefer deactivation; only do this on explicit confirmation.",
  },
  "DELETE /api/employees/[id]/documents/[docId]": {
    summary:
      "Delete one document from an employee's personal file (ID proof, certificate, offer letter...). Needs document:delete. id = employee id, docId from GET /api/employees/[id]/documents.",
    keywords: ["delete employee document", "remove ID proof", "delete certificate"],
    notes: "Irreversible - the stored file is deleted too.",
  },
  "DELETE /api/employees/[id]/photo": {
    summary:
      "Remove an employee's profile photo or preset avatar, so they show initials again. Anyone can remove their own; removing someone else's needs employee:write. id = employee id (use your own id from whoami for yourself).",
    keywords: ["remove profile picture", "delete avatar", "clear photo"],
    notes: "An uploaded photo file is deleted from storage.",
  },
  "DELETE /api/gallery/albums/[albumId]": {
    summary:
      "Delete a company photo-gallery album together with every photo and video in it. Needs gallery:write. albumId = album id or slug from GET /api/gallery/albums.",
    keywords: ["delete album", "remove event photos", "gallery"],
    notes: "Irreversible - all files in the album are deleted from storage.",
  },
  "DELETE /api/gallery/photos/[photoId]": {
    summary:
      "Delete one photo or video from the company gallery. Anyone can delete their own uploads; deleting someone else's needs gallery:write. photoId from GET /api/gallery/albums/[albumId].",
    keywords: ["delete photo", "remove gallery picture", "delete video"],
    notes: "Irreversible - the file is deleted from storage.",
  },
  "DELETE /api/job-roles/[id]": {
    summary:
      "Deactivate a job role (a department-specific role like 'SEO Executive'), or permanently delete it with ?permanent=true. Needs employee:write. id from GET /api/job-roles. Not the same as an access role (/api/roles).",
    query:
      "permanent: true = hard delete (only when no employee has this job role); omitted = soft-deactivate",
    keywords: ["remove job role", "deactivate job role", "delete position"],
    notes:
      "permanent=true cannot be undone. Reactivate a soft-deleted one with PATCH { isActive: true }.",
  },
  "DELETE /api/notifications/inbox": {
    summary:
      "Delete your own in-app notifications: one by id, or all of them. Only ever touches the signed-in person's own notifications.",
    query:
      "id: notification id from GET /api/notifications/inbox; OR all: true to delete every notification (one of the two is required)",
    keywords: ["clear notifications", "delete notification", "empty inbox"],
    notes: "Irreversible. all=true wipes the whole inbox - confirm first.",
  },
  "DELETE /api/roles/[id]": {
    summary:
      "Delete a custom access role (a permission set such as 'Team Lead'). Needs role:write. Built-in system roles cannot be deleted, and the role must have no employees assigned. id from GET /api/roles.",
    keywords: ["delete role", "remove access role", "delete permission set"],
    notes: "Irreversible. Unassign everyone first via PUT /api/employees/[id]/roles.",
  },
  "GET /api/analytics": {
    summary:
      "Company-wide executive analytics: headcount (total, active, new this month vs last), headcount by department, pending/approved leave, attendance status counts this month, last month's payroll totals, open jobs and applicants by stage, active projects, tasks completed, 6-month hiring trend. Needs analytics:read.",
    keywords: [
      "company analytics",
      "HR metrics",
      "headcount report",
      "executive dashboard",
      "KPIs",
    ],
    notes:
      "payroll covers the PREVIOUS month even though payroll.periodLabel shows the current month name. Figures can be up to a minute old.",
  },
  "GET /api/announcements": {
    summary:
      "List company announcements on the noticeboard (highest priority first, then newest), plus category list and stats. Every employee sees published, unexpired ones; holders of announcement:write also see drafts and expired ones.",
    query:
      "category: exact category text (e.g. Information, Holiday Notification, Policy Update, Event, Celebration, IT / System); month: 1-12 and year: YYYY (both needed to filter by publish month); limit: default 100, max 200",
    keywords: ["noticeboard", "company news", "notices", "circulars", "announcements"],
  },
  "GET /api/audit-log": {
    summary:
      "Search the audit trail of who changed what in DNMS (newest first), with the actor's name and the before/after changes. Needs audit:read.",
    query:
      "module: exact module name (e.g. employee, role, document, company, leave); actorId: employee id of the person who acted; action: partial text match (e.g. UPDATE, DEACTIVATE, role:update); dateFrom, dateTo: YYYY-MM-DD (inclusive); page, limit (default 20, max 100)",
    keywords: ["audit trail", "activity log", "who changed", "history of changes", "change log"],
  },
  "GET /api/birthdays": {
    summary:
      "Upcoming colleague birthdays (today first, with 'inDays'), or every birthday in a given year for the birthday calendar. Open to every employee; shows day and month only, never the birth year.",
    query:
      "days: look-ahead window in days (default 30); year: YYYY to instead get all birthdays that year as YYYY-MM-DD dates",
    keywords: [
      "birthdays",
      "whose birthday",
      "birthday calendar",
      "upcoming birthdays",
      "celebrations",
    ],
  },
  "GET /api/dashboard/me": {
    summary:
      "The signed-in person's own dashboard: this month's attendance summary, leave balances, latest payslip (net pay), pending leave/WFH request counts, next holidays, unread notification count, and task workload (due today, overdue, running, hours this week).",
    keywords: ["my dashboard", "my summary", "my overview", "my day", "home page"],
  },
  "GET /api/dashboard/stats": {
    summary:
      "Org-wide HR dashboard numbers: active headcount, joiners in the last 30 days, headcount by status and by department, total company documents, unread notifications across everyone, and the 5 most recent joiners. Needs dashboard:read.",
    keywords: ["HR dashboard", "headcount", "recent joiners", "company stats"],
  },
  "GET /api/departments": {
    summary:
      "List departments with their parent (sub-departments), department head, and active employee count. Open to every employee. Use it to get departmentId values.",
    query: "includeInactive: true to include deactivated departments",
    keywords: ["departments", "teams", "department list", "department head", "sub-departments"],
  },
  "GET /api/departments/[id]": {
    summary:
      "One department's details: name, parent department, head (headId), active flag, careers-site settings and counts of employees, job postings and sub-departments. Needs employee:read. id from GET /api/departments.",
    keywords: ["department details", "department head"],
  },
  "GET /api/designations": {
    summary:
      "List designations (job titles in the company hierarchy, e.g. 'Executive', 'Manager') ordered by level 1-13, with employee counts. Open to every employee. Use it to get designationId values.",
    query: "includeInactive: true to include deactivated designations",
    keywords: ["designations", "job titles", "hierarchy levels", "grades", "positions"],
  },
  "GET /api/employees": {
    summary:
      "HR employee directory with full records (contact, personal details, department, designation, status, probation). Needs employee:read; people without it should use dnms_search_people, GET /api/employees/org-chart or GET /api/employees/[id]/card.",
    query:
      "search: partial name, work email or employee code; departmentId (includes its sub-departments); designationId; status: ACTIVE|INACTIVE (login enabled / deactivated) or ON_LEAVE|SUSPENDED|RESIGNED|TERMINATED; employmentType: FULL_TIME|PART_TIME|CONTRACT|INTERN (INTERN = the Intern Directory); excludeEmploymentType: same values, leaves that type out (the Employee Directory uses INTERN); page, limit (default 20, max 100)",
    keywords: [
      "employee list",
      "staff directory",
      "find employee",
      "all employees",
      "search staff",
    ],
  },
  "GET /api/employees/[id]": {
    summary:
      "One employee's full HR record: personal and contact details, addresses, emergency contact, department, designation, job role, reporting manager, access roles, probation, employment type, direct-report count. Your own record always; anyone else's needs employee:read.",
    keywords: [
      "employee profile",
      "employee details",
      "who is",
      "reporting manager of",
      "HR record",
    ],
    notes:
      "[id] accepts the employee id (UUID) or the profile slug '<employeeCode>-<first>-<last>' (e.g. 8-diwakar-jha). Other /api/employees/[id]/... endpoints need the UUID.",
  },
  "GET /api/employees/[id]/card": {
    summary:
      "A colleague's public card, open to every employee: name, employee code, photo, work email, phone, work location, joining date, birthday (day/month only), department, designation, job role and reporting manager. No personal or salary data.",
    keywords: ["colleague profile", "contact details", "who is", "work email of", "employee card"],
    notes: "[id] accepts the employee id or the profile slug '<employeeCode>-<first>-<last>'.",
  },
  "GET /api/employees/[id]/documents": {
    summary:
      "List the documents in one employee's personal file (title, category such as IDENTITY/ACADEMIC/EMPLOYMENT/TAX, file name, size, expiry). Your own always; anyone else's needs employee:read. id = employee id.",
    keywords: ["employee documents", "ID proof", "certificates", "my documents", "personal file"],
  },
  "GET /api/employees/[id]/documents/[docId]": {
    summary:
      "Get one employee document with a 1-hour download link. Same access as the list: own documents, or anyone's with employee:read. id = employee id, docId from GET /api/employees/[id]/documents.",
    query: "download: 1 to force the link to save the file with its original name",
    keywords: ["download employee document", "view ID proof", "get certificate"],
    notes: "Returns a file - use dnms_download.",
  },
  "GET /api/employees/[id]/photo": {
    summary:
      "An employee's uploaded profile photo (any signed-in employee can view). Returns 404 if they have no uploaded photo (preset avatars are plain public paths in profilePhoto). id = employee id.",
    keywords: ["profile picture", "employee photo", "avatar image"],
    notes: "Returns a file - use dnms_download.",
  },
  "GET /api/employees/[id]/task-access": {
    summary:
      "Whether an employee has 'edit past tasks' access, i.e. the 15-minute task edit window is lifted for tasks they raised, and who granted it when. Needs employee:write. id = employee id.",
    keywords: ["edit past tasks", "task edit window", "15 minute window", "task correction access"],
  },
  "GET /api/employees/check-email": {
    summary:
      "Check whether an email address is free to use for an employee (compared against every work and personal email). Needs employee:write. Returns { available: boolean }.",
    query:
      "email: the address to check (required); excludeId: employee id to ignore (the person being edited)",
    keywords: ["email available", "duplicate email", "email already used"],
  },
  "GET /api/employees/codes": {
    summary:
      "Every employee code (employeeNo) with name and id, sorted by code, so you can see which codes are taken and pick the next free one. Needs employee:write.",
    keywords: ["employee codes", "employee numbers", "next employee code", "employee ID numbers"],
  },
  "GET /api/employees/org-chart": {
    summary:
      "The company org chart: all active employees nested under their reporting manager (top-level people first), each with designation, department, access role and children. Open to every employee.",
    keywords: [
      "org chart",
      "organisation chart",
      "reporting structure",
      "hierarchy",
      "who reports to whom",
      "team tree",
    ],
    notes: "Can be large; use it to find someone's manager chain or direct reports.",
  },
  "GET /api/gallery/albums": {
    summary:
      "List company photo-gallery albums (events, celebrations) with photo/video counts, cover photo and overall stats. Open to every employee.",
    query: "search: partial album title",
    keywords: ["photo gallery", "event photos", "albums", "company pictures"],
  },
  "GET /api/gallery/albums/[albumId]": {
    summary:
      "One gallery album with all its photos and videos (id, caption, file name, type, size, uploader). Open to every employee. albumId = album id or slug from GET /api/gallery/albums.",
    keywords: ["album photos", "event pictures", "view album"],
    notes:
      "To open or download a photo, use GET /api/gallery/photos/[photoId]/file with dnms_download.",
  },
  "GET /api/gallery/photos/[photoId]/file": {
    summary:
      "The actual image or video file for a gallery photo. Open to every employee. photoId from GET /api/gallery/albums/[albumId].",
    query: "variant: thumb for a small preview; download: 1 to save with the original file name",
    keywords: ["download photo", "view gallery image", "get video"],
    notes: "Returns a file - use dnms_download.",
  },
  "GET /api/job-roles": {
    summary:
      "List job roles: department-specific roles like 'SEO Executive' or 'Video Editor', each with its department and employee count. Open to every employee. Different from access roles (/api/roles) and designations.",
    query:
      "departmentId: only that department's job roles; includeInactive: true to include deactivated ones",
    keywords: ["job roles", "positions", "role in department", "functional roles"],
  },
  "GET /api/notifications/inbox": {
    summary:
      "The signed-in person's own in-app notifications (bell icon), newest first, with read/unread state and a link to the related page.",
    query:
      "unread: true for unread only; page, limit (default 20, max 100). unread=true together with limit=1 returns just { unreadCount }",
    keywords: ["my notifications", "alerts", "unread notifications", "inbox", "bell"],
  },
  "GET /api/notifications/task-reminders": {
    summary:
      "The signed-in person's own task-reminder settings: the 'task time almost up' alerts sent while a task is in progress and nearing its estimated hours. Returns defaults (on, 15 min before, 1 reminder) if never saved.",
    keywords: ["task reminders", "reminder settings", "time almost up alert"],
  },
  "GET /api/notifications/templates": {
    summary:
      "List the stored HR email templates (slug, name, subject, HTML/text body, merge fields, active flag, trigger event). Needs email_template:read.",
    keywords: ["email templates", "mail templates", "notification templates"],
  },
  "GET /api/permissions": {
    summary:
      "Every permission that can be put in an access role, grouped by module. Each has an id (needed for role permissionIds), a scope like 'leave:approve' or 'employee:read', module, action and description. Needs role:read.",
    keywords: ["permissions list", "access rights", "permission scopes", "what can a role do"],
  },
  "GET /api/profile": {
    summary:
      "The signed-in person's own profile basics: employee code, name, work email, phone, current address, date of birth, photo, emergency contact, department, designation, status, joining date, and whether a Gmail App Password is saved.",
    keywords: ["my profile", "my details", "my info", "about me"],
  },
  "GET /api/roles": {
    summary:
      "List access roles (permission sets that control what someone can do in DNMS, e.g. Employee, Manager, HR Manager, Admin) with permission and member counts. Needs role:read. Use it to get roleIds. Not job titles - see /api/designations and /api/job-roles.",
    keywords: [
      "access roles",
      "user roles",
      "permission roles",
      "who can do what",
      "security roles",
    ],
  },
  "GET /api/roles/[id]": {
    summary:
      "One access role with its full list of permissions and how many employees hold it. Needs role:read. id from GET /api/roles.",
    keywords: ["role permissions", "what can this role do", "role details"],
  },
  "PATCH /api/announcements/[id]": {
    summary:
      "Edit a noticeboard announcement (text, category, priority, publish/unpublish, expiry). Needs announcement:write. id from GET /api/announcements.",
    body: "{ title: string 3-200 (required), body: string 3-20000 (required), category: string (required), priority?: LOW|NORMAL|HIGH, isPublished?: boolean, expiresAt?: YYYY-MM-DD or '' for none, notify?: boolean (default true: everyone is notified of the edit; false = quiet edit, e.g. a typo fix) }",
    keywords: ["edit announcement", "unpublish notice", "update noticeboard post"],
    notes:
      "This is a FULL replace: always resend title, body and category, plus the current priority, isPublished and expiresAt - omitted ones reset to NORMAL, published, and no expiry. SIDE EFFECT: publishing a draft notifies every active employee (in-app + push); editing a published one does too unless notify: false.",
  },
  "PATCH /api/departments/[id]": {
    summary:
      "Rename a department, move it under another department, set its department head, or (de)activate it. Needs employee:write. id from GET /api/departments.",
    body: "{ name?: string, parentId?: department id or null for top level, headId?: employee id of the department head or null to clear, isActive?: boolean, careersTone?: red|teal|null (careers-site colour), careersJobsLabel?: string|null (careers-site label) }",
    keywords: ["rename department", "department head", "move department", "reactivate department"],
    notes:
      "isActive:false also deactivates every sub-department; isActive:true reactivates its parent departments.",
  },
  "PATCH /api/designations/[id]": {
    summary:
      "Rename a designation (job title), change its hierarchy level, or (de)activate it. Needs employee:write. id from GET /api/designations.",
    body: "{ title?: string (unique), level?: integer 1-13, isActive?: boolean }",
    keywords: ["rename designation", "edit job title", "change level"],
  },
  "PATCH /api/employees/[id]": {
    summary:
      "HR edit of an employee record: name, employee code, emails, phone, personal details, department, designation, job role, reporting manager, employment type, joining date, probation, addresses, emergency contact. Needs employee:write. id = employee id.",
    body: "{ firstName?, lastName?, employeeNo?: unique code, email?: work email (also their login), personalEmail?, phone?, personalPhone?, dateOfBirth?: YYYY-MM-DD, gender?: MALE|FEMALE|OTHER|PREFER_NOT_TO_SAY, nationality?, bloodGroup?, departmentId?, designationId?, jobRoleId?: id or '' to clear, managerId?: reporting manager's employee id, employmentType?: FULL_TIME|PART_TIME|CONTRACT|INTERN, dateOfJoining?, probationEndDate?, onProbation?: boolean, probationMonths?: 0-6, workLocation?, deviceId?: biometric code, gmailAppPassword?: 16 chars, currentAddress?/permanentAddress?: { line1, line2, city, state, zip, country }, emergencyContact?: { name, relation, phone } }",
    keywords: [
      "change reporting manager",
      "transfer department",
      "update designation",
      "edit employee",
      "confirm probation",
      "promote",
    ],
    notes:
      "ALWAYS include the employee's current employmentType (read it first) - if omitted it silently resets to FULL_TIME. status, resignationDate, lastWorkingDate, dottedManagerId, roleId, password and mustChangePassword are accepted but ignored (use deactivate/bulk-terminate and PUT /api/employees/[id]/roles). Department/designation/manager can be changed but not cleared. onProbation:false confirms probation and recalculates leave. The employee gets an in-app notification.",
  },
  "PATCH /api/employees/[id]/task-access": {
    summary:
      "Grant or revoke an employee's 'edit past tasks' access, lifting the 15-minute edit window on tasks they raised so they can correct earlier days. Needs employee:write; you cannot change your own. id = employee id.",
    body: "{ enabled: boolean (required) }",
    keywords: ["allow editing old tasks", "lift task edit window", "past task access"],
    notes: "The employee is notified in-app. Recorded in the audit log.",
  },
  "PATCH /api/job-roles/[id]": {
    summary:
      "Rename a job role, move it to another department, or (de)activate it. Needs employee:write. id from GET /api/job-roles.",
    body: "{ name?: string, departmentId?: department id, isActive?: boolean }",
    keywords: ["rename job role", "edit job role", "reactivate job role"],
  },
  "PATCH /api/notifications/inbox": {
    summary:
      "Mark your own in-app notifications as read: specific ones by id, or all at once. Only touches the signed-in person's notifications.",
    body: "{ ids?: string[] (notification ids from GET /api/notifications/inbox), all?: true } - one of the two is required",
    keywords: ["mark as read", "mark all read", "clear unread", "dismiss notifications"],
  },
  "PATCH /api/notifications/task-reminders": {
    summary:
      "Save the signed-in person's own task-reminder settings for 'task time almost up' alerts on in-progress tasks.",
    body: "{ enabled: boolean, leadMinutes: integer 1-480 (minutes before the estimate runs out), reminderCount: integer 1-10, repeatEveryMinutes: integer 1-120 } - ALL four required",
    keywords: ["turn off task reminders", "change reminder time", "task alert settings"],
  },
  "PATCH /api/notifications/templates": {
    summary:
      "Edit a stored HR email template's name, subject, body, merge fields, trigger or active flag. Needs email_template:write.",
    body: "{ id: template id from GET /api/notifications/templates (required), slug?: lowercase-hyphenated, name?, subject?, bodyHtml?, bodyText?, mergeFields?: string[], isActive?: boolean, trigger?: string }",
    keywords: ["edit email template", "change email wording", "update mail template"],
    notes:
      "Always resend the current mergeFields and isActive - when omitted they reset to [] and true.",
  },
  "PATCH /api/profile": {
    summary:
      "Update the signed-in person's own self-service details: phone, current address, emergency contact, Gmail App Password, or sign-in password. Everything else (name, department, manager) is HR's job via PATCH /api/employees/[id].",
    body: "{ phone?: string, currentAddress?: { line1, line2, city, state, zip, country }, emergencyContact?: { name, relation, phone }, gmailAppPassword?: 16-char Google App Password or '' to remove, currentPassword?: string, newPassword?: string min 8 (both needed to change password) }",
    keywords: ["update my phone", "change my address", "my emergency contact", "edit my profile"],
    notes:
      "Changing the password or Gmail App Password handles credentials - only do it when the person explicitly asks and supplies them.",
  },
  "PATCH /api/roles/[id]": {
    summary:
      "Edit an access role: its display name, description, internal name (custom roles only) or its permissions. Needs role:write. id from GET /api/roles.",
    body: "{ displayName?: string, description?: string, name?: slug (custom roles only), permissionIds?: string[] of permission ids from GET /api/permissions }",
    keywords: ["change role permissions", "give role access", "edit access role"],
    notes:
      "permissionIds REPLACES the role's entire permission set - read the current list first with GET /api/roles/[id] and send the full new list. Affects everyone holding the role (they must sign in again).",
  },
  "POST /api/announcements": {
    summary:
      "Post a new company announcement on the noticeboard for all employees. Needs announcement:write.",
    body: "{ title: string 3-200 (required), body: string 3-20000 (required), category: string (required; e.g. Information, Holiday Notification, Policy Update, Event, Celebration, IT / System), priority?: LOW|NORMAL|HIGH (default NORMAL), isPublished?: boolean (default true; false = draft), expiresAt?: YYYY-MM-DD }",
    keywords: ["post announcement", "publish notice", "company announcement", "noticeboard"],
    notes:
      "Visible to every employee immediately when published. SIDE EFFECT: a published post sends every active employee but the author an in-app notification and push (no email). Drafts send nothing.",
  },
  "POST /api/birthdays/wish": {
    summary:
      "Send a colleague a birthday wish, delivered as an in-app 'Happy Birthday!' notification from you. Any employee can do this; not to yourself. employeeId from GET /api/birthdays.",
    body: "{ employeeId: string (required) }",
    keywords: ["wish happy birthday", "birthday wishes", "send birthday greeting"],
    notes:
      "Sends a fixed message (no custom text). It does not check that today is their birthday.",
  },
  "POST /api/departments": {
    summary:
      "Create a new department, optionally as a sub-department of another. Needs employee:write.",
    body: "{ name: string (required, unique), parentId?: parent department id }",
    keywords: ["add department", "new team", "create sub-department"],
  },
  "POST /api/designations": {
    summary: "Create a new designation (job title in the hierarchy). Needs employee:write.",
    body: "{ title: string (required, unique), level: integer 1-13 (required; 1 = top of the hierarchy) }",
    keywords: ["add designation", "new job title", "create position"],
  },
  "POST /api/employees": {
    summary:
      "Add (onboard) a new employee. Needs employee:write. Creates their login, assigns an access role, seeds leave balances, starts the onboarding checklist and 15-day joinee scorecard.",
    body: "{ firstName, lastName, email: work email - all required; employeeNo?: code (auto EMP-YYYY-#### if blank), personalEmail?, phone?, personalPhone?, dateOfBirth?: YYYY-MM-DD, gender?: MALE|FEMALE|OTHER|PREFER_NOT_TO_SAY, nationality?, bloodGroup?, departmentId?, designationId?, jobRoleId?, managerId?: reporting manager id, dottedManagerId?, roleId?: access role id (default 'employee'), employmentType?: FULL_TIME|PART_TIME|CONTRACT|INTERN, dateOfJoining?: YYYY-MM-DD, probationEndDate?, onProbation?: boolean, probationMonths?: 0-6, deviceId?: biometric code, workLocation?, currentAddress?/permanentAddress?: { line1, line2, city, state, zip, country }, emergencyContact?: { name, relation, phone }, password?: min 8 (generated if omitted), mustChangePassword?: boolean }",
    keywords: ["add employee", "onboard new hire", "create employee", "new joiner"],
    notes:
      "Emails a welcome message WITH the login password to the work and personal emails, and notifies HR/admins. Fails with 402 if the plan's headcount limit is reached. status/resignationDate/lastWorkingDate are ignored.",
  },
  "POST /api/employees/[id]/activate": {
    summary:
      "Reactivate a deactivated or terminated employee: restores their login and sets status back to ACTIVE. Needs employee:write. id = employee id (find with GET /api/employees?status=INACTIVE).",
    keywords: ["reactivate employee", "restore access", "rehire", "enable login"],
    notes: "Project team seats removed at deactivation are not restored.",
  },
  "POST /api/employees/[id]/deactivate": {
    summary:
      "Deactivate an employee (a leaver): blocks their login, removes them from all project teams and service ownership, clears them as manager of teams, and revokes project Drive access. Needs employee:delete; not yourself. id = employee id.",
    keywords: [
      "deactivate employee",
      "disable login",
      "offboard",
      "employee left",
      "revoke access",
    ],
    notes:
      "Reversible with POST /api/employees/[id]/activate, but team seats are not restored. Status is unchanged (use the exit process or bulk-terminate to mark them TERMINATED).",
  },
  "POST /api/employees/[id]/documents": {
    summary:
      "Upload a document to an employee's personal file (ID proof, certificate, etc.). Own file, or anyone's with document:write. Multipart form: file, title, category, expiresAt.",
    keywords: ["upload employee document", "add ID proof", "upload certificate"],
    notes: "File upload - not possible through the AI connector.",
  },
  "POST /api/employees/[id]/photo": {
    summary:
      "Upload a new profile photo (JPG, PNG, WEBP or GIF, max 5 MB) for yourself, or for anyone with employee:write. Multipart form field 'file'.",
    keywords: ["upload profile picture", "change photo"],
    notes:
      "File upload - not possible through the AI connector. To pick a preset avatar instead, use PUT /api/employees/[id]/photo.",
  },
  "POST /api/employees/bulk-terminate": {
    summary:
      "Mark several employees as TERMINATED at once: sets status TERMINATED, last working date today, and blocks their login. Needs employee:delete; your own id is skipped.",
    body: "{ ids: string[] of employee ids (required) }",
    keywords: ["terminate employees", "bulk terminate", "fire", "mass offboarding"],
    notes:
      "Destructive - confirm every name first. Unlike deactivate it does not remove project team seats. Undo per person with POST /api/employees/[id]/activate.",
  },
  "POST /api/gallery/albums": {
    summary: "Create a new photo-gallery album for a company event. Any employee can create one.",
    body: "{ title: string 2-150 (required), description?: string up to 1000, eventDate?: YYYY-MM-DD }",
    keywords: ["new album", "create event album", "photo gallery"],
    notes: "Adding photos to it is a file upload, which the AI connector cannot do.",
  },
  "POST /api/gallery/albums/[albumId]/photos": {
    summary:
      "Upload photos (up to 15 MB each) or videos (MP4/WEBM/MOV, up to 200 MB) into a gallery album. Any employee. Multipart form field 'files' (multiple).",
    keywords: ["upload photos", "add pictures to album", "upload event video"],
    notes: "File upload - not possible through the AI connector.",
  },
  "POST /api/job-roles": {
    summary:
      "Create a new job role inside a department (e.g. 'Performance Marketer' in Marketing). Needs employee:write.",
    body: "{ name: string (required, unique within the department), departmentId: department id (required) }",
    keywords: ["add job role", "new position", "create role in department"],
  },
  "POST /api/message-polls/[pollId]/vote": {
    summary:
      "Vote in a poll posted in a chat conversation or a project message thread. You must be in that chat or have access to that project. pollId and optionId come from the poll on the message.",
    body: "{ optionId: string (required) }",
    keywords: ["vote in poll", "answer poll", "poll response"],
    notes:
      "Voting for an option you already chose REMOVES your vote. Single-choice polls replace your earlier choice. Closed polls return 409.",
  },
  "POST /api/notifications/templates": {
    summary: "Create a new stored HR email template. Needs email_template:write.",
    body: "{ slug: lowercase letters/numbers/hyphens, unique (required), name (required), subject (required), bodyHtml (required), bodyText?, mergeFields?: string[] (placeholders written as {{name}}), isActive?: boolean (default true), trigger?: event name e.g. employee.created }",
    keywords: ["new email template", "create mail template"],
    notes: "Saving a template does not send any email.",
  },
  "POST /api/roles": {
    summary: "Create a new custom access role (a named set of permissions). Needs role:write.",
    body: "{ name: string (required; stored lowercase with underscores, must be unique), displayName: string (required), description?: string, permissionIds?: string[] of permission ids from GET /api/permissions }",
    keywords: ["create role", "new access role", "custom permission set"],
    notes: "Assign it to people with PUT /api/employees/[id]/roles.",
  },
  "PUT /api/employees/[id]/photo": {
    summary:
      "Set an employee's profile picture to one of the built-in preset avatars. Yourself, or anyone with employee:write. id = employee id.",
    body: "{ avatarId: 'av-<group>-NN' (required), group one of web, design, content, video, social, hr, lead and NN 01-06, e.g. av-design-03 }",
    keywords: ["choose avatar", "preset avatar", "change profile picture"],
    notes: "Replaces and deletes any uploaded photo.",
  },
  "PUT /api/employees/[id]/roles": {
    summary:
      "Set which access roles an employee holds (what they can do in DNMS, e.g. make someone an HR Manager or Admin). Needs role:write. id = employee id; role ids from GET /api/roles.",
    body: "{ roleIds: string[] (required) - the COMPLETE new set of role ids; [] removes all }",
    keywords: ["assign role", "make admin", "give HR access", "change permissions", "remove role"],
    notes:
      "REPLACES all the employee's roles - include the ones they keep. The employee (who must sign out and back in) and other admins are notified. The hidden admin role cannot be granted or removed here.",
  },
}
