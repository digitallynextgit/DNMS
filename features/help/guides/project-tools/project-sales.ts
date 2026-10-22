import { Handshake } from "lucide-react"
import type { HelpGuide } from "../../types"

// Screens: features/sales/components/* (the Sales tab, its lead drawer and dialogs).

export const projectSalesGuide: HelpGuide = {
  slug: "project-sales",
  group: "projects",
  icon: Handshake,
  href: "/projects/my-projects",
  title: { en: "Sales (leads)", hi: "सेल्स - लीड्स (Sales)" },
  summary: {
    en: "Keep the businesses a client can sell to - hostels, PGs, hotels - as leads, and work each one from New to Won with calls, WhatsApps and follow-up dates.",
    hi: "जिन businesses को क्लाइंट बेच सकता है - hostel, PG, hotel - उन्हें leads की तरह रखें, और हर एक को calls, WhatsApp और follow-up dates के साथ New से Won तक ले जाएँ।",
  },
  keywords: [
    "sales",
    "leads",
    "pipeline",
    "prospects",
    "follow up",
    "whatsapp",
    "import leads",
    "bd",
    "सेल्स",
    "लीड",
    "फॉलो अप",
  ],
  sections: [
    {
      id: "about",
      title: { en: "Where the Sales tab is", hi: "Sales टैब कहाँ है" },
      intro: {
        en: "A project with the BD / Sales service ticked has a Sales tab next to Mailer. Everyone on the project can see the leads; the Account Managers, project admins and the BD / Sales owner add, import, assign and delete them, and each lead's assignee works it.",
        hi: "जिस प्रोजेक्ट में BD / Sales service टिक है, उसमें Mailer के पास Sales टैब होता है। प्रोजेक्ट के सभी लोग leads देख सकते हैं; Account Managers, project admins और BD / Sales owner उन्हें add, import, assign और delete करते हैं, और हर lead पर उसका assignee काम करता है।",
      },
      steps: [
        {
          text: {
            en: "Click Add lead to enter one business, or Import to bring in an Excel or CSV file. The import guesses which column is the name, phone, area and so on - check it, and leads already in the list (the same phone, or the same business in the same area) are skipped.",
            hi: "एक business डालने के लिए Add lead, या Excel या CSV फ़ाइल लाने के लिए Import पर क्लिक करें। Import अंदाज़ा लगाता है कि कौन सा column नाम, फ़ोन, एरिया वगैरह है - उसे जाँच लें; जो leads पहले से हैं (वही फ़ोन, या उसी एरिया में वही business) वो छोड़ दी जाती हैं।",
          },
        },
        {
          text: {
            en: "Switch between Table and Board. Leads move through New, Contacted, Interested, Site visit / demo, Quotation sent, then Won or Lost. Filter by stage or by whose they are, and search by name, area or phone.",
            hi: "Table और Board के बीच बदलें। Leads New, Contacted, Interested, Site visit / demo, Quotation sent से होकर Won या Lost तक जाती हैं। Stage या किसकी lead है उससे filter करें, और नाम, एरिया या फ़ोन से search करें।",
          },
        },
        {
          text: {
            en: "Click a lead to open it. Call and WhatsApp open straight from there. After talking to them, use Log what happened: pick Call, WhatsApp, Email, Visit or Note, write what was said, move the stage if it changed and set the next follow-up.",
            hi: "Lead खोलने के लिए उस पर क्लिक करें। Call और WhatsApp वहीं से खुलते हैं। बात करने के बाद Log what happened इस्तेमाल करें: Call, WhatsApp, Email, Visit या Note चुनें, क्या बात हुई लिखें, stage बदली हो तो बदलें और अगला follow-up तय करें।",
          },
        },
      ],
      tips: [
        {
          en: "On the follow-up day the lead's assignee gets a reminder - or, if nobody is assigned, the BD / Sales owner.",
          hi: "Follow-up वाले दिन lead के assignee को reminder मिलता है - या, अगर कोई assign नहीं है, तो BD / Sales owner को।",
        },
        {
          en: "If someone asks not to be contacted, edit the lead and turn on Do not contact: Call and WhatsApp switch off and no reminders go out. Bulk SMS or WhatsApp messages need DLT registration or the person's opt-in.",
          hi: "अगर कोई कहे कि उनसे संपर्क न किया जाए, तो lead edit करके Do not contact चालू करें: Call और WhatsApp बंद हो जाते हैं और कोई reminder नहीं जाता। एक साथ कई SMS या WhatsApp भेजने के लिए DLT registration या उस व्यक्ति की सहमति ज़रूरी है।",
        },
      ],
    },
  ],
}
