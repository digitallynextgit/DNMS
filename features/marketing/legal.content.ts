import { siteConfig } from "@/config/site"

// =============================================================================
// Legal document content.
//
// ⚠ THESE ARE DRAFTS, NOT LEGAL ADVICE. They are written to describe what this
// application ACTUALLY does - the data it stores, the third parties it calls,
// the cookies it sets - which is the part a template cannot give you and the
// part a lawyer will ask for first. Have them reviewed before you rely on them,
// and re-read them whenever a new sub-processor or data type is added.
//
// Jurisdiction assumed: India (DPDP Act 2023, IT Act 2000 and the SPDI Rules).
// Selling into the EU/UK adds GDPR obligations this draft only gestures at.
//
// Everything identifying the company comes from config/site.ts, so the entity
// name, address and inboxes are corrected in one place.
// =============================================================================

export interface LegalSection {
  heading: string
  /** Paragraphs. Rendered in order, before any bullets. */
  body?: string[]
  bullets?: string[]
  /** Rendered as a definition list - used for the sub-processor tables. */
  rows?: { term: string; detail: string }[]
}

export interface LegalDoc {
  slug: string
  title: string
  /**
   * The trailing part of `title` to render in the brand accent on the page
   * heading. Must be a SUFFIX of `title`; anything else is ignored and the
   * heading falls back to accenting the last word.
   *
   * Omit it for the common case. It exists for titles where the last word alone
   * reads oddly - "Refund & Cancellation POLICY" splits the pair that belongs
   * together, so that one accents "Cancellation Policy" instead.
   */
  titleAccent?: string
  /** One line under the title. */
  summary: string
  /** Human-readable date. Update whenever the content changes. */
  updated: string
  sections: LegalSection[]
}

const { legal, emails, name, fullName, domain } = siteConfig

/** Kept in one place so every document reports the same revision date. */
const UPDATED = "26 August 2026"

// -----------------------------------------------------------------------------
// The sub-processor list is shared between the privacy policy and the cookie
// policy. It is the list a customer's own DPO will ask for, so it names what
// each third party actually receives rather than saying "service providers".
// -----------------------------------------------------------------------------
const SUBPROCESSORS: { term: string; detail: string }[] = [
  {
    term: "Backblaze B2",
    detail:
      "Object storage for uploaded files - employee documents, project assets, gallery images and email artwork. Files are served through expiring signed URLs, never from a public bucket.",
  },
  {
    term: "Google (Sign-In)",
    detail:
      "Optional single sign-on for staff accounts. We receive your name, email address and profile picture. We never receive your Google password.",
  },
  {
    term: "Google Search Console",
    detail:
      "Only for customers who connect the SEO module. We read search performance data for the properties you authorise, and you can disconnect at any time.",
  },
  {
    term: "Mistral AI",
    detail:
      "Assists with drafting and summarising text you explicitly submit to an AI feature. Content sent is limited to that request. No data is submitted unless you use one of those features.",
  },
  {
    term: "Email delivery (SMTP)",
    detail:
      "Transactional mail - password resets, notifications, onboarding and any campaigns you send. The provider processes recipient addresses and message content.",
  },
  {
    term: "Web push (VAPID)",
    detail:
      "Browser push notifications, if you enable them. Delivery runs through your browser vendor's push service and carries only the notification payload.",
  },
]

// =============================================================================
// Privacy policy
// =============================================================================
const privacy: LegalDoc = {
  slug: "privacy",
  title: "Privacy Policy",
  summary: `How ${legal.entity} collects, uses, stores and protects personal data in ${name}.`,
  updated: UPDATED,
  sections: [
    {
      heading: "Who we are",
      body: [
        `${fullName} ("${name}", "we", "us") is operated by ${legal.entity}, registered at ${legal.address}. We provide a workforce and operations platform that companies use to run HR, attendance, leave, payroll, projects, recruitment and client communication.`,
        `This policy explains what we do with personal data. It covers ${domain} and the application behind it.`,
      ],
    },
    {
      heading: "Two roles, and why the difference matters",
      body: [
        "We handle personal data in two distinct capacities, and your rights differ depending on which applies.",
      ],
      bullets: [
        "As a data fiduciary (controller), for people who visit our website, enquire about the product, or administer a subscription. We decide why and how that data is used.",
        "As a data processor, for the employee and client records a customer company puts into their workspace. That company decides what to collect and why; we only act on their instructions. If you are an employee whose employer uses DNMS, your employer is the fiduciary and your first point of contact.",
      ],
    },
    {
      heading: "What we collect",
      body: ["The categories below reflect what the application genuinely stores."],
      rows: [
        {
          term: "Account and identity",
          detail:
            "Name, work email, employee number, designation, department, reporting line, profile photo and role assignments.",
        },
        {
          term: "Contact and personal details",
          detail:
            "Phone number, date of birth, gender, address and emergency contacts, where your employer chooses to record them.",
        },
        {
          term: "Attendance records",
          detail:
            "Punch timestamps from biometric terminals on your employer's premises, plus derived data such as hours worked, late marks and regularisation requests. We receive the punch event and the device identifier. Fingerprint and face templates stay on the device and are never transmitted to or stored by DNMS.",
        },
        {
          term: "Leave, WFH and payroll",
          detail:
            "Leave balances, applications and approvals; work-from-home requests; salary structures, payslips and payroll runs where the payroll module is used.",
        },
        {
          term: "Performance and recruitment",
          detail:
            "Evaluations, KPI records, goals and feedback; and for applicants, the details and documents submitted through a careers form.",
        },
        {
          term: "Work content",
          detail:
            "Projects, tasks, requirements, documents, chat messages, comments, announcements and files you upload.",
        },
        {
          term: "Technical data",
          detail:
            "IP address, browser and device type, and timestamped security and audit events such as sign-ins, permission changes and administrative actions.",
        },
      ],
    },
    {
      heading: "Why we use it",
      bullets: [
        "To provide the service your employer or your company has subscribed to.",
        "To authenticate you, enforce permissions and keep accounts secure.",
        "To send transactional messages: password resets, approvals, reminders and notifications you have enabled.",
        "To maintain audit trails, which exist to protect you as much as us: they record who changed what and when.",
        "To diagnose faults, monitor availability and improve reliability.",
        "To meet legal, tax and statutory obligations.",
      ],
      body: [
        "We do not sell personal data. We do not use your work content to train AI models, and we do not use it to advertise to you.",
      ],
    },
    {
      heading: "Legal bases",
      body: [
        "Where we act as fiduciary we rely on your consent (which you may withdraw), on the necessity of performing a contract with you, on our legitimate interests in securing and improving the service, and on compliance with law. Where we act as processor, the lawful basis is determined by the customer company that engaged us.",
      ],
    },
    {
      heading: "Who we share it with",
      body: [
        "Access inside a workspace is governed by the roles and permissions your administrators configure. Beyond that, personal data reaches only the sub-processors below, each of which receives the minimum needed for its function.",
      ],
      rows: SUBPROCESSORS,
    },
    {
      heading: "Tenant isolation",
      body: [
        "DNMS is multi-tenant: several companies share the same infrastructure while their data stays strictly separated. Every record carries a tenant identifier, and every database query is scoped to the tenant of the signed-in session by a guard that refuses unscoped access rather than defaulting to a broad result. One company's workspace cannot read or write another's.",
      ],
    },
    {
      heading: "Where data is stored",
      body: [
        "Application data is held in a PostgreSQL database on servers we control. Uploaded files are held in Backblaze B2. Some sub-processors listed above may process data outside India; where they do, we rely on their contractual commitments and standard safeguards.",
      ],
    },
    {
      heading: "How long we keep it",
      bullets: [
        "Workspace data is retained for as long as the customer's subscription is active.",
        "After termination, data is retained for 30 days so it can be exported or an account restored, then deleted.",
        "Audit logs and records required for tax, statutory or legal purposes are kept for the period the applicable law requires.",
        "Backups are retained on a rolling cycle and overwritten in the ordinary course.",
      ],
    },
    {
      heading: "How we protect it",
      bullets: [
        "Encryption in transit (HTTPS/TLS) across the entire application.",
        "Passwords stored only as salted one-way hashes, never in a readable form, and never recoverable by us.",
        "Sensitive stored values, such as integration credentials, encrypted at rest.",
        "Role-based access control with granular permission scopes, so people see only what their role allows.",
        "Uploaded files served through short-lived signed URLs rather than public links.",
        "Audit logging of administrative and security-relevant actions.",
      ],
      body: [
        "No system is perfectly secure. We do not claim otherwise, and we will notify affected users and the relevant authority of a personal data breach as required by law.",
      ],
    },
    {
      heading: "Your rights",
      body: [
        "Subject to applicable law, you may request access to your personal data, correction of inaccurate data, erasure, a portable copy, or restriction of certain processing, and you may withdraw consent where consent is the basis.",
        `If your employer administers your workspace, please raise the request with them first, and we will act on their instruction. Otherwise write to ${emails.privacy} and we will respond within the statutory period.`,
      ],
    },
    {
      heading: "Children",
      body: [
        "DNMS is a workplace product and is not directed at children. We do not knowingly collect data from anyone under 18. If you believe a child's data has been provided to us, contact us and we will delete it.",
      ],
    },
    {
      heading: "Grievance Officer",
      body: [
        `In accordance with India's Digital Personal Data Protection Act, 2023 and the Information Technology Rules, complaints about the handling of personal data may be addressed to our Grievance Officer at ${emails.grievance}, or by post to ${legal.entity}, ${legal.address}. We acknowledge complaints within 24 hours and aim to resolve them within 30 days.`,
      ],
    },
    {
      heading: "Changes to this policy",
      body: [
        "We will update this page when our practices change and revise the date at the top. Material changes will be notified in the application or by email before they take effect.",
      ],
    },
  ],
}

// =============================================================================
// Terms & conditions
// =============================================================================
const terms: LegalDoc = {
  slug: "terms",
  title: "Terms & Conditions",
  summary: `The agreement between you and ${legal.entity} for the use of ${name}.`,
  updated: UPDATED,
  sections: [
    {
      heading: "Agreement",
      body: [
        `These Terms govern your access to and use of ${fullName} ("${name}"), provided by ${legal.entity}, ${legal.address}. By creating a workspace, signing in, or using the service, you agree to them. If you are accepting on behalf of a company, you confirm you are authorised to bind it.`,
      ],
    },
    {
      heading: "Definitions",
      rows: [
        {
          term: "Customer",
          detail: "The company or organisation that subscribes to a DNMS workspace.",
        },
        {
          term: "Workspace",
          detail: "The isolated tenant environment provisioned for a Customer.",
        },
        {
          term: "User",
          detail:
            "Anyone the Customer authorises to sign in: employees, administrators and external client users.",
        },
        {
          term: "Customer Data",
          detail: "All data a Customer or its Users submit to or generate within the Workspace.",
        },
      ],
    },
    {
      heading: "Accounts and access",
      bullets: [
        "The Customer is responsible for all activity under its Workspace, including that of its Users.",
        "Credentials must be kept confidential and must not be shared between people.",
        "The Customer is responsible for the permissions and roles it assigns and for removing access when someone leaves.",
        "Notify us promptly at the support address if you suspect unauthorised access.",
      ],
    },
    {
      heading: "Trial and subscription",
      bullets: [
        "New workspaces begin on a 21-day trial. No payment card is required to start.",
        "At the end of a trial the Workspace must move to a paid plan or it becomes inactive and is scheduled for deletion in line with the retention periods in our Privacy Policy.",
        "Paid plans renew automatically for the same period unless cancelled before renewal.",
        "Fees, seat counts and plan limits are those shown at the time of purchase. We may change pricing on 30 days' notice, effective from your next renewal.",
        "Fees are exclusive of taxes, which are charged as applicable.",
      ],
    },
    {
      heading: "Acceptable use",
      body: ["You agree not to:"],
      bullets: [
        "Use the service unlawfully, or to store or transmit unlawful, infringing or harmful content.",
        "Upload malware, or attempt to gain unauthorised access to any part of the system, any other tenant, or any other user's data.",
        "Probe, scan, load-test or penetration-test the service without our prior written consent.",
        "Reverse engineer, decompile, resell, sublicense or white-label the service except under a written agreement permitting it.",
        "Use the service to send unsolicited bulk email, or in breach of any applicable communications or data protection law.",
        "Circumvent plan limits, rate limits or access controls.",
      ],
    },
    {
      heading: "Your data stays yours",
      body: [
        "The Customer retains all rights in Customer Data. We claim no ownership over it. We process it only to provide and support the service, as described in our Privacy Policy, and on the Customer's instructions.",
        "You are responsible for having the legal right to submit the data you upload, in particular employee and applicant personal data, and for providing whatever notices or consents your local law requires.",
      ],
    },
    {
      heading: "Our intellectual property",
      body: [
        `The software, design, documentation, trade marks and everything else comprising ${name} remain the property of ${legal.entity}. These Terms grant a limited, non-exclusive, non-transferable right to use the service during the subscription term, and nothing more.`,
      ],
    },
    {
      heading: "Availability and support",
      body: [
        "We aim for high availability but do not guarantee uninterrupted service. Planned maintenance will be notified in advance where practicable. Emergency maintenance may occur without notice.",
        "Support is provided by email during business hours. Response targets, if any, are those stated in your plan or order form.",
      ],
    },
    {
      heading: "Third-party services",
      body: [
        "The service integrates optional third-party components: single sign-on, object storage, search analytics, AI assistance and email delivery. Your use of those is subject to their own terms. We are not responsible for their availability or acts.",
      ],
    },
    {
      heading: "Suspension and termination",
      bullets: [
        "You may cancel at any time; cancellation takes effect at the end of the current billing period.",
        "We may suspend access immediately for non-payment, for a breach of the acceptable-use section, or where continued access poses a security risk to the platform or other tenants.",
        "On termination we will make Customer Data available for export for 30 days, after which it is deleted.",
      ],
    },
    {
      heading: "Warranties and disclaimers",
      body: [
        'The service is provided on an "as is" and "as available" basis. To the maximum extent permitted by law we disclaim all implied warranties, including merchantability, fitness for a particular purpose and non-infringement. We do not warrant that the service will be error-free or that it will meet every requirement.',
      ],
    },
    {
      heading: "Limitation of liability",
      body: [
        "To the maximum extent permitted by law, neither party is liable for indirect, incidental, special or consequential loss, or for loss of profits, revenue, goodwill or anticipated savings.",
        "Our aggregate liability arising out of or relating to the service is limited to the fees paid by the Customer in the twelve months preceding the event giving rise to the claim.",
        "Nothing here limits liability that cannot lawfully be limited.",
      ],
    },
    {
      heading: "Indemnity",
      body: [
        "The Customer will indemnify us against third-party claims arising from Customer Data or from use of the service in breach of these Terms or of applicable law.",
      ],
    },
    {
      heading: "Changes to the service and to these Terms",
      body: [
        "We develop the product continuously and may add, change or withdraw features. We will not materially reduce core functionality of a paid plan during a paid term without notice. We may update these Terms; material changes will be notified at least 30 days before they take effect, and continued use after that constitutes acceptance.",
      ],
    },
    {
      heading: "Governing law and jurisdiction",
      body: [
        `These Terms are governed by ${legal.governingLaw}. The courts at ${legal.jurisdiction} have exclusive jurisdiction, save that either party may seek injunctive relief in any competent court to protect its intellectual property or confidential information.`,
      ],
    },
    {
      heading: "Contact",
      body: [
        `Questions about these Terms: ${emails.support}. Postal address: ${legal.entity}, ${legal.address}.`,
      ],
    },
  ],
}

// =============================================================================
// Cookie policy
// =============================================================================
const cookies: LegalDoc = {
  slug: "cookies",
  title: "Cookie Policy",
  summary: `The cookies ${name} sets, what each one does, and how to control them.`,
  updated: UPDATED,
  sections: [
    {
      heading: "The short version",
      body: [
        `${name} is a workplace application, not an ad-supported website. We set no advertising cookies, no cross-site tracking cookies, and no third-party analytics cookies. Every cookie below is either required to keep you signed in and safe, or remembers a preference you chose.`,
      ],
    },
    {
      heading: "Strictly necessary",
      body: [
        "These cannot be switched off. Without them the application cannot authenticate you, and blocking them will prevent you signing in.",
      ],
      rows: [
        {
          term: "authjs.session-token",
          detail:
            "Your signed-in session. Encrypted, HTTP-only, and on HTTPS also marked Secure. It carries your identity, workspace and permissions. Expires 30 days after issue, sooner if you sign out.",
        },
        {
          term: "authjs.csrf-token",
          detail:
            "Protects sign-in and form submissions against cross-site request forgery. Session-lifetime.",
        },
        {
          term: "authjs.callback-url",
          detail:
            "Remembers the page you were heading to so you land there after signing in rather than on a generic screen. Session-lifetime.",
        },
      ],
    },
    {
      heading: "Preferences",
      rows: [
        {
          term: "theme",
          detail:
            "Stores your light or dark appearance choice so the interface does not flash the wrong theme on load. Set only if you change it from the system default.",
        },
      ],
    },
    {
      heading: "Local storage",
      body: [
        "Alongside cookies, the application uses your browser's local storage for interface state: collapsed panels, table filters, drafts you have not sent. This never leaves your browser and is not transmitted to us. Clearing site data removes it.",
      ],
    },
    {
      heading: "Controlling cookies",
      body: [
        "Every browser lets you view, block or delete cookies through its settings. Blocking the strictly necessary cookies above will stop you from signing in. Clearing them signs you out but destroys no data in your workspace.",
      ],
    },
    {
      heading: "Third parties",
      body: [
        "If you sign in with Google, Google sets its own cookies on its own domain as part of that flow, governed by Google's policies rather than ours. Files served from Backblaze B2 are delivered through expiring signed links and set no cookies of ours.",
      ],
      rows: SUBPROCESSORS.slice(0, 2),
    },
    {
      heading: "Questions",
      body: [`Write to ${emails.privacy}.`],
    },
  ],
}

// =============================================================================
// Refund & cancellation
// =============================================================================
const refund: LegalDoc = {
  slug: "refund",
  title: "Refund & Cancellation Policy",
  titleAccent: "Cancellation Policy",
  summary: "How trials, cancellations, renewals and refunds are handled.",
  updated: UPDATED,
  sections: [
    {
      heading: "Try before you pay",
      body: [
        "Every new workspace starts with a 21-day trial and no payment card. The trial is the intended way to evaluate whether DNMS fits your company, and we would rather you use it fully than pay for a month you did not need.",
      ],
    },
    {
      heading: "Cancelling",
      bullets: [
        "You can cancel at any time from your workspace billing settings, or by writing to the support address.",
        "Cancellation stops the next renewal. Your workspace stays fully usable until the end of the period you have already paid for.",
        "No cancellation fee applies.",
      ],
    },
    {
      heading: "Refunds",
      bullets: [
        "Monthly plans are not refunded for the current period once it has begun, because cancellation already prevents the next charge.",
        "Annual plans may be refunded on a pro-rata basis for complete unused months if you cancel within the first 30 days of the term.",
        "If you were charged after cancelling, or charged twice for the same period, we refund in full. Write to us and we will correct it.",
        "Where a documented fault made the service substantially unusable for a sustained period and we could not resolve it, we will refund the affected period.",
      ],
    },
    {
      heading: "How refunds are paid",
      body: [
        "Approved refunds are returned to the original payment method. We initiate them within 7 business days of approval; how long the money takes to appear afterwards depends on your bank or card issuer, typically 5 to 10 business days.",
      ],
    },
    {
      heading: "Not refundable",
      bullets: [
        "Periods during which the workspace was actively used.",
        "Fees for custom development, migration or onboarding work already delivered.",
        "Third-party charges you incur directly with another provider.",
        "Suspension or termination resulting from a breach of the Terms & Conditions.",
      ],
    },
    {
      heading: "Getting your data out",
      body: [
        "Cancelling never holds your data hostage. Export remains available for 30 days after a subscription ends, after which the workspace is deleted in line with our Privacy Policy. If you need longer, ask before the window closes.",
      ],
    },
    {
      heading: "Raising a request",
      body: [
        `Email ${emails.support} with your workspace name and the charge in question. We acknowledge within 2 business days and aim to decide within 7. Unresolved matters can be escalated to our Grievance Officer at ${emails.grievance}.`,
      ],
    },
  ],
}

// =============================================================================

export const LEGAL_DOCS = { privacy, terms, cookies, refund } as const
export type LegalSlug = keyof typeof LEGAL_DOCS

/** Footer / index listing. Order is deliberate: most-read first. */
export const LEGAL_INDEX: { slug: LegalSlug; title: string; blurb: string }[] = [
  { slug: "privacy", title: privacy.title, blurb: "What we collect and why." },
  { slug: "terms", title: terms.title, blurb: "The agreement for using DNMS." },
  { slug: "cookies", title: cookies.title, blurb: "Every cookie, itemised." },
  { slug: "refund", title: refund.title, blurb: "Trials, cancellations, refunds." },
]
