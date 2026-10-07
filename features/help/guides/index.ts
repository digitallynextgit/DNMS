import type { HelpGroup, HelpGuide, L10n } from "../types"
import { startSelfGuides } from "./start-self"
import { selfServiceGuides } from "./self-service"
import { companyGuides } from "./company"
import { projectGuides } from "./projects"
import { projectToolGuides } from "./project-tools"
import { hrPeopleGuides } from "./hr-people"
import { hrOperationsGuides } from "./hr-operations"
import { adminGuides } from "./admin"

// Every guide, in the order the Help home page lists them. Each folder owns its
// own list (./<folder>/index.ts) so guides can be written side by side without
// two people editing this file.

export const HELP_GUIDES: readonly HelpGuide[] = [
  ...startSelfGuides,
  ...selfServiceGuides,
  ...companyGuides,
  ...projectGuides,
  ...projectToolGuides,
  ...hrPeopleGuides,
  ...hrOperationsGuides,
  ...adminGuides,
]

export function getGuide(slug: string): HelpGuide | undefined {
  return HELP_GUIDES.find((g) => g.slug === slug)
}

/** The Help home page's sections, mirroring the sidebar. */
export const HELP_GROUPS: { id: HelpGroup; title: L10n; blurb: L10n }[] = [
  {
    id: "start",
    title: { en: "Getting started", hi: "शुरुआत करें" },
    blurb: {
      en: "Signing in, finding your way around, and your profile.",
      hi: "साइन इन करना, ऐप में रास्ता ढूँढना, और आपकी प्रोफाइल।",
    },
  },
  {
    id: "self",
    title: { en: "Your work", hi: "आपका काम" },
    blurb: {
      en: "Attendance, leave, payslips and everything else about you.",
      hi: "हाज़िरी, छुट्टी, सैलरी स्लिप और आपसे जुड़ी बाकी सब चीज़ें।",
    },
  },
  {
    id: "company",
    title: { en: "Company", hi: "कंपनी" },
    blurb: {
      en: "Chat, announcements, documents and the people around you.",
      hi: "चैट, घोषणाएँ, डॉक्युमेंट्स और आपके साथ काम करने वाले लोग।",
    },
  },
  {
    id: "projects",
    title: { en: "Projects", hi: "प्रोजेक्ट्स" },
    blurb: {
      en: "Projects, tasks, reports and clients.",
      hi: "प्रोजेक्ट्स, टास्क, रिपोर्ट्स और क्लाइंट्स।",
    },
  },
  {
    id: "hr",
    title: { en: "HR tools", hi: "HR टूल्स" },
    blurb: {
      en: "Managing people, attendance, leave, payroll and hiring.",
      hi: "लोगों, हाज़िरी, छुट्टी, पेरोल और भर्ती का प्रबंधन।",
    },
  },
  {
    id: "admin",
    title: { en: "Admin", hi: "एडमिन" },
    blurb: {
      en: "Access, settings and the system's records.",
      hi: "एक्सेस, सेटिंग्स और सिस्टम के रिकॉर्ड।",
    },
  },
]
