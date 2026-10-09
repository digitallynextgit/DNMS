import { Briefcase } from "lucide-react"
import { PERMISSIONS } from "@/lib/constants"
import type { HelpGuide } from "../../types"

export const recruitmentGuide: HelpGuide = {
  slug: "recruitment",
  group: "hr",
  icon: Briefcase,
  href: "/recruitment/applications",
  title: { en: "Recruitment", hi: "भर्ती (Recruitment)" },
  summary: {
    en: "Manage the job openings on the public careers site, move applicants through the hiring stages, and handle employee referrals and their rewards.",
    hi: "पब्लिक careers साइट पर नौकरी की ओपनिंग्स मैनेज करें, आवेदकों को भर्ती के अलग-अलग स्टेज से आगे बढ़ाएँ, और कर्मचारियों के रेफ़रल व उनके इनाम संभालें।",
  },
  keywords: [
    "recruitment",
    "hiring",
    "careers",
    "jobs",
    "job openings",
    "applications",
    "candidates",
    "resume",
    "referral",
    "referral bonus",
    "भर्ती",
    "नौकरी",
    "आवेदन",
    "रेफ़रल",
  ],
  sections: [
    {
      id: "overview",
      title: { en: "The three recruitment pages", hi: "भर्ती के तीन पेज" },
      intro: {
        en: "In the sidebar, under HRMS, open Recruitment. Careers is what candidates see on the public careers site. Applications lists the people who applied there. Referrals lists candidates put forward by employees, and the reward owed on them.",
        hi: "साइडबार में HRMS के नीचे Recruitment खोलें। Careers वो है जो उम्मीदवार पब्लिक careers साइट पर देखते हैं। Applications में वहाँ से अप्लाई करने वाले लोग दिखते हैं। Referrals में वो उम्मीदवार दिखते हैं जिन्हें कर्मचारियों ने रेफ़र किया, और उन पर बनने वाला इनाम।",
      },
    },
    {
      id: "careers",
      title: {
        en: "Manage job openings on the careers site",
        hi: "Careers साइट पर नौकरी की ओपनिंग्स मैनेज करें",
      },
      permission: PERMISSIONS.RECRUITMENT_WRITE,
      intro: {
        en: "The careers site is built like a tree: groups hold sub-departments, sub-departments hold roles, and each role lists its current openings.",
        hi: "Careers साइट एक पेड़ की तरह बनी है: groups के अंदर sub-departments होते हैं, sub-departments के अंदर roles, और हर role में उसकी मौजूदा ओपनिंग्स होती हैं।",
      },
      steps: [
        {
          text: {
            en: "Click Careers. Pick Full-time (1) or Internships (2). Each tile is a group. Click Add group (3) to create one.",
            hi: "Careers पर क्लिक करें। Full-time (1) या Internships (2) चुनें। हर टाइल एक group है। नया group बनाने के लिए Add group (3) पर क्लिक करें।",
          },
          shot: {
            id: "recruitment-careers",
            as: "hr",
            path: "/admin/careers",
            highlight: [
              { role: "tab", name: "Full-time" },
              { role: "tab", name: "Internships" },
              { role: "button", name: "Add group" },
              { role: "switch" },
              { role: "button", name: "Actions", exact: true },
            ],
          },
        },
        {
          text: {
            en: "The switch on a tile (4) says Live or Draft. Only Live items show on the site, so new things can be prepared as Draft first. The three-dot button (5) has Edit and Delete.",
            hi: "टाइल पर बना स्विच (4) Live या Draft दिखाता है। साइट पर सिर्फ़ Live चीज़ें दिखती हैं, इसलिए नई चीज़ें पहले Draft में तैयार की जा सकती हैं। तीन बिंदु वाले बटन (5) में Edit और Delete होते हैं।",
          },
        },
        {
          text: {
            en: "Click a group tile to open its sub-departments, and a sub-department tile to open its roles. Use the path at the top, starting with All groups, to go back.",
            hi: "किसी group टाइल पर क्लिक करें तो उसके sub-departments खुलते हैं, और sub-department टाइल पर क्लिक करें तो उसके roles। वापस जाने के लिए ऊपर All groups से शुरू होने वाला रास्ता इस्तेमाल करें।",
          },
        },
        {
          text: {
            en: "In the roles view, click Add role (1) to add a job, or click a role's name (2) to edit it. Its switch (3) puts it Live or back to Draft.",
            hi: "Roles वाले व्यू में नई नौकरी जोड़ने के लिए Add role (1) पर क्लिक करें, या बदलने के लिए किसी role के नाम (2) पर क्लिक करें। उसका स्विच (3) उसे Live या वापस Draft करता है।",
          },
          shot: {
            id: "recruitment-careers-roles",
            as: "hr",
            path: "/admin/careers",
            // Creative > Design > Graphic Designer, from prisma/demo/recruitment.ts.
            actions: [
              { click: { role: "button", name: "Creative" } },
              { waitFor: { role: "button", name: "Add sub-department" } },
              { click: { role: "button", name: "Design" } },
              { waitFor: { role: "button", name: "Add role" } },
            ],
            highlight: [
              { role: "button", name: "Add role" },
              { role: "button", name: "Graphic Designer" },
              { role: "switch" },
            ],
          },
        },
        {
          text: {
            en: "In the role form, fill the Title, Intro, Job essence and Key requirements (one per line). When you edit a role, Current openings lets you type an opening, like Junior SEO Executive (1-2 Years Exp), and click Add. Openings save straight away.",
            hi: "Role के फॉर्म में Title, Intro, Job essence और Key requirements (हर लाइन में एक) भरें। Role एडिट करते समय Current openings में कोई ओपनिंग लिखें, जैसे Junior SEO Executive (1-2 Years Exp), और Add पर क्लिक करें। ओपनिंग्स तुरंत सेव हो जाती हैं।",
          },
        },
      ],
      tips: [
        {
          en: "Deleting a group removes everything under it, and deleting a role removes its openings. To hide something for a while, switch it to Draft instead.",
          hi: "Group डिलीट करने से उसके अंदर का सब कुछ हट जाता है, और role डिलीट करने से उसकी ओपनिंग्स। कुछ समय के लिए छिपाना हो तो डिलीट करने की बजाय उसे Draft कर दें।",
        },
      ],
    },
    {
      id: "applications",
      title: { en: "Review applications", hi: "आवेदन देखें" },
      steps: [
        {
          text: {
            en: "Click Applications. You see everyone who applied on the careers site, newest first. The red badge at the top counts new ones.",
            hi: "Applications पर क्लिक करें। careers साइट पर अप्लाई करने वाले सभी लोग दिखते हैं, सबसे नए सबसे ऊपर। ऊपर का लाल बैज नए आवेदनों की गिनती बताता है।",
          },
        },
        {
          text: {
            en: "Find people by status in the Status menu (1), with Search name, email or role… (2), or by Full-time / Internship (3). Re-applied means the person applied before. Role closed means the role was closed before they applied. Click View (4) to open an application.",
            hi: "Status मेन्यू (1) में status से, Search name, email or role… (2) से, या Full-time / Internship (3) से लोगों को ढूँढें। Re-applied का मतलब है व्यक्ति पहले भी अप्लाई कर चुका है। Role closed का मतलब है उनके अप्लाई करने से पहले role बंद हो चुका था। आवेदन खोलने के लिए View (4) पर क्लिक करें।",
          },
          shot: {
            id: "recruitment-applications",
            as: "hr",
            path: "/recruitment/applications",
            highlight: [
              { role: "button", name: "Status: All" },
              { placeholder: "Search name, email or role…" },
              { text: "All types", exact: true },
              { role: "button", name: "View", exact: true },
            ],
          },
        },
        {
          text: {
            en: "The panel shows the role, contact details, the Resume / CV (2) and the candidate's message. Move the candidate along with the Status box (1): New, In review, Shortlisted, then Hired or Rejected. It saves as soon as you pick.",
            hi: "पैनल में role, संपर्क की जानकारी, Resume / CV (2) और उम्मीदवार का मैसेज दिखता है। Status बॉक्स (1) से उम्मीदवार को आगे बढ़ाएँ: New, In review, Shortlisted, फिर Hired या Rejected। चुनते ही सेव हो जाता है।",
          },
          shot: {
            id: "recruitment-application-panel",
            as: "hr",
            path: "/recruitment/applications",
            actions: [
              { click: { role: "button", name: "View", exact: true } },
              { waitFor: { role: "dialog" } },
            ],
            highlight: [
              { css: "[role=dialog] [role=combobox]" },
              { role: "link", name: "Resume / CV" },
              { role: "textbox", name: "Notes for the hiring team" },
              { role: "button", name: "Save notes" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Write notes for the team in Internal notes (3) and click Save notes (4). The candidate never sees them.",
            hi: "टीम के लिए Internal notes (3) में नोट्स लिखें और Save notes (4) पर क्लिक करें। उम्मीदवार इन्हें कभी नहीं देखता।",
          },
        },
      ],
      tips: [
        {
          en: "The status and type you pick stay in the page link, so you can share a filtered list with a colleague.",
          hi: "आप जो status और type चुनते हैं, वो पेज के लिंक में बने रहते हैं, इसलिए फ़िल्टर की हुई लिस्ट किसी साथी को भेज सकते हैं।",
        },
        {
          en: "Only HR Managers and Admins see the bin to delete an application. Deleting removes it for good.",
          hi: "आवेदन डिलीट करने का डस्टबिन सिर्फ़ HR Manager और Admin को दिखता है। डिलीट करने पर वो हमेशा के लिए हट जाता है।",
        },
        {
          en: "To download applications as a spreadsheet, with each person's email and phone, click Export above the table and pick CSV file or Excel file. It downloads the rows on the current page, or only the rows you have ticked.",
          hi: "आवेदनों को spreadsheet में डाउनलोड करने के लिए - हर व्यक्ति के ईमेल और फ़ोन के साथ - टेबल के ऊपर Export पर क्लिक करें और CSV file या Excel file चुनें। इसमें चालू पेज की लाइनें आती हैं, या सिर्फ़ वो लाइनें जो आपने टिक की हैं।",
        },
      ],
    },
    {
      id: "referrals",
      title: { en: "Handle referrals and rewards", hi: "रेफ़रल और इनाम संभालें" },
      permission: PERMISSIONS.RECRUITMENT_WRITE,
      intro: {
        en: "A referral is an application that names an employee who referred the candidate. The employee gets a reward - a share of the new hire's monthly salary - once the hire completes one year.",
        hi: "रेफ़रल ऐसा आवेदन है जिसमें उस कर्मचारी का नाम होता है जिसने उम्मीदवार को रेफ़र किया। नया व्यक्ति एक साल पूरा कर ले, तो रेफ़र करने वाले कर्मचारी को इनाम मिलता है - नए व्यक्ति की महीने की सैलरी का एक हिस्सा।",
      },
      steps: [
        {
          text: {
            en: "Click Referrals. Each card shows the candidate, their stage, the role, and who referred them. On the right you see the hire, when the reward becomes due, and the amount.",
            hi: "Referrals पर क्लिक करें। हर कार्ड में उम्मीदवार, उसका स्टेज, role, और किसने रेफ़र किया, यह दिखता है। दाईं ओर नया कर्मचारी, इनाम कब बनेगा, और रकम दिखती है।",
          },
        },
        {
          text: {
            en: "When the candidate joins, click Link hire (1) and pick the employee record made for them. Their joining date starts the one-year clock.",
            hi: "उम्मीदवार जॉइन कर ले, तो Link hire (1) पर क्लिक करें और उसके लिए बना employee record चुनें। उसकी जॉइनिंग की तारीख से एक साल की गिनती शुरू होती है।",
          },
          shot: {
            id: "recruitment-referrals",
            as: "hr",
            path: "/admin/referrals",
            highlight: [{ role: "button", name: "Link hire" }],
          },
        },
        {
          text: {
            en: "When a card says reward due now, pay the referrer, then click Mark paid and confirm. This only records the payout and tells the referrer - it does not send money.",
            hi: "जब किसी कार्ड पर reward due now लिखा आए, तो रेफ़र करने वाले को भुगतान करें, फिर Mark paid पर क्लिक करके कन्फ़र्म करें। इससे सिर्फ़ भुगतान दर्ज होता है और रेफ़र करने वाले को बताया जाता है - कोई पैसा नहीं भेजा जाता।",
          },
        },
      ],
      tips: [
        {
          en: "Change a referral's stage on the Applications page - referrals are applications too.",
          hi: "रेफ़रल का स्टेज Applications पेज पर बदलें - रेफ़रल भी आवेदन ही हैं।",
        },
        {
          en: "The amount shows only after the hire has a salary structure.",
          hi: "रकम तभी दिखती है जब नए कर्मचारी का salary structure बन चुका हो।",
        },
        {
          en: "A yellow warning at the top means a candidate typed an employee ID that matches nobody - a typo or an old number. The application is saved either way.",
          hi: "ऊपर पीली चेतावनी का मतलब है किसी उम्मीदवार ने ऐसी employee ID लिखी जो किसी से मेल नहीं खाती - टाइपिंग की गलती या पुराना नंबर। आवेदन फिर भी सेव रहता है।",
        },
      ],
    },
  ],
}
