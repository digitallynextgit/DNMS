# DNMS - User Flows (Plain English)

> **Test Accounts** (password for all: `Admin@123`)
>
> - Super Admin: `admin@hrms.dev`
> - HR Admin: `priya.sharma@hrms.dev`
> - HR Manager: `rahul.verma@hrms.dev`
> - Employee: `neha.gupta@hrms.dev`
> - Viewer: `viewer@hrms.dev`

---

## M1 - Authentication & Access Control

### Who uses it

Everyone. HR Admins manage roles and permissions.

### Login

1. Go to `http://localhost:3000` → redirected to `/login`
2. Enter email + password → click **Sign In**
3. You land on the dashboard based on your role
4. If you forgot your password → click **"Forgot password?"** → enter email → get a reset link in your inbox → set a new password

### Roles & Permissions (HR Admin / Super Admin only)

1. Go to **Admin → Roles & Permissions** in the sidebar
2. You see all 5 system roles (Super Admin, HR Admin, HR Manager, Employee, Viewer)
3. Click **"Create Role"** to add a custom role - give it a name and select which permissions it has (e.g., can read employees but not edit payroll)
4. Edit an existing role to change its permissions
5. Assign a role to an employee from their profile page

### Audit Log (HR Admin / Super Admin only)

1. Go to **Admin → Audit Log**
2. See every action taken in the system - who did what, when, and on which record
3. Filter by module (employees, leave, payroll, etc.) or search by person

---

## M2 - Employee Management

### Who uses it

- HR Admin / HR Manager: full CRUD
- Employee: view own profile, update limited fields
- Viewer: read-only

### Adding a New Employee (HR Admin)

1. Go to **Employees** → click **"Add Employee"**
2. Fill in: First name, Last name, Email, Phone, Department, Designation, Date of joining, Employee number
3. Set their reporting manager from the dropdown
4. Click **Save** → employee is created, a welcome email is sent automatically
5. The system auto-assigns the "Employee" role

### Browsing the Employee Directory

1. Go to **Employees** → see a card grid of all employees
2. Use the search bar to find by name or employee number
3. Filter by department or status (Active / Inactive)
4. Click a card → opens the employee's full profile

### Employee Profile Tabs

- **Info**: Personal details, contact, emergency contact, address
- **Documents**: All files uploaded for that employee
- **Roles**: Which roles are assigned; HR Admin can add/remove roles here

### Editing an Employee (HR Admin)

1. Open the employee's profile → click **"Edit"**
2. Change any field → click **Save**
3. To deactivate: change Status to "Inactive"

### Org Chart

1. Go to **Employees → Org Chart**
2. See the full company hierarchy as a tree - who reports to whom
3. Click any node to jump to that employee's profile

### Self-Service Profile (Employee)

1. Go to **Profile** (avatar in top-right → Profile)
2. Update your phone number, current address, emergency contact
3. Go to the **Security** tab → change your password (enter current + new password)

---

## M3 - Recruitment

### Who uses it

- HR Admin / HR Manager: create jobs, manage applicants
- Viewer: read-only

### Posting a Job

1. Go to **Recruitment** → click **"Post a Job"**
2. Fill in: Job title, Department, Location, Type (Full-time / Part-time / Contract / Internship), Salary range (min–max), Closing date, Description
3. Set status to **Open** (or keep as Draft)
4. Click **Save** → job appears in the job postings grid

### Managing Applicants (Kanban Pipeline)

1. Click on any job posting card → opens the **Kanban pipeline** for that job
2. Columns represent stages: **Applied → Screening → Interview → Offer → Hired / Rejected**
3. Each card shows the applicant's name, email, phone, and interview count

#### Adding an Applicant

1. Click **"Add Applicant"** → fill in: First name, Last name, Email, Phone, Source (LinkedIn, Naukri, Referral, etc.), Notes
2. Click Save → applicant appears in the **Applied** column

#### Moving an Applicant

1. On the applicant's card → use the **Stage** dropdown to move them (e.g., Applied → Screening)
2. The card moves to the new column instantly

#### Scheduling an Interview

1. Click **"Schedule Interview"** on an applicant card
2. Select: Interview type (Phone / Video / In-Person / Technical / HR), Date & time, Interviewer (optional)
3. Save → interview is logged against the applicant

#### Rejecting an Applicant

1. Move stage to **Rejected** → optionally add a rejection reason
2. The card moves to the Rejected column

---

## M4 - Attendance & Time Tracking

### Who uses it

- HR Admin / HR Manager: overview, manual entry, manage devices
- Employee: view own attendance, GPS check-in, QR scan
- All: CSV import (HR only)

### Attendance Overview (HR Admin)

1. Go to **Attendance** → see a table of all attendance logs
2. Filter by employee, date range, or status (Present / Absent / Half Day / Late)
3. Click **"Add Record"** to manually enter attendance for an employee

### My Attendance (Employee)

1. Go to **Attendance → My Attendance**
2. See your own check-in/out times for each day this month
3. Summary cards: Present days, Absent days, Late days, Work hours

### GPS Check-In (Employee - Mobile/Browser)

1. Go to **Attendance → GPS Check-In**
2. Click **"Refresh Location"** → browser asks for location permission → allow it
3. Your coordinates appear on screen
4. If you're within the office geofence (300m of Mumbai HQ by default):
   - Click **"Check In"** in the morning
   - Click **"Check Out"** when leaving
5. If you're outside the geofence → you get an error showing how far you are

### QR Kiosk (Tablet at Reception)

1. HR Admin opens **Attendance → QR Kiosk** on a tablet at the office entrance
2. A large QR code is displayed - it auto-refreshes every 5 minutes
3. Employees scan it with their phone camera → a scan page opens → click **Check In** or **Check Out**
4. Confirmation shows the employee name and time

### CSV Import (HR Admin)

1. Go to **Attendance → CSV Import**
2. Download the template (columns: `employee_no, date, check_in, check_out`)
3. Fill it in with your data (e.g., from a legacy system)
4. Upload the CSV → click **"Validate"** → see a preview table showing which rows are valid/invalid
5. Fix any errors (wrong employee number, missing date)
6. Click **"Import"** → records are added to the database
7. Existing records for the same employee+date are updated, not duplicated

### Hikvision Device Sync (HR Admin)

1. Go to **Attendance → Devices**
2. Add a device: IP address, port, username, password of the Hikvision face terminal
3. Click **"Test Connection"** → confirms the device is reachable
4. Click **"Sync"** → pulls all check-in/check-out events from the device and creates attendance logs

### Holidays

1. Go to **Attendance → Holidays**
2. See all national/company holidays for the year
3. HR Admin can add custom holidays (e.g., company anniversary)

---

## M5 - Leave Management

### Who uses it

- Employee: apply for leave, view own balance
- HR Manager: approve/reject team leaves
- HR Admin: manage leave types, view all

### Applying for Leave (Employee)

1. Go to **Leave → Apply Leave**
2. Select: Leave type (Casual / Sick / Annual / Maternity / etc.), Start date, End date, Reason
3. Your remaining balance for that type is shown before submitting
4. Click **Submit** → leave request goes to your manager as **Pending**
5. You'll get an email notification on approval/rejection

### Checking Leave Balance (Employee)

1. Go to **Leave → My Leaves**
2. See balance cards for each leave type (e.g., Casual Leave: 8 remaining of 12)
3. Below the cards: your leave history (Pending / Approved / Rejected)

### Approving / Rejecting Leave (HR Manager / HR Admin)

1. Go to **Leave → Team Leaves**
2. See all pending requests from your team
3. Click **Approve** or **Reject** (add a reason for rejection)
4. The employee is notified by email

### Managing Leave Types (HR Admin)

1. Go to **Leave → Leave Types**
2. See all configured leave types with: name, days allowed per year, carryover rules
3. Click **"Add Leave Type"** to create a new one (e.g., Paternity Leave - 5 days)
4. Edit or delete existing types

---

## M6 - Payroll

### Who uses it

- HR Admin: run payroll, manage salary structures
- Employee: view own payslips
- Viewer: read-only

### Setting Up Salary Structure (HR Admin)

1. Go to **Payroll → Salary Structures**
2. Click **"Add Structure"** → fill in: Employee, Basic salary, HRA, TA, Other allowances, PF deduction, TDS, Other deductions
3. Save → the structure is linked to that employee for future payroll runs

### Running Payroll (HR Admin)

1. Go to **Payroll → Overview**
2. Click **"Run Payroll"** → select Month and Year
3. The system calculates gross and net salary for all employees with a salary structure
4. Review the summary (total gross, total net, employee count)
5. Click **Confirm** → payroll records are created
6. Payslip emails are sent to all employees automatically

### Viewing Payslips (Employee)

1. Go to **Payroll → My Payslips**
2. See a list of all months where payroll was processed
3. Click any month → see the full breakdown: Basic, HRA, TA, allowances, deductions, net pay

---

## M7 - Performance Evaluation

### Who uses it

- Employee: submit self-review, set goals
- HR Manager / Admin: create review cycles, see all reviews, add manager ratings

### Creating a Review Cycle (HR Admin)

1. Go to **Performance → Reviews**
2. Click **"New Cycle"** → enter: Name, Year, Quarter (optional), Start date, End date
3. Save → reviews are automatically created for all active employees
4. Status starts as **Pending**

### Submitting Self-Review (Employee)

1. Go to **Performance → My Review**
2. Select the active review cycle from the dropdown
3. Fill in: Self rating (1–5 stars), Comments, Achievements, Areas to improve
4. Click **"Save Draft"** to save without submitting, or **"Submit"** to finalize
5. After submission, status changes to **Self Review** → your manager can now add their rating

### Manager Review (HR Manager)

1. Go to **Performance → Reviews** → find the employee's review
2. Add: Manager rating (1–5 stars), Manager comments, Final rating
3. Click **Complete** → review is marked as **Completed**
4. Employee can see the final result on their My Review page

### Goals (Employee)

1. Go to **Performance → Goals**
2. Click **"Add Goal"** → fill in: Title, Description, Target date, Year
3. Goals are grouped by status: In Progress, Not Started, Completed, Cancelled
4. Update progress (0–100%) as you work toward the goal
5. Mark complete when done

---

## M8 - Document Management

### Who uses it

- HR Admin: upload company-wide documents, manage employee documents
- Employee: view own documents

### Company Documents

1. Go to **Documents**
2. See all company-wide files (policies, handbooks, forms)
3. HR Admin: click **"Upload"** → select file → choose category → upload
4. Anyone with access can download via a secure link (15-min expiry)

### Employee Document Locker

1. Go to **Documents → Employee → [Name]** or open from the employee's profile → Documents tab
2. See all documents linked to that employee (Offer letter, ID proof, certificates, etc.)
3. HR Admin can upload new documents; employee can view but not delete

---

## M9 - Projects & Task Management

### Who uses it

- Admin / HR Admin: create projects, assign members
- Employee: view assigned tasks, update status

### Creating a Project (Admin)

1. Go to **Projects** → click **"New Project"**
2. Fill in: Name, Code (e.g., PROJ-001), Description, Start date, End date
3. Add team members from employee list
4. Click Save → project is created with status **Planning**

### Managing Tasks (Project Board)

1. Click on a project → opens the **Kanban board**
2. Columns: **To Do → In Progress → In Review → Done**
3. Click **"Add Task"** → fill in: Title, Description, Priority (Low/Medium/High/Urgent), Assignee, Due date
4. Drag tasks between columns or use the status dropdown on each card
5. When a task is moved to **Done**, it logs the completion date (used for performance auto-score)

### My Tasks (Employee)

1. Go to **Projects → My Tasks**
2. See all tasks assigned to you across all projects
3. Filter by status or due date
4. Click a task → update status, add notes

---

## M10 - Notifications & Email

### Who uses it

- HR Admin: manage email templates
- Everyone: receive notifications

### Notification Inbox

1. Click the **bell icon** in the top bar (or go to **Notifications**)
2. See all system notifications (leave approved, payslip ready, review submitted, etc.)
3. Click a notification to mark it as read / go to the relevant page

### Email Templates (HR Admin)

1. Go to **Admin → Email Templates**
2. See all system email templates: Welcome, Payslip, Leave Approved, Leave Rejected, etc.
3. Click **Edit** on any template → modify subject line or body (supports `{{employee_name}}`, `{{company_name}}` merge fields)
4. Save → the next time that email is triggered, it uses the new template

### Automatic Email Triggers

Emails are sent automatically when:

- A new employee is created → **Welcome email**
- Payroll is run → **Payslip email** to each employee
- Leave is approved/rejected → **Notification email** to the employee
- Password reset is requested → **Reset link email**

---

## M11 - Analytics & Reporting

### Who uses it

- Super Admin, HR Admin: full analytics
- Viewer: read-only

### Executive Dashboard

1. Go to **Analytics**
2. Top row - 8 KPI cards:
   - Total employees / Active employees
   - New hires this month
   - Pending leave requests
   - Present today (attendance)
   - Open job postings
   - Active projects
   - Last payroll total
3. Charts:
   - **Monthly Hire Trend** (bar chart - last 6 months)
   - **Department Headcount** (horizontal bar - how many people per dept)
   - **Employee Status** (donut - Active / Inactive / On Leave)
   - **Recruitment Pipeline** (bar - applicants by stage: Applied, Screening, Interview, Offer, Hired)

---

## M12 - Multi-Source Attendance

This is an extension of M4 that adds 3 ways to record attendance without Hikvision hardware.

### Option 1: GPS Check-In (covered in M4 above)

Best for: Remote employees or companies without a physical terminal.

### Option 2: QR Kiosk (covered in M4 above)

Best for: Reception/lobby setup on a tablet - employees scan as they walk in.

### Option 3: CSV Import (covered in M4 above)

Best for: Importing historical data or syncing from another system.

### Option 4: Hikvision Device (covered in M4 above)

Best for: Offices that already have Hikvision face terminals installed.

---

## Quick Role Reference

| Feature            | Super Admin | HR Admin | HR Manager | Employee | Viewer |
| ------------------ | :---------: | :------: | :--------: | :------: | :----: |
| Add/Edit Employees |     ✅      |    ✅    |     ❌     |    ❌    |   ❌   |
| View Employees     |     ✅      |    ✅    |     ✅     | Own only |   ✅   |
| Run Payroll        |     ✅      |    ✅    |     ❌     |    ❌    |   ❌   |
| View Payslips      |     ✅      |    ✅    |     ✅     | Own only |   ✅   |
| Approve Leave      |     ✅      |    ✅    |     ✅     |    ❌    |   ❌   |
| Apply Leave        |     ✅      |    ✅    |     ✅     |    ✅    |   ❌   |
| Post Jobs          |     ✅      |    ✅    |     ✅     |    ❌    |   ❌   |
| Manage Roles       |     ✅      |    ✅    |     ❌     |    ❌    |   ❌   |
| View Audit Log     |     ✅      |    ✅    |     ❌     |    ❌    |   ❌   |
| Analytics          |     ✅      |    ✅    |     ❌     |    ❌    |   ✅   |
| GPS Check-In       |     ✅      |    ✅    |     ✅     |    ✅    |   ❌   |
| Self Review        |     ✅      |    ✅    |     ✅     |    ✅    |   ❌   |
| Manage Projects    |     ✅      |    ✅    |     ❌     |    ❌    |   ❌   |
| View Projects      |     ✅      |    ✅    |     ✅     |    ✅    |   ✅   |

---

_Generated for DNMS v1.0 - April 2026_
