/**
 * Loads the empty template at docs/Employee_Onboarding_Template.xlsx, fills in
 * the 12 employee records Karan provided, and writes the result to
 * docs/Employee_Onboarding_Filled.xlsx (template is preserved).
 *
 * Run:  node scripts/fill-onboarding-sheet.mjs
 *
 * Source data: the HTML export Karan shared on 2026-06-03.
 */

import ExcelJS from "exceljs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const INPUT = resolve(__dirname, "..", "docs", "Employee_Onboarding_Template.xlsx")
const OUTPUT = resolve(__dirname, "..", "docs", "Employee_Onboarding_Filled.xlsx")

// ── Employee data - keyed by the column keys defined in generate-onboarding-sheet.mjs
// Unmatched HTML fields (Aadhaar, Emp Code, Direct/Dotted Reporting) are dropped
// - they aren't columns in our template. Department names use the DB list where
// a confident mapping exists; ambiguous ones stay blank (flagged in the script log).

const EMPLOYEES = [
  {
    empCode: "132",
    firstName: "Mridul",
    lastName: "Singh Bisht",
    email: "", // work email - set when @digitallynext.com is provisioned
    personalEmail: "mridulsinghbisht1008@gmail.com",
    phone: "9958784985",
    personalPhone: "",
    dob: "10-08-2002",
    department: "Web Development", // mapped from "Web team"
    designation: "Web Developer",
    employmentType: "Full Time",
    doj: "16-06-2025",
    workLocation: "",
    caLine1: "A-3/54 Kaushik Enclave",
    caLine2: "Burari",
    caCity: "Delhi",
    caState: "Delhi",
    caZip: "110084",
    paLine1: "A-3/54 Kaushik Enclave",
    paLine2: "Burari",
    paCity: "Delhi",
    paState: "Delhi",
    paZip: "110084",
    ecName: "",
    ecRelation: "",
    ecPhone: "9318337612",
  },
  {
    empCode: "136",
    firstName: "Hemant",
    lastName: "", // single-name in source
    email: "",
    personalEmail: "nandalhemant03@gmail.com",
    phone: "8076124881",
    personalPhone: "",
    dob: "18-02-2003",
    department: "Design", // mapped from "Visual Impact Management"
    designation: "UI/UX Designer",
    employmentType: "Full Time",
    doj: "29-10-2025",
    workLocation: "",
    caLine1: "House no. 163, Street no. 5",
    caLine2: "Sangam Vihar, Najafgarh",
    caCity: "New Delhi",
    caState: "Delhi",
    caZip: "110043",
    paLine1: "House no. 163, Street no. 5",
    paLine2: "Sangam Vihar, Najafgarh",
    paCity: "New Delhi",
    paState: "Delhi",
    paZip: "110043",
    ecName: "",
    ecRelation: "",
    ecPhone: "9871156057",
  },
  {
    empCode: "137",
    firstName: "Ayushi",
    lastName: "Pandey",
    email: "",
    personalEmail: "ayushipandey582@gmail.com",
    phone: "9818527772",
    personalPhone: "",
    dob: "06-12-2003",
    department: "Human Resources", // mapped from "HR"
    designation: "HR Executive",
    employmentType: "Full Time",
    doj: "01-12-2025",
    workLocation: "",
    caLine1: "WZ-42, A, Om Vihar",
    caLine2: "Phase 2, Uttam Nagar",
    caCity: "New Delhi",
    caState: "Delhi",
    caZip: "110059",
    paLine1: "WZ-42, A, Om Vihar",
    paLine2: "Phase 2, Uttam Nagar",
    paCity: "New Delhi",
    paState: "Delhi",
    paZip: "110059",
    ecName: "",
    ecRelation: "",
    ecPhone: "9560450107",
  },
  {
    empCode: "", // missing in source
    firstName: "Guruprasad",
    lastName: "", // single-name in source
    email: "",
    personalEmail: "dezinerguru42@gmail.com",
    phone: "9964815586",
    personalPhone: "",
    dob: "20-03-2002",
    department: "Video Production", // mapped from "Video Editing"
    designation: "Video Editor",
    employmentType: "Full Time",
    doj: "03-12-2025",
    workLocation: "",
    caLine1: "",
    caLine2: "",
    caCity: "",
    caState: "",
    caZip: "",
    paLine1: "",
    paLine2: "",
    paCity: "",
    paState: "",
    paZip: "",
    ecName: "",
    ecRelation: "",
    ecPhone: "9449525714",
  },
  {
    empCode: "", // missing in source
    firstName: "Gavisha",
    lastName: "", // single-name in source
    email: "",
    personalEmail: "gavishadhonsiofficial@gmail.com",
    phone: "8979393980",
    personalPhone: "",
    dob: "01-11-1995",
    department: "Design", // mapped from "Visual Impact Management"
    designation: "UI/UX Designer",
    employmentType: "Full Time",
    doj: "03-12-2025",
    workLocation: "",
    caLine1: "6th Main Rd, Hal",
    caLine2: "HAL 3rd Stage, New Tippasandra",
    caCity: "Bengaluru",
    caState: "Karnataka",
    caZip: "560075",
    paLine1: "5053 Prestige Sunrise Park",
    paLine2: "Electronic City Phase I, Norwood",
    paCity: "Bengaluru",
    paState: "Karnataka",
    paZip: "560100",
    ecName: "",
    ecRelation: "",
    ecPhone: "8452052672",
  },
  {
    empCode: "143",
    firstName: "Teesha",
    lastName: "Jain",
    email: "",
    personalEmail: "teeshajain001@gmail.com",
    phone: "9891231109",
    personalPhone: "",
    dob: "01-07-2003",
    department: "Research", // RAW - no clean match in DB list
    designation: "Market Research Specialist",
    employmentType: "Full Time",
    doj: "05-01-2026",
    workLocation: "",
    caLine1: "22, Sukh Vihar",
    caLine2: "Opposite Gagan Vihar",
    caCity: "East Delhi",
    caState: "Delhi",
    caZip: "110051",
    paLine1: "22, Sukh Vihar",
    paLine2: "Opposite Gagan Vihar",
    paCity: "East Delhi",
    paState: "Delhi",
    paZip: "110051",
    ecName: "",
    ecRelation: "Father",
    ecPhone: "9625099487",
  },
  {
    empCode: "144",
    firstName: "Karan",
    lastName: "Joshi",
    email: "",
    personalEmail: "joshikaran.aad.0007@gmail.com",
    phone: "9625902351",
    personalPhone: "",
    dob: "12-08-2003",
    department: "Web Development", // mapped from "Web team"
    designation: "Jr. Full Stack Developer",
    employmentType: "Full Time",
    doj: "23-02-2026",
    workLocation: "",
    caLine1: "House no. 113, Block D",
    caLine2: "Khora Colony",
    caCity: "Ghaziabad",
    caState: "Uttar Pradesh",
    caZip: "201001",
    paLine1: "House no. 113, Block D",
    paLine2: "Khora Colony",
    paCity: "Ghaziabad",
    paState: "Uttar Pradesh",
    paZip: "201001",
    ecName: "",
    ecRelation: "Sister",
    ecPhone: "9911728554",
  },
  {
    empCode: "145",
    firstName: "Diwakar",
    lastName: "Jha",
    email: "",
    personalEmail: "diwakarjha554@gmail.com",
    phone: "8882617743",
    personalPhone: "",
    dob: "07-03-2002",
    department: "Web Development", // mapped from "Web team"
    designation: "Web Developer",
    employmentType: "Full Time",
    doj: "23-02-2026",
    workLocation: "",
    caLine1: "House no. 406, Block J",
    caLine2: "Arpan Vihar, Jaitpur",
    caCity: "Badarpur",
    caState: "Delhi",
    caZip: "110044",
    paLine1: "House no. 406, Block J",
    paLine2: "Arpan Vihar, Jaitpur",
    paCity: "Badarpur",
    paState: "Delhi",
    paZip: "110044",
    ecName: "",
    ecRelation: "Father",
    ecPhone: "87000278406",
  },
  {
    empCode: "146",
    firstName: "Komal",
    lastName: "Gautam",
    email: "",
    personalEmail: "komalgoutam600@gmail.com",
    phone: "9354464123",
    personalPhone: "",
    dob: "", // not in source
    department: "Design", // mapped from "Visual Impact Management"
    designation: "Graphic Designer",
    employmentType: "Full Time",
    doj: "06-03-2026",
    workLocation: "",
    caLine1: "TC Camp 482",
    caLine2: "Raghubir Nagar",
    caCity: "West Delhi",
    caState: "Delhi",
    caZip: "110027",
    paLine1: "TC Camp 482",
    paLine2: "Raghubir Nagar",
    paCity: "West Delhi",
    paState: "Delhi",
    paZip: "110027",
    ecName: "",
    ecRelation: "Sister",
    ecPhone: "7827815507",
  },
  {
    empCode: "149",
    firstName: "Aashutosh",
    lastName: "Jaiswal",
    email: "",
    personalEmail: "aashujaiswal201@gmail.com",
    phone: "7987424526",
    personalPhone: "",
    dob: "19-04-2001", // parsed from "4/19/2001"
    department: "MSG", // RAW - unclear abbreviation
    designation: "Content Strategist",
    employmentType: "Full Time",
    doj: "11-05-2026",
    workLocation: "",
    caLine1: "House No. 339, Pocket A",
    caLine2: "Sector 21",
    caCity: "Gurugram",
    caState: "Haryana",
    caZip: "122001",
    paLine1: "House no. 13",
    paLine2: "Vijay Nagar Phase II, Devrikhurd",
    paCity: "Bilaspur",
    paState: "Chhattisgarh",
    paZip: "",
    ecName: "",
    ecRelation: "",
    ecPhone: "7898511083",
  },
  {
    empCode: "150",
    firstName: "Kshitij",
    lastName: "Pandey",
    email: "",
    personalEmail: "work.kshitijpandey@gmail.com",
    phone: "9718182459",
    personalPhone: "",
    dob: "08-12-1999",
    department: "MAP", // RAW - unclear abbreviation
    designation: "Creative Lead",
    employmentType: "Full Time",
    doj: "18-05-2026",
    workLocation: "",
    caLine1: "A-1/84 Phase 5",
    caLine2: "Ayanagar",
    caCity: "New Delhi",
    caState: "Delhi",
    caZip: "110047",
    paLine1: "A-1/84 Phase 5",
    paLine2: "Ayanagar",
    paCity: "New Delhi",
    paState: "Delhi",
    paZip: "110047",
    ecName: "",
    ecRelation: "",
    ecPhone: "9871602253",
  },
  {
    empCode: "151",
    firstName: "Yuthika",
    lastName: "Patil",
    email: "",
    personalEmail: "yuthikadoes@gmail.com",
    phone: "9372650233",
    personalPhone: "",
    dob: "27-08-2001",
    department: "SMG", // RAW - best guess "SMO" but unsure
    designation: "Brand Manager",
    employmentType: "Full Time",
    doj: "18-05-2026",
    workLocation: "",
    caLine1: "Flat 2",
    caLine2: "Anjali Residency, Khadkeshwar",
    caCity: "Aurangabad",
    caState: "Maharashtra",
    caZip: "",
    paLine1: "House i-47",
    paLine2: "Livstations South City 1, Sector 41",
    paCity: "Gurugram",
    paState: "Haryana",
    paZip: "",
    ecName: "",
    ecRelation: "",
    ecPhone: "838382654",
  },
]

// ── Column key → 1-based column index ────────────────────────────────────────
// Must match the order defined in generate-onboarding-sheet.mjs.
const COL_INDEX = {
  sl: 1,
  empCode: 2,
  firstName: 3,
  lastName: 4,
  email: 5,
  personalEmail: 6,
  phone: 7,
  personalPhone: 8,
  dob: 9,
  gender: 10,
  nationality: 11,
  bloodGroup: 12,
  department: 13,
  designation: 14,
  employmentType: 15,
  doj: 16,
  workLocation: 17,
  caLine1: 18,
  caLine2: 19,
  caCity: 20,
  caState: 21,
  caZip: 22,
  paLine1: 23,
  paLine2: 24,
  paCity: 25,
  paState: 26,
  paZip: 27,
  ecName: 28,
  ecRelation: 29,
  ecPhone: 30,
}

async function main() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(INPUT)

  const sheet = wb.getWorksheet("Employee Details")
  if (!sheet) {
    console.error(
      'Could not find "Employee Details" sheet in template. Did you run generate-onboarding-sheet.mjs first?',
    )
    process.exit(1)
  }

  EMPLOYEES.forEach((emp, idx) => {
    const rowIndex = idx + 2 // row 1 is the header
    const row = sheet.getRow(rowIndex)
    for (const [key, colIdx] of Object.entries(COL_INDEX)) {
      if (key === "sl") continue // auto-formula already in the template
      const val = emp[key] ?? ""
      if (val === "") continue
      row.getCell(colIdx).value = val
    }
    row.commit()
  })

  await wb.xlsx.writeFile(OUTPUT)
  console.log(`Wrote ${OUTPUT}`)
  console.log(`Filled ${EMPLOYEES.length} employee rows.`)

  // Flag departments left as raw (unmatched against DB list).
  const RAW_DEPARTMENTS = new Set(["Research", "MSG", "MAP", "SMG"])
  const flagged = EMPLOYEES.filter((e) => RAW_DEPARTMENTS.has(e.department))
  if (flagged.length > 0) {
    console.log("")
    console.log("Departments needing your review (not in DB dropdown list):")
    for (const e of flagged) {
      console.log(
        `  - ${e.firstName} ${e.lastName} → "${e.department}" (designation: ${e.designation})`,
      )
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
