import { siteConfig } from "@/config/site"
import { PLANS } from "@/features/tenants"

// =============================================================================
// FAQ content.
//
// ONE source for both surfaces: the homepage section shows a short, deliberately
// chosen selection, and /faq shows everything grouped by topic. Keeping two
// lists would guarantee they drift, and the homepage would end up answering a
// question the real page had since corrected.
//
// Answers that quote a number read it from the thing that enforces it (PLANS,
// siteConfig) rather than restating it. A FAQ that contradicts the pricing page
// is worse than no FAQ.
// =============================================================================

export interface FaqItem {
  q: string
  a: string
  /** Include this one in the homepage selection. */
  featured?: boolean
}

export interface FaqCategory {
  id: string
  title: string
  blurb: string
  items: FaqItem[]
}

const trial = PLANS.TRIAL
const starter = PLANS.STARTER
const red = PLANS.RED

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: "the-basics",
    title: "The basics",
    blurb: "What it is and who it is for.",
    items: [
      {
        q: "What is DNMS?",
        a: `${siteConfig.fullName} is an all-in-one company management platform. It brings HR, attendance, leave, payroll, performance, projects, recruitment, a client portal, team chat and SEO tools into one secure, permission-controlled system.`,
        featured: true,
      },
      {
        q: "Who is DNMS for?",
        a: "Companies and agencies tired of stitching together separate HR apps, spreadsheets and chat threads. HR, finance, project managers, leadership and even clients each get exactly the view they need, and no more than that.",
        featured: true,
      },
      {
        q: "Is DNMS genuinely connected, or just many tools in one login?",
        a: "Genuinely connected. An employee is one record: the person who punches in at the door is the same person on the payroll run, the same person assigned to a task and the same person in the org chart. Change a designation once and every module reflects it, because there is nothing to sync.",
        featured: true,
      },
      {
        q: "How long does it take to get started?",
        a: "A workspace is created in under a minute and you can invite your team immediately. How long a full rollout takes depends on what you migrate: an employee list and leave balances is an afternoon, historic payroll is longer. Nothing needs installing on anyone's machine.",
      },
      {
        q: "Can we import our existing data?",
        a: "Employees, departments, designations and leave balances can be brought in from a spreadsheet. For anything larger or messier, talk to us before you start: it is usually faster for us to look at the export first than to have you reshape it twice.",
      },
    ],
  },
  {
    id: "attendance-devices",
    title: "Attendance & devices",
    blurb: "Biometric terminals, punches and corrections.",
    items: [
      {
        q: "Does DNMS work with our biometric devices?",
        a: "Yes. Supported terminals push punch events to DNMS as they happen, so attendance is live rather than a file someone remembers to export. The device stays on your own network; nothing about it needs exposing to the internet.",
        featured: true,
      },
      {
        q: "Do you store fingerprints or face data?",
        a: "No. Biometric templates never leave the terminal. DNMS receives an employee identifier, a timestamp and the device it came from. That is all it needs to build attendance, and all it holds.",
      },
      {
        q: "What happens if the device is offline, or someone forgets to punch?",
        a: "Attendance keeps working. Missed or wrong punches are handled through regularisation requests: the employee raises one, their manager approves it, and the correction is recorded with who approved it and when, rather than silently overwritten.",
      },
      {
        q: "Can people work from home or from a client site?",
        a: "Yes. Work-from-home is a request type of its own with its own approval chain, so a WFH day is recorded as a WFH day rather than as an absence somebody has to explain later.",
      },
    ],
  },
  {
    id: "security-data",
    title: "Security & data",
    blurb: "Access, isolation, and what happens to your records.",
    items: [
      {
        q: "How does DNMS protect our data?",
        a: "Everything travels over HTTPS. Passwords are stored only as salted one-way hashes and cannot be read back by anyone, us included. Sensitive stored values such as integration credentials are encrypted at rest, uploaded files are served through short-lived signed links rather than public URLs, and administrative actions are audit-logged.",
        featured: true,
      },
      {
        q: "Can another company using DNMS see our data?",
        a: "No. Every record carries the company it belongs to, and every database query is scoped to the signed-in session's company by a guard that refuses an unscoped query rather than quietly returning everything. Isolation is enforced at the data layer, not by remembering to add a filter.",
      },
      {
        q: "Who inside our company can see payroll and personal details?",
        a: "Only the roles you grant. Permissions are granular scopes rather than one admin switch, so an HR manager can approve leave without seeing salaries, and a project manager can run projects without seeing either.",
      },
      {
        q: "What happens to our data if we leave?",
        a: "It stays exportable for 30 days after a subscription ends, and is then deleted. The privacy policy sets out retention in full, and the refund policy covers the commercial side.",
      },
    ],
  },
  {
    id: "clients-projects",
    title: "Clients & projects",
    blurb: "The parts your customers see.",
    items: [
      {
        q: "Can we give clients access in DNMS?",
        a: "Yes, through the client portal. A client signs in to their own view of their own projects: progress, deliverables, documents and messages, and nothing else. They are not employees, hold no roles, and can never reach an internal screen.",
        featured: true,
      },
      {
        q: "Do clients need a licence or a seat?",
        a: "No. Pricing is per employee. Client users are not employees, so they do not count towards your headcount or your bill.",
      },
      {
        q: "Can we send campaigns or updates to clients from DNMS?",
        a: "Yes. The project mailer composes and sends from within a project, so a status update goes out against the work it describes and the record of what was sent stays attached to that project.",
      },
    ],
  },
  {
    id: "plans-billing",
    title: "Plans & billing",
    blurb: "What it costs, and how the limits work.",
    items: [
      {
        q: "How does pricing work?",
        a: `Per employee, per month. ${starter.name} is ₹${starter.pricePerEmployee} and ${red.name} is ₹${red.pricePerEmployee}, both excluding GST. What DNMS does scales with headcount and nothing else, so that is what it is priced against: no setup fee and no per-module upsell.`,
      },
      {
        q: "Is there a free trial?",
        a: `Yes. ${trial.durationDays} days, every module unlocked, up to ${trial.maxEmployees} employees, and no payment card to start.`,
      },
      {
        q: "Are we billed for people who have left?",
        a: "No. Billing counts active employees, so the number moves with your headcount rather than with the seats you bought last year.",
      },
      {
        q: "What happens if we outgrow our plan's headcount limit?",
        a: `Each plan has a ceiling: ${starter.maxEmployees} on ${starter.name}, ${red.maxEmployees} on ${red.name}. When you reach it, adding another active employee is refused with a message that says so, rather than failing obscurely. Moving up a plan lifts it immediately, and Enterprise has no ceiling.`,
      },
      {
        q: "Can we cancel at any time?",
        a: "Yes. Cancelling stops the next renewal, and the workspace stays fully usable until the end of the period you have already paid for. There is no cancellation fee and no lock-in.",
      },
    ],
  },
]

/** Every question, flattened. Used for the page's counter. */
export const ALL_FAQS: FaqItem[] = FAQ_CATEGORIES.flatMap((c) => c.items)

/**
 * The homepage selection.
 *
 * Drawn from the same source as /faq rather than kept as a second list, so the
 * short version can never contradict the long one.
 */
export const FEATURED_FAQS: FaqItem[] = ALL_FAQS.filter((f) => f.featured)
