import type { DescriptionMap } from "./types"

// Projects core: projects, tasks, My Work, deliverables, goals, teams/members, kick-off checklist,
// service owners/calendars, progress, requirements, weekly hours, performance. See ./types.ts.
// [id] under /api/projects is the project id or slug unless an entry says otherwise.
export const PROJECTS_CORE: DescriptionMap = {
  "DELETE /api/projects/[id]": {
    summary:
      "Permanently delete a project and everything under it (teams, tasks, deliverables, goals, requirements, calendars). Needs the project:delete permission - being the Account Manager is not enough.",
    keywords: ["delete project", "remove project", "destroy project"],
    notes:
      "Irreversible, cascades to all project data, writes no audit entry - confirm first. [id] = project id or slug from GET /api/projects. To close a project instead, PATCH /api/projects/[id] with status COMPLETED or CANCELLED.",
  },
  "DELETE /api/projects/[id]/deliverables/[deliverableId]": {
    summary:
      "Delete a deliverable (logged output or owed/planned work) from a project. Allowed for its maker or logger, their team manager, the Account Manager or project:write holders. [deliverableId] = rows[].id from GET /api/projects/[id]/deliverables.",
    keywords: ["delete deliverable", "remove output", "remove planned work"],
    notes:
      "Irreversible (its history goes too; attached files stay on the project). Accepted work can only be removed by a project manager; made work completed more than 7 days ago is locked for everyone but project managers.",
  },
  "DELETE /api/projects/[id]/goals/[goalId]": {
    summary:
      "Deactivate (soft-delete) a project goal and its sub-goals, or delete it for good with permanent=1. Only the Account Manager or project:write holders. [goalId] from GET /api/projects/[id]/goals.",
    query:
      "permanent: 1 = delete forever with sub-goals, targets and history (otherwise it is only deactivated and can be restored via POST .../reactivate); reason: optional text recorded when deactivating",
    keywords: ["remove goal", "deactivate goal", "archive goal", "delete objective"],
    notes:
      "permanent=1 is irreversible - confirm first. Deactivated goals stop counting toward progress.",
  },
  "DELETE /api/projects/[id]/goals/[goalId]/targets/[targetId]": {
    summary:
      "Remove a countable deliverable target (e.g. 20 Reels in September) from a project goal. Only the Account Manager or project:write holders; recorded in the goal's history. [targetId] = goals[].targets[].id from GET /api/projects/[id]/goals.",
    keywords: ["remove goal target", "delete target", "goal quantity"],
  },
  "DELETE /api/projects/[id]/requirements/[requirementId]": {
    summary:
      "Delete a requirement (something the team asked for, e.g. client access, content or approval). Only the person who raised it, the Account Manager or project:write holders. [requirementId] from GET /api/projects/[id]/requirements.",
    keywords: ["delete requirement", "remove blocker", "client requirement"],
    notes:
      "Irreversible; tasks it was blocking are unlinked. To resolve it instead, PATCH its status to PROVIDED, REJECTED or CLOSED.",
  },
  "DELETE /api/projects/[id]/teams/[teamId]": {
    summary:
      "Always refused (405): every project has the same fixed teams (AM, WEB, DESIGN, VIDEO, CONTENT, SMO, SEO, PERFORMANCE, PR, ALLIANCES & PARTNERSHIPS, ADMIN). Remove people instead with DELETE /api/projects/[id]/teams/[teamId]/members/[memberId].",
    keywords: ["delete team", "remove team"],
  },
  "DELETE /api/projects/[id]/teams/[teamId]/members/[memberId]": {
    summary:
      "Remove a person from a project team. For project:write holders, the Account Manager or that team's manager. [memberId] is the team-membership id (members[].id from GET /api/projects/[id]/teams/[teamId]/members), NOT the employee id.",
    keywords: [
      "remove team member",
      "remove from project",
      "take off project",
      "unassign from team",
    ],
    notes:
      "Refused for the current Account Manager on the AM team (change the account manager first) and for a team manager while others remain (promote someone first). Notifies the person in-app, removes their calendar seats for that team, drops service ownership if they leave the project entirely and updates Drive folder access.",
  },
  "DELETE /api/tasks/[id]": {
    summary:
      "Permanently delete a task (project or adhoc). Only the task's manager - its team manager, or for adhoc work the assignee's line manager - or project:write holders; an assignee may also delete an untouched hold follow-up the app created.",
    keywords: ["delete task", "remove task"],
    notes:
      "Irreversible: logged hours, comments, checklist and status history go with it - confirm first. [id] = task id.",
  },
  "DELETE /api/tasks/[id]/checklist/[itemId]": {
    summary:
      "Delete one checklist line (sub-item) from a task. [id] = task id; [itemId] from GET /api/tasks/[id]/checklist. Anyone who can see the task's project.",
    keywords: ["delete checklist item", "remove subtask", "remove to-do item"],
  },
  "DELETE /api/tasks/[id]/comments/[commentId]": {
    summary:
      "Delete a comment on a task. Only the comment's author can delete it. [commentId] from GET /api/tasks/[id]/comments.",
    keywords: ["delete comment", "remove task comment"],
  },

  "GET /api/projects": {
    summary:
      "List projects, newest first, with their Account Managers (owner = primary, secondaryAccountManager), client, teams, members, service owners (each with its secondary owner), task counts and kick-off checklist progress. project:write holders see every project; everyone else only projects they are an Account Manager of or on a team of.",
    query:
      "status: PLANNING|ACTIVE|ON_HOLD|COMPLETED|CANCELLED; mine: true = only projects I am an Account Manager of (primary or secondary) or a team member on; clientId: client id; page (default 1); limit (default 20, max 100)",
    keywords: [
      "all projects",
      "project list",
      "find project",
      "project id",
      "client projects",
      "account manager",
    ],
    notes:
      "No name search - page through, or filter by clientId/status. Each row's id (or slug) is the [id] for every /api/projects/[id] route. kickoff is null on projects you do not manage.",
  },
  "GET /api/projects/[id]": {
    summary:
      "One project's full details: name, code, slug, status, priority, phase (stage), services, client, budget, start date, its Account Managers (owner = primary, secondaryAccountManager - null when not set), every team with its manager and members, service owners (serviceOwners[].employee = owner, .secondaryEmployee = secondary owner) and counts. [id] = project id or slug from GET /api/projects.",
    keywords: [
      "project details",
      "who is the account manager",
      "secondary account manager",
      "who owns the service",
      "secondary owner",
      "project teams",
      "project info",
    ],
    notes:
      "Visible to its Account Managers, anyone on one of its teams, and project:read/project:write holders. The field `owner`/`ownerId` is the primary Account Manager (a historical name).",
  },
  "GET /api/projects/[id]/activity": {
    summary:
      "A project's activity feed, newest first: tasks created, moved, approved or deleted, comments, team changes, deliverables logged, goal and requirement changes, with who did it. Anyone with access to the project.",
    query:
      "limit: max entries (default 50, max 100); key: 1 = only key events (team changes, requirements, task approvals/deletions, milestones, tasks finished/on hold/discarded)",
    keywords: ["project history", "recent activity", "what changed", "project feed", "timeline"],
  },
  "GET /api/projects/[id]/assignable-employees": {
    summary:
      "Every active employee in the company (id, name, employee no., designation) for picking someone to add to a team or assign work on this project. Only for project:write holders, the Account Manager or a team manager on this project.",
    keywords: ["employee picker", "add member", "people list", "who can I assign"],
  },
  "GET /api/projects/[id]/deliverables": {
    summary:
      "A project's deliverables (output such as reels, posts, pages, banners) with tallies by type, person, team, week and status, owed and overdue counts and attributed hours, plus up to 300 rows. Anyone with access to the project.",
    query:
      "employeeId; teamId; taskId; type: deliverable type, case-insensitive (e.g. Reel); status: comma list of PLANNED,IN_PROGRESS,STUCK,DELIVERED,ACCEPTED,REJECTED,DISCARDED; from, to: YYYY-MM-DD on the COMPLETED date (owed work has none, so it drops out when these are set)",
    keywords: [
      "project output",
      "what was delivered",
      "planned work",
      "owed work",
      "content count",
    ],
    notes:
      "rows[].id is the [deliverableId] for edit/status routes. Without a status filter the tallies count made work only. truncated=true when more than 300 rows matched.",
  },
  "GET /api/projects/[id]/deliverables/[deliverableId]/events": {
    summary:
      "History of one deliverable, oldest first: created, edited (field before/after), status changes with reasons, verified/unverified and late edits - who did each and when. Anyone with access to the project.",
    keywords: ["deliverable history", "who changed deliverable", "rejection reason", "audit trail"],
  },
  "GET /api/projects/[id]/goals": {
    summary:
      "A project's goals, nested (main goals with sub-goals): status, progress %, target date, owner, tags, deliverable targets, linked tasks and history, plus totals (done, overdue, at risk) and the count of open tasks serving no goal. Anyone with access to the project.",
    query: "includeInactive: 1 = also return deactivated goals",
    keywords: ["project goals", "objectives", "OKR", "goal progress", "milestones"],
  },
  "GET /api/projects/[id]/kickoff": {
    summary:
      "The project's pre-campaign kick-off checklist - the Account Manager's must-haves (strategy, user journey, hub-spoke, 7 Ps, manifestation plan, milestones, analytics, planning) - with each item's key, done flag, who/when and note, and done/total. Only the Account Manager or project:write holders.",
    keywords: [
      "kick-off checklist",
      "kickoff",
      "pre-campaign checklist",
      "must-haves",
      "campaign readiness",
    ],
    notes:
      "sections[].items[].key (e.g. strategy.usp) is the [key] for PATCH /api/projects/[id]/kickoff/[key].",
  },
  "GET /api/projects/[id]/members": {
    summary:
      "Everyone on a project, once each: the Account Manager (isManager: true) plus every member of any project team, with designation. Anyone with access to the project. Use it to find a person's employee id on the project.",
    keywords: ["project members", "who is on the project", "project people", "project staff"],
  },
  "GET /api/projects/[id]/members/[memberId]/tasks": {
    summary:
      "One person's tasks on a project (rejected ones excluded), soonest due first, with status, priority, due date, estimated/logged hours and team. [memberId] is the EMPLOYEE id (from GET /api/projects/[id]/members). Anyone with access to the project.",
    query: "from, to: YYYY-MM-DD - only tasks DUE in this window",
    keywords: ["person's tasks on project", "member workload", "what is someone working on"],
  },
  "GET /api/projects/[id]/progress": {
    summary:
      "Progress dashboard for one project: task counts by status (to-do, in progress, done, on hold, discarded, overdue, on time, late), breakdown by team and by member, weekly completion trend, upcoming tasks and SEO site stats. Anyone with access to the project.",
    query: "from, to: YYYY-MM-DD - only tasks DUE in this window",
    keywords: [
      "project progress",
      "project status report",
      "overdue tasks",
      "completion rate",
      "project health",
    ],
  },
  "GET /api/projects/[id]/requirements": {
    summary:
      "A project's requirements - what the team needs from the client or a colleague (documents, credentials, access, content, designs, approvals, payments) - with type, status, raiser, who it is requested from, needed-by date and tasks it blocks. Anyone with access to the project.",
    keywords: [
      "client requirements",
      "blockers",
      "pending from client",
      "waiting on client",
      "dependencies",
    ],
  },
  "GET /api/projects/[id]/tasks": {
    summary:
      "All tasks on a project (up to 2000) with assignee, creator, goal, blocking requirement and deliverable count. Anyone with access to the project.",
    query:
      "status: TODO|IN_PROGRESS|DONE|ON_HOLD|DISCARDED (legacy IN_REVIEW, CANCELLED); assigneeId: employee id",
    keywords: ["project tasks", "task board", "task list", "who is assigned"],
    notes: "meta.truncated=true when there are more than 2000.",
  },
  "GET /api/projects/[id]/teams": {
    summary:
      "A project's teams (fixed set: AM, WEB, DESIGN, VIDEO, CONTENT, SMO, SEO, PERFORMANCE, PR, ALLIANCES & PARTNERSHIPS, ADMIN) with each team's manager, members and task count. Anyone with access to the project.",
    keywords: ["project teams", "team manager", "team members", "team id"],
    notes:
      "teams[].id is the [teamId]; teams[].members[].id is the membership id used as [memberId] for remove/promote (employeeId is the person).",
  },
  "GET /api/projects/[id]/teams/[teamId]/members": {
    summary:
      "Active members of one project team, earliest joined first. Each row's id is the membership id ([memberId] for remove/promote); employee.id is the person. Anyone with access to the project.",
    keywords: ["team members", "who is on the team", "team roster"],
  },
  "GET /api/projects/[id]/teams/[teamId]/tasks": {
    summary:
      "All tasks of one project team with assignee, creator, goal, blocking requirement and deliverable count. [teamId] from GET /api/projects/[id]/teams. Anyone with access to the project.",
    keywords: ["team tasks", "team workload", "team board"],
  },
  "GET /api/projects/deliverables": {
    summary:
      "Deliverables across every project you can see (portfolio): tallies by type, project, person, team, week and status, owed/overdue counts and hours, plus up to 300 rows. project:read/project:write holders see all projects; others only projects they lead or are on.",
    query:
      "projectId (id, not slug); employeeId; teamId; taskId; type (case-insensitive); status: comma list of PLANNED,IN_PROGRESS,STUCK,DELIVERED,ACCEPTED,REJECTED,DISCARDED; from, to: YYYY-MM-DD on the completed date",
    keywords: [
      "all deliverables",
      "output across projects",
      "deliverables portfolio",
      "what did we make",
    ],
  },
  "GET /api/projects/deliverables/export": {
    summary:
      "Download deliverables as a CSV spreadsheet (project, type, title, quantity, status, dates, maker, team, goal, links, hours, notes) for a completion-date range. Same visibility as GET /api/projects/deliverables.",
    query:
      "from, to: YYYY-MM-DD, both required, at most 366 days apart (completed date); projectId: project id or slug; employeeId; teamId; type; status: comma list as in GET /api/projects/deliverables; client: 1 = client-safe (drops hours, notes and who logged it)",
    keywords: ["export deliverables", "deliverables csv", "download deliverables", "excel"],
    notes: "Returns a file (CSV) - use dnms_download.",
  },
  "GET /api/projects/deliverables/progress": {
    summary:
      "Deliverables progress for a window: totals (done, open, overdue, sent back, late, on time, % complete, quantity made), by project and by person, open items with why each is not done, and delivered items. Scope: project:write all; Account Manager their projects; team manager their teams and reports; member self.",
    query:
      "from, to: YYYY-MM-DD (omit both = all time); projectIds, teamIds, employeeIds: comma-separated ids to narrow (outside your scope = 403; a member always gets only themselves)",
    keywords: ["deliverables status", "delivery progress", "what is overdue", "output progress"],
  },
  "GET /api/projects/deliverables/report": {
    summary:
      "Build a downloadable deliverables report - PowerPoint deck (default), Excel or Word - for a date window, scoped like GET /api/projects/deliverables/progress (project:write all, Account Manager their projects, team manager their teams and reports, member self).",
    query:
      "format: pptx|xlsx|docx (default pptx); from, to: YYYY-MM-DD, max one year apart (omit both = all time); projectIds, teamIds, employeeIds: comma-separated ids to narrow (see GET /api/projects/deliverables/report/scope); ai: 0 = skip AI-written takeaways",
    keywords: [
      "deliverables report",
      "client report deck",
      "progress report pptx",
      "monthly report",
      "slides",
    ],
    notes: "Returns a file - use dnms_download. Slower when AI takeaways are on.",
  },
  "GET /api/projects/deliverables/report/scope": {
    summary:
      "What you may report on in the deliverables report and progress views: your role (Administrator, Account manager, Team manager, Team member) and the projects, teams and people you can pick, with their ids.",
    keywords: ["report scope", "report filters", "which projects can I report on"],
  },
  "GET /api/projects/goals": {
    summary:
      "Goals across all projects you can see (portfolio): each project's active goals with status, progress and target dates, plus totals (done, overdue, at risk, overall progress, next target date) and all tags. project:read/project:write holders see every project; others only their own.",
    query: "projectId: project id (not slug) to narrow to one project",
    keywords: ["all goals", "goals portfolio", "objectives across projects", "at risk goals"],
  },
  "GET /api/projects/my-deliverables": {
    summary:
      "My owed work: open deliverables (to do, in progress, stuck) assigned to me plus unclaimed ones owed by a team I am on, soonest due first, with overdue and unclaimed counts. Always the signed-in person's own.",
    query: "limit: max rows (default 100, max 200)",
    keywords: ["my deliverables", "what do I owe", "my pending output", "my planned work"],
  },
  "GET /api/projects/performance": {
    summary:
      "Task performance metrics: assigned, completed, on time, late, overdue, in progress, on hold, due/done this week, allocated vs logged hours, completion and on-time rates; 8-week trend; by employee and project (by team for one project). project:write sees all; others their teams, owned projects and own tasks.",
    query: "projectId: project id (not slug); from, to: YYYY-MM-DD - only tasks DUE in the window",
    keywords: [
      "team performance",
      "employee performance",
      "on-time rate",
      "completion rate",
      "productivity",
    ],
  },
  "GET /api/projects/performance/scope": {
    summary:
      "Options for the performance filters: the projects, teams and people you may narrow the performance metrics or AI report to, with ids (project:write = all; others projects they own, manage a team in or have tasks on).",
    keywords: ["performance filters", "performance scope"],
  },
  "GET /api/projects/tasks": {
    summary:
      "Tasks across projects filtered by state (overdue, to-do, in progress, on hold, done, open), project, person, team, goal and due window - the list behind Progress/Performance counts. project:write sees all; others tasks of teams they manage, projects they are Account Manager of, or their own.",
    query:
      "state: overdue|todo|progress|hold|done|open|all (default all); projectId (id, not slug); assigneeId; teamId; goalId; unlinked: 1 = only tasks serving no goal; from, to: YYYY-MM-DD due window; limit (default 150, max 900)",
    keywords: [
      "overdue tasks",
      "late tasks",
      "tasks across projects",
      "who is behind",
      "open tasks",
    ],
  },
  "GET /api/projects/weekly-hours": {
    summary:
      "Weekly hours sheet: per person, hours per day (counted on each task's due date), logged vs allocated vs available hours, utilisation %, leave/holiday days and top clients. You see yourself, teams you manage, teams on projects you are Account Manager of and line reports; project:write sees everyone.",
    query: "week: YYYY-MM-DD, any day in the week (normalised to Monday; default this week)",
    keywords: [
      "timesheet",
      "weekly hours",
      "utilisation",
      "capacity",
      "hours logged",
      "allocation",
    ],
  },
  "GET /api/projects/work": {
    summary:
      "One person's project work for a month: services they own (with calendar progress), calendars they own, calendar team-plan rows naming them, and projects they are Account Manager of or on a team of. Default you; another person needs project:write/HR or to be in your reporting line.",
    query: "month: YYYY-MM (default this month); employeeId (default yourself)",
    keywords: [
      "employee work",
      "my services",
      "my calendars",
      "what does someone own",
      "monthly workload",
    ],
  },
  "GET /api/tasks": {
    summary:
      "My Work task list: tasks assigned to me by default; with mine=true, also a team I manage, one direct report/team member, or everyone I manage (project:write: anyone). Includes project, team, goal and blocking requirement; meta lists the teams and people I may pick.",
    query:
      "mine: true = enable the scope picker (required for any scope other than me); scope: me (default) | all | team:<teamId> | user:<employeeId> - unknown or unauthorised values silently fall back to me; status: TODO|IN_PROGRESS|DONE|ON_HOLD|DISCARDED",
    keywords: ["my work", "my tasks", "my to-do", "team tasks", "report's tasks", "adhoc tasks"],
    notes: "Up to 2000 tasks sorted by due date; meta.truncated when more.",
  },
  "GET /api/tasks/[id]/checklist": {
    summary:
      "A task's checklist (sub-items) in order with checked state. [id] = task id. Anyone who can see the task (project access; for adhoc work its assignee, creator or their manager).",
    keywords: ["subtasks", "task checklist", "to-do items"],
  },
  "GET /api/tasks/[id]/comments": {
    summary:
      "Comments on a task, oldest first, with author name and designation. [id] = task id. Anyone who can see the task.",
    keywords: ["task comments", "task discussion", "notes on task"],
  },
  "GET /api/tasks/[id]/timeline": {
    summary:
      "A task's status history: each period it spent in To-do, In Progress, On Hold etc., who moved it and why, across hold follow-ups. Anyone who can see the project (adhoc work: assignee, creator or their manager).",
    keywords: ["task history", "status history", "time in progress", "how long did it take"],
  },

  "PATCH /api/projects/[id]": {
    summary:
      "Edit a project and/or its Account Managers (primary and secondary, both with the same powers), plus name, short name, services, description, status, priority, phase, client, start date, budget. Either Account Manager or a project:write holder may edit; the primary Account Manager (or project:write) can hand the project to a new Account Manager and picks the secondary - the secondary can change neither. Send only the fields to change.",
    body: "{ accountManagerId?: active employee id, the new PRIMARY Account Manager (alias ownerId; the current Account Manager or project:write); secondaryAccountManagerId?: active employee id, or null to clear (the primary Account Manager or project:write); name?; shortName?: up to 24 chars, unique, null clears; services?: full list of service codes (see POST /api/projects), replaces the old list; description?; status?: PLANNING|ACTIVE|ON_HOLD|COMPLETED|CANCELLED; priority?: LOW|MEDIUM|HIGH|URGENT; stage?: LAUNCH|GROWTH|REBRANDING|DECLINE or null (the Phase); clientId?: client id or null; startDate?: YYYY-MM-DD or null; budget?: number (INR) or null; isArchived?: boolean (legacy, hides nothing) }",
    keywords: [
      "change account manager",
      "secondary account manager",
      "backup account manager",
      "reassign project",
      "rename project",
      "project status",
    ],
    notes:
      "The secondary must be someone other than the primary; promoting the secondary to primary empties the secondary slot. A new primary Account Manager becomes manager and member of the AM team (the old one stays until removed); a secondary joins the AM team. Both get Drive folder access and an in-app notification. Service owners are set with PUT /api/projects/[id]/service-owners, not here. Changing services drops owners of removed services and creates calendars for new ones. Setting clientId moves the project's unaffiliated client-portal logins to that client.",
  },
  "PATCH /api/projects/[id]/deliverables/[deliverableId]": {
    summary:
      "Edit a deliverable and optionally move its status in one save: title, type, quantity, how many made, dates, links, notes, linked task/goal, or reassign/claim it. For its maker or logger, their team manager, the Account Manager or project:write holders.",
    body: "{ title?; type?: e.g. Reel, Post, Banner (max 40); quantity?: 1-999; deliveredQuantity?: whole number made so far; status?: PLANNED|IN_PROGRESS|STUCK|DELIVERED|ACCEPTED|REJECTED|DISCARDED (rules as POST .../status); reason?: required for STUCK, DISCARDED, REJECTED and un-accepting; note?: acceptance note; startedOn?, completedOn?, dueOn?: YYYY-MM-DD or null (started/completed not in the future); links?: http(s) URLs, max 20, replaces the list; notes?; taskId?: task on this project or null; goalId?: goal on this project or null; employeeId?: new maker, or null to hand owed work back to the team (managers only) }",
    keywords: [
      "edit deliverable",
      "update output",
      "mark delivered",
      "reassign deliverable",
      "add link to deliverable",
    ],
    notes:
      "Moving to DELIVERED here needs proof (a link, file or note) and, for non-managers, every unit logged. Entries completed more than 7 days ago are locked except for project managers. Returns the saved row.",
  },
  "PATCH /api/projects/[id]/goals/[goalId]": {
    summary:
      "Edit a project goal: title, description, status, target date, tags or the person accountable for it. Only the Account Manager or project:write holders. Send only what changes.",
    body: "{ title?: max 200; description?: string or null; status?: NOT_STARTED|IN_PROGRESS|AT_RISK|DONE|DISCARDED; reason?: required with AT_RISK or DISCARDED; targetDate?: YYYY-MM-DD or null; tags?: string[] (max 6, each max 24 chars; replaces the set); ownerId?: accountable employee id, or null = the Account Manager }",
    keywords: ["update goal", "goal at risk", "goal status", "goal owner", "goal due date"],
    notes:
      "A goal with sub-goals or linked tasks takes its status from them - you can only flag it AT_RISK/DISCARDED or clear that flag. Progress % is not settable (it comes from sub-goals, tasks or deliverable targets). Status changes go into the goal history.",
  },
  "PATCH /api/projects/[id]/goals/[goalId]/targets/[targetId]": {
    summary:
      "Change a goal's deliverable target - what type it counts, how many, which period. Only the Account Manager or project:write holders; logged in the goal's history.",
    body: "{ deliverableType?: max 40 chars, matched case-insensitively to deliverable types; quantity?: 1-999; periodStart?, periodEnd?: YYYY-MM-DD, or null = open-ended (omit to keep) }",
    keywords: ["edit goal target", "change target quantity", "target period"],
    notes: "Refused if it would overlap another target of the same type on the goal.",
  },
  "PATCH /api/projects/[id]/kickoff/[key]": {
    summary:
      "Tick or untick an item on the project's pre-campaign kick-off checklist and/or set its note. Only the Account Manager or project:write holders. [key] = item key from GET /api/projects/[id]/kickoff (e.g. strategy.usp, planning.weekly).",
    body: "{ isDone?: boolean; note?: string up to 2000 chars, or null to clear } - at least one is required",
    keywords: [
      "kick-off checklist",
      "tick kickoff item",
      "complete checklist item",
      "pre-campaign",
    ],
    notes: "Records who ticked it and when. Returns the whole updated checklist.",
  },
  "PATCH /api/projects/[id]/requirements/[requirementId]": {
    summary:
      "Move a requirement's status, e.g. mark it provided, rejected or closed. For the person it is requested from, the person who raised it, the Account Manager or project:write holders.",
    body: "{ status (required): OPEN|IN_PROGRESS|PROVIDED|REJECTED|CLOSED; resolutionNote?: string, required when REJECTED }",
    keywords: ["resolve requirement", "requirement provided", "close blocker", "client provided"],
    notes:
      "PROVIDED, REJECTED and CLOSED resolve it and unblock linked tasks. Notifies the raiser in-app unless they made the change.",
  },
  "PATCH /api/projects/[id]/teams/[teamId]": {
    summary:
      "Set or clear a project team's manager. Only the Account Manager or project:write holders. Team names and descriptions are fixed and cannot be changed (405).",
    body: "{ managerId (required): employee id of someone already on this team, or null to clear (only when they are the sole member) }",
    keywords: ["team manager", "change team lead", "set team manager"],
    notes:
      "No notification is sent; PATCH .../members/[memberId]/promote does the same and notifies the new manager.",
  },
  "PATCH /api/projects/[id]/teams/[teamId]/members/[memberId]/promote": {
    summary:
      "Make a team member that team's manager (the previous manager stays as a regular member). Only the Account Manager or project:write holders. [memberId] = membership id from GET /api/projects/[id]/teams/[teamId]/members, not the employee id.",
    keywords: ["promote to team manager", "make team lead", "team manager"],
    notes: "Notifies the new manager in-app and by email.",
  },
  "PATCH /api/tasks/[id]": {
    summary:
      "Update a task: move its status (start, complete, hold, discard), edit details, reassign, change due date, priority, hours, links, goal or milestone flag. For the assignee, the task's manager (team manager; for adhoc work the assignee's line manager) or project:write holders.",
    body: "{ status?: TODO|IN_PROGRESS|DONE|ON_HOLD|DISCARDED; holdReason + holdExpectedDate (YYYY-MM-DD): required for ON_HOLD; discardReason: required for DISCARDED; keepFollowUp?: true to go ahead after a 409 about a hold follow-up; title?; description?; priority?: LOW|MEDIUM|HIGH|URGENT; startDate?, dueDate?: YYYY-MM-DD or null; estimatedHours?: number or null; tags?: string[]; assigneeId?: active employee id or null (manager/admin only); links?: http(s) URLs, max 20; isMilestone?: boolean; goalId?: goal on the task's project or null; producesOutput?: boolean; outputSkipped?: true = nothing came out of this }",
    keywords: [
      "update task",
      "complete task",
      "mark done",
      "put on hold",
      "reassign task",
      "change due date",
    ],
    notes:
      "Detail fields (title, description, priority, dates, hours, tags) are editable by the task's creator only for 15 minutes after creating it, otherwise only by its manager/admin. IN_PROGRESS starts the time clock and leaving it stops it (loggedHours is measured, not writable). ON_HOLD books the remaining hours onto a follow-up task. Done/hold/discard notifies the manager in-app.",
  },
  "PATCH /api/tasks/[id]/checklist/[itemId]": {
    summary:
      "Tick, untick or rename one checklist line on a task. [itemId] from GET /api/tasks/[id]/checklist. Anyone who can see the task's project.",
    body: "{ isChecked?: boolean; text?: string }",
    keywords: ["check off subtask", "tick checklist item", "edit checklist item"],
  },

  "POST /api/projects": {
    summary:
      "Create a new project. It gets the next DN code, a URL slug, all 11 fixed teams (its Account Manager managing AM) and a calendar per service. Needs project:write. The Account Manager defaults to you.",
    body: "{ name (required); accountManagerId?: active employee id, the primary Account Manager (default you); secondaryAccountManagerId?: active employee id, someone other than the primary; clientId?; description?; status?: PLANNING (default)|ACTIVE|ON_HOLD|COMPLETED|CANCELLED; priority?: LOW|MEDIUM (default)|HIGH|URGENT; stage?: LAUNCH|GROWTH|REBRANDING|DECLINE (the Phase); startDate?: YYYY-MM-DD; budget?: number (INR); shortName?: up to 24 chars, unique; services?: array of SMO (Social Media), SEO (SEO/AEO/GEO), PM (Paid Performance), MSG (Email/WhatsApp/SMS), INF (Influencers), ALL (Alliances & Partnerships), DPR (Digital PR), WEB (Website), CAMP (Campaign Planning), OFF (Offline), BD (BD/Sales), BRAND (Branding Kit) }",
    keywords: ["new project", "create project", "add project", "start project", "onboard client"],
    notes:
      "Also shares the project's Drive folder with its Account Managers and team members, and notifies a new Account Manager in-app. Unknown service codes are silently dropped. Set service owners afterwards with PUT /api/projects/[id]/service-owners.",
  },
  "POST /api/projects/[id]/deliverables": {
    summary:
      "Log output made (default status DELIVERED) or plan owed work (PLANNED / IN_PROGRESS) on a project, optionally repeating weekly or monthly. Anyone on the project logs their own made work; logging for others needs their team manager, the Account Manager or project:write; planning needs a team or project manager.",
    body: "{ type (required): kind of thing, e.g. Reel, Post, Banner (max 40); title (required, max 200); quantity?: 1-999 (default 1); status?: DELIVERED (default)|PLANNED|IN_PROGRESS; employeeId?: maker (default you; null = unassigned, owed work only, then teamId is required); teamId?: team that owes it; completedOn?: YYYY-MM-DD, not in the future (made work, default today); startedOn?; dueOn?: YYYY-MM-DD; links?: http(s) URLs, max 20; notes?; taskId?: task on this project; goalId?: goal on this project; repeat?: { every: WEEK|MONTH, count: 1-52 } (owed work with a dueOn only) }",
    keywords: [
      "log deliverable",
      "log output",
      "record work done",
      "add deliverable",
      "plan deliverables",
      "owed work",
    ],
    notes:
      "Returns { id, created } (created > 1 when repeated). App labels: PLANNED = To do, DELIVERED = Made, REJECTED = Awaiting revision.",
  },
  "POST /api/projects/[id]/deliverables/[deliverableId]/start": {
    summary:
      "Start owed work: claims the deliverable if unassigned, moves it to IN_PROGRESS and creates a linked In Progress task for the maker, due on its due date. For the maker, anyone on the owing team (unclaimed work), their team manager or a project manager.",
    keywords: ["start deliverable", "claim work", "pick up deliverable", "begin owed work"],
    notes:
      "No body. Fails if it is already delivered or already tracked as a task. Returns { taskId, claimed }.",
  },
  "POST /api/projects/[id]/deliverables/[deliverableId]/status": {
    summary:
      "One-click status move on a deliverable: start, mark made (DELIVERED), accept, send back for revision (REJECTED), flag stuck, discard or reopen. Lifecycle: PLANNED -> IN_PROGRESS -> DELIVERED -> ACCEPTED, or REJECTED then DELIVERED again.",
    body: "{ status (required): PLANNED|IN_PROGRESS|STUCK|DELIVERED|ACCEPTED|REJECTED|DISCARDED; reason?: 3+ chars, required for STUCK, DISCARDED, REJECTED and ACCEPTED -> DELIVERED (un-accept); completedOn?: YYYY-MM-DD the work counts for (default today, not future); note?: acceptance note }",
    keywords: [
      "mark deliverable delivered",
      "accept deliverable",
      "reject deliverable",
      "send back for revision",
      "deliverable stuck",
      "approve output",
    ],
    notes:
      "Makers move their own work; only the Account Manager or a project:write holder may accept, jump PLANNED -> DELIVERED or un-accept; the team manager or Account Manager may send back. Work made over 7 days ago is locked except for project managers. Returns the saved row.",
  },
  "POST /api/projects/[id]/deliverables/[deliverableId]/verify": {
    summary:
      "Internal QC sign-off (stage-one check) on a deliverable, or retract it. For the team manager, the maker's line manager (when the team manager made it) or the Account Manager/project:write - nobody checks their own work. Not the client's acceptance.",
    body: "{ verified?: boolean (default true; false retracts the sign-off) }",
    keywords: ["verify deliverable", "QC check", "quality check", "sign off work", "review output"],
  },
  "POST /api/projects/[id]/deliverables/plan": {
    summary:
      "Plan a period's work across teams in one go: creates owed (PLANNED) deliverables, unassigned and owed by each team, all due on the period end. Only the Account Manager or project:write holders.",
    body: "{ periodStart (required), periodEnd (required): YYYY-MM-DD, at most a year; lines (required, 1-60): [{ teamId (required): team on this project; type (required); title (required); quantity?: 1-999; employeeId?: name a maker now; goalId?; notes? }] }",
    keywords: ["plan deliverables", "weekly plan", "monthly plan", "commit work", "content plan"],
    notes: "Adds to any existing plan for the period (never replaces). Returns { created }.",
  },
  "POST /api/projects/[id]/goals": {
    summary:
      "Create a project goal, or a sub-goal under a main goal (one level of nesting only). Only the Account Manager or project:write holders.",
    body: "{ title (required, max 200); description?; parentId?: main goal id to make this a sub-goal; status?: NOT_STARTED (default)|IN_PROGRESS|AT_RISK|DONE|DISCARDED; reason?: required for AT_RISK/DISCARDED; targetDate?: YYYY-MM-DD; tags?: string[] (max 6); ownerId?: accountable employee id (default the Account Manager) }",
    keywords: ["create goal", "add objective", "new goal", "sub-goal", "OKR"],
    notes:
      "Returns { id }. Add countable targets with POST .../goals/[goalId]/targets and link tasks with POST .../goals/[goalId]/tasks.",
  },
  "POST /api/projects/[id]/goals/[goalId]/reactivate": {
    summary:
      "Restore a deactivated (soft-deleted) project goal together with its sub-goals. Only the Account Manager or project:write holders. Find it with GET /api/projects/[id]/goals?includeInactive=1.",
    keywords: ["restore goal", "undelete goal", "reactivate goal"],
  },
  "POST /api/projects/[id]/goals/[goalId]/targets": {
    summary:
      "Add a countable deliverable target to a goal (e.g. 20 Reels between 1 and 30 Sep); the goal's progress then comes from delivered/accepted deliverables of that type. Only the Account Manager or project:write holders.",
    body: "{ deliverableType (required): e.g. Reel (max 40, case-insensitive match); quantity (required): 1-999; periodStart?, periodEnd?: YYYY-MM-DD (both omitted = counts everything ever) }",
    keywords: ["goal target", "set target", "quantity goal", "deliverable target"],
    notes: "Refused if it overlaps another target of the same type on this goal.",
  },
  "POST /api/projects/[id]/goals/[goalId]/tasks": {
    summary:
      "Link existing project tasks to a goal so its progress can derive from them. For the Account Manager, project:write holders or any team manager on the project.",
    body: "{ taskIds (required): array of task ids on this project (max 200; ids from other projects are ignored) }",
    keywords: ["link tasks to goal", "attach task to goal", "goal tasks"],
    notes: "Returns { linked }. A task already serving another goal is moved to this one.",
  },
  "POST /api/projects/[id]/requirements": {
    summary:
      "Raise a requirement - something the team needs (by default from the Account Manager, who chases the client) such as a document, login, access, content, design, approval or payment - optionally marking tasks it blocks. Anyone on the project.",
    body: "{ title (required); type?: DOCUMENT|CREDENTIAL|ACCESS|CONTENT|DESIGN|APPROVAL|PAYMENT|OTHER (default OTHER); details?; neededBy?: YYYY-MM-DD; requestedFromId?: employee id (default the Account Manager); teamId?: team on this project (default the blocked task's team or yours); blockedTaskIds?: task ids on this project }",
    keywords: [
      "raise requirement",
      "need from client",
      "blocker",
      "request access",
      "pending from client",
    ],
    notes:
      "Notifies the person it is requested from and the blocked team's manager in-app and by email.",
  },
  "POST /api/projects/[id]/service-calendars": {
    summary:
      "Create this month's calendar for one of the project's services if it has none yet (adopts an existing same-named calendar instead). Only the Account Manager or project:write holders.",
    body: "{ service (required): a service code ticked on the project, e.g. SEO, SMO, WEB, PM }",
    keywords: ["service calendar", "create calendar", "content calendar", "monthly calendar"],
    notes: "Returns { created } (0 when the service already had a calendar).",
  },
  "POST /api/projects/[id]/tasks": {
    summary:
      "Create a task on a project, optionally in a team and assigned with a due date. A team task needs that team's manager, the Account Manager or project:write; a project-level task (no teamId) needs the Account Manager or project:write. Members adding their own work use POST .../teams/[teamId]/tasks.",
    body: "{ title (required); teamId?: team on this project; assigneeId?: employee id; description?; status?: TODO (default)|IN_PROGRESS|DONE|ON_HOLD|DISCARDED; priority?: LOW|MEDIUM (default)|HIGH|URGENT; startDate?, dueDate?: YYYY-MM-DD; estimatedHours?: number; tags?: string[]; goalId?: goal on this project; producesOutput?: boolean (expects a deliverable; default from the team) }",
    keywords: [
      "create task",
      "assign task",
      "new task",
      "add task to project",
      "give someone a task",
    ],
    notes:
      "Notifies the assignee in-app. assigneeId is not checked against the project's teams, and a missing title is not caught cleanly - always send it.",
  },
  "POST /api/projects/[id]/teams": {
    summary:
      "Always refused (405): every project has the same fixed teams, created with the project. To staff a team use POST /api/projects/[id]/teams/[teamId]/members.",
    keywords: ["create team", "add team"],
  },
  "POST /api/projects/[id]/teams/[teamId]/members": {
    summary:
      "Add an employee to a project team, which puts them on the project. For project:write holders, the Account Manager or that team's manager. The first member of an empty team becomes its manager.",
    body: "{ employeeId (required): active employee id (e.g. from GET /api/projects/[id]/assignable-employees) }",
    keywords: [
      "add team member",
      "add to project",
      "staff team",
      "assign to project",
      "add person to team",
    ],
    notes:
      "Notifies the person in-app and by email and gives them access to the project's Drive folder. 409 if already on that team.",
  },
  "POST /api/projects/[id]/teams/[teamId]/tasks": {
    summary:
      "Create a task in a project team. A team member may add their own task (send their own id as assigneeId); the team manager, Account Manager or project:write may assign it to any member of the team.",
    body: "{ title (required); assigneeId?: a member of this team - defaults to the TEAM MANAGER, so non-managers must send their own id; description?; priority?: LOW|MEDIUM (default)|HIGH|URGENT; dueDate?: YYYY-MM-DD; estimatedHours?: number; tags?: string[]; goalId?: goal on this project; producesOutput?: boolean; seoPropertyId?: an SEO site of this project }",
    keywords: ["create team task", "assign task", "add my task", "new task"],
    notes:
      "Starts as TODO. A manager assigning someone else notifies them in-app and by email; a member adding their own task notifies the team manager in-app.",
  },
  "POST /api/projects/performance/report": {
    summary:
      "Generate an AI-written performance briefing (portfolio, project, team or individual) from real task data in your scope (as GET /api/projects/performance): overall, on track, needs attention, urgent, blockers, workload, quality, actions. Nothing is stored.",
    body: "{ type?: portfolio (default)|project|team|individual; sections?: array of overall|onTrack|attention|urgent|blockers|workload|quality|actions (default overall, onTrack, attention, urgent, actions); projectIds?: ids; teamIds?: ids (project/team/individual only); employeeIds?: ids (individual only); from?, to?: YYYY-MM-DD due window }",
    keywords: [
      "performance report",
      "AI report",
      "team briefing",
      "status summary",
      "manager report",
    ],
    notes:
      "Returns { report } as text. 503 when AI is not configured. Filters the chosen type does not use are silently ignored.",
  },
  "POST /api/tasks": {
    summary:
      "Create an ADHOC task - work with no project or client (meetings, interviews, internal QC) - on yourself, on a direct report, or on anyone if you hold project:write.",
    body: "{ title (required); assigneeId?: active employee id (default you); description?; priority?: LOW|MEDIUM (default)|HIGH|URGENT; dueDate?: YYYY-MM-DD; estimatedHours?: number; tags?: string[] }",
    keywords: ["adhoc task", "personal task", "meeting task", "my work", "create task"],
    notes:
      "For client/project work use POST /api/projects/[id]/tasks or POST /api/projects/[id]/teams/[teamId]/tasks. Notifies the assignee in-app when it is not you.",
  },
  "POST /api/tasks/[id]/checklist": {
    summary:
      "Add a checklist line (sub-item) to the end of a task's checklist. [id] = task id. Anyone who can see the task.",
    body: "{ text (required): string }",
    keywords: ["add subtask", "add checklist item", "task to-do"],
  },
  "POST /api/tasks/[id]/comments": {
    summary:
      "Comment on a task as the signed-in person. [id] = task id. Anyone who can see the task; the comment also shows in the project's activity feed.",
    body: "{ content (required): string }",
    keywords: ["comment on task", "add note to task", "reply on task"],
  },
  "PUT /api/projects/[id]/service-owners": {
    summary:
      "Set or clear who owns one service on a project (e.g. who owns SEO) and its always-on secondary owner, who has the same powers on the service's calendars. An Account Manager or project:write holder sets either; the service's owner may also pick or clear their own secondary.",
    body: "{ service (required): a service code ticked on the project (SMO, SEO, PM, MSG, INF, ALL, DPR, WEB, CAMP, OFF, BD, BRAND); employeeId?: the owner - someone on the project's teams (or an Account Manager), or null to clear; secondaryEmployeeId?: the secondary owner, same rule, someone other than the owner, or null to clear. A key left out stays as it is. }",
    keywords: [
      "service owner",
      "secondary service owner",
      "backup owner",
      "who owns SEO",
      "assign service",
      "calendar owner",
    ],
    notes:
      "Clearing the owner moves the secondary up (with the calendars from this month on); making the secondary the owner empties the secondary slot. A secondary needs an owner. Notifies each newly named person in-app and by email (not when you pick yourself). Returns every service owner on the project.",
  },
}
