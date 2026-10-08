import { DEMO_EMAIL_DOMAIN } from "@/lib/demo"
import type { DemoPersona } from "../types"

// Made-up people for Help screenshots only (seeded by prisma/seed-demo.ts). Emails use an
// undeliverable domain (lib/demo.ts) that the mailer drops.

const email = (local: string) => `${local}@${DEMO_EMAIL_DOMAIN}`

export interface DemoPerson {
  key: string
  firstName: string
  lastName: string
  email: string
  employeeNo: string
  department: string
  designation: string
  /** System role name (lib/constants SYSTEM_ROLES). */
  role: "admin" | "hr_manager" | "hr_employee" | "employee"
  /** `key` of their manager. */
  manager?: string
  gender: "MALE" | "FEMALE"
  /** Days ago they joined (relative, so the data never looks stale). */
  joinedDaysAgo: number
  /** Monthly gross, INR. */
  monthlyGross: number
}

export const DEMO_PERSONAS: Record<DemoPersona, string> = {
  admin: "aarav",
  hr: "neha",
  manager: "rohan",
  employee: "priya",
}

export const DEMO_DEPARTMENTS = [
  { name: "Leadership", parent: null },
  { name: "Human Resources", parent: null },
  { name: "Creative", parent: null },
  { name: "Design", parent: "Creative" },
  { name: "Content", parent: "Creative" },
  { name: "Technology", parent: null },
  { name: "Marketing", parent: null },
  { name: "SEO", parent: "Marketing" },
  { name: "Social Media", parent: "Marketing" },
  { name: "Finance", parent: null },
  { name: "Sales", parent: null },
] as const

export const DEMO_PEOPLE: DemoPerson[] = [
  {
    key: "aarav",
    firstName: "Aarav",
    lastName: "Mehta",
    email: email("aarav.mehta"),
    employeeNo: "DM001",
    department: "Leadership",
    designation: "Director",
    role: "admin",
    gender: "MALE",
    joinedDaysAgo: 1460,
    monthlyGross: 250000,
  },
  {
    key: "neha",
    firstName: "Neha",
    lastName: "Kapoor",
    email: email("neha.kapoor"),
    employeeNo: "DM002",
    department: "Human Resources",
    designation: "HR Manager",
    role: "hr_manager",
    manager: "aarav",
    gender: "FEMALE",
    joinedDaysAgo: 1100,
    monthlyGross: 95000,
  },
  {
    key: "rohan",
    firstName: "Rohan",
    lastName: "Verma",
    email: email("rohan.verma"),
    employeeNo: "DM003",
    department: "Creative",
    designation: "Creative Lead",
    role: "employee",
    manager: "aarav",
    gender: "MALE",
    joinedDaysAgo: 900,
    monthlyGross: 120000,
  },
  {
    key: "priya",
    firstName: "Priya",
    lastName: "Sharma",
    email: email("priya.sharma"),
    employeeNo: "DM004",
    department: "Design",
    designation: "Graphic Designer",
    role: "employee",
    manager: "rohan",
    gender: "FEMALE",
    joinedDaysAgo: 420,
    monthlyGross: 55000,
  },
  {
    key: "karthik",
    firstName: "Karthik",
    lastName: "Iyer",
    email: email("karthik.iyer"),
    employeeNo: "DM005",
    department: "Technology",
    designation: "Full Stack Developer",
    role: "employee",
    manager: "aarav",
    gender: "MALE",
    joinedDaysAgo: 650,
    monthlyGross: 85000,
  },
  {
    key: "ananya",
    firstName: "Ananya",
    lastName: "Gupta",
    email: email("ananya.gupta"),
    employeeNo: "DM006",
    department: "Content",
    designation: "Content Writer",
    role: "employee",
    manager: "rohan",
    gender: "FEMALE",
    joinedDaysAgo: 380,
    monthlyGross: 45000,
  },
  {
    key: "vikram",
    firstName: "Vikram",
    lastName: "Singh",
    email: email("vikram.singh"),
    employeeNo: "DM007",
    department: "SEO",
    designation: "SEO Specialist",
    role: "employee",
    manager: "rohan",
    gender: "MALE",
    joinedDaysAgo: 510,
    monthlyGross: 50000,
  },
  {
    key: "sneha",
    firstName: "Sneha",
    lastName: "Reddy",
    email: email("sneha.reddy"),
    employeeNo: "DM008",
    department: "Social Media",
    designation: "Social Media Executive",
    role: "employee",
    manager: "rohan",
    gender: "FEMALE",
    joinedDaysAgo: 300,
    monthlyGross: 40000,
  },
  {
    key: "arjun",
    firstName: "Arjun",
    lastName: "Nair",
    email: email("arjun.nair"),
    employeeNo: "DM009",
    department: "Creative",
    designation: "Video Editor",
    role: "employee",
    manager: "rohan",
    gender: "MALE",
    joinedDaysAgo: 220,
    monthlyGross: 42000,
  },
  {
    key: "meera",
    firstName: "Meera",
    lastName: "Joshi",
    email: email("meera.joshi"),
    employeeNo: "DM010",
    department: "Finance",
    designation: "Accounts Executive",
    role: "employee",
    manager: "aarav",
    gender: "FEMALE",
    joinedDaysAgo: 700,
    monthlyGross: 48000,
  },
  {
    key: "ishaan",
    firstName: "Ishaan",
    lastName: "Malhotra",
    email: email("ishaan.malhotra"),
    employeeNo: "DM011",
    department: "Sales",
    designation: "Business Development Executive",
    role: "employee",
    manager: "aarav",
    gender: "MALE",
    joinedDaysAgo: 180,
    monthlyGross: 46000,
  },
  {
    key: "kavya",
    firstName: "Kavya",
    lastName: "Pillai",
    email: email("kavya.pillai"),
    employeeNo: "DM012",
    department: "Human Resources",
    designation: "HR Executive",
    role: "hr_employee",
    manager: "neha",
    gender: "FEMALE",
    joinedDaysAgo: 260,
    monthlyGross: 38000,
  },
  {
    key: "rahul",
    firstName: "Rahul",
    lastName: "Das",
    email: email("rahul.das"),
    employeeNo: "DM013",
    department: "Design",
    designation: "Junior Designer",
    role: "employee",
    manager: "rohan",
    gender: "MALE",
    // A new joinee: onboarding checklist and 15-day scorecard in progress.
    joinedDaysAgo: 6,
    monthlyGross: 30000,
  },
  {
    key: "pooja",
    firstName: "Pooja",
    lastName: "Bansal",
    email: email("pooja.bansal"),
    employeeNo: "DM014",
    department: "Content",
    designation: "Copywriter",
    role: "employee",
    manager: "rohan",
    gender: "FEMALE",
    // Has resigned: resignation + exit clearance in progress.
    joinedDaysAgo: 800,
    monthlyGross: 44000,
  },
]

/** Someone who has already left - gives the headcount and status charts a past. */
export interface DemoFormerPerson extends DemoPerson {
  /** Days ago their last working day was. */
  leftDaysAgo: number
  exitStatus: "RESIGNED" | "TERMINATED"
  exitReason: string
}

export const DEMO_FORMER_PEOPLE: DemoFormerPerson[] = [
  {
    key: "manish",
    firstName: "Manish",
    lastName: "Tiwari",
    email: email("manish.tiwari"),
    employeeNo: "DM015",
    department: "Social Media",
    designation: "Social Media Executive",
    role: "employee",
    manager: "rohan",
    gender: "MALE",
    joinedDaysAgo: 560,
    monthlyGross: 41000,
    leftDaysAgo: 20,
    exitStatus: "RESIGNED",
    exitReason: "Moved to Hyderabad to join a product company's in-house social team.",
  },
]

export const DEMO_CLIENTS = [
  { key: "sunrise", name: "Sunmeadow Foods Pvt Ltd", industry: "Food & Beverage" },
  { key: "urbannest", name: "UrbanNest Realty", industry: "Real Estate" },
  { key: "fitlife", name: "FitLife Wellness", industry: "Health & Fitness" },
] as const

export const DEMO_PROJECTS = [
  {
    key: "sunrise",
    name: "Sunmeadow Organics Launch",
    client: "sunrise",
    accountManager: "rohan",
    members: ["priya", "ananya", "sneha", "vikram", "arjun"],
    status: "ACTIVE",
    stage: "LAUNCH",
  },
  {
    key: "urbannest",
    name: "UrbanNest Website & SEO",
    client: "urbannest",
    accountManager: "rohan",
    members: ["karthik", "vikram", "ananya", "priya"],
    status: "ACTIVE",
    stage: "GROWTH",
  },
  {
    key: "fitlife",
    name: "FitLife App Rebrand",
    client: "fitlife",
    accountManager: "aarav",
    members: ["priya", "rahul", "arjun", "sneha"],
    status: "PLANNING",
    stage: "REBRANDING",
  },
  {
    key: "internal",
    name: "Demo Company Website",
    client: null,
    accountManager: "aarav",
    members: ["karthik", "priya", "ananya"],
    status: "ACTIVE",
    stage: null,
  },
] as const

/** Look a demo person up by key (throws on a typo, so a guide can't silently break). */
export function demoPerson(key: string): DemoPerson {
  const p = DEMO_PEOPLE.find((x) => x.key === key)
  if (!p) throw new Error(`Unknown demo person "${key}"`)
  return p
}
