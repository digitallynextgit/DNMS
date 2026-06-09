# Product Requirements Document - Project Management Module v2

| Field            | Value                                                   |
| ---------------- | ------------------------------------------------------- |
| **Document**     | PRD-PM-002                                              |
| **Version**      | 2.0                                                     |
| **Status**       | ✅ Approved - Ready for Implementation                  |
| **Date**         | 2026-05-21                                              |
| **Owner**        | Karan Joshi                                             |
| **Stakeholders** | HR, Operations, Project Owners, Team Leads, Engineering |
| **Linked Spec**  | `docs/project-management-spec.md` (technical)           |

---

## 1. Executive Summary

Digitally Next currently runs **all client and internal projects through informal channels** - spreadsheets, WhatsApp threads, ad-hoc emails. The existing DNMS Project Management module exists but is **too flat**: it treats every project as a single bucket of members and a single bucket of tasks, with no concept of teams, no role hierarchy, and no centralised file storage. This makes it unusable for the agency's real workflow.

This PRD describes a **redesigned Project Management module** that mirrors Digitally Next's actual operating model:

- **Projects** are organised into **discipline-specific Teams** (Web Development, Design, Marketing, etc.)
- Each Team has a **designated Manager** who owns task assignment and quality
- **Team Members** can self-organise but require Manager sign-off on what they work on
- Every Project has a **dedicated file storage area** so all related assets, briefs, and deliverables live in one place

When shipped, this module replaces three workflows simultaneously: project intake (currently emails), task tracking (currently spreadsheets), and asset management (currently scattered Google Drives).

---

## 2. Background & Problem Statement

### 2.1 Current State (As-Is)

The DNMS already has a Project Management module with:

- A `Project` model with name, description, status, dates, budget, owner
- A flat `ProjectMember` list (employees linked to a project)
- A flat `ProjectTask` list (tasks linked to a project, optional assignee)
- A simple Projects page (`/projects`), Project detail page (`/projects/[id]`), and My Tasks page (`/projects/my-tasks`)

### 2.2 Pain Points

| #   | Problem                                                                                  | Impact                                                        |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| P1  | No way to group members by discipline within a project                                   | Project of 15 people = one undifferentiated list              |
| P2  | No role differentiation - every member has equal task-creation rights                    | Junior staff create tasks without senior oversight            |
| P3  | No file storage - assets live in random Drive folders, links shared in chat              | Lost briefs, lost deliverables, no audit trail                |
| P4  | No task approval workflow - chaos when juniors create scope-creep tasks                  | Project Owner can't see what's actually planned vs improvised |
| P5  | No clear ownership when project has multiple disciplines                                 | "Whose job is this?" delays                                   |
| P6  | Existing `ProjectMember` model can't represent "Manager" - the schema flattens hierarchy | Manual workarounds in every project                           |

### 2.3 Why Now

- The company has scaled from ~15 to **24 active employees across 8 disciplines** in 18 months
- Every new client engagement spans multiple disciplines (e.g., a website build needs Web Dev + Design + Content + SEO)
- HR-led roll-out of DNMS for leave + WFH is **already live**; users are inside the app daily - adding project management here removes the need to switch tools

---

## 3. Goals & Non-Goals

### 3.1 Goals (Must Have)

1. **G1.** Admin can create a project and break it into named teams
2. **G2.** Each team has clearly identified members + exactly one Manager
3. **G3.** Tasks belong to a team, not a project, and respect role-based creation rules
4. **G4.** Members can suggest their own tasks but require Manager approval to make them official
5. **G5.** Every project has a dedicated, category-organised file storage area in Supabase Storage
6. **G6.** Full audit trail on every create/update/delete action
7. **G7.** Notifications (in-app + email) when team/task ownership changes hands

### 3.2 Non-Goals (Out of Scope for this version)

- ❌ Time-tracking / timesheets (schema reserved, no UI)
- ❌ Gantt / timeline visualisations
- ❌ Project budget burn-down charts
- ❌ Client / external user access
- ❌ Comments threads on tasks
- ❌ File preview (PDF / image inline rendering)
- ❌ Project templates ("Clone from previous")
- ❌ Inter-project task dependencies
- ❌ Resource versioning / file history

---

## 4. Personas

### 4.1 The Admin - _"I run this place"_

- **Who:** Super Admin / HR Admin (Karan, Founders, top HR leadership)
- **Goals:** Spin up projects fast when a deal closes, ensure proper team structure, oversee everything
- **Frustrations today:** Has to email-chase team leads for status; no central source of truth
- **Permissions:** Can create / edit / archive projects, create teams, promote managers

### 4.2 The Team Manager - _"My team delivers this discipline"_

- **Who:** Senior Specialists / Team Leads / Managers (per Digitally Next L5–L7 levels)
- **Example:** Lead of the Web Development team on the "Acme Website Redesign" project
- **Goals:** Assign work to team members, approve their proposed tasks, track delivery, manage team composition
- **Frustrations today:** Juniors do tasks unilaterally; manager finds out at the wrong time
- **Permissions:** Within their own team - add/remove members, create tasks for anyone, approve/reject self-created tasks, delete tasks, upload resources

### 4.3 The Team Member - _"I do the work"_

- **Who:** Trainee / Junior / Associate / Specialist (L1–L4)
- **Example:** Junior designer on the "Acme Website Redesign" project's Design team
- **Goals:** See what's expected of me, propose extra work, log my progress, share my deliverables
- **Frustrations today:** Doesn't know what's planned beyond the current week; deliverables get lost in chat
- **Permissions:** Within their team - create self-tasks (pending approval), update own task status, upload resources, view all team & project tasks

### 4.4 The Project Owner - _"I'm accountable for this client"_

- **Who:** Manager / Senior Manager / AVP (L7–L9) - the person whose name is on the deal
- **Note:** In this version, Owner has **no elevated powers**. They're informational (badge on project card). All admin actions still require Admin permission.
- **Future:** May get team-create / manager-promote powers in a later version

### 4.5 The Outside Observer - _"I need read-only visibility"_

- **Who:** Founders, finance, board members
- **Permissions:** `project:read` only - sees everything, edits nothing
- **Not in scope this version:** Public/client-facing views

---

## 5. User Stories

### Epic A - Project Setup

- **A1.** As an Admin, I want to **create a new project** with name, description, dates, and owner, so I can register a new engagement.
- **A2.** As an Admin, I want to **add multiple teams** to a project with ad-hoc names (e.g., "Web Development", "Design"), so the project mirrors the disciplines required.
- **A3.** As an Admin, I want to **assign team members** to each team, so each discipline has staff allocated.
- **A4.** As an Admin, I want to **designate one member as Manager** when adding members to a team, so there is a single point of accountability.

### Epic B - Team & Member Management

- **B1.** As an Admin, I want to **add or remove a team member** after project setup, so I can adapt as the project evolves.
- **B2.** As an Admin, I want to **promote a different member to Manager**, so I can rotate leadership or replace someone who leaves.
- **B3.** As an Admin, I want the system to **prevent demoting a Manager unless a replacement is nominated**, so a team is never accidentally manager-less while it has members.
- **B4.** As an Admin, I want the system to **prevent adding the same employee to a second team** within the same project, so cross-team conflict is avoided.

### Epic C - Tasks & Workflow

- **C1.** As a Team Manager, I want to **create a task and assign it to any team member**, so I can distribute work.
- **C2.** As a Team Member, I want to **create a task for myself**, so I can propose new work or document what I'm doing.
- **C3.** As a Team Manager, I want to **see all pending-approval self-tasks** and approve or reject them, so I retain control over scope.
- **C4.** As a Team Member, when my task is **rejected**, I want to **see the rejection reason**, so I understand why and can adapt.
- **C5.** As a Team Member, I want to **update the status of any task assigned to me** (TODO → IN_PROGRESS → DONE), so I can show progress.
- **C6.** As a Team Manager, I want to **delete a task** when scope changes, so the board reflects reality.
- **C7.** As any project participant, I want to **see all tasks across all teams** in this project, so I have visibility into cross-team dependencies.

### Epic D - Resources / File Storage

- **D1.** As any team member, I want to **upload a file** (brief, asset, deliverable) to the project, so the team has a single source of truth.
- **D2.** As an uploader, I want to **tag the file with a category** (Briefs / Assets / Deliverables / References / Other), so files are findable.
- **D3.** As an uploader, I want to **scope the file to my team or to the whole project**, so private team assets don't clutter the project-level view.
- **D4.** As any team member, I want to **download a file via a time-limited signed URL**, so I can use the asset offline.
- **D5.** As an uploader, I want to **delete a file I uploaded**, so I can remove mistakes.
- **D6.** As a Team Manager, I want to **delete any file in my team's folder**, so I can curate quality.
- **D7.** As an Admin, I want the system to **reject files over 100MB or with executable extensions**, so storage stays clean and safe.

### Epic E - Self-Service & Visibility

- **E1.** As any project participant, I want a **"My Tasks" page** showing every task assigned to me across all projects/teams, so I can plan my day.
- **E2.** As any project participant, I want **overdue tasks visually flagged**, so nothing slips.
- **E3.** As a Team Manager, I want **in-app + email notification** when I'm promoted to manager, so I know I just got new responsibilities.
- **E4.** As a Team Member, I want **in-app + email notification** when I'm assigned a task or my self-task is approved/rejected, so I always know what's expected.

---

## 6. Functional Requirements

### 6.1 Projects

| ID      | Requirement                                                                                                                                                                                    |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-P-01 | Only users with `project:write` (Admin / HR Admin) may create or edit projects                                                                                                                 |
| FR-P-02 | A project has: `name`, `code` (unique, e.g. "ACME-001"), `description`, `status` (Planning / Active / On Hold / Completed), `priority`, `startDate`, `endDate`, `budget` (optional), `ownerId` |
| FR-P-03 | Soft-delete via `isArchived` flag; archived projects hidden by default                                                                                                                         |
| FR-P-04 | Project listing groups by status with member-count and resource-count badges                                                                                                                   |
| FR-P-05 | Project detail page uses tabbed layout: Overview / Teams / Tasks / Resources                                                                                                                   |

### 6.2 Teams

| ID      | Requirement                                                                               |
| ------- | ----------------------------------------------------------------------------------------- |
| FR-T-01 | Teams are created **after** the project, ad-hoc, by Admin                                 |
| FR-T-02 | Team has: `name` (free text), optional `description`, `managerId` (nullable), `projectId` |
| FR-T-03 | Team name must be unique within a project - DB constraint enforced                        |
| FR-T-04 | A team with zero members has `managerId = null`                                           |
| FR-T-05 | A team can be deleted; cascade deletes its members + tasks + team-scoped resources        |
| FR-T-06 | Team rename is allowed                                                                    |

### 6.3 Team Membership

| ID      | Requirement                                                                                                                                                    |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-M-01 | Adding a member: Admin or that team's Manager may add                                                                                                          |
| FR-M-02 | DB constraint prevents the same employee from being added to two teams in the same project                                                                     |
| FR-M-03 | Adding the first member to an empty team automatically makes them the Manager                                                                                  |
| FR-M-04 | Promoting a different member to Manager: Admin only                                                                                                            |
| FR-M-05 | Demoting current Manager requires a replacement to be designated in the same operation, UNLESS the manager is the only member (then team becomes manager-less) |
| FR-M-06 | Removing the Manager from team membership is blocked if other members exist without a replacement                                                              |
| FR-M-07 | Removing a non-manager member is allowed without restriction                                                                                                   |
| FR-M-08 | Notifications fire on: added to team, promoted to manager, removed from team                                                                                   |

### 6.4 Tasks

| ID       | Requirement                                                                                                                                                                                                                                                 |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-TK-01 | Task always belongs to a Team (and therefore to a Project)                                                                                                                                                                                                  |
| FR-TK-02 | Task fields: `title`, `description`, `status` (TODO / IN_PROGRESS / IN_REVIEW / DONE), `priority` (LOW / MEDIUM / HIGH / URGENT), `assigneeId`, `dueDate`, `estimatedHours`, `loggedHours`, `tags`, `approvalStatus`, `isManagerCreated`, `rejectionReason` |
| FR-TK-03 | **Manager-created tasks** → `approvalStatus = APPROVED`, `isManagerCreated = true`. Visible to all team members immediately.                                                                                                                                |
| FR-TK-04 | **Self-tasks** (creator = assignee, creator ≠ team manager) → `approvalStatus = PENDING_APPROVAL`. Visible but flagged as pending.                                                                                                                          |
| FR-TK-05 | Manager may approve a pending task → `APPROVED`; rejects with reason → `REJECTED` (kept for audit, hidden from default board)                                                                                                                               |
| FR-TK-06 | Only the **assignee** or the **Manager** may change a task's `status`                                                                                                                                                                                       |
| FR-TK-07 | Only the **Manager** or **Admin** may delete a task; deletion cascades nothing (terminal)                                                                                                                                                                   |
| FR-TK-08 | All project members may **view** all tasks across all teams in the project, including PENDING_APPROVAL ones (flagged)                                                                                                                                       |
| FR-TK-09 | Task assignment triggers in-app + email notification to the assignee                                                                                                                                                                                        |

### 6.5 Resources (File Storage)

| ID      | Requirement                                                                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-R-01 | Resource has: `projectId`, `teamId` (nullable for project-level), `category` (enum), `fileName`, `fileSize`, `mimeType`, `objectKey`, `description`, `uploadedById` |
| FR-R-02 | Category enum: `BRIEFS`, `ASSETS`, `DELIVERABLES`, `REFERENCES`, `OTHER`                                                                                            |
| FR-R-03 | Storage path conventions: `projects/{projectId}/{category}/{filename}` (project-level), `projects/{projectId}/teams/{teamId}/{category}/{filename}` (team-level)    |
| FR-R-04 | File size cap: **100 MB** per file. API rejects > 100 MB with 413.                                                                                                  |
| FR-R-05 | Blocked extensions: `.exe`, `.bat`, `.sh`, `.cmd`, `.msi`, `.com`, `.scr`, `.ps1`                                                                                   |
| FR-R-06 | Any project participant may upload                                                                                                                                  |
| FR-R-07 | Download via 15-minute Supabase signed URL                                                                                                                          |
| FR-R-08 | Delete: uploader, team Manager (within own team), or Admin                                                                                                          |
| FR-R-09 | Resources list filterable by team, category, uploader                                                                                                               |

### 6.6 Notifications

| Trigger                          | Channel                      | Recipient                        |
| -------------------------------- | ---------------------------- | -------------------------------- |
| Added to a team                  | In-app + Email               | The added employee               |
| Promoted to Manager              | In-app + Email               | The new manager                  |
| Removed from a team              | In-app                       | The removed employee             |
| Task assigned (manager → member) | In-app + Email               | The assignee                     |
| Self-task created                | In-app                       | The team Manager                 |
| Self-task approved               | In-app + Email               | The original creator             |
| Self-task rejected               | In-app + Email (with reason) | The original creator             |
| Task status changed to DONE      | In-app                       | The team Manager + Project Owner |

### 6.7 Audit Log

Every CUD operation on Projects, Teams, Members, Tasks, and Resources writes an `AuditLog` row with:

- `actorId`, `action` (CREATE / UPDATE / DELETE / APPROVE / REJECT / PROMOTE / DEMOTE)
- `module = "project"`
- `entityType` (Project / ProjectTeam / ProjectTeamMember / ProjectTask / ProjectResource)
- `entityId`
- `changes` (JSON: before/after diff for updates)
- `ipAddress`, `userAgent`

---

## 7. User Flows

### Flow 7.1 - Spin up a new project from a closed deal (Admin)

1. Admin clicks **New Project** on `/projects`
2. Fills in name, code, description, dates, owner → submits
3. Lands on `/projects/[id]` Overview tab
4. Clicks **Teams** tab → **Add Team**
5. Types "Web Development" → submits → empty team created
6. Clicks the team → **Add Member** → searches "Vivek" → adds → auto-becomes Manager
7. **Add Member** → "Saurabh" → added as regular member
8. Repeats steps 4–7 for "Design", "Content", etc.
9. ✅ Done. Team Managers receive promotion notifications.

### Flow 7.2 - Team Manager assigns work

1. Vivek logs in → opens "/projects/[id]" → **Tasks** tab → filter to "Web Development" team
2. Clicks **Create Task** → fills title "Build hero section", assignee = Saurabh, due date, priority HIGH
3. Submits → task is APPROVED + visible on the board immediately
4. Saurabh gets in-app + email notification

### Flow 7.3 - Team Member proposes a task

1. Saurabh logs in → opens his team's task board
2. Clicks **Create Task** → assignee picker is locked to himself (he's not the manager)
3. Fills title "Refactor navbar for accessibility", due date, MEDIUM priority → submits
4. Task created with `approvalStatus = PENDING_APPROVAL`. Appears on board with an orange "Pending Manager Approval" badge.
5. Vivek receives in-app notification
6. Vivek clicks the pending task → **Approve** → status flips to APPROVED, badge clears
7. Saurabh receives "Task approved" notification - can now start working

### Flow 7.4 - Team Manager rejects a self-task

1. Saurabh creates a self-task "Set up Kubernetes cluster" (out of scope)
2. Vivek opens it → clicks **Reject** → modal prompts for reason → "Not in scope for this sprint"
3. Task moves to `approvalStatus = REJECTED`, hidden from default board view (visible in filter "Rejected")
4. Saurabh receives email + in-app notification with the rejection reason

### Flow 7.5 - Resource upload to team folder

1. Saurabh opens project → **Resources** tab
2. Selects scope = "Web Development team" + category = "Assets"
3. Drag-drops `hero-mockup-v3.psd` (45 MB) → upload begins
4. File lands at `projects/{projectId}/teams/{webDevTeamId}/ASSETS/hero-mockup-v3.psd`
5. Resource record created with uploaderId = Saurabh
6. Visible in the Resources gallery to all project participants

### Flow 7.6 - Manager swap (someone leaves)

1. Vivek resigns. Admin opens his team in "Acme" project.
2. Clicks Vivek's row → **Promote** option not shown (he's already manager); clicks **Remove**
3. System blocks with: _"Cannot remove the team manager while team has other members. Please promote another member to manager first."_
4. Admin clicks **Promote** on Saurabh → confirms → Saurabh becomes Manager, Vivek stays as member
5. Admin clicks **Remove** on Vivek → succeeds → Vivek no longer on team
6. Saurabh receives promotion notification

### Flow 7.7 - Last person leaves an empty team

1. Admin opens "Design" team - only Komal remaining, she is the manager
2. Clicks Komal → **Remove**
3. Allowed because she's the only member → team becomes empty (`managerId = null`, no members)
4. Admin may then delete the team entirely OR add new members later

---

## 8. UI / UX Specifications

### 8.1 Information Architecture

```
/projects                                  ← list of all projects (existing, minor updates)
/projects/[id]                             ← project detail (major redesign - tabbed)
  ├── Overview (default tab)
  ├── Teams
  ├── Tasks (flat list across teams)
  └── Resources
/projects/[id]/teams/[teamId]              ← optional drill-down (or expandable card)
/projects/my-tasks                         ← personal tasks across projects (existing, redesigned)
```

### 8.2 Project Detail - Tabs

#### Overview Tab

- Project hero: name, code, status badge, priority chip
- Quick stats: # teams, # members, # tasks (Open / Done), # resources
- Owner card
- Date range + duration
- Description block
- "Recent Activity" list (last 5 audit events)

#### Teams Tab

- Card grid; each card shows:
  - Team name + member count
  - Manager avatar with crown icon
  - Stacked avatars of first 5 members
  - Task count: "12 active · 3 done"
  - Click → expands to show full member list + task summary
- **+ Add Team** button (Admin only, top right)
- Empty state: "No teams yet. Add a team to start organising this project."

#### Tasks Tab

- Filter bar: Team picker, Status picker, Assignee picker, "Pending approval only" toggle
- Two view modes: **List** (default) and **Kanban** (group by status)
- Each task row/card shows: title, assignee avatar, team chip, status, priority, due date
- Pending-approval tasks have an orange "Awaiting approval" badge
- Rejected tasks shown only when filter explicitly includes them
- Task click → side-drawer with full detail + actions (approve / reject / edit / delete)

#### Resources Tab

- Top: scope selector (Project-level / Team picker) + category filter
- Body: file gallery (table or grid)
- Each row: filename, size, category chip, team chip (if team-scoped), uploader avatar, upload date, actions (download / delete)
- "+ Upload" button: opens dialog with category picker, optional team scope, file picker (drag-drop supported)
- Inline 100MB warning if file exceeds limit

### 8.3 Team Expansion / Drill-down

- Header: team name (editable inline for Admin), manager card, description
- Members section:
  - Searchable list; each row: avatar, name, role (Manager / Member), Joined date, action menu (Remove / Promote)
  - **+ Add Member** button (Admin / Manager)
- Tasks section:
  - Kanban columns: TODO / IN_PROGRESS / IN_REVIEW / DONE
  - **+ Create Task** button - opens form with assignee picker:
    - Manager view: searchable dropdown of all team members
    - Member view: locked to self (read-only chip showing their own name)

### 8.4 My Tasks Page Redesign

- Group by Project → Team
- Each task row shows project + team chip
- Overdue tasks: red border + "Overdue by N days" badge
- Pending-approval self-tasks shown separately at top with orange banner
- Inline status update (dropdown on hover)

### 8.5 Permissions UI Cues

- "Add Team" button hidden if not Admin
- "Promote" / "Demote Manager" actions hidden if not Admin
- Task assignee dropdown locked to self if not Manager
- "Delete task" button hidden if not Manager + not Admin
- Uploader-only delete buttons hidden for other users' files (unless Manager / Admin)

---

## 9. Data Model

See companion spec `docs/project-management-spec.md` § 4 for the full Prisma schema. Summary:

```
Project (existing) 1───* ProjectTeam (new) 1───* ProjectTeamMember (new)
                       │
                       └───* ProjectTask (modified: + teamId, approvalStatus, isManagerCreated)
                       │
                       └───* ProjectResource (new)
                                  └── ResourceCategory enum
                       │
                       └── managerId → Employee
```

### Key constraints

- `ProjectTeam @@unique([projectId, name])`
- `ProjectTeamMember @@unique([teamId, employeeId])`
- `ProjectTeamMember @@unique([projectId, employeeId])` ← enforces "one team per project per employee"
- `ProjectTask.teamId` is required (was previously project-scoped)

### Dropped

- `ProjectMember` model - replaced entirely by team membership

---

## 10. API Contracts

See spec § 5. Summary of new/changed endpoints:

**Teams**

- `GET    /api/projects/[id]/teams`
- `POST   /api/projects/[id]/teams` (Admin)
- `PATCH  /api/projects/[id]/teams/[teamId]` (Admin)
- `DELETE /api/projects/[id]/teams/[teamId]` (Admin)

**Members**

- `GET    /api/projects/[id]/teams/[teamId]/members`
- `POST   /api/projects/[id]/teams/[teamId]/members` (Admin or Team Manager)
- `DELETE /api/projects/[id]/teams/[teamId]/members/[mid]` (Admin or Team Manager; enforces manager-swap rule)
- `PATCH  /api/projects/[id]/teams/[teamId]/members/[mid]/promote` (Admin only)

**Tasks**

- `GET    /api/projects/[id]/teams/[teamId]/tasks`
- `POST   /api/projects/[id]/teams/[teamId]/tasks` (any team member; approval rules applied server-side)
- `PATCH  /api/tasks/[id]/approve` (Manager only)
- `PATCH  /api/tasks/[id]/reject` (Manager only)
- `PATCH  /api/tasks/[id]` (assignee or Manager)
- `DELETE /api/tasks/[id]` (Manager or Admin)

**Resources**

- `GET    /api/projects/[id]/resources` (any project participant)
- `POST   /api/projects/[id]/resources` (any project participant; size + extension validated)
- `GET    /api/projects/[id]/resources/[fid]/url` (any project participant; returns signed URL)
- `DELETE /api/projects/[id]/resources/[fid]` (uploader, Manager, or Admin)

---

## 11. Permissions Matrix

| Action                          | Admin | Project Owner | Team Manager         | Team Member                    | Other Employee |
| ------------------------------- | ----- | ------------- | -------------------- | ------------------------------ | -------------- |
| Create / edit / archive project | ✅    | ❌            | ❌                   | ❌                             | ❌             |
| Create / delete team            | ✅    | ❌            | ❌                   | ❌                             | ❌             |
| Rename team                     | ✅    | ❌            | ❌                   | ❌                             | ❌             |
| Add member to team              | ✅    | ❌            | ✅ (own team)        | ❌                             | ❌             |
| Remove member from team         | ✅    | ❌            | ✅ (own team)        | ❌                             | ❌             |
| Promote member to Manager       | ✅    | ❌            | ❌                   | ❌                             | ❌             |
| Create task - assign to self    | ✅    | -             | ✅                   | ✅                             | ❌             |
| Create task - assign to others  | ✅    | ❌            | ✅ (own team only)   | ❌                             | ❌             |
| Approve / reject self-task      | ✅    | ❌            | ✅ (own team only)   | ❌                             | ❌             |
| Edit task status (any task)     | ✅    | ❌            | ✅ (own team)        | ✅ (only if assignee)          | ❌             |
| Delete task                     | ✅    | ❌            | ✅ (own team)        | ❌                             | ❌             |
| View tasks                      | ✅    | ✅            | ✅                   | ✅ (any team in their project) | ❌             |
| Upload resource                 | ✅    | ✅            | ✅                   | ✅                             | ❌             |
| Delete own uploaded resource    | ✅    | ✅            | ✅                   | ✅                             | ❌             |
| Delete other user's resource    | ✅    | ❌            | ✅ (within own team) | ❌                             | ❌             |

---

## 12. Business Rules (Hard Constraints)

| ID    | Rule                                                                            | Enforcement                                        |
| ----- | ------------------------------------------------------------------------------- | -------------------------------------------------- |
| BR-01 | One team per name per project                                                   | DB unique constraint                               |
| BR-02 | One team per employee per project                                               | DB unique constraint                               |
| BR-03 | First member added to an empty team becomes Manager                             | Application logic                                  |
| BR-04 | Cannot demote Manager unless replacement is named OR Manager is the only member | API validation, returns 422                        |
| BR-05 | Self-tasks require Manager approval before they're "official"                   | API logic sets `approvalStatus = PENDING_APPROVAL` |
| BR-06 | File uploads > 100MB are rejected                                               | API validation, returns 413                        |
| BR-07 | File uploads with executable extensions are rejected                            | API validation, returns 415                        |
| BR-08 | Only Admin can create projects                                                  | Permission check `project:write`                   |
| BR-09 | Only Admin can promote a Manager                                                | Permission check + role check                      |
| BR-10 | Deleting a team cascades members + tasks + team-scoped resources                | DB cascade + Supabase Storage cleanup job          |

---

## 13. Edge Cases & Error Handling

| Scenario                                                               | Expected Behaviour                                                                                           |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Admin tries to add an employee already on another team in this project | 409 - _"This employee is already on the 'Design' team in this project. Remove them from there first."_       |
| Manager tries to remove themselves without nominating a replacement    | 422 - _"You are the team manager. Promote another member to manager before leaving the team."_               |
| Member tries to assign a task to someone other than themselves         | 403 - _"Only the team manager can assign tasks to other members."_                                           |
| Anyone uploads a 150MB file                                            | 413 - _"File exceeds the 100MB limit. Please compress or split."_                                            |
| User uploads `payload.exe`                                             | 415 - _"Executable files are not allowed for security reasons."_                                             |
| Admin deletes a project with active tasks + uploaded files             | Confirmation dialog: _"This will permanently delete N tasks and N files. Type the project code to confirm."_ |
| Manager rejects a pending task without a reason                        | 422 - _"Rejection reason is required."_                                                                      |
| Member opens a task that was deleted while they had it open            | 404 toast - _"This task no longer exists."_                                                                  |
| Two admins simultaneously promote two different members to manager     | Optimistic locking via `updatedAt` timestamp on team; second request gets 409                                |
| Storage upload fails midway (Supabase error)                           | Resource record is NOT created; user sees toast - _"Upload failed. Please retry."_                           |
| User who is not a project participant tries to view a task             | 403 - _"You do not have access to this project."_                                                            |

---

## 14. Non-Functional Requirements

| ID     | Category             | Requirement                                                                                            |
| ------ | -------------------- | ------------------------------------------------------------------------------------------------------ |
| NFR-01 | Performance          | Project detail page loads in < 1.5s with up to 50 tasks + 30 resources                                 |
| NFR-02 | Scalability          | Schema handles up to 1000 projects, 50 teams per project, 100 members per team                         |
| NFR-03 | Security             | All resource downloads use 15-min signed URLs (never permanent links)                                  |
| NFR-04 | Security             | Resources are stored in a private Supabase bucket; bucket policy denies anonymous access               |
| NFR-05 | Reliability          | Failed file uploads roll back the DB record so we never have orphan records                            |
| NFR-06 | Auditability         | Every CUD operation logged within 100ms (non-blocking)                                                 |
| NFR-07 | Observability        | Server logs include `[PROJECT_*]`, `[TASK_*]`, `[RESOURCE_*]` prefixes for grep                        |
| NFR-08 | Compatibility        | Module works on latest Chrome, Edge, Firefox, Safari (desktop); responsive down to 1024px              |
| NFR-09 | Accessibility        | Keyboard navigation for task board; all icons paired with labels for screen readers                    |
| NFR-10 | Internationalisation | Date/time formatting via `toLocaleDateString("en-IN", …)`; UI strings remain English-only this version |

---

## 15. Notifications & Emails

### Notification triggers

See § 6.6.

### Email template stubs (new)

Email templates added to existing `EmailTemplate` system (Admin can customise):

- `project.team_added` - _"You've been added to the {{teamName}} team of {{projectName}}"_
- `project.manager_promoted` - _"You're now the manager of {{teamName}} ({{projectName}})"_
- `project.task_assigned` - _"{{managerName}} assigned you a task: {{taskTitle}}"_
- `project.task_approved` - _"Your task '{{taskTitle}}' has been approved by {{managerName}}"_
- `project.task_rejected` - _"Your task '{{taskTitle}}' was rejected. Reason: {{reason}}"_

### Frequency control

- All emails are immediate, no batching
- No "daily digest" in this version
- User preference for opting out: Future (out of scope)

---

## 16. Audit & Compliance

### What gets logged

| Entity      | Action                                      | Logged? |
| ----------- | ------------------------------------------- | ------- |
| Project     | CREATE / UPDATE / DELETE / ARCHIVE          | ✅      |
| Team        | CREATE / RENAME / DELETE                    | ✅      |
| Team Member | ADD / REMOVE / PROMOTE / DEMOTE             | ✅      |
| Task        | CREATE / UPDATE / DELETE / APPROVE / REJECT | ✅      |
| Resource    | UPLOAD / DELETE / DOWNLOAD (URL fetched)    | ✅      |

Logs are written to the existing `AuditLog` table (module = `"project"`). Already viewable at `/admin/audit-log`.

### Retention

- Indefinite retention by default
- Future: configurable archive policy

---

## 17. Storage & File Management

### Bucket structure (Supabase Storage)

```
hrms-documents/                      ← single bucket (existing)
└── projects/
    └── {projectId}/
        ├── BRIEFS/
        ├── ASSETS/
        ├── DELIVERABLES/
        ├── REFERENCES/
        ├── OTHER/
        └── teams/
            └── {teamId}/
                ├── BRIEFS/
                ├── ASSETS/
                ├── DELIVERABLES/
                ├── REFERENCES/
                └── OTHER/
```

### Path resolution

- For a project-level resource: `projects/{projectId}/{CATEGORY}/{sanitised-filename}`
- For a team-level resource: `projects/{projectId}/teams/{teamId}/{CATEGORY}/{sanitised-filename}`
- Filenames sanitised: lowercase, alphanumeric + hyphens only, dedup with timestamp suffix if collision

### Cleanup

- On project delete: queue background job to delete entire `projects/{projectId}/` prefix
- On team delete: queue background job to delete `projects/{projectId}/teams/{teamId}/` prefix
- On resource delete (single): delete the specific object key

---

## 18. Success Metrics

We'll measure success at the **30-day post-launch** mark.

| Metric                                                           | Target                      |
| ---------------------------------------------------------------- | --------------------------- |
| % of active projects using at least 1 team                       | ≥ 80%                       |
| Avg # of teams per active project                                | ≥ 2                         |
| % of tasks assigned via the module (vs spreadsheets - anecdotal) | ≥ 60% (self-reported)       |
| Median tasks per active project per week                         | ≥ 10                        |
| Adoption: # of distinct employees creating ≥ 1 task              | ≥ 18 of 24 active employees |
| Resource uploads per active project                              | ≥ 5 in first month          |
| Task approval cycle time (created → approved)                    | Median ≤ 24 hours           |
| User satisfaction (informal HR survey)                           | ≥ 4/5                       |

---

## 19. Rollout Plan

### Phase 0 - Preparation (Today)

- Communicate to all employees: "Project management redesign coming next week. Pause new informal projects until we're live."
- Identify 1–2 pilot projects from active client work

### Phase 1 - Schema + Backend (Day 1)

- Apply migration
- Wipe existing demo project data
- Reseed with 2–3 demo projects + teams + members + sample tasks + 2–3 sample resources
- Backend APIs functional, tested via curl/Postman

### Phase 2 - Frontend (Day 2)

- Tabbed project detail page live
- Teams, Members, Tasks, Resources tabs all functional
- My Tasks redesigned
- Smoke test with admin account end-to-end

### Phase 3 - Pilot & Polish (Day 3)

- Migrate 1 real client project into the system (e.g., "Acme Website")
- Project Manager + Team Manager spend 1 hour each running through real flow
- Bug fixes from pilot feedback
- Empty states, notifications, audit log verification

### Phase 4 - General Availability

- All-hands announcement
- Quick 15-min training video / Loom
- HR collects feedback for first week
- 30-day success-metric review

---

## 20. Risks & Mitigations

| Risk                                                                   | Likelihood | Impact | Mitigation                                                                                      |
| ---------------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------- |
| Existing users confused by tabbed redesign                             | Medium     | Medium | Short Loom walkthrough; keep My Tasks layout similar                                            |
| Self-task approval workflow adds friction, members stop creating tasks | High       | Medium | Make approval one-click; manager notification is fast; track approval cycle time as a metric    |
| 100MB cap turns out to be too low (designers with Figma exports)       | Medium     | Low    | Easy to raise via env var or admin setting                                                      |
| Team-scoped storage paths grow unwieldy as projects scale              | Low        | Low    | Cleanup job on project delete handles it                                                        |
| Manager-swap rule confuses Admin during real reorganisation            | Medium     | Low    | Clear error message + nudge UI                                                                  |
| Notifications email volume becomes spam                                | Medium     | Medium | Future opt-out in Profile preferences; daily digest as Phase 2 enhancement                      |
| Existing project data is wiped - pilot project's history is lost       | High       | Low    | Only seeded demo data is being wiped; no real client data exists in current Projects module yet |

---

## 21. Open Questions

✅ **None.** All 12 open questions from the spec have been resolved by the stakeholder (Karan) on 2026-05-21:

1. Team Types: ad-hoc per project
2. One team per name per project
3. One team per employee per project
4. Manager exclusivity (follows from #3)
5. Self-tasks need Manager approval
6. Project + Team creation = Admin only
7. Storage: folders/categories
8. 100MB file cap, no executables
9. Auto team-scoped storage folders
10. Full task visibility within project
11. Manager swap-or-empty rule
12. Wipe existing seeded projects

Notifications, audit log, and no-versioning applied as default.

---

## 22. Glossary

| Term                     | Definition                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **Project**              | A unit of work, typically a client engagement or internal initiative                                                    |
| **Team**                 | A discipline-scoped group within a project (e.g., the Web Development team on the Acme project)                         |
| **Team Type**            | A label like "Web Development" or "Design". In v2, these are **ad-hoc** (typed by admin per project), not a global list |
| **Member**               | An employee who is part of a team in a project                                                                          |
| **Manager**              | One designated member per team with elevated permissions                                                                |
| **Self-task**            | A task created by a member where they assign it to themselves; requires manager approval                                |
| **Manager-created task** | A task created by the team's manager and assigned to any team member; auto-approved                                     |
| **Approval status**      | A task field tracking whether a self-task has been approved by the manager (APPROVED / PENDING_APPROVAL / REJECTED)     |
| **Resource**             | A file uploaded to the project's storage area                                                                           |
| **Resource scope**       | Whether a resource belongs to the project as a whole or to a specific team within it                                    |
| **Resource category**    | A fixed label for organising files: BRIEFS / ASSETS / DELIVERABLES / REFERENCES / OTHER                                 |

---

## 23. Appendix - Implementation Phases (from Spec)

| Phase | Scope                                                                                               | Estimate        |
| ----- | --------------------------------------------------------------------------------------------------- | --------------- |
| 1     | Prisma schema + migration + reseed                                                                  | ~3 h            |
| 2     | Backend API routes (teams, members, tasks, resources)                                               | ~5 h            |
| 3     | Frontend (tabbed detail, team cards, member picker, task form, resource gallery, My Tasks redesign) | ~6 h            |
| 4     | Polish (notifications, audit log entries, empty states, sidebar entry, QA)                          | ~2 h            |
|       | **Total**                                                                                           | **~2.5–3 days** |

---

**END OF PRD**
