# Project Management Module - Specification

**Version:** 2.0
**Date:** 2026-05-21
**Status:** ✅ Approved - answers locked, ready to implement

---

## 1. Overview

The Project Management module enables Digitally Next to organise client and internal work into **projects**, where each project is broken into **teams** (Web Dev, Design, Marketing, etc.), and each team has **members**, one **manager**, and **tasks**. Each project also has a dedicated **storage area** for shared resources.

---

## 2. Core Concepts

### 2.1 Project

- Top-level container for any piece of work
- **Created only by Admin** (super_admin / hr_admin)
- Has metadata: name, code, description, status, priority, start/end dates, budget, owner
- Holds zero or more **Teams**
- Holds a **Storage Area** (file repository)

### 2.2 Team

- A group within a project, scoped to a discipline
- **Team Type** examples: Web Development, Design, Marketing, Content, SEO, Video, etc.
- Team Types are configurable (admin manages a master list)
- Each team belongs to exactly **one** project
- Each team has:
  - **Members** (N employees)
  - **One Manager** (designated from among the members)

### 2.3 Team Member

- An Employee assigned to a Team
- Has a flag indicating if they're the team's Manager

### 2.4 Task

- Belongs to a Team (and therefore to a Project)
- Has assignee, status, priority, due date, description
- **Creation rules:**
  - Any team member may create a task **for themselves** (self-assigned)
  - Only the Team Manager may create tasks **and assign to any team member**
  - Only the Team Manager (or Admin) may **delete** tasks
  - Anyone assigned to a task can update its status / log progress

### 2.5 Project Storage / Resources

- Each project has a dedicated **file storage area** in Supabase Storage
- Path convention: `projects/{projectId}/...`
- Any project team member can upload / view files
- Tracks: filename, size, mime type, uploader, upload date

---

## 3. Permissions Model

| Permission                               | Scope                                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `project:read`                           | View projects (existing)                                                                           |
| `project:write`                          | Create / edit / archive projects (existing - limited to Admin)                                     |
| `project:delete`                         | Delete projects (existing)                                                                         |
| `team_type:write`                        | Manage master list of team types (Admin only)                                                      |
| **Manager-level** (derived, not a scope) | If `team.managerId === currentUser.id` → can create tasks for others, delete tasks, manage members |
| **Member-level** (derived)               | If user is in `team.members` → can create self-tasks, upload to project storage                    |

### Permission matrix per action

| Action                         | Admin | Project Owner | Team Manager                     | Team Member          | Other Employee |
| ------------------------------ | ----- | ------------- | -------------------------------- | -------------------- | -------------- |
| Create project                 | ✅    | -             | -                                | -                    | ❌             |
| Edit project                   | ✅    | ✅            | ❌                               | ❌                   | ❌             |
| Archive project                | ✅    | ✅            | ❌                               | ❌                   | ❌             |
| Create team in project         | ✅    | ✅            | ❌                               | ❌                   | ❌             |
| Delete team                    | ✅    | ✅            | ❌                               | ❌                   | ❌             |
| Add member to team             | ✅    | ✅            | ✅ (own team)                    | ❌                   | ❌             |
| Remove member from team        | ✅    | ✅            | ✅ (own team)                    | ❌                   | ❌             |
| Promote member to manager      | ✅    | ✅            | ❌                               | ❌                   | ❌             |
| Create task for self           | ✅    | ✅            | ✅                               | ✅                   | ❌             |
| Create task for another member | ✅    | ✅            | ✅ (own team)                    | ❌                   | ❌             |
| Delete task                    | ✅    | ✅            | ✅ (own team)                    | ❌                   | ❌             |
| Update own task status         | ✅    | ✅            | ✅                               | ✅                   | ❌             |
| Upload resource                | ✅    | ✅            | ✅                               | ✅                   | ❌             |
| Delete resource                | ✅    | ✅            | ✅ (uploader or any in own team) | ✅ (own upload only) | ❌             |

---

## 4. Schema Changes

### 4.1 New Models (v2 - locked decisions applied)

```prisma
model ProjectTeam {
  id           String   @id @default(uuid())
  projectId    String   @map("project_id")
  name         String                              // ad-hoc, e.g. "Web Development"
  description  String?
  managerId    String?  @map("manager_id")         // an Employee.id - nullable when team is empty
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  project      Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  manager      Employee?     @relation("TeamManager", fields: [managerId], references: [id], onDelete: SetNull)
  members      ProjectTeamMember[]
  tasks        ProjectTask[]
  resources    ProjectResource[]

  @@unique([projectId, name])                       // one team-name per project
  @@map("project_teams")
}

model ProjectTeamMember {
  id          String   @id @default(uuid())
  teamId      String   @map("team_id")
  projectId   String   @map("project_id")           // denormalised to enforce 1-team-per-project
  employeeId  String   @map("employee_id")
  joinedAt    DateTime @default(now()) @map("joined_at")

  team        ProjectTeam @relation(fields: [teamId],     references: [id], onDelete: Cascade)
  employee    Employee    @relation("ProjectTeamMembership", fields: [employeeId], references: [id], onDelete: Cascade)

  @@unique([teamId, employeeId])                    // can't be in same team twice
  @@unique([projectId, employeeId])                 // can only be in ONE team per project (rule #3)
  @@map("project_team_members")
}

enum ResourceCategory {
  BRIEFS
  ASSETS
  DELIVERABLES
  REFERENCES
  OTHER
}

model ProjectResource {
  id           String           @id @default(uuid())
  projectId    String           @map("project_id")
  teamId       String?          @map("team_id")     // null = project-level resource
  category     ResourceCategory @default(OTHER)
  fileName     String           @map("file_name")
  fileSize     Int              @map("file_size")
  mimeType     String           @map("mime_type")
  objectKey    String           @unique @map("object_key")   // Supabase storage key, unique
  description  String?
  uploadedById String           @map("uploaded_by_id")
  createdAt    DateTime         @default(now()) @map("created_at")

  project      Project      @relation(fields: [projectId],   references: [id], onDelete: Cascade)
  team         ProjectTeam? @relation(fields: [teamId],      references: [id], onDelete: SetNull)
  uploadedBy   Employee     @relation("ResourceUploader",    fields: [uploadedById], references: [id])

  @@index([projectId])
  @@index([teamId])
  @@index([category])
  @@map("project_resources")
}

enum TaskApprovalStatus {
  APPROVED            // manager-created OR self-created and approved
  PENDING_APPROVAL    // self-created, awaiting manager approval
  REJECTED            // manager rejected the self-created task
}
```

**Note:** `TeamType` model is NOT created - team names are ad-hoc per project (decision #1).

**Storage path conventions** (Supabase folders are virtual):

- Project-level resource: `projects/{projectId}/{category}/{filename}`
- Team-level resource: `projects/{projectId}/teams/{teamId}/{category}/{filename}`

### 4.2 Changes to existing models

```prisma
model ProjectTask {
  // existing fields...
  teamId             String              @map("team_id")                  // NEW
  approvalStatus     TaskApprovalStatus  @default(APPROVED) @map("approval_status")  // NEW
  isManagerCreated   Boolean             @default(false) @map("is_manager_created")  // NEW
  rejectionReason    String?             @map("rejection_reason")                    // NEW (when approval rejected)

  team               ProjectTeam @relation(fields: [teamId], references: [id], onDelete: Cascade)
}

model Project {
  teams              ProjectTeam[]
  resources          ProjectResource[]
}

model Employee {
  managedTeams              ProjectTeam[]         @relation("TeamManager")
  projectTeamMemberships    ProjectTeamMember[]   @relation("ProjectTeamMembership")
  uploadedResources         ProjectResource[]     @relation("ResourceUploader")
}
```

### 4.3 Deprecation

- The existing `ProjectMember` model is **dropped**. Team membership (via `ProjectTeamMember`) is the only source of project participation.
- The 2 existing seeded projects + their members/tasks are **wiped** in the new seed (decision #12).

---

## 5. API Endpoints

### Teams (within a project - ad-hoc names, no global type list)

- `GET /api/projects/[id]/teams` - list teams in project
- `POST /api/projects/[id]/teams` - create team (Admin / Project Owner only)
- `PATCH /api/projects/[id]/teams/[teamId]` - rename, change manager
- `DELETE /api/projects/[id]/teams/[teamId]` - delete team (cascades members + tasks)

### Team Members

- `GET /api/projects/[id]/teams/[teamId]/members` - list members
- `POST /api/projects/[id]/teams/[teamId]/members` - add member (Admin / Project Owner / Team Manager)
- `DELETE /api/projects/[id]/teams/[teamId]/members/[memberId]` - remove
- `PATCH /api/projects/[id]/teams/[teamId]/members/[memberId]/promote` - make this member the manager (Admin / Project Owner only)

### Tasks

- `GET /api/projects/[id]/teams/[teamId]/tasks` - list tasks for team (all team members can see all tasks)
- `POST /api/projects/[id]/teams/[teamId]/tasks` - create task
  - If `assigneeId !== caller.id` → must be Manager of this team. Created task → `approvalStatus = APPROVED`, `isManagerCreated = true`.
  - If `assigneeId === caller.id` (self-task) → allowed for any team member. Created task → `approvalStatus = PENDING_APPROVAL`, `isManagerCreated = false`.
- `PATCH /api/tasks/[id]/approve` - Manager approves a `PENDING_APPROVAL` task → `APPROVED`
- `PATCH /api/tasks/[id]/reject` - Manager rejects a `PENDING_APPROVAL` task with reason → `REJECTED`
- `PATCH /api/tasks/[id]` - update status (only assignee or manager)
- `DELETE /api/tasks/[id]` - manager-of-team OR admin only

### Project Resources (storage)

- `GET /api/projects/[id]/resources` - list resources (any project participant)
- `POST /api/projects/[id]/resources` - upload (any project participant)
- `GET /api/projects/[id]/resources/[fileId]/url` - get signed download URL
- `DELETE /api/projects/[id]/resources/[fileId]` - uploader OR team manager OR admin

---

## 6. UI Pages

### 6.1 `/projects` (existing - minor changes)

- Add team-count badge per project card
- Add resource-count badge

### 6.2 `/projects/[id]` (major redesign)

Tabbed layout:

- **Overview** - project info, status, dates, owner, summary stats
- **Teams** - list of teams in this project, each shows: type, member count, manager avatar, task count
  - "Add Team" button (Admin/Owner only)
  - Click a team → expand to show members + tasks
- **Tasks** - flat task list across all teams (filterable by team)
- **Resources** - file gallery with upload, download, delete
- **Activity** - audit log of project events (optional Phase 2)

### 6.3 `/projects/[id]/teams/[teamId]` (new - or modal)

- Team header: name, type, manager
- Members section: list with avatars, role badges, add/remove buttons (manager only)
- Tasks section: kanban or list grouped by status
  - "Create Task" button - visible to all members; manager has assignee picker, members are forced to self-assign

### 6.4 `/projects/my-tasks` (existing - minor changes)

- Group tasks by Project → Team
- Show whether task is self-created or assigned
- Overdue highlighting

### 6.5 New: Admin → Team Types (`/admin/team-types`)

- Master list of team types, add/edit/delete

---

## 7. Implementation Phases

### Phase 1 - Schema + Migration (Day 1, ~3h)

1. Add `ProjectTeam`, `ProjectTeamMember`, `ProjectResource` models + `ResourceCategory` + `TaskApprovalStatus` enums
2. Add `teamId`, `approvalStatus`, `isManagerCreated`, `rejectionReason` to `ProjectTask`
3. **Drop** `ProjectMember` model (cascade-deletes existing junk data)
4. Write migration
5. Apply to Supabase
6. Wipe existing 2 demo projects + recreate seed with: 2–3 demo projects, each with 2–3 teams (e.g., "Web Development", "Design", "Content"), 3–5 members per team, 1 manager per team, sample tasks (mix of manager-created and self-tasks pending approval), and a few seeded resources

### Phase 2 - Backend APIs (Day 1 cont. / Day 2, ~5h)

1. Team Types CRUD
2. Teams CRUD (with project-owner permission check)
3. Team Members add/remove/promote
4. Task creation with role-based assignment rule
5. Resources upload/list/delete (using existing Supabase Storage helpers)
6. Add `wfh:approve`-style permission scope `project:manage_teams` for project owner
7. Audit-log entries for every CUD

### Phase 3 - Frontend (Day 2 / Day 3, ~6h)

1. Project detail page tab layout (Overview / Teams / Tasks / Resources)
2. Team creation dialog (admin only)
3. Team card component (members, manager, task count)
4. Add/Remove member dialog (with searchable employee picker)
5. Promote-to-manager action
6. Task creation form with role-aware assignee picker
7. Resources tab with file upload, drag-drop, signed-URL download, delete
8. My Tasks redesign - group by project/team

### Phase 4 - Polish (Day 3, ~2h)

1. Notifications: assignee notified on task assignment, member notified on team add
2. Email triggers (optional): added to a project / made team manager
3. Empty states everywhere
4. Loading skeletons
5. Sidebar admin entry for Team Types
6. End-to-end QA pass

**Total estimate: 2.5–3 working days**

---

## 8. Locked Decisions

### Critical

1. **Team Types - ad-hoc, per project.** No global master list. When creating a team, admin types a name (e.g., "Web Development"). The `TeamType` model is dropped entirely. ProjectTeam has a free-text `name` column with `@@unique([projectId, name])`.
2. **One team per name per project.** Cannot have two teams named "Web Development" in the same project. Enforced by unique constraint above.
3. **Employee in only ONE team per project.** Enforced via denormalised `projectId` on `ProjectTeamMember` + `@@unique([projectId, employeeId])`. Database-level guarantee.
4. **Manager exclusivity** - moot, follows from #3. Since an employee can only be in one team per project, they can only manage that one team.
5. **Self-tasks require Manager Approval.** Added `approvalStatus` enum on `ProjectTask`:
   - `APPROVED` (default for manager-created)
   - `PENDING_APPROVAL` (default for self-created)
   - `REJECTED`
     Member-created tasks are invisible/inactive until manager approves. Manager rejects with optional reason.
6. **Project + Team creation = Admin only.** `project:write` permission (super_admin / hr_admin). Project `ownerId` is informational only - no elevated powers from being owner.

### Storage / Resources

7. **Folders/categories.** Resources have a fixed category enum: `BRIEFS`, `ASSETS`, `DELIVERABLES`, `REFERENCES`, `OTHER`.
8. **File size cap: 100MB per file.** Type allowlist deferred (default: anything except executables - `.exe`, `.bat`, `.sh`, `.cmd`).
9. **Per-team auto-folders.** When a team is created, the storage path `projects/{projectId}/teams/{teamId}/` is reserved (folders in Supabase are virtual - the path convention is enforced on upload). Project-level files live at `projects/{projectId}/{category}/`, team-level at `projects/{projectId}/teams/{teamId}/{category}/`. The resource record stores both `teamId` (nullable for project-level) and `category`.

### Task visibility

10. **Full visibility within the project.** All project members can see all tasks across all teams. (Approval-pending tasks visible too, but flagged.)

### Removing managers

11. **Manager swap-or-empty rule:**

- If team has other members → must promote a replacement first; cannot just remove the manager
- If manager is the **only** member → may be removed; team becomes empty (managerId = null)
- Empty teams can be deleted by admin or filled with new members

### Existing data

12. **Wipe and reseed.** The two existing seeded projects + their flat members/tasks will be deleted. Seed will produce fresh projects with proper teams structure.

### Defaults applied

13. **Notifications:** in-app + email triggered on: added to a team, made team manager, task assigned, self-task approved/rejected.
14. **Audit log:** every team / member / task / resource CUD is logged with before/after diff.
15. **Resource versioning:** none - uploads overwrite by `objectKey`. Optional later.

---

## 9. Out of Scope (deferred to later)

- Time tracking / timesheets (schema exists, no UI)
- Project budget tracking & burn-down
- Gantt / timeline view
- Client / external user access to projects
- Project templates ("clone from template")
- Inter-project dependencies
- Comments / discussion thread on tasks
- File preview in browser (PDF / image)
