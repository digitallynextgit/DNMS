// =============================================================================
// The checklists a company starts with. Editable from day one.
// =============================================================================
// Transcribed from "Onboarding and Exit Checklist.docx" - HR's own process
// document. The wording is deliberately theirs, not a paraphrase: people
// recognise their own checklist, and a reworded step reads as a different step.
//
// PURE DATA. No imports, no server-only, no Prisma - this is read by
// provision.service.ts (new companies), prisma/seed.ts (fresh databases) and
// prisma/backfill-hr-checklists.ts (existing companies), one of which runs as a
// standalone tsx script outside Next entirely.
//
// ── OFFSETS ─────────────────────────────────────────────────────────────────
// `offsetDays` is relative to the instance's ANCHOR DATE:
//   onboarding -> dateOfJoining, so 0 = day one and 21 = start of week four;
//   exit       -> lastWorkingDate, so NEGATIVE means "before they go" and
//                 positive means "after" (a settlement lands after the last day).
// `null` means "no date" - do it when the process reaches it.
// =============================================================================

export type DefaultAssigneeRole = "HR" | "MANAGER" | "EMPLOYEE" | "DEPARTMENT_HEAD"
export type DefaultItemKind = "TASK" | "CLEARANCE"

export interface DefaultChecklistItem {
  text: string
  /** Shown under the item. The document's sub-bullets live here. */
  helpText?: string
  itemKind?: DefaultItemKind
  assigneeRole?: DefaultAssigneeRole
  /** A required CLEARANCE blocks the exit from being completed. */
  isRequired?: boolean
  offsetDays?: number | null
}

export interface DefaultChecklistSection {
  title: string
  items: DefaultChecklistItem[]
}

export interface DefaultChecklistTemplate {
  kind: "ONBOARDING" | "EXIT"
  name: string
  description: string
  sections: DefaultChecklistSection[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_ONBOARDING_TEMPLATE: DefaultChecklistTemplate = {
  kind: "ONBOARDING",
  name: "Candidate Onboarding Checklist",
  description: "Everything from the week before someone joins to their first-month review.",
  sections: [
    {
      title: "To-do Before Joining",
      items: [
        { text: "Create welcome card (give content to Graphic team)", offsetDays: -3 },
        { text: "Make their Role charter", offsetDays: -3 },
        { text: "Get their email id and credentials from the G-Suite POC", offsetDays: -2 },
      ],
    },
    {
      title: "Step 1. Documentation & Access Setup (Day 1 - Morning)",
      items: [
        {
          text: "Collect personal documents",
          helpText: "ID proof, bank details, education and work-experience verification.",
          offsetDays: 0,
        },
        { text: "Provide offer letter copy + signed acknowledgement", offsetDays: 0 },
        { text: "Create email ID and give credentials", offsetDays: 0 },
        {
          text: "Register biometric attendance and enter data in employee records",
          offsetDays: 0,
        },
        { text: "Add to official WhatsApp group(s) and send welcome message", offsetDays: 0 },
        {
          text: "Send the welcome mail pack",
          helpText:
            "Hierarchy PPT, Work from Home Policy, Leave Policy, Code of Conduct and Holiday Calendar.",
          offsetDays: 0,
        },
        {
          text: "Share Role Charter (KRAs, KPIs) and first 15-day expectations",
          assigneeRole: "MANAGER",
          offsetDays: 0,
        },
      ],
    },
    {
      title: "Step 2. Orientation & Induction",
      items: [
        { text: "Welcome with the welcome kit and the welcome card", offsetDays: 0 },
        {
          text: "Office tour",
          helpText: "Workspace, pantry, meeting rooms, breakout area.",
          offsetDays: 0,
        },
        {
          text: "Induction session",
          helpText:
            "Company values and culture; policies - work from home, leave, code of conduct, appraisal/increment, PIP and termination; hierarchy and reporting structure (COO, Heads, Managers, Operational staff).",
          offsetDays: 0,
        },
      ],
    },
    {
      title: "Step 3. Initial Training & Task Alignment",
      items: [
        {
          text: "Role-specific process training",
          assigneeRole: "MANAGER",
          offsetDays: 1,
        },
        { text: "Assign a buddy/mentor for the first 15 days", offsetDays: 1 },
        {
          text: "Manager explains workflow & task allocation",
          assigneeRole: "MANAGER",
          offsetDays: 1,
        },
        {
          text: "Share onboarding guide/manual",
          helpText: "Tools, naming conventions, file storage.",
          offsetDays: 2,
        },
        { text: "Email signature to be made by the Design team", offsetDays: 3 },
        { text: "Get their salary account details on mail", offsetDays: 3 },
      ],
    },
    {
      title: "Step 4. HR & Reporting Protocol",
      items: [
        {
          text: "First 15 days: reports to HR, with the manager in loop for task allocation",
          offsetDays: 0,
        },
        {
          text: "After 15 days: reporting shifts directly to the manager",
          offsetDays: 15,
        },
        {
          text: "15-day review - HR and manager joint evaluation",
          helpText: "If performance is unsatisfactory, decide on early exit or a PIP.",
          offsetDays: 15,
        },
        {
          text: "Confirm offer-letter probation clause is understood (revocable within 1 month)",
          offsetDays: 0,
        },
      ],
    },
    {
      title: "Step 5. Culture & Engagement",
      items: [
        { text: "Team introduction (formal icebreaker round)", offsetDays: 0 },
        {
          text: "Encourage them to connect with company social media channels",
          offsetDays: 0,
          isRequired: false,
        },
        { text: "First-day lunch sponsored by the office", offsetDays: 0 },
      ],
    },
    {
      title: "Step 6. First Month Milestones",
      items: [
        { text: "Week 1: daily HR check-ins", offsetDays: 7 },
        {
          text: "Week 2: begin small independent tasks",
          assigneeRole: "MANAGER",
          offsetDays: 14,
        },
        {
          text: "Week 3: handle at least one client deliverable",
          assigneeRole: "MANAGER",
          offsetDays: 21,
        },
        {
          text: "Week 4: performance review + feedback loop",
          assigneeRole: "MANAGER",
          offsetDays: 28,
        },
      ],
    },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// Exit clearance
// ─────────────────────────────────────────────────────────────────────────────
//
// Step 3 is the reason this is software rather than a spreadsheet. Its four
// entries are CLEARANCE items: each names a person who must personally sign,
// and while a required one is unsigned the exit cannot be completed - so no
// relieving letter and no final settlement. The document states that rule twice;
// here it is enforced rather than remembered.
//
// The document's line "Employee must collect sign-offs from all relevant
// departments before HR clearance" is deliberately NOT an item. It described the
// process the four items below now ARE, and a checkbox saying "collect the
// checkboxes" is noise.
//
// Finance and IT/Admin have no dedicated structure anywhere in this schema, so
// they seed with no department attached. HR points each at the right Department
// in the template editor, once, and every exit afterwards routes itself.

export const DEFAULT_EXIT_TEMPLATE: DefaultChecklistTemplate = {
  kind: "EXIT",
  name: "Exit Clearance Checklist",
  description:
    "Notice period, handover, department sign-offs and final settlement. Relieving is blocked until every required clearance is signed.",
  sections: [
    {
      title: "Step 1. Resignation & Notice Period",
      items: [
        { text: "Collect formal resignation letter/email", offsetDays: null },
        { text: "HR and the manager both acknowledge acceptance in writing", offsetDays: null },
        {
          text: "Communicate notice period, last working day and exit process",
          offsetDays: null,
        },
        { text: "Inform reporting manager + relevant department heads", offsetDays: null },
      ],
    },
    {
      title: "Step 2. Knowledge Transfer & Handover",
      items: [
        {
          text: "Prepare handover document",
          helpText: "Projects, clients, deadlines and pending tasks.",
          assigneeRole: "EMPLOYEE",
          offsetDays: -7,
        },
        {
          text: "Transfer client communications to another team member",
          assigneeRole: "EMPLOYEE",
          offsetDays: -7,
        },
        {
          text: "Transfer ownership of Google Drive folders & repository files",
          assigneeRole: "EMPLOYEE",
          offsetDays: -7,
        },
        {
          text: "Conduct the status handover meeting",
          assigneeRole: "MANAGER",
          offsetDays: -5,
        },
      ],
    },
    {
      title: "Step 3. Department-Wise Clearance",
      items: [
        {
          text: "Manager / Reporting Head",
          helpText: "Confirms handover of tasks and projects.",
          itemKind: "CLEARANCE",
          assigneeRole: "MANAGER",
          offsetDays: -3,
        },
        {
          text: "Finance",
          helpText: "Verifies no pending advances, reimbursements or dues.",
          itemKind: "CLEARANCE",
          assigneeRole: "DEPARTMENT_HEAD",
          offsetDays: -3,
        },
        {
          text: "IT / Admin",
          helpText:
            "Verifies return of laptop, devices and access cards, and removal of email/drive access.",
          itemKind: "CLEARANCE",
          assigneeRole: "DEPARTMENT_HEAD",
          offsetDays: -3,
        },
        {
          text: "Other departments worked with",
          helpText:
            "Confirm no incomplete agenda or tasks pending. Optional by default - add one clearance per department this person actually worked with.",
          itemKind: "CLEARANCE",
          assigneeRole: "DEPARTMENT_HEAD",
          isRequired: false,
          offsetDays: -3,
        },
      ],
    },
    {
      title: "Step 4. HR Final Sign-Off",
      items: [
        {
          text: "Review the collective clearance form signed by all departments",
          offsetDays: 0,
        },
        { text: "Issue relieving letter", offsetDays: 0 },
        {
          text: "Issue experience/tenure certificate",
          helpText: "Only if the employee asks for one.",
          isRequired: false,
          offsetDays: 0,
        },
        {
          text: "Remove from WhatsApp groups, HR1 and Google Drive access",
          offsetDays: 0,
        },
      ],
    },
    {
      title: "Step 5. Full & Final Settlement",
      items: [
        { text: "Salary till last working day", offsetDays: 7 },
        { text: "Adjustment of leave balances", offsetDays: 7 },
        {
          text: "Pending reimbursements",
          helpText: "Travel, client expenses.",
          offsetDays: 7,
        },
        { text: "F&F statement issued to employee", offsetDays: 7 },
      ],
    },
    {
      title: "Step 6. Exit Interview & Closure",
      items: [
        {
          text: "Conduct exit interview",
          helpText: "Reasons for leaving, feedback, suggestions.",
          offsetDays: 0,
        },
        { text: "Document insights for HR records", offsetDays: 0 },
        { text: "Team farewell email", isRequired: false, offsetDays: 0 },
      ],
    },
  ],
}

export const DEFAULT_CHECKLIST_TEMPLATES: DefaultChecklistTemplate[] = [
  DEFAULT_ONBOARDING_TEMPLATE,
  DEFAULT_EXIT_TEMPLATE,
]
