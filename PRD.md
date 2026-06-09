# Product Requirements Document (PRD)

## DNMS - Digitally Next Management System

**Version:** 1.0  
**Date:** April 2026  
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals & Success Metrics](#2-goals--success-metrics)
3. [System Architecture Overview](#3-system-architecture-overview)
4. [Module Breakdown](#4-module-breakdown)
   - [M1 - Authentication & Permission-Based Access Control](#m1--authentication--permission-based-access-control-pbac)
   - [M2 - Employee Management](#m2--employee-management)
   - [M3 - Recruitment & Screening](#m3--recruitment--screening)
   - [M4 - Attendance & Time Tracking](#m4--attendance--time-tracking)
   - [M5 - Leave Management](#m5--leave-management)
   - [M6 - Payroll](#m6--payroll)
   - [M7 - Performance Evaluation](#m7--performance-evaluation)
   - [M8 - Document Management](#m8--document-management)
   - [M9 - Project & Task Management](#m9--project--task-management)
   - [M10 - Notifications & Auto-Mailer](#m10--notifications--auto-mailer)
   - [M11 - Analytics & Reporting Dashboard](#m11--analytics--reporting-dashboard)
5. [UI/UX Design Guidelines](#5-uiux-design-guidelines)
6. [Tech Stack Recommendation](#6-tech-stack-recommendation)
7. [Integration Specifications](#7-integration-specifications)
8. [Data Models](#8-data-models)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Phased Rollout Plan](#10-phased-rollout-plan)

---

## 1. Executive Summary

This document defines the full product scope for a proprietary **Digitally Next Management System (DNMS)** for the company. The system is designed to consolidate all HR operations - from hiring to exit - into a single, modular, web-based platform.

Key differentiators from off-the-shelf solutions:

- **Modular architecture** - every feature is an independent module; new features can be added without touching existing ones.
- **Hikvision face-recognition integration** - automated attendance sync from the physical entry/exit machine.
- **Project-aware DNMS** - built-in project management with PBAC and auto performance evaluation based on task completion rates.
- **Auto-communication engine** - triggered emails for onboarding, shortlisting, birthdays, leave, and project events.

---

## 2. Goals & Success Metrics

| Goal                              | KPI                                  | Target        |
| --------------------------------- | ------------------------------------ | ------------- |
| Eliminate manual attendance entry | % of attendance auto-imported        | > 99%         |
| Reduce payroll processing time    | Hours spent per payroll cycle        | < 2 hours     |
| Centralize employee records       | % of employee data digitized         | 100%          |
| Improve recruitment visibility    | Time-to-hire                         | Reduce by 40% |
| Project delivery transparency     | On-time project task completion rate | > 85%         |
| Remove unauthorized access        | Role violation incidents             | 0             |

---

## 3. System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     Next.js 14 (App Router)                       │
│                                                                   │
│  ┌─────────────────────────┐   ┌──────────────────────────────┐  │
│  │    /app  (Pages/UI)     │   │   /app/api/  (Route Handlers) │  │
│  │  React Server + Client  │   │                               │  │
│  │  Components, layouts,   │   │  /api/auth/[...]/             │  │
│  │  pages, shadcn/ui       │   │  /api/employees/              │  │
│  │                         │   │  /api/recruitment/            │  │
│  │  State: Zustand +       │   │  /api/attendance/             │  │
│  │  TanStack Query         │   │  /api/leave/                  │  │
│  │                         │   │  /api/payroll/                │  │
│  └─────────────────────────┘   │  /api/performance/            │  │
│                                │  /api/documents/              │  │
│                                │  /api/projects/               │  │
│                                │  /api/notifications/          │  │
│                                │  /api/reports/                │  │
│                                └──────────────────────────────┘  │
└──────────────────────────────────────┬───────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │           /lib  (shared)             │
                    │  prisma/db  │  auth  │  mailer       │
                    │  middleware │  queue │  file-store   │
                    └──────┬─────────────────────┬─────────┘
                           │                     │
              ┌────────────▼──────┐   ┌──────────▼──────────┐
              │   PostgreSQL 16   │   │  MinIO (file store) │
              │  + Redis (cache/  │   │  (documents, PDFs)  │
              │    job queue)     │   └─────────────────────┘
              └───────────────────┘
                           │
              ┌────────────▼──────────────┐
              │  Hikvision Face Terminal  │
              │  ISAPI / SFTP / CSV pull  │
              └───────────────────────────┘
```

**Project structure:**

```
/
├── app/
│   ├── (auth)/login/
│   ├── (dashboard)/
│   │   ├── employees/
│   │   ├── recruitment/
│   │   ├── attendance/
│   │   ├── leave/
│   │   ├── payroll/
│   │   ├── performance/
│   │   ├── documents/
│   │   ├── projects/
│   │   └── reports/
│   └── api/
│       ├── auth/
│       ├── employees/
│       ├── recruitment/
│       ├── attendance/
│       ├── leave/
│       ├── payroll/
│       ├── performance/
│       ├── documents/
│       ├── projects/
│       ├── notifications/
│       └── reports/
├── lib/
│   ├── db.ts              (Prisma client singleton)
│   ├── auth.ts            (session + PBAC helpers)
│   ├── mailer.ts          (Nodemailer/SendGrid wrapper)
│   ├── queue.ts           (BullMQ job queue)
│   └── storage.ts         (MinIO upload/download)
├── prisma/
│   └── schema.prisma
└── middleware.ts           (PBAC enforcement on all /api routes)
```

Each module exposes its own:

- API route handlers under `app/api/<module>/route.ts`
- Database schema (isolated Prisma models, foreign keyed to `Employee`)
- Permission scopes consumed by M1 (PBAC) via `middleware.ts`
- Event hooks consumed by M10 (Notifications) via the job queue

---

## 4. Module Breakdown

---

### M1 - Authentication & Permission-Based Access Control (PBAC)

**Purpose:** Control who can see and do what across the entire system. Every other module defers permission checks to M1.

#### 4.1.1 Roles (Predefined)

| Role              | Description                                            |
| ----------------- | ------------------------------------------------------ |
| `super_admin`     | Full system access, manages all organizations/branches |
| `hr_admin`        | Full HR module access, no project finance visibility   |
| `hr_manager`      | Manages recruitment, attendance, leave approvals       |
| `payroll_manager` | Payroll module only                                    |
| `project_manager` | Full project module access, read-only employee data    |
| `team_lead`       | Assign/review tasks within assigned projects           |
| `employee`        | Self-service: own profile, leaves, payslips, tasks     |
| `recruiter`       | Recruitment module only                                |
| `viewer`          | Read-only across permitted modules                     |

#### 4.1.2 Permission Scopes

Permissions follow the pattern: `<module>:<action>`

Examples:

- `employee:read`, `employee:write`, `employee:delete`
- `payroll:run`, `payroll:view_own`
- `attendance:edit`, `attendance:import`
- `project:create`, `project:assign_task`
- `recruitment:shortlist`, `recruitment:send_offer`

#### 4.1.3 Custom Role Builder

- HR Admin can create custom roles by composing permission scopes from a checkbox grid UI.
- Roles can be scoped to: **entire company**, **department**, **project**, or **individual**.

#### 4.1.4 Features

- JWT-based authentication with refresh tokens (15min access / 7-day refresh)
- OAuth2 SSO support (Google Workspace / Microsoft 365)
- MFA (TOTP - Google Authenticator / Authy)
- Session management: active sessions list, remote logout
- Audit log: every permission-sensitive action logged with actor, timestamp, IP
- Role assignment: assign multiple roles per employee
- Department-level overrides (e.g., HR Manager of Branch A ≠ Branch B)
- IP allowlist per role (optional)

#### 4.1.5 UI Pages

- `/login` - Clean login with SSO options
- `/admin/roles` - Role management grid
- `/admin/permissions` - Permission matrix (role × scope)
- `/admin/audit-log` - Filterable audit trail table
- `/admin/sessions` - Active sessions per user

---

### M2 - Employee Management

**Purpose:** Single source of truth for all employee data, from joining to exit.

#### 4.2.1 Employee Profile

Each employee record contains:

**Personal Information**

- Full name, date of birth, gender, nationality, blood group
- Personal email, personal phone
- Emergency contact (name, relation, phone)
- Permanent and current address
- Profile photo

**Employment Information**

- Employee ID (auto-generated: `EMP-YYYY-XXXX`)
- Department, designation, job grade, employment type (full-time / part-time / contract / intern)
- Date of joining, probation end date, confirmation date
- Reporting manager
- Work location / branch
- Work schedule (shift assignment)
- Status: Active / On Leave / Suspended / Resigned / Terminated

**Compensation (read-only; owned by Payroll module)**

- CTC, base salary, allowances (linked from M6)

**Linked Modules**

- Documents (M8)
- Projects assigned (M9)
- Leave balance (M5)
- Attendance summary (M4)

#### 4.2.2 Employee Lifecycle

```
[Candidate] → Hired → [Onboarding] → Active → [Probation Review]
→ Confirmed → [Normal Lifecycle] → [Exit Interview] → Alumni / Terminated
```

- Onboarding checklist: configurable per department
- Exit checklist: clearance from IT, Finance, HR, Reporting Manager
- Auto-archive on exit (data retained, access revoked)

#### 4.2.3 Employee Directory

- Searchable, filterable by department / designation / location / status
- Card view + Table view toggle
- Org chart view (interactive hierarchy tree)
- Export to CSV / Excel / PDF

#### 4.2.4 Self-Service Portal

Employees can:

- Update personal info, photo, bank details (pending HR approval)
- View payslips, leave balance, attendance
- Download their own documents
- View their project tasks and performance scores

#### 4.2.5 UI Pages

- `/employees` - Directory (search, filter, view toggle)
- `/employees/new` - Add employee form (multi-step wizard)
- `/employees/:id` - Full profile (tabbed: Info / Docs / Attendance / Payroll / Projects / Performance)
- `/employees/:id/edit` - Edit profile
- `/org-chart` - Interactive org chart
- `/profile` - Employee self-service (own profile)

---

### M3 - Recruitment & Screening

**Purpose:** Track the full hiring funnel from job posting to offer acceptance.

#### 4.3.1 Job Requisition

- Department head raises a Job Requisition (JR)
- Fields: position, department, headcount, job description, required skills, deadline, budget range
- Approval flow: Department Head → HR Manager → HR Admin
- Status: Draft → Pending Approval → Approved → Open → Closed → Fulfilled

#### 4.3.2 Candidate Pipeline & Screening Tracker

Visual Kanban board with configurable stages:

```
Applied → Screening → Phone Screen → Technical Round → HR Round
→ Final Interview → Offer Sent → Offer Accepted → Joined / Rejected
```

Per candidate card:

- Name, current CTC, expected CTC, notice period
- Applied position, source (LinkedIn / Naukri / Referral / Walk-in / Portal)
- Resume attachment
- Interview schedule (linked to calendar)
- Interviewer feedback and score (structured form per round)
- Auto-shortlist toggle (mark as shortlisted → triggers email)
- Rejection reason (from dropdown + free text)
- Offer letter generation (template-based, auto-filled)

#### 4.3.3 Resume / Candidate Database

- Store ALL candidates (past and present pipelines)
- Tag by skills, experience, domain
- Full-text search across resumes
- Bulk import from CSV / LinkedIn export
- Resume parser (extracts name, email, phone, skills, experience from PDF/DOCX)
- Duplicate detection (by email / phone)
- Re-engage: pull any past candidate back into a new JR pipeline

#### 4.3.4 Interview Scheduling

- Calendar integration (Google Calendar / Outlook)
- Auto-send interview invite to candidate and interviewers
- Reschedule / cancel with auto-notification
- Video interview link generation (Zoom / Google Meet)

#### 4.3.5 Offer Management

- Offer letter template builder (rich-text, with merge fields)
- Generate PDF offer letter
- Send via email with e-sign link (DocuSign / native signature)
- Offer accepted → auto-trigger onboarding workflow

#### 4.3.6 Analytics

- Source of hire breakdown
- Time per stage (average days per pipeline stage)
- Offer acceptance rate
- Interviewer feedback scores

#### 4.3.7 UI Pages

- `/recruitment` - Dashboard (open JRs, pipeline summary)
- `/recruitment/jobs` - Job Requisitions list
- `/recruitment/jobs/:id` - JR detail + Kanban pipeline
- `/recruitment/candidates` - Resume database
- `/recruitment/candidates/:id` - Candidate full profile
- `/recruitment/interviews` - Interview calendar view
- `/recruitment/offers` - Offers sent and status

---

### M4 - Attendance & Time Tracking

**Purpose:** Accurate, automated attendance records with minimal manual intervention. Core integration point with Hikvision hardware.

#### 4.4.1 Hikvision Integration

The company uses a Hikvision face-recognition entry/exit terminal. Currently data is exported manually to a pen drive.

**Automated Sync Options (in priority order):**

**Option A - Network SDK / ISAPI (Recommended)**

- Hikvision devices expose an HTTP-based ISAPI (Intelligent Security API)
- Backend service polls the device every 15 minutes (or uses event push callback)
- Extracts: Employee ID, timestamp, door direction (IN/OUT)
- Auto-imports into attendance records without any manual step
- Requires device to be on the same network as the server

**Option B - SFTP Auto-Pull**

- Hikvision device exports logs to an FTP/SFTP folder at end of day
- Scheduled job pulls the file, parses it, and imports records

**Option C - USB/CSV Manual Import (Fallback)**

- HR uploads the exported CSV/Excel from the pen drive
- System parses and maps records to employees
- Duplicate detection (skip already-imported records)
- Preview before confirm import
- This is the current workflow - zero change for HR until Option A/B is live

#### 4.4.2 Attendance Record

Per day per employee:

- Date
- First IN time, Last OUT time
- Total hours worked
- Status: Present / Absent / Half-Day / Late / On Leave / Holiday / Work From Home
- Overtime hours (if exceeds shift hours)
- Source: Device / Manual / Imported / WFH Self-Mark

#### 4.4.3 Shift Management

- Define shifts: Morning (9am–6pm), Night, Flexible, etc.
- Assign shifts to employees or departments
- Shift calendar: weekly/monthly view
- Overtime rules per shift

#### 4.4.4 Regularization

- Employee can raise a regularization request if forgot to punch in/out
- Manager approves or rejects with comment
- Approved regularization updates attendance record

#### 4.4.5 Holiday & Weekend Calendar

- Define company holidays (national + company-specific)
- Weekend configuration (Sat/Sun, or Sat half-day, etc.)
- Branch-specific holiday calendars

#### 4.4.6 WFH Tracking

- Employee marks WFH self-service
- Manager approval
- WFH days counted separately in reports

#### 4.4.7 Reports

- Monthly attendance sheet (per employee, per department)
- Late arrivals report
- Absenteeism report
- Overtime report
- Export: Excel / PDF

#### 4.4.8 UI Pages

- `/attendance` - Monthly attendance grid (all employees)
- `/attendance/import` - CSV import wizard (Option C)
- `/attendance/my` - Employee self-view
- `/attendance/regularization` - Regularization requests queue
- `/attendance/shifts` - Shift configuration
- `/attendance/holidays` - Holiday calendar
- `/attendance/reports` - Downloadable reports

---

### M5 - Leave Management

**Purpose:** Track, approve, and report on all employee leaves.

#### 4.5.1 Leave Types

Configurable leave types:

- Casual Leave (CL)
- Sick Leave (SL)
- Earned / Privilege Leave (EL/PL)
- Maternity / Paternity Leave
- Compensatory Off (Comp-Off)
- Loss of Pay (LOP)
- Special Leave
- Bereavement Leave

Per type: annual quota, carry-forward rules, encashment eligibility, gender restrictions.

#### 4.5.2 Leave Application Flow

```
Employee applies → Manager notified → Manager approves/rejects
→ HR notified → Attendance auto-updated → Email confirmation sent
```

- Half-day option
- Multiple consecutive days
- Attach medical certificate for Sick Leave > 2 days
- LOP auto-triggered if leave balance exhausted

#### 4.5.3 Leave Balance

- Real-time balance per leave type
- Accrual: monthly or annually (configurable)
- Carry-forward: defined cap per leave type
- Encashment on exit (based on policy)

#### 4.5.4 Team Leave Calendar

- Visual calendar showing who's on leave (within same team/department)
- Overlap detection: alert if > N% of team on leave on same day

#### 4.5.5 Leave Reports

- Leave utilization per employee / department
- LOP summary (for payroll)
- Absenteeism trends

#### 4.5.6 UI Pages

- `/leave` - My leave balance + Apply leave
- `/leave/calendar` - Team leave calendar
- `/leave/approvals` - Manager approval queue
- `/leave/history` - Leave history (filterable)
- `/leave/admin` - HR admin: all leaves, policy configuration

---

### M6 - Payroll

**Purpose:** Accurate, auditable monthly payroll calculation with compliance support.

#### 4.6.1 Salary Structure

- Define CTC components per employee or designation:
  - Fixed: Basic, HRA, Transport Allowance, Special Allowance
  - Variable: Performance bonus, incentive
  - Deductions: PF (Employee + Employer), ESI, Professional Tax, TDS, LOP deduction

- Salary template builder: create named templates, apply to employee groups

#### 4.6.2 Payroll Processing Cycle

```
1. Lock attendance for month (M4 feeds LOP days)
2. Pull approved leave data (M5 feeds LOP)
3. Calculate gross = fixed + variable
4. Apply deductions (statutory + voluntary)
5. Calculate net pay
6. Generate payslips (PDF)
7. HR review → Approve → Mark as paid
8. Bank transfer file export (NEFT/RTGS format)
9. Lock payroll for month (immutable audit record)
```

- Payroll run: department-wise or company-wide
- One-click re-run if corrections needed before approval

#### 4.6.3 Statutory Compliance

- PF: 12% employee + 12% employer contribution auto-calculated
- ESI: applicable for CTC ≤ ₹21,000
- Professional Tax: state-wise slab configuration
- TDS: Form 16, tax declaration by employee, old vs new regime
- Gratuity tracker

#### 4.6.4 Payslip

- Auto-generated PDF payslip per employee per month
- Shows: earnings breakdown, deductions breakdown, net pay, YTD totals
- Emailed automatically to employee on payroll approval
- Downloadable from self-service portal

#### 4.6.5 Reports

- Payroll summary (per month)
- Department-wise payroll cost
- PF/ESI challan reports
- TDS reports
- Bank disbursement file (CSV for bank upload)
- Form 16 generation

#### 4.6.6 UI Pages

- `/payroll` - Payroll dashboard (current month status)
- `/payroll/run` - Payroll processing wizard
- `/payroll/salary-structures` - Salary component templates
- `/payroll/history` - Past payroll records
- `/payroll/reports` - All compliance and summary reports
- `/payroll/settings` - PF, ESI, PT configuration per state

---

### M7 - Performance Evaluation

**Purpose:** Structured, fair, and data-driven employee performance management.

#### 4.7.1 Evaluation Cycles

- Configurable cycles: Annual, Semi-Annual, Quarterly
- Evaluation types:
  - Self-Assessment
  - Manager Review
  - Peer Review (360°)
  - Project-Based Auto-Evaluation (fed by M9)

#### 4.7.2 Performance Review Form Builder

HR Admin can build custom forms with:

- Rating scales (1–5, 1–10, or custom labels)
- Competency sections: Technical Skills, Communication, Leadership, Teamwork, Punctuality
- Goal-based sections: set goals at start of cycle, rate achievement at end
- Free-text comments per section
- Weighted scoring per section

#### 4.7.3 KPI & Goal Setting

- At cycle start: Manager sets goals for employee (SMART goals)
- Mid-cycle: check-in reviews
- End of cycle: achievement rating

#### 4.7.4 Auto-Evaluation from Project Module (M9)

- System calculates: `task_completion_rate = tasks_completed / tasks_assigned × 100`
- Weighted by: task priority (critical > high > medium > low)
- Average across all projects in the evaluation period
- Auto-populates a "Project Performance" section in the review form
- Score bands:
  - ≥ 90% → Exceptional
  - 75–89% → Meets Expectations
  - 60–74% → Needs Improvement
  - < 60% → Underperforming

#### 4.7.5 Evaluation Workflow

```
HR initiates cycle → Employees submit self-assessment
→ Manager reviews + rates → (optional) Peer feedback
→ Final score calculated → Manager discusses with employee
→ Employee acknowledges → HR closes cycle → Scores archived
```

#### 4.7.6 Performance Dashboard

- Company-wide distribution chart (bell curve)
- Department-wise performance heatmap
- Top performers list
- Employees flagged for PIP (Performance Improvement Plan)
- Year-over-year trend per employee

#### 4.7.7 PIP (Performance Improvement Plan)

- HR/Manager creates PIP for underperforming employees
- Define: improvement goals, timeline, check-in schedule
- Track milestones within PIP

#### 4.7.8 UI Pages

- `/performance` - Evaluation cycles list
- `/performance/cycles/:id` - Cycle detail, employee status list
- `/performance/review/:employeeId` - Review form (manager view)
- `/performance/self-assessment` - Employee self-assessment form
- `/performance/dashboard` - Analytics and distribution
- `/performance/pip` - PIP management

---

### M8 - Document Management

**Purpose:** Centralized, secure, access-controlled storage for all HR and employee documents.

#### 4.8.1 Document Types

**Company Documents**

- HR policies, employee handbook
- Offer letter templates, NDA templates
- Compliance certificates, registrations

**Employee Documents**

- Identity: Aadhar, PAN, Passport, Driving License
- Academic: Degree certificates, marksheets
- Professional: Previous experience letters, relieving letters
- Employment: Offer letter, appointment letter, increment letters, promotion letters, warning letters
- Tax: Form 16, investment declarations

#### 4.8.2 Features

- Upload: PDF, DOCX, JPG, PNG (max 20MB per file)
- Versioning: retain previous versions of the same document
- Expiry tracking: alert when a document (e.g., passport, visa) is about to expire
- E-sign integration: send documents for digital signature
- Bulk download as ZIP
- Watermarking on sensitive documents (optional)
- Virus/malware scan on upload

#### 4.8.3 Access Control

- Access governed by M1 (PBAC)
- Document-level permissions: HR Admin can see all; Employees see only own docs
- Shareable link with expiry (for external sharing, e.g., auditors)

#### 4.8.4 HR Document Templates

- Template library (offer letters, appointment letters, increment letters, etc.)
- Merge fields auto-fill employee data
- One-click generate → download as PDF / send to employee

#### 4.8.5 UI Pages

- `/documents` - HR's document library
- `/documents/employee/:id` - Employee's document locker
- `/documents/templates` - Template builder and library
- `/documents/expiry-tracker` - Documents expiring within next 30/60/90 days

---

### M9 - Project & Task Management

**Purpose:** Track all company projects with phase-level granularity, task assignments, and team performance visibility - integrated with PBAC and Performance Evaluation.

#### 4.9.1 Project Structure

```
Project
  └── Phases (e.g., Discovery, Design, Development, Testing, Deployment)
        └── Tasks
              └── Sub-tasks (optional)
```

#### 4.9.2 Project Fields

- Project name, description, client (internal/external)
- Start date, expected end date, actual end date
- Status: Planning / Active / On Hold / Completed / Cancelled
- Priority: Critical / High / Medium / Low
- Project Manager (from employee list)
- Budget (optional)
- Tags / Category

#### 4.9.3 Phase Management

- Add unlimited phases per project
- Each phase has: name, start date, end date, completion %
- Phase status: Not Started / In Progress / Completed / Blocked
- Phases can run sequentially or in parallel
- Phase completion auto-calculated from task completion within it

#### 4.9.4 Team Management

- Assign employees to a project (role: Project Manager / Team Lead / Developer / Designer / etc.)
- PBAC per project: a Project Manager only sees projects they manage
- Team members see only their assigned tasks by default
- Project-level permission overrides possible

#### 4.9.5 Task Management

- Task fields:
  - Title, description
  - Assignee (must be a project team member)
  - Phase
  - Priority: Critical / High / Medium / Low
  - Due date
  - Status: To Do / In Progress / In Review / Done / Blocked
  - Estimated hours, Logged hours
  - Attachments, comments thread
  - Labels / tags

- Task views:
  - Kanban board (per phase or project-wide)
  - List view (with sorting, filtering)
  - Gantt chart (timeline view)
  - Calendar view

- Task assignment triggers: auto-email notification to assignee (M10)

#### 4.9.6 Task Completion & Performance Feed

- When task status → Done: completion timestamp recorded
- System tracks per employee:
  - Total tasks assigned
  - Tasks completed on time
  - Tasks completed late
  - Tasks not completed (past due)
- This data feeds M7 auto-evaluation score at end of review cycle

#### 4.9.7 Project Dashboard

- All projects: progress bars, phase status, team member count
- Drill-down: per project, see phases, task completion %, blockers
- My Tasks: personal task list across all projects
- Gantt view across all active projects (portfolio view)

#### 4.9.8 Time Logging

- Employees log time against tasks
- Weekly timesheets (submit + manager approve)
- Billable vs non-billable hours tracking

#### 4.9.9 UI Pages

- `/projects` - All projects grid/list (filterable by status, PM, date)
- `/projects/new` - Create project wizard
- `/projects/:id` - Project overview (phases, team, progress)
- `/projects/:id/tasks` - Task board (Kanban/List/Gantt toggle)
- `/projects/:id/team` - Team assignments
- `/projects/:id/reports` - Project-specific performance report
- `/tasks/my` - Cross-project personal task list
- `/timesheets` - Weekly timesheet entry

---

### M10 - Notifications & Auto-Mailer

**Purpose:** Trigger timely, templated, professional communications for key HR events - zero manual effort.

#### 4.10.1 Trigger Events & Email Types

| Trigger                        | Recipients                    | Template                               |
| ------------------------------ | ----------------------------- | -------------------------------------- |
| Candidate shortlisted          | Candidate                     | Shortlisting confirmation + next steps |
| Offer letter sent              | Candidate                     | Offer letter PDF attached              |
| Offer accepted                 | HR Admin, Hiring Manager      | Offer acceptance alert                 |
| New employee onboarded         | Employee, Manager, IT, HR     | Welcome email + onboarding checklist   |
| Employee birthday              | Employee, Manager (optional)  | Birthday greeting                      |
| Leave application submitted    | Manager                       | Leave approval request                 |
| Leave approved/rejected        | Employee                      | Leave decision notification            |
| Leave balance < threshold      | Employee                      | Low leave balance alert                |
| Payslip generated              | Employee                      | Payslip PDF attached                   |
| Performance review initiated   | Employee                      | Review form link                       |
| Task assigned                  | Assignee                      | Task details + link                    |
| Task overdue                   | Assignee, Manager             | Overdue alert                          |
| Document expiring (30/60 days) | HR Admin                      | Expiry reminder                        |
| Probation ending (30 days)     | HR Manager, Reporting Manager | Probation review reminder              |
| Work anniversary               | Employee, HR                  | Work anniversary greeting              |

#### 4.10.2 Email Template Engine

- Rich-text template builder (WYSIWYG)
- Merge fields: `{{employee_name}}`, `{{department}}`, `{{leave_dates}}`, etc.
- Preview with sample data before saving
- Per-template enable/disable toggle
- Multi-language support (optional future feature)

#### 4.10.3 Notification Channels

- **Email** (primary): via SMTP / SendGrid / AWS SES
- **In-App Notification Bell**: real-time, with read/unread state
- **WhatsApp** (optional future): via WhatsApp Business API

#### 4.10.4 Notification Log

- Log of every notification sent: recipient, trigger, timestamp, status (delivered/failed)
- Retry on failure
- Unsubscribe per notification type (for non-critical ones)

#### 4.10.5 Scheduler

- Birthday emails: daily cron at 8AM
- Work anniversary: daily cron at 8AM
- Document expiry reminders: weekly cron
- Probation reminders: weekly cron
- Overdue task alerts: daily cron at 9AM

#### 4.10.6 UI Pages

- `/notifications` - In-app notification center
- `/admin/email-templates` - Template management
- `/admin/notification-log` - Delivery log
- `/admin/notification-settings` - Enable/disable per trigger

---

### M11 - Analytics & Reporting Dashboard

**Purpose:** Give leadership a bird's-eye view of organizational health across all modules.

#### 4.11.1 Executive Dashboard (Home)

Live cards:

- Total Employees (active / on leave / WFH today)
- Open Positions (from Recruitment)
- Payroll cost this month
- Average attendance % (this month)
- Projects: Active / Completed / Blocked
- Top performers (from last evaluation cycle)

Charts:

- Headcount trend (12-month line chart)
- Department-wise headcount (donut chart)
- Attendance trend (bar chart, last 6 months)
- Hiring funnel (conversion rates per stage)

#### 4.11.2 Module-Specific Reports

Each module exports its own reports (described in each module section above). Reports available:

| Module         | Key Reports                                               |
| -------------- | --------------------------------------------------------- |
| M2 Employee    | Headcount by dept/designation, Joiners/Leavers, Org chart |
| M3 Recruitment | Pipeline report, source analysis, time-to-hire            |
| M4 Attendance  | Monthly attendance sheet, LOP list, late arrivals         |
| M5 Leave       | Utilization report, LOP impact                            |
| M6 Payroll     | Payroll summary, PF/ESI challan, Form 16, bank file       |
| M7 Performance | Score distribution, PIP list, top/bottom performers       |
| M9 Projects    | Task completion rate per person, project health report    |

#### 4.11.3 Custom Report Builder

- Drag-and-drop field selector
- Filter by date range, department, employee, project
- Group by any field
- Visualization: table, bar chart, pie chart, line chart
- Save report template
- Schedule report: auto-email to HR every month

#### 4.11.4 UI Pages

- `/dashboard` - Executive home dashboard
- `/reports` - Report catalog
- `/reports/custom` - Custom report builder
- `/reports/scheduled` - Scheduled reports list

---

## 5. UI/UX Design Guidelines

### 5.1 Design Language

- **Style:** Modern SaaS - clean, minimal, data-forward
- **Color Palette:**
  - Primary: `#2563EB` (Blue 600) - actions, CTAs
  - Secondary: `#7C3AED` (Violet 600) - accents
  - Success: `#16A34A` (Green 600)
  - Warning: `#D97706` (Amber 600)
  - Danger: `#DC2626` (Red 600)
  - Background: `#F8FAFC` (Slate 50)
  - Surface: `#FFFFFF`
  - Text Primary: `#0F172A` (Slate 900)
  - Text Secondary: `#64748B` (Slate 500)
  - Border: `#E2E8F0` (Slate 200)

- **Typography:** Inter (headings) + Inter (body) - system-ui fallback
- **Radius:** 8px cards, 6px buttons, 4px inputs
- **Shadows:** Subtle (1–2px elevation only)
- **Icons:** Lucide React (consistent, outlined)

### 5.2 Layout

- **Sidebar navigation** (collapsible, 240px expanded / 64px icon-only)
- **Top bar:** search, notification bell, user avatar
- **Main content:** max-width container with responsive grid
- **Breadcrumbs** on all inner pages

Sidebar structure:

```
🏠 Dashboard
👥 Employees
   ├── Directory
   └── Org Chart
📋 Recruitment
⏱ Attendance
🗓 Leave
💰 Payroll
📊 Performance
📁 Documents
🚀 Projects
   └── My Tasks
📧 Notifications
📈 Reports
⚙️  Admin (PBAC, Settings)
```

### 5.3 Key UX Patterns

- **Empty states:** illustrated, with a clear CTA (not just "No data")
- **Loading skeletons:** never spinners on full-page loads
- **Optimistic UI:** actions feel instant, errors roll back
- **Inline editing:** click a field to edit in-place where applicable
- **Bulk actions:** checkbox select + action bar (for employee lists, task lists)
- **Confirmation dialogs:** for destructive actions only
- **Toast notifications:** non-blocking, top-right, 3-second auto-dismiss
- **Responsive:** tablet-friendly minimum; mobile for employee self-service
- **Keyboard shortcuts:** documented, accessible

### 5.4 Accessibility

- WCAG 2.1 AA compliant
- All interactive elements focusable and keyboard navigable
- Color is never the sole indicator of state
- Screen reader labels on all form fields

---

## 6. Tech Stack Recommendation

Single Next.js 14 monorepo - frontend pages and backend API routes live together. No separate backend server.

### Framework & Language

| Layer     | Choice                      | Reason                                                                            |
| --------- | --------------------------- | --------------------------------------------------------------------------------- |
| Framework | **Next.js 14 (App Router)** | Unified frontend + API in one project; Route Handlers replace a standalone server |
| Language  | TypeScript                  | End-to-end type safety across pages and API routes                                |
| Runtime   | Node.js 20                  | Next.js API routes run as standard Node.js; no extra runtime needed               |

### Frontend (UI layer - `/app/(dashboard)/`)

| Layer            | Choice                          | Reason                                                            |
| ---------------- | ------------------------------- | ----------------------------------------------------------------- |
| UI Components    | shadcn/ui + Tailwind CSS        | Accessible, themeable, copy-paste component library               |
| State - server   | TanStack Query (React Query v5) | Data fetching, caching, background refetch against `/api/` routes |
| State - client   | Zustand                         | Lightweight global UI state (sidebar, modals, user session)       |
| Charts           | Recharts                        | React-native, composable charts                                   |
| Tables           | TanStack Table v8               | Headless, virtual scroll, server-side pagination                  |
| Rich Text Editor | Tiptap                          | Email template builder in M10                                     |
| Forms            | React Hook Form + Zod           | Performant, schema-validated forms                                |
| PDF Viewer       | react-pdf                       | View uploaded PDFs in-browser                                     |
| Date utilities   | date-fns                        | Lightweight date formatting and arithmetic                        |

### Backend (API layer - `/app/api/`)

| Layer           | Choice                                | Reason                                                                                                          |
| --------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| API style       | Next.js Route Handlers (`route.ts`)   | Built into Next.js; no separate server process                                                                  |
| PBAC middleware | Next.js `middleware.ts`               | Runs on Edge before every `/api/*` request; validates JWT + checks permission scope                             |
| Auth            | **next-auth v5 (Auth.js)**            | Session management, JWT, OAuth (Google/Microsoft SSO), MFA support                                              |
| ORM             | **Prisma**                            | Type-safe DB client, schema-first migrations, works perfectly in Next.js API routes                             |
| Job Queue       | **BullMQ** (Redis-backed)             | Email jobs, scheduled crons (attendance sync, birthday emails); runs as a separate worker process (`worker.ts`) |
| File Storage    | **MinIO** (self-hosted S3-compatible) | Document/payslip/resume storage; signed URLs for secure download                                                |
| Email           | Nodemailer + SendGrid                 | Nodemailer for SMTP; SendGrid as fallback via API                                                               |
| PDF Generation  | Puppeteer (headless)                  | Server-side payslip, offer letter, report PDF generation in API routes                                          |
| Validation      | Zod                                   | Shared schema validation used in both forms and API route request bodies                                        |
| HTTP client     | Axios                                 | Internal calls to Hikvision ISAPI from API routes                                                               |

### Database

| Layer               | Choice                                                           |
| ------------------- | ---------------------------------------------------------------- |
| Primary DB          | PostgreSQL 16                                                    |
| Cache + Queue store | Redis 7 (also used by BullMQ)                                    |
| Full-text search    | PostgreSQL `tsvector` to start; migrate to Meilisearch if needed |
| File storage        | MinIO (S3-compatible, self-hosted)                               |

### DevOps

| Layer         | Choice                                               |
| ------------- | ---------------------------------------------------- |
| CI/CD         | GitHub Actions                                       |
| Hosting       | Hetzner VPS / AWS EC2 (self-hosted)                  |
| Reverse Proxy | Nginx (SSL termination + static asset caching)       |
| SSL           | Let's Encrypt (Certbot)                              |
| Monitoring    | Grafana + Prometheus                                 |
| Logs          | Loki (or PM2 logs)                                   |
| Backups       | Daily `pg_dump` → MinIO bucket with 30-day retention |

### Key architectural notes

- **No separate backend server.** Everything runs inside Next.js. The `/app/api/` Route Handlers ARE the backend.
- **BullMQ worker** is the only separate process - it runs as `node worker.ts` alongside Next.js to process email jobs and cron tasks (Hikvision sync, birthday mailer, etc.) without blocking API responses.
- **Prisma client** is instantiated as a singleton in `lib/db.ts` and imported directly into Route Handlers.
- **PBAC** is enforced in `middleware.ts` (Edge runtime) for route-level guards, with fine-grained permission checks inside each Route Handler using `lib/auth.ts` helpers.
- **Shared Zod schemas** live in `lib/schemas/` and are imported by both the form layer and API route handlers - single source of truth for validation.

---

## 7. Integration Specifications

### 7.1 Hikvision Device Integration

**Device:** Hikvision DS-K Series Face Recognition Terminal

**Method 1: ISAPI HTTP Pull (Recommended)**

```
Backend Cron (every 15 min):
  GET http://<device_ip>/ISAPI/AccessControl/AcsEvent?format=json
  Headers: Authorization: Digest <credentials>

Response: array of events
  {
    "employeeNoString": "EMP-2024-0042",
    "time": "2026-04-06T09:04:22",
    "eventType": "entry", // or "exit"
    "deviceName": "Main Gate"
  }

Backend maps employeeNoString → employee_id
Inserts into attendance_logs table
Deduplicates by (employee_id, timestamp)
```

**Method 2: CSV Import Parser**

Supported columns from Hikvision export:

- `Card No` or `Employee No`
- `Date Time`
- `Event Description` (Entry / Exit)

Mapping rules:

- Employee No → matched against `employees.device_id` field
- First event of day = IN, last event = OUT
- Intermediate events discarded

### 7.2 Email Service (SMTP / SendGrid)

- Configure SMTP credentials in Admin Settings
- Fallback: SendGrid API if SMTP fails
- All outbound emails BCC to `hr-archive@company.com` (configurable)

### 7.3 Calendar Integration (Optional)

- Google Calendar API: create interview events, auto-send invites
- Outlook/Exchange: CalDAV sync

### 7.4 E-Sign Integration (Optional)

- DocuSign API or DigiLocker API for Indian compliance
- Alternatively: native canvas-based signature capture

---

## 8. Data Models

### Core Tables (simplified)

```sql
-- Employees
employees (
  id UUID PK,
  employee_no VARCHAR UNIQUE,
  device_id VARCHAR,          -- Hikvision device card/face ID
  first_name, last_name,
  email VARCHAR UNIQUE,
  department_id FK,
  designation_id FK,
  manager_id FK → employees(id),
  status ENUM(active, on_leave, resigned, terminated),
  joined_at DATE,
  created_at, updated_at
)

-- PBAC
roles (id, name, description)
permissions (id, scope VARCHAR UNIQUE)  -- e.g. "payroll:run"
role_permissions (role_id FK, permission_id FK)
employee_roles (employee_id FK, role_id FK, scope_type, scope_id)

-- Attendance
attendance_logs (
  id UUID PK,
  employee_id FK,
  log_date DATE,
  punch_in TIMESTAMP,
  punch_out TIMESTAMP,
  total_hours DECIMAL,
  status ENUM(present, absent, half_day, late, holiday, on_leave, wfh),
  source ENUM(device, manual, import, wfh),
  created_at
)

-- Leave
leave_types (id, name, annual_quota, carry_forward_limit, ...)
leave_balances (employee_id FK, leave_type_id FK, year, allocated, used, remaining)
leave_requests (
  id UUID PK,
  employee_id FK,
  leave_type_id FK,
  from_date, to_date,
  days DECIMAL,
  status ENUM(pending, approved, rejected, cancelled),
  approver_id FK,
  reason, rejection_reason
)

-- Payroll
salary_structures (id, name, is_template)
salary_components (id, structure_id FK, name, type ENUM(earning, deduction), amount_type ENUM(fixed, percentage), value)
payroll_runs (id, month, year, status ENUM(draft, approved, paid), total_gross, total_net, run_by FK)
payslips (id, payroll_run_id FK, employee_id FK, gross, deductions, net, pdf_url)

-- Projects
projects (id, name, status, start_date, end_date, project_manager_id FK, ...)
project_phases (id, project_id FK, name, status, start_date, end_date, order_index)
project_members (project_id FK, employee_id FK, role VARCHAR)
tasks (
  id UUID PK,
  project_id FK, phase_id FK,
  title, description,
  assignee_id FK,
  priority ENUM(critical, high, medium, low),
  status ENUM(todo, in_progress, in_review, done, blocked),
  due_date DATE,
  completed_at TIMESTAMP,
  estimated_hours, logged_hours
)

-- Recruitment
job_requisitions (id, title, department_id FK, status, ...)
candidates (id, name, email, phone, resume_url, skills[], ...)
pipeline_stages (id, jr_id FK, name, order_index)
candidate_pipeline (id, candidate_id FK, jr_id FK, stage_id FK, status, ...)
interviews (id, candidate_pipeline_id FK, scheduled_at, interviewers[], feedback, score)

-- Performance
evaluation_cycles (id, name, type, start_date, end_date, status)
evaluation_forms (id, cycle_id FK, employee_id FK, reviewer_id FK, type, scores JSONB, final_score, status)
kpis (id, employee_id FK, cycle_id FK, goal, target, achievement, weight)
```

---

## 9. Non-Functional Requirements

| Requirement          | Target                                                       |
| -------------------- | ------------------------------------------------------------ |
| **Performance**      | Page load < 2s (P95); API response < 300ms (P95)             |
| **Availability**     | 99.5% uptime (max ~44h downtime/year)                        |
| **Scalability**      | Support 1,000 concurrent users; 10,000 employee records      |
| **Security**         | OWASP Top 10 compliance; all PII encrypted at rest (AES-256) |
| **Data Backup**      | Daily automated PostgreSQL backup; 30-day retention          |
| **Audit Trail**      | All sensitive mutations logged with actor + timestamp        |
| **Session Security** | JWT expiry 15min; secure HttpOnly cookies; CSRF protection   |
| **File Security**    | Signed URLs for document downloads (15-min expiry)           |
| **Browser Support**  | Chrome 100+, Edge 100+, Firefox 100+, Safari 15+             |
| **Localization**     | INR currency; IST timezone default; date format DD/MM/YYYY   |

---

## 10. Phased Rollout Plan

### Phase 1 - Core Foundation (Months 1–2)

- M1: Authentication + PBAC
- M2: Employee Management (profiles, directory)
- M8: Document Management (basic upload/view)
- M10: Email engine (SMTP setup, basic templates)

### Phase 2 - Attendance & Leave (Month 3)

- M4: Attendance - CSV import (Option C) first, ISAPI integration (Option A) as stretch
- M5: Leave Management
- M10: Leave email triggers

### Phase 3 - Payroll (Month 4)

- M6: Payroll module
- M10: Payslip auto-email

### Phase 4 - Recruitment (Month 5)

- M3: Recruitment & Screening
- M10: Candidate email triggers (shortlist, offer, onboarding)

### Phase 5 - Projects & Performance (Months 6–7)

- M9: Project & Task Management
- M7: Performance Evaluation (manual + auto from M9)
- M10: Task and review triggers

### Phase 6 - Analytics & Polish (Month 8)

- M11: Analytics Dashboard
- Custom report builder
- UI polish, mobile responsiveness
- Hikvision ISAPI live sync (if not done in Phase 2)
- Penetration testing, performance audit

---

## Appendix A - Role-Permission Matrix (excerpt)

| Permission            | super_admin | hr_admin | hr_manager | payroll_mgr | project_mgr | team_lead | employee |
| --------------------- | :---------: | :------: | :--------: | :---------: | :---------: | :-------: | :------: |
| employee:read         |      ✓      |    ✓     |     ✓      |      ✓      |  ✓ (team)   | ✓ (team)  |    ✗     |
| employee:write        |      ✓      |    ✓     |     ✓      |      ✗      |      ✗      |     ✗     |    ✗     |
| payroll:run           |      ✓      |    ✗     |     ✗      |      ✓      |      ✗      |     ✗     |    ✗     |
| payroll:view_own      |      ✓      |    ✓     |     ✓      |      ✓      |      ✓      |     ✓     |    ✓     |
| attendance:edit       |      ✓      |    ✓     |     ✓      |      ✗      |      ✗      |     ✗     |    ✗     |
| attendance:import     |      ✓      |    ✓     |     ✓      |      ✗      |      ✗      |     ✗     |    ✗     |
| project:create        |      ✓      |    ✗     |     ✗      |      ✗      |      ✓      |     ✗     |    ✗     |
| project:assign_task   |      ✓      |    ✗     |     ✗      |      ✗      |      ✓      |     ✓     |    ✗     |
| task:update_own       |      ✓      |    ✓     |     ✓      |      ✓      |      ✓      |     ✓     |    ✓     |
| recruitment:shortlist |      ✓      |    ✓     |     ✓      |      ✗      |      ✗      |     ✗     |    ✗     |
| performance:run_cycle |      ✓      |    ✓     |     ✗      |      ✗      |      ✗      |     ✗     |    ✗     |
| reports:all           |      ✓      |    ✓     |     ✗      |      ✗      |      ✗      |     ✗     |    ✗     |

---

## Appendix B - API Route Structure (Next.js Route Handlers)

All routes live under `app/api/` as `route.ts` files. Each file exports named HTTP method handlers (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).

```
app/api/
├── auth/
│   ├── [...nextauth]/route.ts     next-auth sign-in/out/callback
│   └── session/route.ts           current session info
├── employees/
│   ├── route.ts                   GET (list, search) · POST (create)
│   ├── [id]/route.ts              GET · PATCH · DELETE
│   ├── [id]/documents/route.ts    GET employee docs
│   └── org-chart/route.ts         GET hierarchy tree
├── recruitment/
│   ├── jobs/route.ts              GET · POST
│   ├── jobs/[id]/route.ts         GET · PATCH · DELETE
│   ├── candidates/route.ts        GET · POST
│   ├── candidates/[id]/route.ts   GET · PATCH
│   ├── pipeline/[jrId]/route.ts   GET pipeline stages + cards
│   └── interviews/route.ts        GET · POST · PATCH
├── attendance/
│   ├── route.ts                   GET (monthly grid)
│   ├── import/route.ts            POST (CSV upload)
│   ├── sync/route.ts              POST (trigger Hikvision ISAPI pull)
│   ├── regularization/route.ts    GET · POST · PATCH
│   ├── shifts/route.ts            GET · POST · PATCH
│   └── holidays/route.ts          GET · POST · DELETE
├── leave/
│   ├── types/route.ts             GET · POST · PATCH
│   ├── balances/route.ts          GET
│   ├── requests/route.ts          GET · POST
│   └── requests/[id]/route.ts     PATCH (approve/reject)
├── payroll/
│   ├── structures/route.ts        GET · POST · PATCH
│   ├── runs/route.ts              GET · POST (trigger run)
│   ├── runs/[id]/route.ts         GET · PATCH (approve/lock)
│   ├── payslips/[employeeId]/route.ts  GET list
│   └── reports/route.ts           GET (challan, Form16, bank file)
├── performance/
│   ├── cycles/route.ts            GET · POST
│   ├── cycles/[id]/route.ts       GET · PATCH
│   ├── reviews/[employeeId]/route.ts  GET · POST · PATCH
│   └── kpis/route.ts              GET · POST · PATCH
├── documents/
│   ├── upload/route.ts            POST (multipart)
│   ├── [id]/route.ts              GET (signed URL) · DELETE
│   └── templates/route.ts         GET · POST · PATCH
├── projects/
│   ├── route.ts                   GET · POST
│   ├── [id]/route.ts              GET · PATCH · DELETE
│   ├── [id]/phases/route.ts       GET · POST · PATCH
│   ├── [id]/members/route.ts      GET · POST · DELETE
│   ├── [id]/tasks/route.ts        GET · POST
│   └── tasks/[taskId]/route.ts    GET · PATCH · DELETE
├── notifications/
│   ├── inbox/route.ts             GET · PATCH (mark read)
│   ├── templates/route.ts         GET · POST · PATCH
│   └── settings/route.ts          GET · PATCH
└── reports/
    ├── route.ts                   GET (catalog)
    └── custom/route.ts            POST (run custom query)
```

Every route handler calls `withAuth(req, requiredScope)` from `lib/auth.ts` as the first line to enforce PBAC before any business logic runs.

---

_End of PRD - Version 1.0_  
_Next step: Review with stakeholders → Prioritize Phase 1 → Define wireframes → Kick off development_
