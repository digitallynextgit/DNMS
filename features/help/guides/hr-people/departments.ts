import { Network } from "lucide-react"
import { PERMISSIONS } from "@/lib/constants"
import type { HelpGuide } from "../../types"

export const departmentsGuide: HelpGuide = {
  slug: "departments",
  group: "hr",
  icon: Network,
  href: "/employees/departments",
  title: { en: "Departments", hi: "डिपार्टमेंट्स (Departments)" },
  summary: {
    en: "See how the company is organised into departments and sub-departments, who is in each, and add, rename, move or close them.",
    hi: "देखें कंपनी किन departments और sub-departments में बँटी है, किसमें कौन है, और उन्हें जोड़ें, नाम बदलें, दूसरी जगह ले जाएँ या बंद करें।",
  },
  keywords: [
    "department",
    "sub-department",
    "team",
    "structure",
    "organisation",
    "headcount",
    "डिपार्टमेंट",
    "विभाग",
    "टीम",
  ],
  sections: [
    {
      id: "board",
      title: { en: "Read the departments board", hi: "Departments बोर्ड समझें" },
      intro: {
        en: "Departments go up to three levels deep: department, sub-department and sub-sub-department. Each top-level department has its own card, with everything under it listed inside.",
        hi: "Departments तीन लेवल तक जाते हैं: department, sub-department और sub-sub-department। हर top-level department का अपना कार्ड होता है, और उसके नीचे का सब कुछ उसी कार्ड में दिखता है।",
      },
      steps: [
        {
          text: {
            en: "In the sidebar, open Employees and click Departments. The boxes at the top count each level, such as Sub-departments (1), and the active employees in them.",
            hi: "साइडबार में Employees खोलें और Departments पर क्लिक करें। ऊपर के बॉक्स हर लेवल की गिनती दिखाते हैं, जैसे Sub-departments (1), और उनमें कितने active employees हैं।",
          },
          shot: {
            id: "departments-board",
            as: "hr",
            path: "/employees/departments",
            highlight: [
              { text: "Sub-departments", exact: true },
              { role: "link", name: "employees in Creative" },
              { placeholder: "Search departments..." },
            ],
          },
        },
        {
          text: {
            en: "Every item has an outline number: 1 for a department, 1.2 for its second sub-department, and 1.2.1 for the one below that. Items are numbered in alphabetical order, so the numbers can shift when you add a new one.",
            hi: "हर आइटम का एक नंबर होता है: department के लिए 1, उसके दूसरे sub-department के लिए 1.2, और उसके नीचे वाले के लिए 1.2.1। नंबर अल्फाबेटिकल क्रम में लगते हैं, इसलिए नया जोड़ने पर नंबर बदल सकते हैं।",
          },
        },
        {
          text: {
            en: "The people icon with a number (2) is the headcount. Click it to open the Employee Directory showing exactly those people. To find a department, type in the search box (3) - the matching part of the name is highlighted.",
            hi: "लोगों वाले आइकन के साथ लिखा नंबर (2) headcount है। उस पर क्लिक करें तो Employee Directory में सिर्फ वही लोग दिखेंगे। कोई department ढूँढना हो तो सर्च बॉक्स (3) में टाइप करें - नाम का मिलता हुआ हिस्सा हाइलाइट हो जाता है।",
          },
        },
      ],
      tips: [
        {
          en: "A department's headcount includes everyone in its sub-departments. Point at the number to see how many sit directly in it.",
          hi: "किसी department के headcount में उसके sub-departments के सभी लोग शामिल होते हैं। नंबर पर माउस ले जाएँ तो दिखेगा कि सीधे उसमें कितने लोग हैं।",
        },
        {
          en: "Inactive departments stay on the board, faded, with an Inactive tag.",
          hi: "Inactive departments बोर्ड पर हल्के रंग में, Inactive टैग के साथ दिखते रहते हैं।",
        },
      ],
    },
    {
      id: "add",
      title: {
        en: "Add a department or sub-department",
        hi: "Department या sub-department जोड़ें",
      },
      permission: PERMISSIONS.EMPLOYEE_WRITE,
      steps: [
        {
          text: {
            en: "Click Add Department at the top right.",
            hi: "ऊपर दाईं ओर Add Department पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Type the Name (1). In Sits under (2), leave Nothing - it is a top-level department for a new main department, or pick the department it belongs under. Click Create (3).",
            hi: "Name (1) टाइप करें। Sits under (2) में, नए main department के लिए Nothing - it is a top-level department रहने दें, या वो department चुनें जिसके नीचे ये आएगा। Create (3) पर क्लिक करें।",
          },
          shot: {
            id: "departments-add-dialog",
            as: "hr",
            path: "/employees/departments",
            actions: [{ click: { role: "button", name: "Add Department" } }],
            highlight: [
              { label: "Name" },
              { label: "Sits under" },
              { role: "button", name: "Create" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "A quicker way for a sub-department: click Add sub-department at the bottom of a department's card. Sits under is already filled in for you.",
            hi: "Sub-department के लिए आसान तरीका: department के कार्ड में सबसे नीचे Add sub-department पर क्लिक करें। Sits under पहले से भरा होता है।",
          },
        },
      ],
      tips: [
        {
          en: "Departments go three levels deep at most, so nothing can be added under a sub-sub-department.",
          hi: "Departments ज़्यादा से ज़्यादा तीन लेवल तक जाते हैं, इसलिए sub-sub-department के नीचे कुछ नहीं जोड़ा जा सकता।",
        },
      ],
    },
    {
      id: "manage",
      title: {
        en: "Rename, move, deactivate or delete",
        hi: "नाम बदलें, दूसरी जगह ले जाएँ, deactivate या delete करें",
      },
      permission: PERMISSIONS.EMPLOYEE_WRITE,
      steps: [
        {
          text: {
            en: "Click the three-dot button next to any department, sub-department or sub-sub-department. The menu has an Add option for the level below (1), Edit (2) and Deactivate (3). When it has people, there is also a View option with the headcount, such as View 6 employees.",
            hi: "किसी भी department, sub-department या sub-sub-department के बगल में तीन डॉट वाले बटन पर क्लिक करें। मेन्यू में नीचे वाला लेवल जोड़ने का Add ऑप्शन (1), Edit (2) और Deactivate (3) होते हैं। अगर उसमें लोग हैं, तो headcount के साथ एक View ऑप्शन भी होता है, जैसे View 6 employees।",
          },
          shot: {
            id: "departments-actions-menu",
            as: "hr",
            path: "/employees/departments",
            actions: [{ click: { role: "button", name: "Actions for Creative" } }],
            highlight: [
              { role: "menuitem", name: "Add sub-department" },
              { role: "menuitem", name: "Edit" },
              { role: "menuitem", name: "Deactivate" },
            ],
          },
        },
        {
          text: {
            en: "To rename it, click Edit, change the Name and click Save Changes. To move it, pick a different department in Sits under - everything below it moves along. Sits under only offers places where it still fits within three levels.",
            hi: "नाम बदलने के लिए Edit पर क्लिक करें, Name बदलें और Save Changes पर क्लिक करें। दूसरी जगह ले जाने के लिए Sits under में दूसरा department चुनें - इसके नीचे का सब कुछ भी साथ चला जाता है। Sits under में सिर्फ वही जगहें आती हैं जहाँ ये तीन लेवल के अंदर फिट हो।",
          },
        },
        {
          text: {
            en: "To stop using a department, click Deactivate. If it has sub-departments, DNMS asks you first, because they are deactivated too. Employees stay assigned, and you can click Activate later.",
            hi: "किसी department का इस्तेमाल बंद करना है तो Deactivate पर क्लिक करें। अगर उसके sub-departments हैं, तो DNMS पहले पूछता है, क्योंकि वो भी deactivate हो जाते हैं। Employees उसी में रहते हैं, और बाद में Activate पर क्लिक कर सकते हैं।",
          },
        },
        {
          text: {
            en: "Delete only shows in the menu when the department is empty - no employees, no job postings and no sub-departments. Deleting can't be undone.",
            hi: "Delete मेन्यू में तभी दिखता है जब department खाली हो - कोई employee नहीं, कोई job posting नहीं और कोई sub-department नहीं। Delete को वापस नहीं किया जा सकता।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "Why is Delete missing from the menu?",
            hi: "मेन्यू में Delete क्यों नहीं दिख रहा?",
          },
          a: {
            en: "The department still has employees, job postings or sub-departments. Move them out first, or deactivate the department instead.",
            hi: "उस department में अभी भी employees, job postings या sub-departments हैं। पहले उन्हें कहीं और ले जाएँ, या department को deactivate कर दें।",
          },
        },
        {
          q: {
            en: "I can't activate a sub-department. Why?",
            hi: "मैं sub-department को activate नहीं कर पा रहा। क्यों?",
          },
          a: {
            en: "The department above it is inactive. Activate that one first.",
            hi: "उसके ऊपर वाला department inactive है। पहले उसे activate करें।",
          },
        },
      ],
    },
  ],
}
