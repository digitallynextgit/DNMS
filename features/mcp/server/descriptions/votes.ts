import type { DescriptionMap } from "./types"

// Votes & Events: admins/HR run events (Best Rangoli, Best Ethnic Wear...), every other employee
// votes once. Admins and HR see who voted for whom; voters only ever get counts.
export const VOTES: DescriptionMap = {
  "GET /api/votes/candidates": {
    summary:
      "The employees who can be options in a vote event: every active employee except admins, sorted by name. Admins and the HR team only.",
    keywords: ["vote candidates", "who can be nominated", "eligible nominees"],
  },
  "GET /api/votes/events": {
    summary:
      "List the company's vote events (Best Rangoli, Best Dressed...) with their options, the caller's own ballot and the live standings once voting opens. Every employee sees published events; ?manage=1 is the admin/HR view with drafts, live counts, who voted for each option and who has not voted yet.",
    query:
      "manage: 1 = include drafts, live counts, options[].voters and notVoted (admins and the HR team only)",
    keywords: [
      "votes",
      "voting",
      "poll",
      "event voting",
      "best rangoli",
      "who is winning",
      "who voted for whom",
      "who has not voted",
    ],
    notes:
      "Everyone sees live counts and the leaders once voting opens; only admins and HR see voter names. Everyone on staff votes, admins included; admins are never on the ballot.",
  },
  "POST /api/votes/events": {
    summary:
      "Create a vote event as a draft: a title, an optional description, an optional opening time and a closing time, plus optional options (employees by id, or custom entries by label). Admins and the HR team only.",
    body: "{ title, description?, opensAt?: ISO date-time (empty = opens when published), closesAt: ISO date-time, allEmployees?: boolean (true = every active non-admin employee becomes an option), allowVoteChange?: boolean (default false = the first vote is final), options?: [{ employeeId? } | { label, description? }] }",
    keywords: ["create vote", "new voting event", "start a poll", "diwali contest"],
    notes:
      "Nothing is visible to employees until it is published with PATCH { publish: true }, which needs at least two options.",
  },
  "GET /api/votes/events/[id]": {
    summary:
      "One vote event with its options and, when the caller may see them, the counts and the leading option(s). id from GET /api/votes/events.",
    keywords: ["vote details", "vote results", "poll results"],
  },
  "PATCH /api/votes/events/[id]": {
    summary:
      "Edit a vote event's title, description or opening/closing times, publish it, pull it back to draft, close voting early or reopen it. Admins and the HR team only. id from GET /api/votes/events.",
    body: "{ title?, description?, opensAt?, closesAt?, publish?: boolean, close?: boolean, allowVoteChange?: boolean }",
    keywords: ["publish vote", "close voting", "reopen voting", "extend voting", "edit vote event"],
    notes:
      "publish: true notifies every eligible voter in the app. publish: false only works while nobody has voted. close: true ends voting now and reveals the results to everyone.",
  },
  "DELETE /api/votes/events/[id]": {
    summary:
      "Permanently delete a vote event with all its options, photos and ballots. Admins and the HR team only. id from GET /api/votes/events.",
    keywords: ["delete vote", "remove voting event"],
    notes:
      "Irreversible. To stop voting without losing the results, PATCH it with close: true instead.",
  },
  "POST /api/votes/events/[id]/options": {
    summary:
      "Add an option to a vote event: an employee (employeeId), a custom entry such as a team or a desk (label), or every eligible employee not yet listed ({ allEmployees: true }). Admins and the HR team only. id = event id from GET /api/votes/events.",
    body: "{ allEmployees: true } or { employeeId?: employee id from GET /api/votes/candidates, label?: name for a custom entry (required without employeeId), description? }",
    keywords: ["add nominee", "add candidate", "add option to vote", "add all employees"],
    notes:
      "Not allowed once voting has closed. Each employee can be an option only once per event, and admins can never be options.",
  },
  "PUT /api/votes/events/[id]/ballot": {
    summary:
      "Cast or change the caller's own vote in an open event. One vote per person per event; calling again moves it to the new option only when the event has allowVoteChange on, otherwise it is refused. id = event id from GET /api/votes/events, optionId from its options.",
    body: "{ optionId }",
    keywords: ["vote for", "cast vote", "change my vote", "submit ballot", "vote for myself"],
    notes:
      "Only while the event is open. Everyone on staff votes, admins included, for any option, themselves included. Admins and HR can see who voted for whom.",
  },
  "PATCH /api/votes/options/[optionId]": {
    summary:
      "Rename an option in a vote event or change its description. Admins and the HR team only. optionId from GET /api/votes/events.",
    body: "{ label, description? }",
    keywords: ["rename nominee", "edit vote option"],
  },
  "DELETE /api/votes/options/[optionId]": {
    summary:
      "Remove an option from a vote event, together with any ballots cast for it. Admins and the HR team only. optionId from GET /api/votes/events.",
    keywords: ["remove nominee", "delete vote option"],
    notes: "Irreversible - votes already cast for this option are lost.",
  },
  "GET /api/votes/options/[optionId]/photo": {
    summary:
      "The photo uploaded for a custom vote option (a rangoli, a decorated desk), as an image redirect. Returns a file - use dnms_download. optionId from GET /api/votes/events.",
    keywords: ["vote option photo", "rangoli photo", "entry picture"],
    notes:
      "Returns a file. Employee options have no uploaded photo; their profile photo is shown instead.",
  },
  "POST /api/votes/options/[optionId]/photo": {
    summary:
      "Upload or replace the photo of a custom vote option (JPG, PNG or WEBP, up to 10 MB, multipart field 'photo'). Admins and the HR team only. optionId from GET /api/votes/events.",
    body: "multipart/form-data with one 'photo' image file",
    keywords: ["upload entry photo", "add rangoli picture", "vote option image"],
    notes: "Replaces the previous photo, which is deleted from storage.",
  },
}
