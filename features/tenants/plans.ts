// =============================================================================
// Plans (M5).
//
// The four tiers the product is sold on. Kept as data, in one place, so the
// signup page, the platform console and the enforcement check cannot disagree
// about what a plan includes.
//
// PRICING IS PER EMPLOYEE PER MONTH. That is the honest unit for this product:
// what it does - attendance, payroll, leave, performance - scales with headcount
// and with nothing else. A flat fee would overcharge a five-person studio and
// undercharge a two-hundred-person agency for the same work.
//
// No framework imports: the marketing page, the console and the server all read
// this.
// =============================================================================

export type PlanKey = "TRIAL" | "STARTER" | "RED" | "ENTERPRISE"

/**
 * GST applied on top of every listed price.
 *
 * Prices in PLANS are EXCLUSIVE of tax - that is the number a buyer compares
 * against a competitor, and the number an invoice line carries before tax is
 * added. Anything that shows a price to a customer must show this too, or the
 * figure on the page and the figure on the invoice disagree.
 */
export const GST_RATE = 0.18

export interface Plan {
  key: PlanKey
  name: string
  /** INR per employee per month. Null = negotiated. */
  pricePerEmployee: number | null
  /** Hard ceiling on active employees. Null = no ceiling. */
  maxEmployees: number | null
  /** Days the plan runs before it lapses. Null = it does not. */
  durationDays: number | null
  blurb: string
  includes: readonly string[]
  /** Modules this plan does NOT unlock, named so the limit is legible. */
  excludes: readonly string[]
}

export const PLANS: Record<PlanKey, Plan> = {
  TRIAL: {
    key: "TRIAL",
    name: "Trial",
    pricePerEmployee: 0,
    maxEmployees: 5,
    durationDays: 21,
    blurb: "Three weeks, every module, your own data. No card.",
    includes: ["Everything in Red", "Up to 5 employees", "Email support"],
    excludes: [],
  },
  STARTER: {
    key: "STARTER",
    name: "Starter",
    pricePerEmployee: 599,
    maxEmployees: 20,
    durationDays: null,
    blurb: "The HR core for a small team.",
    includes: [
      "Employees & documents",
      "Attendance & leave",
      "Holiday calendar",
      "Payslips",
      "Up to 20 employees",
    ],
    excludes: ["Projects & tasks", "Client portal", "Performance reviews", "SEO & monitoring"],
  },
  RED: {
    key: "RED",
    name: "Red",
    pricePerEmployee: 999,
    maxEmployees: 50,
    durationDays: null,
    blurb: "The whole system. What Digitally Next runs on.",
    includes: [
      "Everything in Starter",
      "Projects, tasks & timesheets",
      "Client portal & project mailer",
      "Performance reviews",
      "Recruitment & referrals",
      "SEO & uptime monitoring",
      "Biometric attendance push",
      "Up to 50 employees",
    ],
    excludes: [],
  },
  ENTERPRISE: {
    key: "ENTERPRISE",
    name: "Enterprise",
    pricePerEmployee: null,
    maxEmployees: null,
    durationDays: null,
    blurb: "Unlimited headcount, your own terms. Talk to us.",
    includes: [
      "Everything in Red",
      "Unlimited employees",
      "Priority support & onboarding",
      "Custom integrations",
    ],
    excludes: [],
  },
}

/** The plans a company may pick for itself. Enterprise is a conversation. */
export const SELF_SERVE_PLANS: readonly PlanKey[] = ["TRIAL", "STARTER", "RED"]

export function planOf(key: string | null | undefined): Plan {
  return PLANS[(key ?? "TRIAL") as PlanKey] ?? PLANS.TRIAL
}

/** Days left on a trial. Null when the plan does not expire. Negative = lapsed. */
export function daysRemaining(plan: string, trialEndsAt: Date | null): number | null {
  if (plan !== "TRIAL" || !trialEndsAt) return null
  return Math.ceil((trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
}

export interface HeadcountCheck {
  allowed: boolean
  current: number
  limit: number | null
  message: string | null
}

/**
 * May this company add another active employee?
 *
 * Called before an employee is created. Returns a message written for the HR
 * admin who hits it, not for a log: it says what the limit is and what to do,
 * because "Forbidden" from a headcount ceiling is indistinguishable from a bug.
 */
export function checkHeadcount(plan: string, activeEmployees: number): HeadcountCheck {
  const limit = planOf(plan).maxEmployees
  if (limit === null || activeEmployees < limit) {
    return { allowed: true, current: activeEmployees, limit, message: null }
  }
  return {
    allowed: false,
    current: activeEmployees,
    limit,
    message:
      `Your ${planOf(plan).name} plan covers ${limit} active employees and you have ${activeEmployees}. ` +
      `Upgrade to add more, or deactivate someone who has left.`,
  }
}
