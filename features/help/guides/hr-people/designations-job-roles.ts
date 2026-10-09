import { Briefcase } from "lucide-react"
import { PERMISSIONS } from "@/lib/constants"
import type { HelpGuide } from "../../types"

export const designationsJobRolesGuide: HelpGuide = {
  slug: "designations-job-roles",
  group: "hr",
  icon: Briefcase,
  href: "/employees/designations",
  title: { en: "Designations and Job Roles", hi: "Designations और Job Roles" },
  summary: {
    en: "Keep the lists of job titles and department roles that you pick from when you add or edit an employee.",
    hi: "Job titles और department वाले roles की लिस्ट रखें, जिनमें से आप employee जोड़ते या edit करते समय चुनते हैं।",
  },
  keywords: [
    "designation",
    "job title",
    "title",
    "level",
    "job role",
    "role",
    "position",
    "पद",
    "डेज़िग्नेशन",
    "जॉब रोल",
  ],
  sections: [
    {
      id: "difference",
      title: { en: "Designation or job role?", hi: "Designation या job role?" },
      intro: {
        en: "Both show on an employee's profile, but they mean different things.",
        hi: "दोनों employee की प्रोफाइल पर दिखते हैं, लेकिन दोनों का मतलब अलग है।",
      },
      tips: [
        {
          en: "A designation is the person's job title, like Graphic Designer or HR Manager. Every employee must have one, and each designation has a level from 1 to 13.",
          hi: "Designation व्यक्ति का job title है, जैसे Graphic Designer या HR Manager। हर employee का एक designation होना ज़रूरी है, और हर designation का 1 से 13 तक एक level होता है।",
        },
        {
          en: "A job role is narrower and optional. It belongs to one department, for example Full Stack Developer under Technology. On the employee form, Job Role only lists the roles of the department you picked.",
          hi: "Job role ज़्यादा खास होता है और ज़रूरी नहीं है। ये एक department का होता है, जैसे Technology के अंदर Full Stack Developer। Employee फॉर्म में Job Role में सिर्फ चुने हुए department के roles आते हैं।",
        },
      ],
    },
    {
      id: "designations",
      title: { en: "See the designations", hi: "Designations देखें" },
      steps: [
        {
          text: {
            en: "In the sidebar, open Employees and click Designations. The table shows each Title, its Level (L1 to L13), how many Employees have it, and its Status.",
            hi: "साइडबार में Employees खोलें और Designations पर क्लिक करें। टेबल में हर Title, उसका Level (L1 से L13), कितने Employees के पास ये है, और उसका Status दिखता है।",
          },
        },
        {
          text: {
            en: "Type in the search box (1) to find a designation. If you can edit, each row has a pencil to edit (2) and a power button to deactivate (3), and Add Designation (4) is at the top right.",
            hi: "कोई designation ढूँढने के लिए सर्च बॉक्स (1) में टाइप करें। अगर आप edit कर सकते हैं, तो हर लाइन पर edit के लिए पेंसिल (2) और deactivate के लिए पावर बटन (3) है, और Add Designation (4) ऊपर दाईं ओर है।",
          },
          shot: {
            id: "designations-job-roles-designations",
            as: "hr",
            path: "/employees/designations",
            highlight: [
              { placeholder: "Search designations..." },
              { role: "button", name: "Edit", exact: true },
              { role: "button", name: "Deactivate", exact: true },
              { role: "button", name: "Add Designation" },
            ],
          },
        },
      ],
    },
    {
      id: "add-designation",
      title: { en: "Add or change a designation", hi: "Designation जोड़ें या बदलें" },
      permission: PERMISSIONS.EMPLOYEE_WRITE,
      steps: [
        {
          text: {
            en: "Click Add Designation. Type the Title (1), set the Level (1 to 13) (2), and click Create (3).",
            hi: "Add Designation पर क्लिक करें। Title (1) टाइप करें, Level (1 to 13) (2) सेट करें, और Create (3) पर क्लिक करें।",
          },
          shot: {
            id: "designations-job-roles-designation-dialog",
            as: "hr",
            path: "/employees/designations",
            actions: [{ click: { role: "button", name: "Add Designation" } }],
            highlight: [
              { label: "Title" },
              { label: "Level (1 to 13)" },
              { role: "button", name: "Create" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "To rename one, click its pencil, change it and click Save Changes. The new title shows on everyone who has it.",
            hi: "नाम बदलने के लिए उसकी पेंसिल पर क्लिक करें, बदलें और Save Changes पर क्लिक करें। नया title उन सभी पर दिखेगा जिनके पास ये designation है।",
          },
        },
        {
          text: {
            en: "Click the power button to deactivate one you no longer use, and again to activate it. To deactivate several, tick their boxes and click Deactivate in the table's header row.",
            hi: "जो designation अब इस्तेमाल नहीं होता, उसे deactivate करने के लिए पावर बटन पर क्लिक करें, और वापस activate करने के लिए दोबारा। कई एक साथ deactivate करने हों तो उनके बॉक्स टिक करें और टेबल की हेडर लाइन में Deactivate पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "A deactivated designation stays on the people who already have it, but can't be picked for anyone new.",
          hi: "Deactivate किया गया designation उन लोगों पर बना रहता है जिनके पास पहले से है, लेकिन किसी नए के लिए चुना नहीं जा सकता।",
        },
        {
          en: "The bin button (Delete permanently) only appears when no employee has that designation.",
          hi: "डस्टबिन वाला बटन (Delete permanently) तभी दिखता है जब किसी भी employee के पास वो designation न हो।",
        },
      ],
    },
    {
      id: "job-roles",
      title: { en: "See the job roles", hi: "Job roles देखें" },
      steps: [
        {
          text: {
            en: "In the sidebar, open Employees and click Job Roles. The table shows each Role, its Department, how many Employees have it, and its Status.",
            hi: "साइडबार में Employees खोलें और Job Roles पर क्लिक करें। टेबल में हर Role, उसका Department, कितने Employees के पास ये है, और उसका Status दिखता है।",
          },
        },
        {
          text: {
            en: "Pick a department in the filter (1) to see only its roles. If you can edit, Add Role (2) is at the top right.",
            hi: "सिर्फ किसी एक department के roles देखने के लिए फिल्टर (1) में वो department चुनें। अगर आप edit कर सकते हैं, तो Add Role (2) ऊपर दाईं ओर है।",
          },
          shot: {
            id: "designations-job-roles-job-roles",
            as: "hr",
            path: "/employees/job-roles",
            highlight: [
              { text: "All departments", exact: true },
              { role: "button", name: "Add Role" },
            ],
          },
        },
      ],
    },
    {
      id: "add-job-role",
      title: { en: "Add or change a job role", hi: "Job role जोड़ें या बदलें" },
      permission: PERMISSIONS.EMPLOYEE_WRITE,
      steps: [
        {
          text: {
            en: "Click Add Role. Pick the Department (1), type the Role name (2), and click Create (3).",
            hi: "Add Role पर क्लिक करें। Department (1) चुनें, Role name (2) टाइप करें, और Create (3) पर क्लिक करें।",
          },
          shot: {
            id: "designations-job-roles-job-role-dialog",
            as: "hr",
            path: "/employees/job-roles",
            actions: [{ click: { role: "button", name: "Add Role" } }],
            highlight: [
              { label: "Department" },
              { label: "Role name" },
              { role: "button", name: "Create" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Use the pencil on a row to rename a role or move it to another department, the power button to deactivate or activate it, and the bin to delete a role nobody has.",
            hi: "किसी role का नाम बदलने या उसे दूसरे department में ले जाने के लिए लाइन पर पेंसिल, deactivate या activate करने के लिए पावर बटन, और जिस role पर कोई नहीं है उसे delete करने के लिए डस्टबिन इस्तेमाल करें।",
          },
        },
      ],
      tips: [
        {
          en: "If you picked a department in the filter first, Add Role starts with that department already chosen.",
          hi: "अगर आपने पहले फिल्टर में department चुना है, तो Add Role में वही department पहले से चुना हुआ आता है।",
        },
      ],
    },
  ],
}
