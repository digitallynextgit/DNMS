import { KeyRound } from "lucide-react"
import type { HelpGuide } from "../../types"

export const projectPasswordsGuide: HelpGuide = {
  slug: "project-passwords",
  group: "projects",
  icon: KeyRound,
  href: "/projects/my-projects",
  title: { en: "A project's Passwords tab", hi: "प्रोजेक्ट का Passwords टैब" },
  summary: {
    en: "Keep a client's logins and keys safely in one place, and copy them when you need them. For Account Managers and project admins.",
    hi: "क्लाइंट के लॉगिन और keys एक जगह सुरक्षित रखें, और ज़रूरत पड़ने पर कॉपी करें। ये Account Manager और प्रोजेक्ट एडमिन के लिए है।",
  },
  keywords: [
    "password",
    "passwords",
    "credentials",
    "login",
    "username",
    "vault",
    "copy password",
    "पासवर्ड",
    "लॉगिन",
    "यूज़रनेम",
  ],
  sections: [
    {
      id: "about",
      title: { en: "Who sees this tab", hi: "ये टैब किसे दिखता है" },
      intro: {
        en: "The Passwords tab holds a project's credentials - website logins, API keys, social media accounts. Only the project's Account Manager and project admins see it. Everyone else on the project doesn't see the tab at all.",
        hi: "Passwords टैब में प्रोजेक्ट के credentials रहते हैं - वेबसाइट लॉगिन, API keys, सोशल मीडिया अकाउंट। ये सिर्फ़ प्रोजेक्ट के Account Manager और प्रोजेक्ट एडमिन को दिखता है। प्रोजेक्ट के बाकी लोगों को ये टैब दिखता ही नहीं।",
      },
      tips: [
        {
          en: "Passwords are stored encrypted. A password is only shown when you choose to reveal or copy it.",
          hi: "पासवर्ड encrypted रूप में सेव होते हैं। पासवर्ड तभी दिखता है जब आप उसे reveal या कॉपी करते हैं।",
        },
      ],
    },
    {
      id: "use",
      title: { en: "Find and copy a login", hi: "लॉगिन ढूँढें और कॉपी करें" },
      steps: [
        {
          text: {
            en: "Open the project and click the Passwords tab. Each entry shows its name, website, username and a hidden password.",
            hi: "प्रोजेक्ट खोलें और Passwords टैब पर क्लिक करें। हर एंट्री में उसका नाम, वेबसाइट, username और छुपा हुआ पासवर्ड दिखता है।",
          },
        },
        {
          text: {
            en: "Type in the search box (1) to find an entry by name, username, website or notes.",
            hi: "नाम, username, वेबसाइट या notes से एंट्री ढूँढने के लिए सर्च बॉक्स (1) में लिखें।",
          },
          shot: {
            id: "project-passwords-list",
            as: "manager",
            path: "/projects/sunmeadow-organics-launch?tab=passwords",
            highlight: [
              { placeholder: "Search by name, username, website or notes" },
              { role: "button", name: "Copy username" },
              { role: "button", name: "Reveal" },
              { role: "button", name: "Copy password" },
            ],
          },
        },
        {
          text: {
            en: "Click Copy username (2) next to the username. Click the eye button (3) to reveal the password, and again to hide it. Click Copy password (4) to copy it without showing it on screen.",
            hi: "username के पास Copy username (2) पर क्लिक करें। पासवर्ड देखने के लिए आँख वाले बटन (3) पर क्लिक करें, और छुपाने के लिए फिर से। स्क्रीन पर दिखाए बिना कॉपी करने के लिए Copy password (4) पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Click the website link on an entry to open the site in a new tab.",
            hi: "साइट नए टैब में खोलने के लिए एंट्री पर दिए वेबसाइट लिंक पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "The search looks at names, usernames, websites and notes - never at the passwords themselves.",
          hi: "सर्च नाम, username, वेबसाइट और notes में ढूँढता है - पासवर्ड के अंदर कभी नहीं।",
        },
        {
          en: "If copying fails, your browser has blocked the clipboard. Reveal the password and copy it by hand.",
          hi: "अगर कॉपी नहीं हो रहा, तो आपके ब्राउज़र ने clipboard रोक दिया है। पासवर्ड reveal करके हाथ से कॉपी करें।",
        },
      ],
    },
    {
      id: "add",
      title: { en: "Add a login", hi: "नया लॉगिन जोड़ें" },
      steps: [
        {
          text: {
            en: "Click Add Entry at the top right of the tab.",
            hi: "टैब में ऊपर दाईं ओर Add Entry पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Give it a Label (1) so people know what it is, like Instagram or Website admin. Fill in the Username / Email (2) and the Password (3).",
            hi: "इसे एक Label (1) दें ताकि पता चले ये किसका है, जैसे Instagram या Website admin। Username / Email (2) और Password (3) भरें।",
          },
          shot: {
            id: "project-passwords-add",
            as: "manager",
            path: "/projects/sunmeadow-organics-launch?tab=passwords",
            actions: [{ click: { role: "button", name: "Add Entry" } }],
            highlight: [
              { placeholder: "e.g. Production DB, AWS Root, Figma Team" },
              { placeholder: "admin@example.com" },
              { placeholder: "Enter password" },
              { placeholder: "https://example.com" },
              { role: "button", name: "Save", exact: true },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Add the URL (4) of the site and any Notes, then click Save (5).",
            hi: "साइट का URL (4) और कोई Notes हों तो डालें, फिर Save (5) पर क्लिक करें।",
          },
        },
      ],
    },
    {
      id: "change",
      title: { en: "Change or delete a login", hi: "लॉगिन बदलें या डिलीट करें" },
      steps: [
        {
          text: {
            en: "Click the pencil button on the right of an entry. Change what you need. Leave New Password (leave blank to keep) empty to keep the old password. Click Update.",
            hi: "एंट्री के दाईं ओर पेंसिल बटन पर क्लिक करें। जो बदलना है बदलें। पुराना पासवर्ड रखना है तो New Password (leave blank to keep) खाली छोड़ दें। Update पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "To remove an entry, click the bin button and confirm with Delete.",
            hi: "एंट्री हटाने के लिए bin बटन पर क्लिक करें और Delete से कन्फ़र्म करें।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "I work on the project but can't see the Passwords tab. Why?",
            hi: "मैं प्रोजेक्ट पर काम करता हूँ, फिर भी Passwords टैब नहीं दिख रहा। क्यों?",
          },
          a: {
            en: "Client logins are sensitive, so only the project's Account Manager and project admins can open them. Ask the Account Manager when you need a login.",
            hi: "क्लाइंट के लॉगिन संवेदनशील होते हैं, इसलिए उन्हें सिर्फ़ प्रोजेक्ट का Account Manager और प्रोजेक्ट एडमिन खोल सकते हैं। लॉगिन चाहिए तो Account Manager से पूछें।",
          },
        },
      ],
    },
  ],
}
