import type { DescriptionMap } from "./types"

// HR ops & content: onboarding/exit checklists, resignations, clearances, documents and document
// requests, stock register, chat (DMs), work reports, SEO sites. See ./types.ts for the format.
export const HR_OPS_CONTENT: DescriptionMap = {
  "DELETE /api/chat/messages/[messageId]": {
    summary:
      "Delete a chat (DM) message. scope=me hides any message from the caller's own view only; scope=everyone removes the caller's OWN message for both people (only within 15 minutes of sending), leaving a 'Message deleted' placeholder.",
    query:
      "scope: me|everyone (default me). messageId comes from GET /api/chat/conversations/[conversationId]/messages.",
    keywords: ["delete message", "unsend message", "remove chat message", "delete for everyone"],
    notes:
      "scope=everyone cannot be undone and fails with 403 on someone else's message or after the 15-minute window.",
  },
  "DELETE /api/documents/[id]": {
    summary:
      "Permanently delete a stored document (company document or an employee's personal document such as ID proof or offer letter) and its file. Needs document:delete.",
    keywords: [
      "delete document",
      "remove file",
      "delete company policy",
      "remove employee document",
    ],
    notes:
      "Irreversible: the file is removed from storage. Confirm the exact document (title, owner) with the user first.",
  },
  "DELETE /api/resignations/[id]": {
    summary:
      "Withdraw the caller's OWN resignation while it is still PENDING (sets it to CANCELLED). Get the id from GET /api/resignations. An approved or rejected resignation cannot be withdrawn here.",
    keywords: [
      "withdraw resignation",
      "cancel resignation",
      "take back resignation",
      "retract notice",
    ],
  },
  "DELETE /api/stock/issues/[id]": {
    summary:
      "Delete one entry from the stock register (an item issued to someone), which puts that quantity back into 'stock left'. Needs employee:write (HR). Get the id from GET /api/stock/issues.",
    keywords: [
      "delete stock entry",
      "remove issued item",
      "undo stock issue",
      "stock register delete",
    ],
    notes: "Irreversible. Confirm the holder, item and quantity first.",
  },
  "GET /api/chat/attachments/[attachmentId]/file": {
    summary:
      "Download a file sent in a chat (photo, video, voice note, sticker or document). Only the two people in that conversation can fetch it. Attachment ids are in messages[].attachments[].id from the conversation messages endpoint.",
    query: "download: 1 to download with the original file name (otherwise opens inline).",
    keywords: [
      "chat file",
      "chat photo",
      "voice note",
      "chat attachment download",
      "DM attachment",
    ],
    notes: "Returns a file (redirect to a signed link) - use dnms_download.",
  },
  "GET /api/chat/contacts": {
    summary:
      "List active colleagues the caller can start a chat (DM) with, with name, email, photo and designation. Excludes the caller. Use the id with POST /api/chat/conversations.",
    query: "search: part of a first name, last name or email (optional). Returns at most 50, A-Z.",
    keywords: ["who can I message", "chat contacts", "find colleague to message", "new chat"],
  },
  "GET /api/chat/conversations": {
    summary:
      "List the caller's own one-to-one chat conversations (DMs): the other person, last message preview, unread count per chat and total unread. Pinned chats first, then most recent. Up to 100.",
    keywords: ["my chats", "my messages", "inbox", "DM list", "conversations"],
  },
  "GET /api/chat/conversations/[conversationId]/messages": {
    summary:
      "Read the messages in one of the caller's chat conversations (oldest first), with replies, reactions, attachments, polls/events and read receipts. Only participants can read. conversationId from GET /api/chat/conversations.",
    query:
      "before: ISO timestamp - return messages older than this (page backwards using the oldest createdAt); limit: default 50, max 100. Response has hasMore.",
    keywords: ["read messages", "chat history", "open chat", "what did they say", "DM thread"],
    notes: "Reading does not mark the chat as read - call POST .../read for that.",
  },
  "GET /api/chat/conversations/[conversationId]/pinned": {
    summary:
      "List pinned messages in one of the caller's chat conversations (newest pin first, up to 20).",
    keywords: ["pinned messages", "pinned in chat", "important messages"],
  },
  "GET /api/chat/conversations/[conversationId]/search": {
    summary:
      "Search message text inside one of the caller's chat conversations. Returns up to 50 matches, newest first.",
    query: "q: search text, at least 2 characters (shorter returns nothing).",
    keywords: ["search in chat", "find message", "search conversation"],
  },
  "GET /api/chat/search": {
    summary:
      "Search across ALL the caller's chats by message text and by the other person's name. Groups results per conversation (up to 5 matching messages each), most recent first.",
    query: "q: search text, at least 2 characters.",
    keywords: ["search messages", "search all chats", "find chat with", "find DM"],
  },
  "GET /api/chat/unread": {
    summary:
      "Count the caller's unread chat messages: { unreadCount, conversations } (how many chats have unread messages). Cheap badge check.",
    keywords: ["unread messages", "unread chats", "new messages count"],
    notes: "Side effect: marks waiting messages to the caller as delivered (second tick).",
  },
  "GET /api/clearances": {
    summary:
      "The caller's own to-do list of open onboarding and exit checklist items assigned to them, e.g. IT 'collect laptop', Finance 'no dues', manager handover sign-off. Clearances first, then by due date. No HR permission needed.",
    keywords: [
      "my clearances",
      "exit clearance pending",
      "my checklist tasks",
      "sign off clearance",
      "pending sign-offs",
    ],
  },
  "GET /api/clearances/count": {
    summary:
      "The 'Waiting on you' badge number: open onboarding/exit checklist items assigned to the caller PLUS weekly joinee reviews due from them (Fridays not yet scored for people they manage as reporting or dotted manager). Returns { count }.",
    keywords: ["clearance count", "pending clearances", "how many sign-offs", "waiting on you"],
    notes:
      "Can be higher than GET /api/clearances, which lists only the checklist items; the due weekly reviews are listed by GET /api/joinee-weekly-reviews/due.",
  },
  "GET /api/document-requests": {
    summary:
      "List document requests (HR asking an employee to upload a document). HR with document:write sees everyone's and can filter; anyone else sees only requests addressed to them.",
    query:
      "employeeId: only this employee (HR only, ignored for others); status: PENDING|FULFILLED|CANCELLED.",
    keywords: [
      "document requests",
      "documents HR asked for",
      "pending document upload",
      "requested documents",
    ],
  },
  "GET /api/documents": {
    summary:
      "List company-wide documents (policies, templates, handbooks) - not employees' personal documents (those are under /api/employees/[id]/documents). Needs document:read, which every employee has.",
    query:
      "category: IDENTITY|ACADEMIC|PROFESSIONAL|EMPLOYMENT|TAX|COMPANY_POLICY|TEMPLATE|OTHER; page; limit (default 10, max 100).",
    keywords: ["company documents", "policies", "HR policy document", "templates", "handbook"],
  },
  "GET /api/documents/[id]": {
    summary:
      "Get a 15-minute download link for one document plus its details. Company documents: anyone with document:read. Personal documents: the owner or HR (employee:read). Ids from GET /api/documents or /api/employees/[id]/documents.",
    query: "download: 1 to make the link download with the original file name.",
    keywords: ["download document", "open document", "view policy", "document link"],
    notes: "Returns a file link - use dnms_download.",
  },
  "GET /api/exit-clearance/full-final": {
    summary:
      "The Full & Final settlement register: every leaver (DNMS leavers added automatically, past employees by hand) with last working day, FnF due date (two months after it unless changed), FnF released-on date, status, notice period and relieving letter. Open ones first, most urgent on top. Needs exit:read.",
    notes:
      "status = { state: PENDING|DUE_SOON (due within 7 days)|OVERDUE|RELEASED|RELEASED_LATE, days (left or late) }. Reading it also adds any new DNMS leavers to the register and moves their last working day/default due date to match their profile.",
    keywords: [
      "full and final",
      "fnf",
      "final settlement",
      "fnf due",
      "fnf overdue",
      "relieving letter",
      "notice period served",
    ],
  },
  "POST /api/exit-clearance/full-final": {
    summary:
      "Add a past employee (someone who left before DNMS) to the Full & Final register. Needs exit:write.",
    body: "{ name (required unless employeeId); employeeId?: a DNMS employee id instead of name (409 if already in the register); lastWorkingDate (required): YYYY-MM-DD; designation?; dueDate?: YYYY-MM-DD, not before lastWorkingDate (default two months after it); releasedOn?: YYYY-MM-DD; noticePeriod?: SERVED|NOT_SERVED|COMPANY_EXIT; relievingGiven?: boolean; relievingDate?: YYYY-MM-DD (kept only when relievingGiven is true); notes? (max 2000) }",
    keywords: ["add fnf", "record full and final", "past employee settlement"],
  },
  "PATCH /api/exit-clearance/full-final/[id]": {
    summary:
      "Update one Full & Final record: FnF due date, released-on date (null to clear), notice period, relieving letter and its date, notes. Needs exit:write.",
    body: "{ dueDate?: YYYY-MM-DD (not before the last working day); releasedOn?: YYYY-MM-DD | null; noticePeriod?: SERVED|NOT_SERVED|COMPANY_EXIT|null; relievingGiven?: boolean (false also clears relievingDate); relievingDate?: YYYY-MM-DD | null; designation?: string | null; notes?: string | null; name?/lastWorkingDate?: YYYY-MM-DD, past employees only }",
    notes:
      "For a leaver who was in DNMS the last working day follows their profile, so lastWorkingDate is refused (409) - change it on the profile - and name is ignored. Releasing FnF = set releasedOn. id from GET /api/exit-clearance/full-final.",
    keywords: ["mark fnf released", "fnf paid", "update full and final"],
  },
  "DELETE /api/exit-clearance/full-final/[id]": {
    summary:
      "Remove a past employee's Full & Final record. Needs exit:write. Leavers who were in DNMS can't be removed (409) - they would be added back.",
    notes: "Irreversible. Confirm the name first.",
    keywords: ["delete fnf record", "remove full and final"],
  },
  "GET /api/exit-clearance/serving-notice": {
    summary:
      "Everyone currently serving their notice period (resignation accepted, account still active), with last working day, manager, and exit checklist progress including which clearances still block relieving. Needs exit:read.",
    keywords: [
      "serving notice",
      "notice period",
      "who is leaving",
      "leavers",
      "exit pipeline",
      "last working day",
    ],
  },
  "GET /api/hr-checklists": {
    summary:
      "List onboarding or exit clearance checklists with each employee and progress (items and clearances done). Needs onboarding:read (ONBOARDING) or exit:read (EXIT).",
    query:
      "kind: ONBOARDING|EXIT (default ONBOARDING); status: IN_PROGRESS|COMPLETED|CANCELLED|ALL (default IN_PROGRESS); search: employee name or employee no; page; limit (default 20, max 100).",
    keywords: [
      "onboarding checklist",
      "exit checklist",
      "joiners",
      "exit clearance list",
      "new hire checklist",
    ],
  },
  "GET /api/hr-checklists/[id]": {
    summary:
      "One onboarding or exit checklist in full: every item with its section, assignee, due date, done/notes, plus progress, the linked resignation, and what the caller may do (canWrite, myItemIds). Readable by HR for that kind, the employee themselves, and anyone assigned an item.",
    keywords: [
      "checklist details",
      "exit clearance status",
      "onboarding progress",
      "checklist items",
    ],
  },
  "GET /api/resignations": {
    summary:
      "The caller's OWN latest resignation (any status: PENDING, APPROVED, REJECTED, CANCELLED) with reviewer and note, or null if they never resigned.",
    keywords: [
      "my resignation",
      "resignation status",
      "did my resignation get approved",
      "my notice",
    ],
  },
  "GET /api/resignations/review": {
    summary:
      "Pending resignations waiting for the caller's decision: HR (resignation:approve) sees all, a manager sees those of people they manage directly (as reporting or dotted manager). Others get an empty list with authorized:false.",
    query: "page; limit (default 10, max 100).",
    keywords: [
      "resignations to approve",
      "pending resignations",
      "review resignation",
      "who resigned",
    ],
  },
  "GET /api/resignations/review/count": {
    summary:
      "Number of pending resignations the caller can review (all for HR with resignation:approve, otherwise those of their direct reports, reporting or dotted).",
    keywords: ["pending resignation count", "resignations waiting"],
  },
  "GET /api/seo/sites": {
    summary:
      "List the Google Search Console properties (siteUrl, permissionLevel) the company's service account can read, plus that service account's email to grant access to. Used to pick the exact property when linking a project's SEO. Needs project:write.",
    keywords: [
      "search console sites",
      "GSC properties",
      "google search console",
      "seo property list",
    ],
    notes: "503 when Search Console is not configured.",
  },
  "GET /api/stock/employees": {
    summary:
      "Search employees, including deactivated ones (the holder may have left), to link stock register entries to a person. Needs employee:read. Returns up to 20.",
    query: "q: first name, last name or employee no (optional).",
    keywords: ["link stock to employee", "stock holder search", "find employee for stock"],
  },
  "GET /api/stock/issues": {
    summary:
      "The stock register ledger: one row per item issued to someone (holder name, linked employee, item, quantity, issued date, notes), newest first. Needs employee:read (HR).",
    query:
      "q: matches holder name, item name or employee name; itemId: only this item; unlinked: 1 = only entries not linked to an employee; page; limit (default 25, max 100).",
    keywords: [
      "stock issued",
      "who has what",
      "items given to employees",
      "stock ledger",
      "welcome kit issued",
    ],
  },
  "GET /api/stock/items": {
    summary:
      "List stock items (merchandise, kits, equipment) with price per piece (INR), purchased quantity, issued quantity and stock left. Needs employee:read (HR).",
    keywords: ["stock items", "inventory", "stock left", "how many left", "stock balance"],
  },
  "GET /api/stock/register": {
    summary:
      "The stock register as a grid like the original sheet: one row per holder + issue date, one cell per item with summed quantity and the underlying entry ids (needed by PATCH /api/stock/register). Needs employee:read.",
    query:
      "q: holder or employee name (not item name); itemId: rows that include this item; unlinked: 1 = only rows not linked to an employee; page; limit (default 25, max 100) - pages over rows.",
    keywords: ["stock register", "stock sheet", "stock matrix", "stock by person"],
    notes: "For an Excel/CSV of the register, use dnms_export_table on this endpoint.",
  },
  "GET /api/work-reports": {
    summary:
      "Generate a work/progress report file for one or more people over a month or date range: attendance, leave, WFH, hours, tasks and deliverables done, open items. Admins/HR any employee; managers themselves and their reporting line; others only themselves.",
    query:
      "month: YYYY-MM, OR from + to: YYYY-MM-DD (max 92 days apart, cannot start in the future); employeeIds: comma-separated employee ids (required for managers/admins, ignored for others - always self; max 40); projectIds: comma-separated project ids to limit to (optional, max 50); format: pptx|pdf|docx (default pptx); ai: 1|0 (default 1 - AI polishes the bullets).",
    keywords: [
      "work report",
      "progress report",
      "monthly report",
      "team report",
      "performance deck",
      "weekly report",
    ],
    notes:
      "Returns a file - use dnms_download. Call GET /api/work-reports/scope first to see whose report the caller may build. Asking for someone outside scope is a 403.",
  },
  "GET /api/work-reports/scope": {
    summary:
      "Who the caller may include in a work report: role (admin|manager|member), the people list (id, name, designation, department, inTeam, isMe), the default month (last month) and whether AI polishing is available.",
    keywords: ["work report people", "who can I report on", "my team for report"],
  },
  "PATCH /api/chat/messages/[messageId]": {
    summary:
      "Edit the text of the caller's OWN chat message, only within 15 minutes of sending. The message shows as edited.",
    body: "{ body: string (required, 1-4000 chars) }",
    keywords: ["edit message", "fix typo in chat", "change message"],
  },
  "PATCH /api/document-requests/[id]": {
    summary:
      "Close a document request. The employee it is addressed to can mark it FULFILLED (after uploading); HR (document:write) can mark any request FULFILLED or CANCELLED. Id from GET /api/document-requests.",
    body: "{ action: FULFILL|CANCEL (required) }",
    keywords: ["fulfil document request", "cancel document request", "mark document submitted"],
    notes: "Only changes the status - it does not check that a file was actually uploaded.",
  },
  "PATCH /api/hr-checklists/items/[itemId]": {
    summary:
      "Tick or untick one onboarding/exit checklist item, e.g. sign off a clearance ('laptop returned'). Allowed for the item's assignee or HR with onboarding:write / exit:write. Item ids from GET /api/clearances or GET /api/hr-checklists/[id].",
    body: "{ done: boolean (required - explicit, not a toggle), note?: string (max 500, e.g. 'laptop returned, asset tag DN-114') }",
    keywords: [
      "sign clearance",
      "mark checklist item done",
      "laptop returned",
      "no dues",
      "complete onboarding task",
    ],
    notes:
      "409 if the checklist is closed or someone else just changed the item. Signing a clearance is audit-logged.",
  },
  "PATCH /api/hr-checklists/items/[itemId]/assignee": {
    summary:
      "Reassign one onboarding/exit checklist item to another active employee (e.g. a stand-in while a department head is away), or unassign it. Needs onboarding:write or exit:write for that checklist's kind.",
    body: "{ assigneeId: employee id, or null to unassign (required key) }",
    keywords: ["reassign clearance", "change checklist owner", "assign checklist item"],
    notes: "Notifies the new assignee.",
  },
  "PATCH /api/stock/issues/[id]": {
    summary:
      "Edit one stock register entry: holder name, linked employee, quantity, issued date or notes. Needs employee:write (HR).",
    body: "{ holderName?: string, employeeId?: employee id to link | null to unlink (omit to leave), quantity?: integer >=1, issuedOn?: YYYY-MM-DD | null, notes?: string | null }",
    keywords: ["edit stock entry", "link stock to employee", "correct issued quantity"],
  },
  "PATCH /api/stock/items/[id]": {
    summary:
      "Edit a stock item: rename, change price, correct the purchased total, or restock (add pieces). Needs employee:write (HR). Item ids from GET /api/stock/items.",
    body: "{ name?: string (unique), pricePerPiece?: number INR | null, purchasedQty?: integer (sets the total), restockBy?: integer >=1 (adds to the total; wins over purchasedQty), notes?: string | null }",
    keywords: ["restock", "add stock", "update stock price", "correct stock quantity"],
  },
  "PATCH /api/stock/register": {
    summary:
      "Save one whole row of the stock register grid (one holder + date): sets holder, linked employee and date on every cell, and each cell's quantity (0 deletes it). Needs employee:write. Take the row from GET /api/stock/register.",
    body: "{ holderName: string (required), employeeId: employee id | null (required), issuedOn: YYYY-MM-DD | null (required), cells: [{ itemId: string, issueIds: string[] (the cell's ids from GET /api/stock/register; [] for a new cell), quantity: integer >=0 }] (1-100) }",
    keywords: ["edit stock row", "update stock register", "change stock quantities"],
    notes:
      "Fails if the row changed since it was read - re-read and retry. quantity 0 deletes entries.",
  },
  "POST /api/chat/conversations": {
    summary:
      "Open (or create, if none exists) the one-to-one chat with a colleague and return its conversation id. Idempotent. Get the colleague's id from GET /api/chat/contacts.",
    body: "{ employeeId: employee id (required, an active colleague, not yourself) }",
    keywords: ["start chat", "message someone", "new DM", "open conversation with"],
  },
  "POST /api/chat/conversations/[conversationId]/attachments": {
    summary:
      "Send photos, videos, voice notes, stickers or files in a chat (up to 25 MB each), with an optional caption.",
    body: "multipart form: files (one or more), body?: caption, sticker?: 1, durationSec?, waveform?",
    keywords: ["send file in chat", "send photo", "send voice note", "share attachment"],
    notes: "File upload - not possible through the AI connector.",
  },
  "POST /api/chat/conversations/[conversationId]/cards": {
    summary:
      "Post a poll, an event invite or a colleague's contact card into one of the caller's chats, as the caller.",
    body: "{ kind: poll|event|contact (required). poll: question (required), options: string[] (2-12 required), allowMultiple?: boolean, closesAt?: ISO datetime. event: title (required), startsAt: ISO datetime (required), endsAt?, location?, notes?. contact: employeeId (required - the colleague to share) }",
    keywords: ["chat poll", "create poll", "send event invite", "share contact"],
    notes: "Sent as the user - confirm the content first.",
  },
  "POST /api/chat/conversations/[conversationId]/messages": {
    summary:
      "Send a text message (DM) in one of the caller's chat conversations, optionally as a reply quoting an earlier message. Get or create the conversation with POST /api/chat/conversations.",
    body: "{ body: string (required, 1-4000 chars), replyToId?: id of a message in the same conversation to quote }",
    keywords: ["send message", "DM someone", "reply in chat", "text a colleague"],
    notes: "Sent as the user and notifies the recipient - confirm the exact text first.",
  },
  "POST /api/chat/conversations/[conversationId]/pin": {
    summary:
      "Pin or unpin a conversation at the top of the caller's own chat list (a toggle - calling again unpins). Does not affect the other person.",
    keywords: ["pin chat", "unpin chat", "pin conversation"],
  },
  "POST /api/chat/conversations/[conversationId]/read": {
    summary:
      "Mark one of the caller's chat conversations as read: clears its unread count and chat notifications and shows the other person a read receipt.",
    keywords: ["mark as read", "mark chat read", "clear unread"],
  },
  "POST /api/chat/messages/[messageId]/pin": {
    summary:
      "Pin or unpin a message in a chat (a toggle). Pinned messages are shared - both people see them in the pinned list.",
    keywords: ["pin message", "unpin message", "pin in chat"],
  },
  "POST /api/chat/messages/[messageId]/react": {
    summary:
      "Add an emoji reaction to a chat message, or remove it if the caller already reacted with that emoji (toggle).",
    body: "{ conversationId: the message's conversation id (required), emoji: string (required, e.g. thumbs-up emoji) }",
    keywords: ["react to message", "emoji reaction", "like message"],
  },
  "POST /api/document-requests": {
    summary:
      "HR asks an employee to upload a document (e.g. PAN card, degree certificate) with an optional note and due date. Needs document:write.",
    body: "{ employeeId: employee id (required), title: string (required), category?: IDENTITY|ACADEMIC|PROFESSIONAL|EMPLOYMENT|TAX|COMPANY_POLICY|TEMPLATE|OTHER (default OTHER), note?: string, dueDate?: YYYY-MM-DD }",
    keywords: [
      "request document",
      "ask employee to upload",
      "collect documents",
      "missing documents",
    ],
    notes: "Notifies the employee in DNMS.",
  },
  "POST /api/documents": {
    summary:
      "Upload a document - a company-wide one (policy, template), or a personal one for an employee when employeeId is given. Needs document:write.",
    body: "multipart form: file (required), title (required), description?, category? (IDENTITY|ACADEMIC|PROFESSIONAL|EMPLOYMENT|TAX|COMPANY_POLICY|TEMPLATE|OTHER), employeeId?, expiresAt?",
    keywords: ["upload document", "add policy", "upload company file"],
    notes: "File upload - not possible through the AI connector.",
  },
  "POST /api/hr-checklists": {
    summary:
      "Start an onboarding or exit clearance checklist for an employee by hand, from the company template. Needs onboarding:write or exit:write. Exit checklists normally start automatically when a resignation is approved.",
    body: "{ employeeId: employee id (required), kind: ONBOARDING|EXIT (defaults to ONBOARDING if omitted) }",
    keywords: ["start onboarding", "start exit clearance", "create checklist", "begin offboarding"],
    notes:
      "Notifies every item owner. 409 if no template exists or the employee already has an open checklist of that kind.",
  },
  "POST /api/hr-checklists/[id]/cancel": {
    summary:
      "Cancel (abandon) an in-progress onboarding or exit checklist, e.g. a withdrawn resignation or a joiner who never started. Needs onboarding:write or exit:write.",
    body: "{ reason?: string (max 300) }",
    keywords: ["cancel checklist", "abandon onboarding", "cancel exit clearance"],
    notes: "Cannot be reopened afterwards.",
  },
  "POST /api/hr-checklists/[id]/complete": {
    summary:
      "Mark an ONBOARDING checklist complete. Needs onboarding:write. Refused (409, naming them) while any required clearance item is unsigned. For exits use complete-exit.",
    keywords: ["complete onboarding", "finish onboarding", "close onboarding checklist"],
  },
  "POST /api/hr-checklists/[id]/complete-exit": {
    summary:
      "HR's final exit sign-off (relieving): closes the exit checklist, marks the employee RESIGNED, deactivates the account, takes them off project teams and passes their projects/services to the secondary owner, and ticks relieving on their Full & Final record. Needs exit:write. 409 while required clearances are unsigned; not for your own exit.",
    keywords: [
      "relieve employee",
      "complete exit",
      "final settlement sign-off",
      "issue relieving",
      "offboard",
    ],
    notes:
      "High impact and not reversible here: the person loses access immediately and gets a relieving email (manager cc). Get explicit confirmation.",
  },
  "POST /api/hr-checklists/[id]/items": {
    summary:
      "Add an extra item to an in-progress onboarding/exit checklist, e.g. a clearance from another department the leaver worked with. Needs onboarding:write or exit:write.",
    body: "{ sectionTitle: string (required, the step it belongs to), text: string (required, 2-300), helpText?: string, itemKind?: TASK|CLEARANCE (default TASK; a required CLEARANCE blocks completion), assigneeId?: employee id | null, isRequired?: boolean (default true), dueDate?: YYYY-MM-DD }",
    keywords: ["add checklist item", "add clearance", "extra exit task"],
    notes: "Notifies the assignee if one is given.",
  },
  "POST /api/resignations": {
    summary:
      "Submit the CALLER'S OWN resignation (starts the notice process). Blocked if they already have a pending or accepted resignation.",
    body: "{ reason?: string, requestedLastWorkingDate?: YYYY-MM-DD }",
    keywords: ["resign", "submit resignation", "put in my papers", "serve notice"],
    notes:
      "Very serious - only on the user's explicit, confirmed request. Notifies their manager and HR and emails HR from the employee's own Gmail if set up. If no last working date is given, approval sets it to the approval day.",
  },
  "POST /api/resignations/[id]/review": {
    summary:
      "Approve or reject a pending resignation. Allowed for the employee's reporting or dotted manager or HR (resignation:approve), never for your own. Approving starts the notice period and the exit clearance checklist. Id from GET /api/resignations/review.",
    body: "{ action: APPROVE|REJECT (required), note?: string }",
    keywords: [
      "approve resignation",
      "reject resignation",
      "accept resignation",
      "decline resignation",
    ],
    notes:
      "Emails and notifies the employee (both managers cc). Approval sets their last working day (requested date, or today if none) and notifies exit checklist owners. Cannot be undone.",
  },
  "POST /api/stock/import": {
    summary:
      "Bulk-import stock items and issues (the parsed stock sheet) as JSON. Additive: known item names are restocked (quantity added, price replaced), unknown ones created; issue holders are auto-linked to employees by name. Needs employee:write.",
    body: "{ items: [{ name: string, pricePerPiece: number | null, purchasedQty: integer | null }] (max 500), issues: [{ holderName: string, itemName: string, quantity: integer >=1, issuedOn: YYYY-MM-DD | null }] (max 5000) }",
    keywords: ["import stock", "upload stock sheet", "bulk add stock"],
    notes: "Running the same import twice double-counts. Confirm before calling.",
  },
  "POST /api/stock/issues": {
    summary:
      "Record that a stock item was issued to someone (e.g. welcome kit, T-shirt, laptop bag), optionally linked to an employee. Needs employee:write (HR). Item ids from GET /api/stock/items.",
    body: "{ itemId: string (required), holderName: string (required), employeeId?: employee id | null, quantity: integer >=1 (required), issuedOn?: YYYY-MM-DD | null, notes?: string }",
    keywords: ["issue stock", "give item to employee", "laptop issued", "hand out merchandise"],
    notes: "Does not check stock left - it can go negative.",
  },
  "POST /api/stock/issues/bulk": {
    summary:
      "Act on several stock register entries at once: link them to an employee, unlink them, or delete them. Needs employee:write (HR).",
    body: "{ ids: string[] (required, 1-500 entry ids), action: link|unlink|delete (required), employeeId?: employee id (required for link) }",
    keywords: ["bulk link stock", "bulk delete stock entries", "link many entries"],
    notes:
      "Any action other than exactly 'link' or 'unlink' DELETES the entries. Deletes are irreversible - confirm first.",
  },
  "POST /api/stock/items": {
    summary:
      "Add a new stock item to the register (e.g. 'Welcome kit', 'Laptop bag'). Needs employee:write (HR).",
    body: "{ name: string (required, unique, max 120), pricePerPiece?: number INR | null, purchasedQty?: integer (default 0), notes?: string | null }",
    keywords: ["add stock item", "new inventory item", "create stock"],
  },
}
