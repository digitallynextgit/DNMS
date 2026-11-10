import type { DescriptionMap } from "./types"

// OYD (Own Your Deadline): flags on employees for missed deadlines and delays. A flag counts once
// HR or the employee's Reporting Manager confirms it; 1 coaching, 2 monitoring, 3 PIP, 4 review.
export const OYD: DescriptionMap = {
  "GET /api/oyd/flags": {
    summary:
      "OYD (Own Your Deadline) flags the caller may see, newest first: HR and admins see everyone's, a Reporting Manager their reports', anyone the flags they raised, and an employee their own confirmed ones (removed ones too, for the history). Each has the note, who raised, confirmed or removed it, and the level it was when confirmed.",
    keywords: [
      "oyd",
      "own your deadline",
      "flags",
      "missed deadline flags",
      "how many flags",
      "pip",
      "flags to confirm",
    ],
    notes:
      "Returns { flags: [{ id, employee, raisedBy, category, note, status: PENDING|CONFIRMED|REJECTED, level, reviewedBy, reviewedAt, reviewNote, removedBy, removedAt, removeReason, createdAt, canReview, canRemove }], viewer: { id, isHr, managesAnyone } }. Only CONFIRMED flags without removedAt count towards the level.",
  },
  "GET /api/oyd/people": {
    summary:
      "Active colleagues the caller can raise an OYD flag on (everyone but themselves), with confirmsAtOnce = the caller is HR or their Reporting Manager, so a flag counts immediately.",
    keywords: ["who can I flag", "oyd people"],
  },
  "POST /api/oyd/flags": {
    summary:
      "Raise an OYD flag on a colleague for a missed deadline or a delay. From HR, an admin or the employee's Reporting Manager it counts at once and mails the employee from the caller's mail with HR and the Reporting Manager in Cc; from anyone else it waits for HR or the Reporting Manager to confirm.",
    body: "{ employeeId (required); category: MISSED_DEADLINE|DELAYED_HANDOVER|BLOCKER_NOT_SHARED|REPEATED_DELAYS; note (required, 5-2000 chars) }",
    keywords: ["raise flag", "flag an employee", "oyd flag", "report a delay"],
    notes:
      "Sends real notifications and, once it counts, a real email. HR and the Reporting Manager are alerted when someone reaches Flag 3 (PIP) or Flag 4 (management review).",
  },
  "PATCH /api/oyd/flags/[id]": {
    summary:
      "Act on an OYD flag: confirm or reject a pending one (HR, admins or the employee's Reporting Manager; never your own), or remove one (whoever raised it, HR or admins). Removal keeps the flag in the history with who removed it.",
    body: "{ action: confirm|reject|remove (required); note?: reason - required for reject, optional for remove }",
    keywords: ["confirm flag", "reject flag", "remove flag", "withdraw flag"],
    notes:
      "Confirming mails the employee and notifies them; removing a confirmed flag notifies the employee with their new count.",
  },
}
