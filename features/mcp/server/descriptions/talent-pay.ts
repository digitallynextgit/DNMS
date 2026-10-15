import type { DescriptionMap } from "./types"

// Talent & pay: recruitment, careers CMS, payroll, performance evaluations, joinee scorecards,
// referrals. See ./types.ts for the format.
export const TALENT_PAY: DescriptionMap = {
  "DELETE /api/careers/[id]": {
    summary:
      "Delete a department group from the public careers website (Careers CMS), together with every sub-department, role and opening under it. Needs recruitment:write. [id] is the group id from GET /api/careers.",
    keywords: ["remove careers group", "delete careers department", "careers site", "careers CMS"],
    notes:
      "Irreversible cascade delete: everything under the group disappears from the careers site. Applications already received are kept. Confirm with the user first; setting status DRAFT via PATCH hides it instead.",
  },
  "DELETE /api/careers/openings/[id]": {
    summary:
      "Delete one opening line (a seniority variant such as 'Senior Designer (3-5 yrs)') from a role on the public careers website. Needs recruitment:write. [id] is the opening id from GET /api/careers (group > subDepartments > roles > openings).",
    keywords: ["remove opening", "careers opening", "careers site vacancy"],
    notes: "Irreversible.",
  },
  "DELETE /api/careers/roles/[id]": {
    summary:
      "Delete a role (job listing) and its openings from the public careers website. Needs recruitment:write. [id] is the careers role id from GET /api/careers.",
    keywords: ["remove job from careers page", "delete careers role", "take down job listing"],
    notes:
      "Irreversible. Applications already received for the role are kept but lose their link to it. Setting status DRAFT via PATCH hides it instead.",
  },
  "DELETE /api/careers/sub-departments/[id]": {
    summary:
      "Delete a sub-department from the public careers website, with all its roles and openings. Needs recruitment:write. [id] is the sub-department id from GET /api/careers.",
    keywords: ["remove careers sub-department", "careers CMS", "careers department"],
    notes: "Irreversible cascade delete. Setting status DRAFT via PATCH hides it instead.",
  },
  "DELETE /api/joinee-scorecards/[id]": {
    summary:
      "Delete a new joinee's 15-day scorecard and all of its daily scores. Needs onboarding:write. [id] is the scorecard id (scorecard.id from GET /api/joinee-scorecards?employeeId=...).",
    keywords: ["remove joinee scorecard", "new joinee evaluation", "onboarding scorecard"],
    notes: "Irreversible - every daily score and observation is lost.",
  },
  "DELETE /api/payroll/records/[id]": {
    summary:
      "Delete one employee's monthly payroll record (payslip) while it is still DRAFT. Needs payroll:process. [id] is the payroll record id from GET /api/payroll/records.",
    keywords: ["delete payslip", "remove payroll entry", "undo payroll run"],
    notes:
      "Only DRAFT records can be deleted (409 otherwise). Irreversible; run POST /api/payroll/records for that month again to regenerate it.",
  },
  "DELETE /api/payroll/salary-structures/[id]": {
    summary:
      "Delete an employee's salary structure (their monthly pay breakup). Needs payroll:write. [id] is the salary structure id from GET /api/payroll/salary-structures.",
    keywords: ["remove salary", "delete pay structure", "delete CTC breakup"],
    notes:
      "Refused (409) once any payroll record has been generated from it. Irreversible - payroll can no longer be run for that employee until a new structure is set.",
  },
  "DELETE /api/performance/evaluations/[id]": {
    summary:
      "Delete one performance evaluation (appraisal / review scorecard) including all self, manager and controller ratings. HR only (performance:review). [id] is the evaluation id from GET /api/performance/evaluations.",
    keywords: ["delete appraisal", "remove performance review", "delete evaluation"],
    notes: "Irreversible - submitted ratings and the final score are lost.",
  },
  "DELETE /api/recruitment/applicants/[id]": {
    summary:
      "Delete a candidate from a job posting's internal hiring pipeline, along with their interviews. Needs recruitment:write. [id] is the applicant id from GET /api/recruitment/applicants.",
    keywords: ["delete candidate", "remove applicant", "remove from pipeline"],
    notes:
      "Irreversible. To keep the record but drop the candidate, PATCH the stage to REJECTED instead.",
  },
  "DELETE /api/recruitment/applications/[id]": {
    summary:
      "Permanently delete an application received from the careers website (or an employee referral). Only the admin or HR manager role may do this - recruitment:write alone gets 403. [id] from GET /api/recruitment/applications.",
    keywords: ["delete job application", "delete careers application", "remove referral"],
    notes:
      "Irreversible: destroys the candidate's real submission and any referral/reward tracking on it. Prefer PATCH status REJECTED. Confirm first.",
  },
  "DELETE /api/recruitment/interviews/[id]": {
    summary:
      "Delete a scheduled candidate interview. Needs recruitment:write. [id] is the interview id from GET /api/recruitment/interviews.",
    keywords: ["cancel interview", "remove interview", "delete interview slot"],
    notes: "Irreversible. Nobody is notified - tell the candidate and interviewer separately.",
  },
  "DELETE /api/recruitment/jobs/[id]": {
    summary:
      "Delete an internal job posting (job opening / vacancy) and, with it, every applicant and interview under it. Needs recruitment:write. [id] is the job posting id from GET /api/recruitment/jobs.",
    keywords: ["delete job posting", "remove vacancy", "delete job opening"],
    notes:
      "Irreversible cascade: all candidates and interviews for the job are deleted too. To stop hiring, PATCH status CLOSED instead. Confirm first.",
  },
  "GET /api/careers": {
    summary:
      "The full public careers website content (Careers CMS) as a tree: groups (mode FULL_TIME or INTERNSHIP) > sub-departments > roles > openings, including both DRAFT and PUBLISHED items. Needs recruitment:read. Use it to find ids for the careers edit endpoints.",
    keywords: [
      "careers page",
      "careers website",
      "job board",
      "roles on website",
      "careers tree",
      "careers CMS",
    ],
  },
  "GET /api/joinee-scorecards": {
    summary:
      "A new joinee's 15-working-day scorecard: daily 1-5 scores from the manager (job role, communication, learning) and HR (discipline, culture, learning), observations, recommendation and HR SPOC. Anyone can read their own; onboarding:read or onboarding:write sees anyone's.",
    query:
      "employeeId: the employee's id (required; find it with dnms_search_people or /api/employees)",
    keywords: [
      "new joinee scorecard",
      "15 day evaluation",
      "onboarding scores",
      "joinee review",
      "probation scorecard",
    ],
    notes:
      "Returns scorecard: null when none has been started, and canEdit saying whether the caller may score it. scorecard.id is the id the scorecard edit endpoints need.",
  },
  "GET /api/payroll/me": {
    summary:
      "The signed-in employee's own payslips (monthly payroll records), newest first: gross, deductions, net pay, present/leave/LOP days and status. Always only the caller's own salary, whatever their permissions.",
    keywords: ["my payslip", "my salary", "salary slip", "my pay history", "net pay"],
    notes:
      "Includes records still in DRAFT or PROCESSING, not only PAID ones - check status before calling something a final payslip. Payslips are on-screen data, not files: present the figures.",
  },
  "GET /api/payroll/me/[id]": {
    summary:
      "One of the caller's own payslips in full: earnings breakup (basic, HRA, allowances, overtime), deductions, net pay, days and status, plus the salary structure used. [id] is a payroll record id from GET /api/payroll/me; someone else's gives 403.",
    keywords: ["payslip details", "salary slip for month", "my payslip breakup"],
    notes: "No file - read it and present the figures.",
  },
  "GET /api/payroll/records": {
    summary:
      "List monthly payroll records (payslips). With payroll:write it covers every employee and can filter by employeeId or name; without it, only the caller's own salary records come back, whatever filters are sent.",
    query:
      "month: 1-12; year: e.g. 2026; status: DRAFT|PROCESSING|APPROVED|PAID; employeeId: employee id (payroll:write only); search: employee name or number; page, limit (max 100; default 100 without page, 10 with page)",
    keywords: [
      "payroll list",
      "payslips for month",
      "salary register",
      "monthly payroll",
      "salary paid",
    ],
  },
  "GET /api/payroll/records/[id]": {
    summary:
      "One payroll record (payslip) in full: earnings breakup, deductions, net pay, present/leave/LOP days, status and the salary structure used. payroll:write can open anyone's; others only their own (403). [id] from GET /api/payroll/records.",
    keywords: ["payslip details", "payroll record", "salary slip"],
    notes: "No file - read it and present the figures.",
  },
  "GET /api/payroll/salary-structures": {
    summary:
      "Salary structures: each employee's fixed monthly pay breakup (basic, HRA, conveyance, medical, telephone, other allowances) and effective date. payroll:write sees every employee's salary; everyone else gets only their own.",
    keywords: [
      "salary structure",
      "CTC breakup",
      "salary breakup",
      "monthly salary",
      "pay structure",
    ],
    notes:
      "No filters - all rows come back at once; find a person by employee.firstName/employeeNo. Amounts are monthly INR (x12 for annual). PF/ESI/TDS are always zero.",
  },
  "GET /api/payroll/salary-structures/[id]": {
    summary:
      "One salary structure (monthly pay breakup) by its id. payroll:write only - employees should read their own via GET /api/payroll/salary-structures. [id] is the salary structure id, not the employee id.",
    keywords: ["salary structure details", "CTC breakup", "employee salary"],
  },
  "GET /api/payroll/summary": {
    summary:
      "Company-wide payroll totals: total gross, net and deductions, number of payroll records, and a count by status (DRAFT, PROCESSING, APPROVED, PAID). payroll:write only.",
    query: "month: 1-12; year: e.g. 2026 (both optional; omit both for all-time totals)",
    keywords: ["payroll total", "salary bill", "total salary cost", "payroll summary"],
  },
  "GET /api/performance/evaluations": {
    summary:
      "List performance evaluations (appraisals / review scorecards). HR (performance:review) sees everyone's; others see their own plus the ones where they are the reviewing manager or project controller.",
    query:
      "status: PENDING|SELF_DONE|MANAGER_DONE|COMPLETED; period: exact period label (the response's periods array lists them); q: employee name or number; mine=1: only the caller's own; page, limit (max 100, default 10)",
    keywords: ["appraisal", "performance review", "evaluation list", "ratings", "pending reviews"],
  },
  "GET /api/performance/evaluations/[id]": {
    summary:
      "One evaluation: its criteria (selfCriteria and managerCriteria, each with id, section, weight), submitted ratings and comments, final score out of 100, and viewerRole (EMPLOYEE, MANAGER, CONTROLLER or HR) saying which side the caller can fill. Visible to the employee, their reviewers and HR.",
    keywords: ["appraisal details", "performance score", "evaluation form", "review ratings"],
    notes:
      "The employee cannot see manager/controller ratings until those are submitted. Use the criterion ids here as the keys of ratings in PATCH.",
  },
  "GET /api/performance/kpi-profiles": {
    summary:
      "All active employees with whether they have a custom KPI profile (the parameters they are rated on in evaluations) and how many manager/self lines it has. HR only (performance:review).",
    keywords: ["KPI setup", "who has KPIs", "evaluation parameters", "KPI profiles"],
    notes:
      "Only employees with a configured profile are included when an evaluation round is generated.",
  },
  "GET /api/performance/kpi-profiles/[employeeId]": {
    summary:
      "One employee's KPI profile: the Section A (role KPIs, 60%) and Section B (workplace discipline and execution, 40%) parameters they are rated on in evaluations. HR only (performance:review). [employeeId] is the employee id.",
    keywords: ["employee KPIs", "appraisal parameters", "rating criteria", "KPI list"],
    notes: "An empty items list means the built-in default parameters are used.",
  },
  "GET /api/recruitment/applicants": {
    summary:
      "List candidates in the internal hiring pipeline (people added to DNMS job postings) with stage, contact details, notes and interviews. Needs recruitment:read. Careers-website applications are separate: GET /api/recruitment/applications.",
    query:
      "jobId: job posting id from GET /api/recruitment/jobs; stage: APPLIED|SCREENING|INTERVIEW|OFFER|HIRED|REJECTED",
    keywords: [
      "candidates",
      "applicants",
      "hiring pipeline",
      "shortlisted candidates",
      "recruitment",
    ],
    notes: "Returns at most the 500 newest; meta.truncated says when more exist.",
  },
  "GET /api/recruitment/applicants/[id]/resume": {
    summary:
      "Download a pipeline candidate's CV / resume (PDF or Word). Needs recruitment:read. [id] is the applicant id from GET /api/recruitment/applicants.",
    keywords: ["candidate CV", "download resume", "applicant resume"],
    notes:
      "Returns a file - use dnms_download (it redirects to a short-lived storage or external link). 404 when no CV is on file.",
  },
  "GET /api/recruitment/applications": {
    summary:
      "List job applications received from the public careers website, including employee referrals: candidate name, email, phone, LinkedIn, role applied for, status, HR notes and a CV link. Needs recruitment:read.",
    query:
      "status: RECEIVED|IN_REVIEW|SHORTLISTED|REJECTED|HIRED or all; mode: FULL_TIME|INTERNSHIP or all; q: search candidate name, email or role title; page, limit (max 100, default 20)",
    keywords: [
      "careers applications",
      "website applications",
      "job applications",
      "new applicants",
      "CVs received",
    ],
    notes:
      "meta.newCount = applications still RECEIVED (unread). resumeUrl is a signed CV link valid about 1 hour - give it to the user as-is.",
  },
  "GET /api/recruitment/applications/[id]": {
    summary:
      "One careers-website application in full: candidate details, message, role applied for, status, HR notes, referrer and a CV link. Needs recruitment:read. [id] from GET /api/recruitment/applications.",
    keywords: ["application details", "candidate application", "careers application"],
    notes: "resumeUrl is a signed CV link valid about 1 hour.",
  },
  "GET /api/recruitment/interviews": {
    summary:
      "List candidate interviews (type, date/time, interviewer, result, feedback) with the candidate's name and job title, earliest first. Needs recruitment:read.",
    query: "applicantId: only this candidate's interviews (optional; applicant id)",
    keywords: [
      "interview schedule",
      "upcoming interviews",
      "interview feedback",
      "interview calendar",
    ],
  },
  "GET /api/recruitment/jobs": {
    summary:
      "List internal job postings (job openings / vacancies) with department, status, salary band, closing date and applicant count, including drafts. Needs recruitment:read.",
    query: "status: DRAFT|OPEN|CLOSED|ON_HOLD",
    keywords: ["job openings", "vacancies", "open positions", "job postings", "hiring"],
  },
  "GET /api/recruitment/jobs/[id]": {
    summary:
      "One job posting in full, with every applicant (contact details, stage, notes) and their interviews. Needs recruitment:read. [id] from GET /api/recruitment/jobs.",
    keywords: ["job posting details", "candidates for job", "vacancy details"],
  },
  "GET /api/referrals": {
    summary:
      "The caller's own employee referrals: each person they referred, the role, current stage and the referral reward (state none/pending/due/paid, eligible date, amount), plus totals and the caller's employee number. Any employee; only their own.",
    keywords: ["my referrals", "referral bonus", "referral reward", "refer a friend status"],
  },
  "GET /api/referrals/admin": {
    summary:
      "HR's view of every employee referral in the company: candidate, role, stage, referrer (or an unmatched employee number typed on the careers form), linked hire and reward state/amount. Needs recruitment:write.",
    keywords: [
      "all referrals",
      "referral rewards due",
      "referral payouts",
      "employee referral program",
    ],
  },
  "GET /api/referrals/roles": {
    summary:
      "Roles an employee can refer someone for: the roles currently published on the careers website, with department. Any employee. Use the id as careerRoleId in POST /api/referrals.",
    keywords: ["referable roles", "open roles to refer", "refer for which job"],
  },
  "PATCH /api/careers/[id]": {
    summary:
      "Edit a department group on the public careers website (Careers CMS): title, code, mode, slug, link label, tone, order, or publish/unpublish it. Needs recruitment:write. [id] is the group id from GET /api/careers.",
    body: "{ mode?: FULL_TIME|INTERNSHIP, code?: string, title?: string, slug?: lowercase-letters-numbers-hyphens, jobsLabel?: string, tone?: red|teal, order?: integer >= 0, status?: DRAFT|PUBLISHED }",
    keywords: [
      "publish careers group",
      "edit careers department",
      "unpublish careers",
      "careers CMS",
    ],
    notes:
      "Always send tone with its current value - when omitted it is reset to teal. PUBLISHED makes it live on the website (children show only if they are PUBLISHED too).",
  },
  "PATCH /api/careers/openings/[id]": {
    summary:
      "Edit an opening line under a careers-website role: change its label, order, or publish/unpublish it. Needs recruitment:write. [id] is the opening id from GET /api/careers.",
    body: "{ label?: string, order?: integer >= 0, status?: DRAFT|PUBLISHED }",
    keywords: ["edit opening", "publish opening", "careers vacancy"],
  },
  "PATCH /api/careers/roles/[id]": {
    summary:
      "Edit a role (job listing) on the public careers website: title, tag line, summary, intro, job essence, key requirements, order, or publish/unpublish it. Needs recruitment:write. [id] is the careers role id from GET /api/careers.",
    body: "{ title?: string, slug?: lowercase-hyphenated, meta?: short tag e.g. 'Mumbai · 3-5 yrs · Full-time', summary?: one-line pitch, intro?: paragraph, jobEssence?: string, keyRequirements?: string[], order?: integer >= 0, status?: DRAFT|PUBLISHED }",
    keywords: ["edit job listing", "publish role", "careers page copy", "job description"],
    notes:
      "The website shows a role's full description only when intro is set. keyRequirements replaces the whole list.",
  },
  "PATCH /api/careers/sub-departments/[id]": {
    summary:
      "Edit a sub-department on the public careers website: title, slug, link label, tone, order, or publish/unpublish it. Needs recruitment:write. [id] is the sub-department id from GET /api/careers.",
    body: "{ title?: string, slug?: lowercase-hyphenated, jobsLabel?: string, tone?: red|teal, order?: integer >= 0, status?: DRAFT|PUBLISHED }",
    keywords: ["edit careers sub-department", "publish sub-department", "careers CMS"],
    notes: "Always send tone with its current value - when omitted it is reset to teal.",
  },
  "PATCH /api/joinee-scorecards/[id]": {
    summary:
      "Update a new joinee's scorecard summary: HR SPOC, manager observations, HR observations and the final recommendation. Needs onboarding:write. [id] is scorecard.id from GET /api/joinee-scorecards?employeeId=...",
    body: "{ hrSpocId?: employee id or null, managerObservations?: string or null, hrObservations?: string or null, recommendation?: CONTINUE|CONTINUE_WITH_IMPROVEMENTS|REVIEW_REQUIRED or null } - send at least one",
    keywords: [
      "joinee recommendation",
      "joinee observations",
      "assign HR SPOC",
      "onboarding review",
    ],
  },
  "PATCH /api/joinee-scorecards/[id]/days/[day]": {
    summary:
      "Enter or clear one day's 1-5 scores on a new joinee's 15-day scorecard. Needs onboarding:write (a manager without it cannot score). [id] is the scorecard id; [day] is the day number 1-15.",
    body: "{ <criterionKey>: whole number 1-5 (5 Excellent, 4 Good, 3 Average, 2 Needs Improvement, 1 Unsatisfactory) or null to clear } - keys come from GET /api/joinee-scorecards/criteria (built-in: mgrJobRole, mgrCommunication, mgrLearning, hrDiscipline, hrCulture, hrLearning); send only the scores to change",
    keywords: ["score new joinee", "daily joinee rating", "joinee day score"],
  },
  "PATCH /api/payroll/records/[id]": {
    summary:
      "Move a payroll record (payslip) to its next stage DRAFT > PROCESSING > APPROVED > PAID, add notes, or (while DRAFT) set overtime and other deductions, which recalculates gross and net pay. Needs payroll:process. [id] from GET /api/payroll/records.",
    body: "{ status?: the next stage only (DRAFT->PROCESSING, PROCESSING->APPROVED, APPROVED->PAID), notes?: string, overtime?: INR >= 0 (DRAFT only), otherDeductions?: INR >= 0 (DRAFT only) }",
    keywords: [
      "approve payroll",
      "mark salary paid",
      "process payslip",
      "add overtime",
      "salary deduction",
    ],
    notes:
      "Marking PAID notifies and emails the employee their payslip summary and cannot be reversed. Stages cannot be skipped or moved back. overtime/otherDeductions are silently ignored unless the record is DRAFT.",
  },
  "PATCH /api/payroll/salary-structures/[id]": {
    summary:
      "Revise an employee's salary (increment / salary change): update any monthly pay component or the effective date. Needs payroll:write. [id] is the salary structure id from GET /api/payroll/salary-structures (not the employee id).",
    body: "{ basicSalary?, hra?, conveyance?, medicalAllowance?, telephoneAllowance?, otherAllowances?: monthly INR numbers; effectiveFrom?: YYYY-MM-DD }",
    keywords: ["salary revision", "increment", "change salary", "update CTC", "raise"],
    notes:
      "Rejected (422) if the new monthly total exceeds the designation's salary cap. Only payroll generated afterwards uses it; existing payslips keep their figures. PF/ESI/TDS are forced to zero.",
  },
  "PATCH /api/performance/evaluations/[id]": {
    summary:
      "Submit ratings for one side of a performance evaluation: SELF (only the employee), MANAGER (the assigned manager or HR) or CONTROLLER (the assigned project controller or HR). Every criterion of that side must be rated 1-5.",
    body: "{ role: SELF|MANAGER|CONTROLLER (required), ratings: { <criterion id>: 1-5 } for every criterion of that side (required; ids from GET /api/performance/evaluations/[id] - selfCriteria for SELF, managerCriteria for MANAGER and CONTROLLER), comment?: string }",
    keywords: [
      "submit appraisal",
      "rate employee",
      "self evaluation",
      "manager review",
      "fill evaluation",
    ],
    notes:
      "The manager's ratings set the official final score out of 100 (Section A 60%, B 40%). Notifies the employee (manager review) or the manager (self review). Can be resubmitted, which overwrites earlier ratings.",
  },
  "PATCH /api/recruitment/applicants/[id]": {
    summary:
      "Update a pipeline candidate: move them to another stage (screening/shortlist, interview, offer, hired, rejected) or edit name, contact details, notes, CV link or rejection reason. Needs recruitment:write. [id] from GET /api/recruitment/applicants.",
    body: "{ stage?: APPLIED|SCREENING|INTERVIEW|OFFER|HIRED|REJECTED, firstName?, lastName?, email?, phone?, notes?, resumeUrl?: link to CV, rejectionReason?: string }",
    keywords: ["shortlist candidate", "reject candidate", "move candidate stage", "hire candidate"],
    notes:
      "Moving to SCREENING, OFFER or HIRED automatically emails the candidate (shortlisted / offer extended / welcome) from the acting user's mailbox. For a real offer letter with CTC use POST /api/recruitment/applicants/[id]/offer.",
  },
  "PATCH /api/recruitment/applications/[id]": {
    summary:
      "Change the status of a careers-website application (or employee referral) and/or HR's private notes on it. Needs recruitment:write. [id] from GET /api/recruitment/applications.",
    body: "{ status?: RECEIVED|IN_REVIEW|SHORTLISTED|REJECTED|HIRED, hrNotes?: string (max 5000) or null } - send at least one",
    keywords: ["shortlist application", "reject application", "review application", "HR notes"],
    notes:
      "Does not email the candidate. If an employee referred them, a status change notifies that employee in-app. For a referred hire, also link the employee record with PATCH /api/referrals/[id].",
  },
  "PATCH /api/recruitment/interviews/[id]": {
    summary:
      "Record an interview outcome or reschedule it: set the result, feedback, a new date/time or notes. Needs recruitment:write. [id] from GET /api/recruitment/interviews.",
    body: "{ result?: PENDING|PASSED|FAILED|NO_SHOW, feedback?: string, scheduledAt?: ISO date-time e.g. 2026-10-20T11:00:00+05:30, notes?: string }",
    keywords: [
      "interview result",
      "interview feedback",
      "reschedule interview",
      "candidate passed",
    ],
    notes:
      "Nobody is emailed or notified. Type, interviewer and rating cannot be changed here. Does not move the candidate's stage.",
  },
  "PATCH /api/recruitment/jobs/[id]": {
    summary:
      "Edit a job posting: title, description, department, location, type, salary band, closing date, status (open, close, put on hold) or its careers-page copy. Needs recruitment:write. [id] from GET /api/recruitment/jobs.",
    body: "{ title?, slug?, description?, departmentId?: department id or null, location?, type?: FULL_TIME|PART_TIME|CONTRACT|INTERNSHIP|FREELANCE, salaryMin?, salaryMax?: INR, closingDate?: YYYY-MM-DD or null, status?: DRAFT|OPEN|CLOSED|ON_HOLD, meta?, summary?, intro?, jobEssence?, keyRequirements?: string[], currentOpenings?: string[], publishToCareers?: boolean }",
    keywords: ["close job", "open job posting", "edit vacancy", "put job on hold"],
    notes:
      "publishToCareers is only stored - the public careers site is driven by the Careers CMS (/api/careers), not by job postings.",
  },
  "PATCH /api/referrals/[id]": {
    summary:
      "HR actions on an employee referral: link-hire (connect the hired candidate to their new employee record; marks it HIRED and starts the one-year reward clock) or mark-paid (record the referral reward as paid). Needs recruitment:write. [id] is the referral id from GET /api/referrals/admin.",
    body: "{ action: link-hire|mark-paid (required); link-hire: hiredEmployeeId (required, employee id - that employee needs a date of joining); mark-paid: amount?: INR > 0 (omit to use the calculated reward) }",
    keywords: [
      "pay referral bonus",
      "link referral hire",
      "referral reward paid",
      "referral payout",
    ],
    notes:
      "Both notify the referrer. mark-paid works only once the hire has completed a year, and cannot be undone - the amount is frozen.",
  },
  "POST /api/careers": {
    summary:
      "Create a department group on the public careers website (Careers CMS), e.g. 'Marketing' under Full-time or Internship. Needs recruitment:write.",
    body: "{ mode: FULL_TIME|INTERNSHIP (required), code: short label shown above the title (required), title (required), jobsLabel: link text e.g. 'Explore Sub-Departments' (required), slug?: lowercase-hyphenated (default from title), tone?: red|teal (default teal), order?: integer >= 0, status?: DRAFT|PUBLISHED (default DRAFT) }",
    keywords: ["add careers group", "new careers department", "careers CMS"],
  },
  "POST /api/careers/openings": {
    summary:
      "Add an opening line (a seniority variant such as 'Junior Designer (1-2 yrs)') under a role on the public careers website. Needs recruitment:write.",
    body: "{ roleId: careers role id from GET /api/careers (required), label (required), order?: integer >= 0, status?: DRAFT|PUBLISHED (default DRAFT) }",
    keywords: ["add opening", "new vacancy on careers page", "careers opening"],
  },
  "POST /api/careers/roles": {
    summary:
      "Add a role (job listing) under a sub-department on the public careers website. Needs recruitment:write.",
    body: "{ subDepartmentId (required), title (required), slug?: lowercase-hyphenated, meta?: short tag, summary?: one-line pitch, intro?: paragraph, jobEssence?: string, keyRequirements?: string[], order?: integer >= 0, status?: DRAFT|PUBLISHED (default DRAFT) }",
    keywords: ["post job on careers page", "add careers role", "new job listing"],
    notes:
      "Visible on the site only when it and its sub-department and group are PUBLISHED. Published roles also become referable by employees.",
  },
  "POST /api/careers/sub-departments": {
    summary:
      "Add a sub-department under a group on the public careers website. Needs recruitment:write.",
    body: "{ groupId: careers group id (required), title (required), jobsLabel: link text e.g. 'Explore Open Roles' (required), slug?: lowercase-hyphenated, tone?: red|teal (default teal), order?: integer >= 0, status?: DRAFT|PUBLISHED (default DRAFT) }",
    keywords: ["add careers sub-department", "careers CMS", "careers department"],
  },
  "POST /api/joinee-scorecards": {
    summary:
      "Start a 15-working-day new joinee scorecard for an employee (for people who joined before scorecards were automatic). Days are laid out from their date of joining, skipping weekends and holidays. Needs onboarding:write.",
    body: "{ employeeId (required), hrSpocId?: employee id of the HR point of contact }",
    keywords: ["create joinee scorecard", "start onboarding evaluation", "new joinee review"],
    notes: "409 if the employee already has a scorecard.",
  },
  "POST /api/payroll/records": {
    summary:
      "Run payroll for a month: creates DRAFT payslips for every active employee with a salary structure (or only the listed employeeIds), prorated from attendance, leave, WFH and holidays (salary / 30 per day). Needs payroll:process.",
    body: "{ month: 1-12 (required), year: e.g. 2026 (required), employeeIds?: employee id[] (default: everyone eligible) }",
    keywords: ["run payroll", "generate payslips", "process salary", "monthly payroll"],
    notes:
      "Notifies every employee included that their payslip is ready, with the net pay. Anyone who already has a record for that month is skipped. Confirm the month and people first.",
  },
  "POST /api/payroll/salary-structures": {
    summary:
      "Set up an employee's salary structure (monthly pay breakup) for the first time. Needs payroll:write.",
    body: "{ employeeId (required), basicSalary: monthly INR (required), hra?, conveyance?, medicalAllowance?, telephoneAllowance?, otherAllowances?: monthly INR (default 0), effectiveFrom: YYYY-MM-DD (required) }",
    keywords: ["set salary", "add salary structure", "CTC setup", "new employee salary"],
    notes:
      "One per employee - 409 if one exists (use PATCH to revise). 422 if the monthly total exceeds the designation's salary cap. PF/ESI/TDS are set to zero.",
  },
  "POST /api/performance/evaluations": {
    summary:
      "Create a performance evaluation (appraisal) for one employee for a period; its criteria are copied from their KPI profile (or the defaults). HR only (performance:review).",
    body: "{ employeeId (required), periodLabel: e.g. 'Q3 2026' (required), managerId?: reviewing manager (defaults to their reporting manager), controllerId?: optional project controller who also reviews, periodStart?, periodEnd?, dueDate?: YYYY-MM-DD }",
    keywords: ["start appraisal", "create performance review", "new evaluation"],
    notes: "Notifies the employee, the manager and the controller.",
  },
  "POST /api/performance/evaluations/bulk-delete": {
    summary: "Delete many performance evaluations at once. HR only (performance:review).",
    body: "{ ids: evaluation id[] (required, 1-500) }",
    keywords: ["delete appraisals", "bulk delete evaluations", "remove reviews"],
    notes: "Irreversible. Confirm the exact list with the user first.",
  },
  "POST /api/performance/evaluations/generate": {
    summary:
      "Start an evaluation round now: creates a PENDING evaluation, labelled with today's date (e.g. 'Oct 14, 2026'), for every active employee who has a KPI profile, reviewed by their reporting manager. HR only (performance:review). No body.",
    keywords: [
      "start appraisal cycle",
      "generate evaluations",
      "evaluation round",
      "launch reviews",
    ],
    notes:
      "Notifies every employee and manager included. Safe to re-run the same day (existing ones are skipped). Employees without a configured KPI profile are left out.",
  },
  "POST /api/recruitment/applicants": {
    summary:
      "Add a candidate to a job posting's internal hiring pipeline at stage APPLIED. Needs recruitment:write.",
    body: "{ jobId: job posting id (required), firstName (required), lastName (required), email (required), phone?, resumeUrl?: link to CV, source?: e.g. LinkedIn, Naukri, Referral, notes? }",
    keywords: ["add candidate", "new applicant", "add to pipeline"],
    notes:
      "Required fields are not validated - a missing one gives a generic 500 error. CV files cannot be uploaded through the connector; pass a link in resumeUrl.",
  },
  "POST /api/recruitment/applicants/[id]/offer": {
    summary:
      "Email an offer letter to a pipeline candidate (designation, annual CTC, joining date, location) and move them to the OFFER stage. Needs recruitment:write. [id] is the applicant id.",
    body: "{ designation (required), ctc: annual CTC in INR as a number (required), joiningDate?: YYYY-MM-DD (else 'to be confirmed'), location?: string }",
    keywords: ["send offer letter", "make offer", "offer CTC", "job offer"],
    notes:
      "Emails the candidate immediately from the acting user's mailbox - it cannot be recalled. Always confirm the designation, CTC and date with the user first.",
  },
  "POST /api/recruitment/applicants/[id]/resume": {
    summary:
      "Upload a CV / resume file (PDF or Word, max 10 MB) for a pipeline candidate. Needs recruitment:write.",
    keywords: ["upload CV", "attach resume"],
    notes:
      "File upload (multipart) - not possible through the AI connector. Set a CV link instead with PATCH /api/recruitment/applicants/[id] { resumeUrl }.",
  },
  "POST /api/recruitment/interviews": {
    summary: "Schedule an interview for a pipeline candidate. Needs recruitment:write.",
    body: "{ applicantId (required), scheduledAt: ISO date-time e.g. 2026-10-20T11:00:00+05:30 (required), type?: PHONE|VIDEO|IN_PERSON|TECHNICAL|HR (default PHONE), interviewerId?: employee id, notes?: string }",
    keywords: ["schedule interview", "book interview", "set up interview"],
    notes:
      "Does not email the candidate or notify the interviewer, and does not change the candidate's stage. Duration, location and meeting link cannot be set here.",
  },
  "POST /api/recruitment/jobs": {
    summary:
      "Create a job posting (job opening / vacancy) for the internal hiring pipeline. Needs recruitment:write.",
    body: "{ title (required), description?, departmentId?, location?, type?: FULL_TIME|PART_TIME|CONTRACT|INTERNSHIP|FREELANCE (default FULL_TIME), salaryMin?, salaryMax?: INR, closingDate?: YYYY-MM-DD, status?: DRAFT|OPEN|CLOSED|ON_HOLD (default DRAFT), slug?, meta?, summary?, intro?, jobEssence?, keyRequirements?: string[], currentOpenings?: string[], publishToCareers?: boolean }",
    keywords: ["new job opening", "post a job", "create vacancy", "open position"],
    notes:
      "Title is not validated - always send one. Does not put the job on the public careers site; that is the Careers CMS (POST /api/careers/roles).",
  },
  "POST /api/recruitment/jobs/generate": {
    summary:
      "Use DNMS's AI to draft careers-page copy for a job: tag line, one-line summary, intro, job essence, key requirements and opening variants. Returns text only - saves nothing. Any employee.",
    body: "{ title (required), departmentName?, type?: FULL_TIME|PART_TIME|CONTRACT|INTERNSHIP|FREELANCE, location? }",
    keywords: ["write job description", "AI job post", "draft JD"],
    notes:
      "Uses the company's own AI quota; you can usually write this copy yourself. 500 when AI is not configured in DNMS.",
  },
  "POST /api/referrals": {
    summary:
      "Refer someone for an open role (employee referral). Any employee; it is recorded under the caller and everyone with recruitment:write is notified.",
    body: "{ fullName (required), email (required), careerRoleId (required, from GET /api/referrals/roles), resumeUrl: https link to their CV (required), phone?, linkedIn?: https URL, note?: string (max 2000) }",
    keywords: ["refer a friend", "employee referral", "refer candidate", "referral bonus"],
    notes:
      "Refused if that email already has an open application for the role. The reward becomes due once the hire completes a year.",
  },
  "PUT /api/performance/kpi-profiles/[employeeId]": {
    summary:
      "Replace an employee's KPI profile - the parameters they are rated on in future performance evaluations (self and manager rate the same list). HR only (performance:review). [employeeId] is the employee id.",
    body: "{ items (required): [{ section: A|B (A = role KPIs, 60%; B = workplace discipline & execution, 40%), label: string, description?: string, evaluator?: MANAGER|SELF }] }",
    keywords: ["set KPIs", "edit appraisal parameters", "KPI profile", "rating criteria"],
    notes:
      "Replaces the whole list - send every line, not just changes. An empty list clears it (defaults apply and the employee drops out of generated rounds). Existing evaluations keep their criteria. Mixing evaluator values drops the SELF lines.",
  },
}
