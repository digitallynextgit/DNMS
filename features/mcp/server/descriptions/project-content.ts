import type { DescriptionMap } from "./types"

// Project content: sheets / content calendars (workbooks, tabs, rows, columns, team plan),
// project chat (messages, replies, reactions, attachments), the Files tab (folders, uploaded
// files, saved links) and the project's Google Drive folder. See ./types.ts for the format.
//
// Vocabulary: a "sheet" or "calendar" in the UI is a WORKBOOK (often one edition per month).
// Each workbook has TABS - the [sheetId] in /sheets/... routes is a TAB id, not a workbook id.
export const PROJECT_CONTENT: DescriptionMap = {
  "DELETE /api/projects/[id]/drive/file": {
    summary:
      "Move a file in the project's Google Drive folder to the Drive trash. Only the project's Account Manager or a project admin. [id] is the project id or slug; the Drive file id goes in the body (from GET /api/projects/[id]/drive or /files driveFiles).",
    body: "{ fileId: Google Drive file id (required) }",
    keywords: ["delete drive file", "trash google doc", "remove file from drive", "bin drive file"],
    notes:
      "Recoverable from the Drive trash. Refuses files outside this project's Drive folder (404). The body is required even though this is a DELETE.",
  },
  "DELETE /api/projects/[id]/folders/[folderId]": {
    summary:
      "Delete an EMPTY folder from a project's Files tab (and its Google Drive mirror). Allowed for the folder's creator or a project manager. [folderId] comes from GET /api/projects/[id]/folders or /files.",
    keywords: ["delete folder", "remove project folder", "files tab folder"],
    notes:
      "Fails with a validation error if the folder still holds sub-folders, files, links or anything in its Drive mirror - move or delete them first.",
  },
  "DELETE /api/projects/[id]/links/[linkId]": {
    summary:
      "Remove a saved link (bookmark to a Figma, Canva, Google Doc or other URL) from a project's Files tab. Only whoever added it or a project manager. [linkId] comes from GET /api/projects/[id]/links.",
    keywords: ["delete link", "remove bookmark", "remove saved url"],
    notes: "Permanent. Only the bookmark is removed; the website itself is untouched.",
  },
  "DELETE /api/projects/[id]/messages/[messageId]": {
    summary:
      "Delete a thread (opening post) you started in a project's chat / Messages tab, with all its replies. Only the author, and only within 15 minutes of posting. [messageId] comes from GET /api/projects/[id]/messages.",
    keywords: ["delete chat thread", "delete project message", "remove post", "unsend"],
    notes: "Permanent - removes the whole thread including other people's replies.",
  },
  "DELETE /api/projects/[id]/messages/[messageId]/replies/[replyId]": {
    summary:
      "Delete one of your own replies in a project chat thread. Only the author, within 15 minutes of sending. [replyId] comes from GET /api/projects/[id]/messages/[messageId]/replies.",
    keywords: ["delete reply", "unsend message", "delete chat reply"],
    notes: "Permanent.",
  },
  "DELETE /api/projects/[id]/resources/[fileId]": {
    summary:
      "Permanently delete an uploaded project file (brief, asset, deliverable, reference) from the Files tab and from storage. Allowed for the uploader, the file's team manager, or a project manager. [fileId] comes from GET /api/projects/[id]/resources or /files.",
    keywords: [
      "delete project file",
      "remove upload",
      "delete brief",
      "delete asset",
      "delete resource",
    ],
    notes:
      "Irreversible. If the file was attached to a logged deliverable, that deliverable's 'made' count goes down with it.",
  },
  "DELETE /api/projects/[id]/sheets/[sheetId]": {
    summary:
      "Delete one TAB of a project sheet / content calendar, with all its columns, rows and edit history. Only the Account Manager or a project admin. [sheetId] is the tab id (tabs[].id from GET /api/projects/[id]/workbooks).",
    keywords: ["delete tab", "remove sheet tab", "delete calendar tab"],
    notes:
      "Irreversible. To delete a whole calendar month use DELETE /api/projects/[id]/workbooks/[workbookId].",
  },
  "DELETE /api/projects/[id]/sheets/[sheetId]/columns/[columnId]": {
    summary:
      "Delete a column from a sheet tab, clearing its value in every row. Only the Account Manager or a project admin. [sheetId] is the tab id; [columnId] from the tab's columns in GET /api/projects/[id]/workbooks/[workbookId].",
    keywords: ["delete column", "remove sheet column", "drop column"],
    notes:
      "The discarded values are copied into the tab's history (GET .../history) but cannot be restored automatically.",
  },
  "DELETE /api/projects/[id]/sheets/[sheetId]/rows/[rowId]": {
    summary:
      "Delete a row from a sheet tab (e.g. one post from a content calendar). Only the Account Manager or a project admin. [rowId] is rows[].id from GET /api/projects/[id]/workbooks/[workbookId].",
    keywords: ["delete row", "remove post from calendar", "delete sheet row"],
    notes: "The row's values are kept in the tab's history, but the row itself cannot be restored.",
  },
  "DELETE /api/projects/[id]/workbooks/[workbookId]": {
    summary:
      "Delete ONE edition (one month) of a project sheet / content calendar, with all its tabs, rows and history. Other months of the same calendar are kept. Only the Account Manager or a project admin. [workbookId] from GET /api/projects/[id]/workbooks.",
    keywords: [
      "delete content calendar",
      "delete sheet",
      "delete calendar month",
      "remove workbook",
    ],
    notes: "Irreversible.",
  },
  "DELETE /api/projects/[id]/workbooks/[workbookId]/teams/[teamId]": {
    summary:
      "Take a team off a content calendar's team plan (what that team owes for the month). Allowed for a project admin, the Account Manager, the calendar's manager or that team's manager. [teamId] is the PROJECT team id (teamId in GET .../workbooks/[workbookId]/teams).",
    keywords: ["remove team from calendar", "unplan team", "drop team from content plan"],
    notes:
      "Files attached to the team's row are detached, not deleted; the response returns detachedFiles.",
  },
  "GET /api/projects/[id]/drive": {
    summary:
      "The project's Google Drive folder: its link, the files directly in it (Docs, Sheets, uploads) and how many members have access. Anyone on the project. [id] is the project id or slug.",
    keywords: ["google drive folder", "project drive", "drive files", "shared drive link"],
    notes:
      "Returns configured:false when the company has no Drive connected. Side effect: creates the folder if missing and syncs its sharing to current project members.",
  },
  "GET /api/projects/[id]/files": {
    summary:
      "Browse one folder of a project's Files tab: sub-folders (with item counts), uploaded files, saved links, Google Drive-only files and the breadcrumb path. Anyone on the project. Omit folder for the top level.",
    query:
      "folder: folder id to open (from folders[].id or GET /api/projects/[id]/folders); omit for the project's top level",
    keywords: [
      "project files",
      "client files",
      "browse folder",
      "files tab",
      "documents",
      "repository",
    ],
    notes:
      "Side effect: sub-folders made directly in Google Drive are adopted into the tree, and the top-level read re-syncs Drive sharing.",
  },
  "GET /api/projects/[id]/folders": {
    summary:
      "Every folder in a project's Files tab as a flat list (id, name, parentId, creator). Anyone on the project. Use it to find a folder id or rebuild the tree.",
    keywords: ["project folders", "folder list", "folder tree"],
  },
  "GET /api/projects/[id]/links": {
    summary:
      "All saved links (bookmarked URLs such as Figma, Canva, Google Docs or live pages) on a project's Files tab, newest first, with title, tag, folder and who added them. Anyone on the project.",
    keywords: ["project links", "bookmarks", "saved urls", "reference links"],
  },
  "GET /api/projects/[id]/messages": {
    summary:
      "List a project's chat threads (Messages tab): pinned first, then by latest activity, with author, reply count, reactions and the last reply preview. Pass q to search titles, posts and replies. Anyone on the project.",
    query:
      "q: optional search text (matches thread titles, opening posts and replies; returns matchedReplies)",
    keywords: [
      "project chat",
      "project messages",
      "discussion threads",
      "search chat",
      "team conversation",
    ],
    notes: "Capped at 500 threads (meta.truncated says if more exist).",
  },
  "GET /api/projects/[id]/messages/[messageId]/replies": {
    summary:
      "Read the replies in one project chat thread, oldest to newest, with attachments, reactions, quoted replies, polls/events/contact cards, plus readers (who has seen the Messages tab and when). [messageId] from GET /api/projects/[id]/messages.",
    keywords: ["thread replies", "read chat thread", "conversation", "message replies"],
    notes:
      "Newest 500 replies (meta.truncated). Attachment files: use dnms_download on /api/projects/message-attachments/<attachments[].id>/file.",
  },
  "GET /api/projects/[id]/messages/unread": {
    summary:
      "How many new project chat posts and replies by other people there are since you last opened this project's Messages tab. Returns { count }.",
    keywords: ["unread messages", "new chat count", "unread project chat"],
  },
  "GET /api/projects/[id]/resources": {
    summary:
      "List every file uploaded to a project (briefs, assets, deliverables, references), newest first, with uploader, team, tag, size and client-sharing/review status. Anyone on the project. No download link - use /resources/[fileId]/file for that.",
    query:
      'teamId: project team id, or the text "null" for files not tied to a team; category: BRIEFS|ASSETS|DELIVERABLES|REFERENCES|OTHER',
    keywords: [
      "project files",
      "uploaded files",
      "briefs",
      "client assets",
      "deliverable files",
      "resources",
    ],
    notes: "category must be one of the listed values exactly - anything else errors.",
  },
  "GET /api/projects/[id]/resources/[fileId]": {
    summary:
      "One uploaded project file's details plus a signedUrl to open it (a 15-minute storage link, or a DNMS path for Drive-stored files). Anyone on the project. [fileId] from GET /api/projects/[id]/resources.",
    query: "download: 1 to sign the link as a download (save) instead of an inline preview",
    keywords: ["file details", "open project file", "file link"],
    notes:
      "To give the user the file, prefer dnms_download on /api/projects/[id]/resources/[fileId]/file.",
  },
  "GET /api/projects/[id]/resources/[fileId]/file": {
    summary:
      "Download or view an uploaded project file (brief, asset, deliverable, reference) as anyone on the project. [fileId] from GET /api/projects/[id]/resources or /files.",
    query: "download: 1 to save as a download instead of opening inline",
    keywords: ["download project file", "get brief", "download asset", "open file"],
    notes: "Returns a file - use dnms_download (readText:true to read a PDF/Word/Excel/text file).",
  },
  "GET /api/projects/[id]/sheets": {
    summary:
      "Index of a project's sheets / content calendars with their tab names and ids - no grid data. Same result as GET /api/projects/[id]/workbooks. Anyone on the project.",
    keywords: ["project sheets", "sheet tabs", "content calendars list"],
  },
  "GET /api/projects/[id]/sheets/[sheetId]/history": {
    summary:
      "Edit history of one sheet tab: the latest 200 cell changes, row deletions and column deletions, each with before/after values, who did it (staff or client) and when. [sheetId] is the tab id.",
    keywords: [
      "sheet history",
      "who changed this cell",
      "calendar edit log",
      "undo history",
      "audit trail",
    ],
  },
  "GET /api/projects/[id]/workbooks": {
    summary:
      "List a project's sheets / content calendars (posting schedules): name, month (periodMonth), calendar manager, service, whether shared with the client, and each tab's id and name - no rows. Anyone on the project. Use it to find a workbookId or tab id.",
    keywords: [
      "content calendar",
      "posting schedule",
      "project sheets",
      "monthly calendar",
      "social media calendar",
      "workbooks",
    ],
  },
  "GET /api/projects/[id]/workbooks/[workbookId]": {
    summary:
      "Open one sheet / content calendar in full: every tab with its columns (id, name, type) and rows (cells keyed by column id), plus the team plan (what each team owes, status, due date, links, files, people), its owner (assignedTo) and secondary (secondaryOwner). Anyone on the project.",
    keywords: [
      "open content calendar",
      "read sheet",
      "calendar posts",
      "posting schedule rows",
      "sheet data",
    ],
    notes: "Cells are keyed by column id - map them to column names using the tab's columns list.",
  },
  "GET /api/projects/[id]/workbooks/[workbookId]/export": {
    summary:
      "Download a content calendar as Excel or CSV - the same file as the calendar's Download menu: the whole month (every tab, one sheet each) as .xlsx, or one tab as .xlsx or .csv. Column names as headers, people by name. Anyone on the project.",
    query:
      "format: xlsx|csv (default xlsx); sheetId: one tab's id from GET /api/projects/[id]/workbooks/[workbookId] (required for csv; omit for the whole calendar)",
    keywords: [
      "download calendar",
      "export calendar",
      "calendar excel",
      "calendar csv",
      "content calendar file",
    ],
    notes: "Returns a file - use dnms_download.",
  },
  "PUT /api/projects/[id]/workbooks/[workbookId]/secondary": {
    summary:
      "Set or clear who covers a content calendar for its owner, with the same powers (plan it, edit the team plan). For a service calendar this is the service's secondary owner (every month of the service follows); for a custom, hand-made calendar it applies to this month and its later months. The calendar's owner, an Account Manager or a project admin may set it.",
    body: "{ employeeId: active employee id (someone other than the calendar's owner; on the project's teams for a service calendar), or null to clear }",
    keywords: [
      "calendar secondary",
      "secondary owner",
      "backup calendar owner",
      "cover calendar",
      "custom calendar owner",
    ],
    notes:
      "The calendar needs an owner first. Notifies the person in-app and by email. Returns { secondaryOwner }.",
  },
  "GET /api/projects/[id]/workbooks/[workbookId]/teams": {
    summary:
      "The team plan of one content calendar: each team's quantity owed, status (TODO|IN_PROGRESS|DONE|STUCK|DISCARDED), due date, links, notes, assigned people and attached files. Anyone on the project.",
    keywords: ["calendar team plan", "what each team owes", "team deliverables for month"],
    notes:
      "Each row has id (the calendar-row id used as workbookTeamId on files) and teamId (the project team id used in /teams/[teamId]).",
  },
  "GET /api/projects/message-attachments/[attachmentId]/file": {
    summary:
      "Download or view a photo, video, voice note or file posted in a project chat thread. Anyone on that project. [attachmentId] is attachments[].id from GET /api/projects/[id]/messages/[messageId]/replies.",
    query: "download: 1 to save with the original file name instead of opening inline",
    keywords: ["chat attachment", "download chat file", "message photo", "voice note"],
    notes: "Returns a file (redirects to a signed link) - use dnms_download.",
  },
  "PATCH /api/projects/[id]/drive/file": {
    summary:
      "Rename and/or move a file in the project's Google Drive folder into one of the project's Files-tab folders. Anyone on the project. The Drive file id goes in the body.",
    body: "{ fileId: Google Drive file id (required), name?: string (max 255), folderId?: project folder id, or null for the top level } - at least one of name/folderId",
    keywords: ["rename drive file", "move google doc", "organise drive"],
    notes: "Refuses files outside this project's Drive folder (404).",
  },
  "PATCH /api/projects/[id]/folders/[folderId]": {
    summary:
      "Rename a Files-tab folder and/or move it under another folder. Allowed for the folder's creator or a project manager. Mirrored to Google Drive.",
    body: "{ name?: string (1-120), parentId?: folder id, or null for the top level } - at least one",
    keywords: ["rename folder", "move folder"],
    notes:
      "Names must be unique among siblings (case-insensitive); a folder cannot move into itself or its own sub-folders.",
  },
  "PATCH /api/projects/[id]/links/[linkId]": {
    summary:
      "Edit a saved project link: title, URL, folder, tag or description. Only whoever added it or a project manager. [linkId] from GET /api/projects/[id]/links.",
    body: "{ title?: string (max 200), url?: full http(s) URL, folderId?: folder id or null (top level), tag?: BRAND|STRATEGY|RESEARCH|JOURNEY|REPORT|CREATIVE|VIDEO|PRODUCT|LEGAL|OTHER or null, description?: string (max 1000) or null } - at least one",
    keywords: ["edit link", "update bookmark", "move link"],
  },
  "PATCH /api/projects/[id]/messages/[messageId]": {
    summary:
      "Edit or pin your own project chat thread. Only the author can change it; title/content edits only within 15 minutes of posting, pinning any time. [messageId] from GET /api/projects/[id]/messages.",
    body: "{ title?: string, content?: string, isPinned?: boolean, mentionedIds?: employee ids (replaces the mention list) }",
    keywords: ["edit chat post", "pin thread", "unpin message", "edit message"],
    notes:
      "Newly @mentioned people are notified. Mentions of people not on the project are dropped silently; blank title/content are ignored.",
  },
  "PATCH /api/projects/[id]/messages/[messageId]/replies/[replyId]": {
    summary:
      "Edit the text of your own reply in a project chat thread, within 15 minutes of sending. [replyId] from GET /api/projects/[id]/messages/[messageId]/replies.",
    body: "{ content: string (required, non-empty), mentionedIds?: employee ids (replaces the mention list) }",
    keywords: ["edit reply", "edit chat message", "fix typo"],
    notes: "Does not notify newly mentioned people.",
  },
  "PATCH /api/projects/[id]/resources/[fileId]": {
    summary:
      "Update an uploaded project file: retag, rename, move to a folder, attach it to a calendar team row, share it with the client portal, or record a review decision on a client file. Uploader, the file's team manager, or a project manager.",
    body: "{ tag?: BRAND|STRATEGY|RESEARCH|JOURNEY|REPORT|CREATIVE|VIDEO|PRODUCT|LEGAL|OTHER or null, fileName?: string (max 255), folderId?: folder id or null (top level), workbookTeamId?: calendar team-row id (id from GET .../workbooks/[workbookId]/teams) or null to detach, isClientVisible?: boolean (project manager only), reviewStatus?: IN_REVIEW|APPROVED|CHANGES_REQUESTED (project manager only, file must already be shared), reviewNote?: string (max 1000) } - at least one",
    keywords: [
      "rename file",
      "share file with client",
      "approve client file",
      "move file",
      "retag file",
      "review upload",
    ],
    notes:
      "Sharing makes the file visible to the client in the portal; unsharing also clears its review decision.",
  },
  "PATCH /api/projects/[id]/sheets/[sheetId]": {
    summary:
      "Rename a sheet tab or change its description. Anyone on the project. [sheetId] is the tab id (tabs[].id from GET /api/projects/[id]/workbooks).",
    body: "{ name?: string, description?: string or null }",
    keywords: ["rename tab", "rename sheet tab"],
    notes: "To rename the whole calendar use PATCH /api/projects/[id]/workbooks/[workbookId].",
  },
  "PATCH /api/projects/[id]/sheets/[sheetId]/cells": {
    summary:
      "Write cells in a sheet tab by ROW POSITION (0-based), creating the row if nothing was typed there yet - the easiest way to fill in or edit a content calendar row. Anyone on the project. Values merge into the row.",
    body: "{ position: integer >= 0 (required, row index), cells: { <columnId>: value } (required; column ids from the tab's columns in GET .../workbooks/[workbookId]) }",
    keywords: [
      "edit cell",
      "fill in calendar",
      "update content calendar",
      "write to sheet",
      "add post to calendar",
    ],
    notes:
      "Unknown column ids are silently skipped. NUMBER columns need numbers, CHECKBOX true/false, everything else is stored as text; empty string clears a cell. Each change is logged in the tab history.",
  },
  "PATCH /api/projects/[id]/sheets/[sheetId]/columns/[columnId]": {
    summary:
      "Change a sheet column's name, type, dropdown options or width. Anyone on the project. [columnId] from the tab's columns in GET /api/projects/[id]/workbooks/[workbookId].",
    body: "{ name?: string, type?: TEXT|LONG_TEXT|NUMBER|DATE|SELECT|CHECKBOX|URL|PERSON, options?: string[] (dropdown choices for SELECT), width?: number of pixels or null }",
    keywords: ["rename column", "change column type", "dropdown options", "edit column"],
    notes: "Changing the type does not convert values already in the column.",
  },
  "PATCH /api/projects/[id]/sheets/[sheetId]/layout": {
    summary:
      "Resize a row height or a column width in a sheet tab (layout only, not content). Anyone on the project.",
    body: "{ rowHeight?: { position: row index, height: pixels (clamped 24-400) }, columnWidth?: { columnId: string, width: pixels (clamped 64-640) } } - at least one",
    keywords: ["resize column", "row height", "column width"],
    notes: "Not recorded in history.",
  },
  "PATCH /api/projects/[id]/sheets/[sheetId]/rows/[rowId]": {
    summary:
      "Update cells of an existing sheet row by its row id (merged - other columns are left alone). Anyone on the project. [rowId] is rows[].id from GET /api/projects/[id]/workbooks/[workbookId].",
    body: "{ cells: { <columnId>: value } (required) }",
    keywords: ["edit row", "update calendar post", "change cell"],
    notes:
      "Unknown column ids are silently skipped; values are normalised by column type. Each change is logged in the tab history.",
  },
  "PATCH /api/projects/[id]/workbooks/[workbookId]": {
    summary:
      "Rename a sheet / content calendar or set, move or clear its month. Anyone on the project. Renaming renames EVERY month of that calendar.",
    body: '{ name?: string, periodMonth?: "YYYY-MM" or null for an undated calendar } - at least one',
    keywords: ["rename content calendar", "rename sheet", "change calendar month"],
    notes:
      "A name is either a monthly series or one undated calendar, never both; two editions cannot share a month.",
  },
  "PATCH /api/projects/[id]/workbooks/[workbookId]/share": {
    summary:
      "Share a sheet / content calendar with the client in the client portal, or stop sharing it. Only the Account Manager or a project admin.",
    body: "{ isClientVisible: boolean (required) }",
    keywords: [
      "share calendar with client",
      "client approval calendar",
      "unshare sheet",
      "client portal",
    ],
    notes: "When shared, the client can read AND edit the calendar from the portal.",
  },
  "POST /api/projects/[id]/drive": {
    summary:
      "Upload a file into the project's Google Drive folder (optionally into a Files-tab folder's Drive mirror). Anyone on the project.",
    body: "multipart form: file (required, max 250 MB), folderId?: project folder id",
    keywords: ["upload to drive", "drive upload"],
    notes: "File upload - not possible through the AI connector.",
  },
  "POST /api/projects/[id]/drive/export": {
    summary:
      "Export a Google Sheet from the project's Drive folder as an Excel (.xlsx) file. Anyone on the project.",
    body: "{ fileId: Google Drive file id of a Google Sheet (required) }",
    keywords: ["export google sheet", "download sheet as excel", "drive to xlsx"],
    notes:
      "Returns a file - use dnms_download with method POST and this body. Fails if the file is not a Google Sheet or not in this project's Drive.",
  },
  "POST /api/projects/[id]/drive/new": {
    summary:
      "Create a blank Google Doc or Google Sheet in the project's Drive folder (or a Files-tab folder's Drive mirror). Anyone on the project. Returns the new file with its webViewLink.",
    body: '{ kind?: doc|sheet (default doc), name?: string (default "Untitled doc"/"Untitled sheet"), folderId?: project folder id }',
    keywords: ["new google doc", "create google sheet", "new document in drive"],
  },
  "POST /api/projects/[id]/drive/sync": {
    summary:
      "Re-sync who can open the project's Google Drive folder so it matches the current project members (adds new members, removes people who left). Only the Account Manager or a project admin.",
    keywords: ["sync drive access", "fix drive permissions", "share drive folder with team"],
    notes: "Returns how many shares were granted and revoked.",
  },
  "POST /api/projects/[id]/folders": {
    summary:
      "Create a folder in a project's Files tab (also created in Google Drive when connected). Anyone on the project.",
    body: "{ name: string (required, max 120), parentId?: parent folder id, or null/omit for the top level }",
    keywords: ["new folder", "create folder", "organise files"],
    notes: "Folder names must be unique within the same parent (case-insensitive).",
  },
  "POST /api/projects/[id]/links": {
    summary:
      "Save a link (Figma, Canva, Google Doc, live page or any web URL) to a project's Files tab. Anyone on the project.",
    body: "{ title: string (required, max 200), url: full http(s) URL (required), folderId?: folder id or null, tag?: BRAND|STRATEGY|RESEARCH|JOURNEY|REPORT|CREATIVE|VIDEO|PRODUCT|LEGAL|OTHER or null, description?: string (max 1000) }",
    keywords: ["add link", "save url", "bookmark", "add reference link"],
  },
  "POST /api/projects/[id]/messages": {
    summary:
      "Start a new thread in a project's chat / Messages tab as the connected employee. Anyone on the project. @mention project members to notify them.",
    body: "{ title: string (required), content: string (required), mentionedIds?: employee ids of project members }",
    keywords: ["post in project chat", "new discussion", "start thread", "message the team"],
    notes: "Notifies mentioned people. Mentions of people not on the project are dropped silently.",
  },
  "POST /api/projects/[id]/messages/[messageId]/attachments": {
    summary: "Send photos, videos, voice notes or files as a reply in a project chat thread.",
    body: 'multipart form: files (one or more, max 25 MB each), body?: caption, sticker?: "1", durationSec?, waveform?',
    keywords: ["send photo in chat", "attach file to message", "voice note"],
    notes: "File upload - not possible through the AI connector.",
  },
  "POST /api/projects/[id]/messages/[messageId]/cards": {
    summary:
      "Post a poll, an event or a colleague's contact card as a reply in a project chat thread. Anyone on the project. [messageId] from GET /api/projects/[id]/messages.",
    body: "{ kind: poll|event|contact (required); poll: question (required), options: string[] (2-12), allowMultiple?: boolean, closesAt?: ISO datetime; event: title (required), startsAt: ISO datetime (required), endsAt?, location?, notes?; contact: employeeId (required) }",
    keywords: ["create poll", "chat poll", "schedule event in chat", "share contact"],
    notes:
      "A contact card copies the colleague's email and phone into the thread. Thread participants get a live update but no notification.",
  },
  "POST /api/projects/[id]/messages/[messageId]/react": {
    summary:
      "Toggle an emoji reaction on a project chat thread's opening post, or on one reply if replyId is given. Calling again with the same emoji removes it. Returns { emoji, on }.",
    body: "{ emoji: string (required, the emoji character itself, max 16 chars), replyId?: reply id in this thread (omit to react to the opening post) }",
    keywords: ["react", "like message", "emoji reaction", "thumbs up"],
  },
  "POST /api/projects/[id]/messages/[messageId]/replies": {
    summary:
      "Reply in a project chat thread as the connected employee, optionally quoting an earlier reply. Anyone on the project. [messageId] from GET /api/projects/[id]/messages.",
    body: '{ content: string (required), mentionedIds?: employee ids of project members, replyToId?: a reply id in this thread, or "root" to quote the opening post }',
    keywords: ["reply in chat", "answer thread", "respond to message", "comment"],
    notes: "Notifies the thread author, everyone who replied before, and anyone mentioned.",
  },
  "POST /api/projects/[id]/messages/unread": {
    summary:
      "Mark this project's chat / Messages tab as read for the connected employee (resets the unread count and updates 'seen by').",
    keywords: ["mark chat read", "mark messages seen", "clear unread"],
  },
  "POST /api/projects/[id]/resources": {
    summary:
      "Upload a file (brief, asset, deliverable, reference) to a project's Files tab, optionally into a folder, for a team, against a logged deliverable or a content calendar team row.",
    body: "multipart form: file (required, max 250 MB), category?: BRIEFS|ASSETS|DELIVERABLES|REFERENCES|OTHER, teamId?, folderId?, tag?, description?, deliverableId?, workbookTeamId?",
    keywords: ["upload file", "upload brief", "add asset"],
    notes: "File upload - not possible through the AI connector.",
  },
  "POST /api/projects/[id]/sheets": {
    summary:
      "Add a new tab to a project sheet / content calendar. It starts with 26 blank text columns A-Z and no rows. Anyone on the project.",
    body: "{ workbookId: string (required, from GET /api/projects/[id]/workbooks), name: string (required, unique within that sheet), description?: string }",
    keywords: ["add tab", "new sheet tab", "new calendar tab"],
  },
  "POST /api/projects/[id]/sheets/[sheetId]/columns": {
    summary:
      "Add a column to the end of a sheet tab. Anyone on the project. [sheetId] is the tab id.",
    body: "{ name: string (required), type?: TEXT|LONG_TEXT|NUMBER|DATE|SELECT|CHECKBOX|URL|PERSON (default TEXT), options?: string[] (dropdown choices, used for SELECT) }",
    keywords: ["add column", "new column", "dropdown column"],
  },
  "POST /api/projects/[id]/sheets/[sheetId]/import": {
    summary:
      "Bulk-append rows to a sheet tab (e.g. load a whole month's posts into a content calendar). Anyone on the project. Rows go after the last existing row.",
    body: "{ rows: array (required, 1-2000) of objects { <columnId>: value } }",
    keywords: ["import rows", "bulk add posts", "paste into sheet", "load calendar"],
    notes: "Unknown column ids and empty rows are dropped. Returns { imported, firstPosition }.",
  },
  "POST /api/projects/[id]/sheets/[sheetId]/rows": {
    summary:
      "Append one empty row to the end of a sheet tab. Anyone on the project. Takes no body and returns no row id.",
    keywords: ["add row", "new empty row"],
    notes:
      "To add a row WITH content, use PATCH .../sheets/[sheetId]/cells with the next free position instead.",
  },
  "POST /api/projects/[id]/workbooks": {
    summary:
      "Create a new sheet / content calendar on a project, optionally as a monthly edition and optionally copying tabs, columns and the team plan from an earlier month (never its rows). Anyone on the project.",
    body: '{ name: string (required), firstTab?: string (default "Tab 1"), periodMonth?: "YYYY-MM" (omit for an undated sheet), copyFrom?: { workbookId: string (required if copyFrom), structure?: boolean (default true), teamPlan?: boolean (default true) } }',
    keywords: [
      "new content calendar",
      "create sheet",
      "next month calendar",
      "posting schedule",
      "duplicate calendar",
    ],
    notes:
      "A name is either a monthly series or one undated sheet. Copying also carries over the calendar manager and service.",
  },
  "POST /api/projects/[id]/workbooks/[workbookId]/assign": {
    summary:
      "Set or clear the manager (owner) of a sheet / content calendar. Allowed for project managers and any team manager on the project.",
    body: "{ employeeId: active employee id, or null to unassign }",
    keywords: ["assign calendar", "calendar manager", "sheet owner", "who runs this calendar"],
    notes:
      "Notifies the new manager. If the calendar belongs to one of the project's services and is this month or later, that person also becomes the service owner and manager of all its current and future calendars (they must be on a project team).",
  },
  "PUT /api/projects/[id]/workbooks/[workbookId]/teams/[teamId]": {
    summary:
      "Add a team to a content calendar's plan or update its row: how many items it owes, due date, status, hand-in links, notes and people. [teamId] is the PROJECT team id (from GET /api/projects/[id]/teams). Omitted fields are left alone.",
    body: "{ quantity?: integer >= 0, dueOn?: YYYY-MM-DD or null, status?: TODO|IN_PROGRESS|DONE|STUCK|DISCARDED, links?: string[] of http(s) URLs (max 20, replaces the list), notes?: string or null, employeeIds?: string[] (replaces the set; must be active members of that team) }",
    keywords: [
      "plan team for month",
      "mark calendar done",
      "hand in links",
      "team deliverable status",
      "assign people to calendar",
    ],
    notes:
      "Team members may change links, notes and status; quantity, dueOn, employeeIds and DISCARDED need the AM, a project admin, the calendar's manager or the team's manager. DONE needs links + files >= quantity. Notifies newly added people.",
  },
}
