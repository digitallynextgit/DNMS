import { Activity } from "lucide-react"
import type { HelpGuide } from "../../types"

// Screens: features/monitoring/components/project-monitoring-tab.tsx and its dialogs.

const MONITORING = "/projects/urbannest-website-seo?tab=monitoring"

export const projectMonitoringGuide: HelpGuide = {
  slug: "project-monitoring",
  group: "projects",
  icon: Activity,
  href: "/projects/my-projects",
  title: {
    en: "Monitoring (uptime and renewals)",
    hi: "मॉनिटरिंग - अपटाइम और रिन्यूअल (Monitoring)",
  },
  summary: {
    en: "Get alerted when the client's website goes down, and get reminded before a domain, SSL certificate, hosting plan or licence runs out.",
    hi: "क्लाइंट की वेबसाइट बंद होने पर अलर्ट पाएँ, और डोमेन, SSL सर्टिफिकेट, होस्टिंग प्लान या लाइसेंस खत्म होने से पहले रिमाइंडर पाएँ।",
  },
  keywords: [
    "monitoring",
    "uptime",
    "website down",
    "outage",
    "alert",
    "renewal",
    "domain",
    "ssl",
    "hosting",
    "licence",
    "license",
    "expiry",
    "वेबसाइट बंद",
    "अलर्ट",
    "रिन्यूअल",
    "डोमेन",
    "एक्सपायरी",
  ],
  sections: [
    {
      id: "about",
      title: { en: "What Monitoring watches", hi: "Monitoring किस पर नज़र रखता है" },
      intro: {
        en: "The Monitoring tab has two parts: Uptime, which checks that the client's site is working, and Renewals, which lists what can expire and take the site down.",
        hi: "Monitoring टैब के दो हिस्से हैं: Uptime, जो चेक करता है कि क्लाइंट की साइट चल रही है, और Renewals, जिसमें वो चीज़ें हैं जो एक्सपायर होकर साइट बंद कर सकती हैं।",
      },
      steps: [
        {
          text: {
            en: "Open the project from My Projects and click the Monitoring tab. The three numbers at the top show sites Down right now (1), items Expiring in 30 days, and items Without an owner.",
            hi: "My Projects से प्रोजेक्ट खोलें और Monitoring टैब पर क्लिक करें। ऊपर के तीन नंबर दिखाते हैं: अभी बंद साइट्स - Down right now (1), 30 दिन में एक्सपायर होने वाली चीज़ें - Expiring in 30 days, और बिना ज़िम्मेदार वाली चीज़ें - Without an owner।",
          },
          shot: {
            id: "project-monitoring-tab",
            as: "employee",
            path: MONITORING,
            highlight: [
              { text: "Down right now", exact: true },
              { role: "button", name: "Watch a URL" },
              { role: "button", name: "Add renewal" },
            ],
          },
        },
      ],
      tips: [
        {
          en: "Everyone on the project team can use this tab - the people working on the site are the ones who need to know when it is down.",
          hi: "प्रोजेक्ट टीम का हर व्यक्ति ये टैब इस्तेमाल कर सकता है - साइट पर काम करने वालों को ही सबसे पहले पता होना चाहिए कि वो बंद है।",
        },
      ],
    },
    {
      id: "uptime",
      title: { en: "Watch a website", hi: "वेबसाइट पर नज़र रखें" },
      steps: [
        {
          text: {
            en: "Click Watch a URL (2 in the first picture). Type the URL (1), starting with https://. Add a Label (2) - it is shown in the alerts. Pick an Owner (3), or leave it on Project team. Keep Active ticked and click Start watching (4).",
            hi: "Watch a URL (पहली तस्वीर में 2) पर क्लिक करें। URL (1) लिखें, https:// के साथ। Label (2) डालें - ये अलर्ट में दिखता है। Owner (3) चुनें, या Project team ही रहने दें। Active पर टिक रहने दें और Start watching (4) पर क्लिक करें।",
          },
          shot: {
            id: "project-monitoring-watch",
            as: "employee",
            path: MONITORING,
            actions: [{ click: { role: "button", name: "Watch a URL" } }],
            highlight: [
              { placeholder: "https://example.com" },
              { placeholder: "Storefront" },
              { label: "Owner" },
              { role: "button", name: "Start watching" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "DNMS checks the site every 5 minutes. Any normal answer from the site counts as up, and two failed checks in a row count as an outage.",
            hi: "DNMS हर 5 मिनट में साइट चेक करता है। साइट से कोई भी सामान्य जवाब आए तो वो चालू मानी जाती है, और लगातार दो बार चेक फेल हो तो उसे आउटेज माना जाता है।",
          },
        },
        {
          text: {
            en: "When a site is down, its card turns red and shows how long it has been down. Alerts go to the whole project team and escalate every 30 minutes until someone clicks I'm on it (1). That tells everyone you are handling it and stops the escalation.",
            hi: "साइट बंद होने पर उसका कार्ड लाल हो जाता है और दिखाता है कि कितनी देर से बंद है। अलर्ट पूरी प्रोजेक्ट टीम को जाते हैं और हर 30 मिनट में आगे बढ़ते रहते हैं, जब तक कोई I'm on it (1) पर क्लिक न करे। इससे सबको पता चलता है कि आप इसे देख रहे हैं, और अलर्ट आगे बढ़ना रुक जाता है।",
          },
          shot: {
            id: "project-monitoring-down",
            as: "employee",
            path: MONITORING,
            highlight: [{ role: "button", name: "I'm on it" }],
          },
        },
        {
          text: {
            en: "Edit changes a monitor - untick Active to pause it for a while. The bin icon stops watching the URL and deletes its outage history.",
            hi: "Edit से मॉनिटर बदलें - कुछ समय के लिए रोकना हो तो Active से टिक हटा दें। डिब्बे वाला आइकन URL पर नज़र रखना बंद करता है और उसकी आउटेज हिस्ट्री मिटा देता है।",
          },
        },
      ],
    },
    {
      id: "renewals",
      title: { en: "Track renewals", hi: "रिन्यूअल ट्रैक करें" },
      steps: [
        {
          text: {
            en: "Click Add renewal. Pick the Type (1): Domain, SSL certificate, Hosting / plan, Licence or Other. Type the Name, like the domain name (2), and the Provider, and pick the Expires on date.",
            hi: "Add renewal पर क्लिक करें। Type (1) चुनें: Domain, SSL certificate, Hosting / plan, Licence या Other। Name लिखें, जैसे डोमेन का नाम (2), और Provider लिखें, फिर Expires on तारीख चुनें।",
          },
          shot: {
            id: "project-monitoring-renewal",
            as: "employee",
            path: MONITORING,
            actions: [{ click: { role: "button", name: "Add renewal" } }],
            highlight: [
              { label: "Type" },
              { placeholder: "digitallynext.com" },
              { label: "Owner" },
              { text: "Auto-renew is enabled" },
              { role: "button", name: "Add to register" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Pick an Owner (3) - the one person accountable for renewing it. Fill in Paid by (which card or account pays) and Card expires. Tick Auto-renew is enabled (4) if it renews on its own. Click Add to register (5).",
            hi: "Owner (3) चुनें - वो एक व्यक्ति जो इसे रिन्यू करवाने का ज़िम्मेदार है। Paid by (किस कार्ड या अकाउंट से पेमेंट होता है) और Card expires भरें। अगर ये अपने आप रिन्यू होता है तो Auto-renew is enabled (4) पर टिक करें। Add to register (5) पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Reminders go out 60, 30, 14, 7, 3 and 1 days before the date, then every day once it is overdue. In the list, the Expires date turns amber within 30 days and red within 7. Use the pencil to edit and the bin to remove.",
            hi: "रिमाइंडर तारीख से 60, 30, 14, 7, 3 और 1 दिन पहले जाते हैं, और तारीख निकल जाने पर रोज़। लिस्ट में Expires की तारीख 30 दिन के अंदर पीली और 7 दिन के अंदर लाल हो जाती है। बदलने के लिए पेंसिल और हटाने के लिए डिब्बे वाला आइकन इस्तेमाल करें।",
          },
        },
      ],
      tips: [
        {
          en: "Reminders are sent even when Auto-renew is on. Auto-renew fails too - most often because the card on file has expired, so keep Card expires up to date.",
          hi: "Auto-renew चालू होने पर भी रिमाइंडर आते हैं। Auto-renew भी फेल होता है - ज़्यादातर इसलिए कि सेव किया हुआ कार्ड एक्सपायर हो चुका होता है, इसलिए Card expires हमेशा सही रखें।",
        },
        {
          en: "Every renewal should have an Owner. Anything without one is counted under Without an owner at the top.",
          hi: "हर रिन्यूअल का Owner होना चाहिए। जिसका Owner नहीं है, वो ऊपर Without an owner में गिना जाता है।",
        },
      ],
    },
  ],
}
