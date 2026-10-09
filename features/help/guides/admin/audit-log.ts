import { ScrollText } from "lucide-react"
import type { HelpGuide } from "../../types"

export const auditLogGuide: HelpGuide = {
  slug: "audit-log",
  group: "admin",
  icon: ScrollText,
  href: "/admin/audit-log",
  title: { en: "Audit Log", hi: "ऑडिट लॉग (Audit Log)" },
  summary: {
    en: 'See who changed what in DNMS, and when - handy whenever someone asks "who changed this?".',
    hi: 'देखें DNMS में किसने क्या बदला और कब - जब भी कोई पूछे "ये किसने बदला?", तब ये बहुत काम आता है।',
  },
  keywords: [
    "audit",
    "log",
    "history",
    "activity",
    "who changed",
    "trail",
    "record",
    "sign in",
    "ऑडिट",
    "लॉग",
    "इतिहास",
    "रिकॉर्ड",
    "किसने बदला",
  ],
  sections: [
    {
      id: "read",
      title: { en: "Read the log", hi: "लॉग पढ़ें" },
      intro: {
        en: "Each time someone makes an important change, DNMS adds one line here. The newest lines are at the top, 10 to a page.",
        hi: "जब भी कोई ज़रूरी बदलाव करता है, DNMS यहाँ एक लाइन जोड़ देता है। सबसे नई लाइनें सबसे ऊपर होती हैं, एक पेज पर 10।",
      },
      steps: [
        {
          text: {
            en: "Click Audit Log in the sidebar. Each row shows the Timestamp (date and time), the Actor (who did it, with their employee code), the Action, the Module (which part of DNMS), the Entity (what kind of record changed) and the IP Address (the internet address it came from), when that was saved.",
            hi: "साइडबार में Audit Log पर क्लिक करें। हर लाइन में दिखता है: Timestamp (तारीख और समय), Actor (किसने किया, उनके एम्प्लॉई कोड के साथ), Action, Module (DNMS का कौन सा हिस्सा), Entity (किस तरह का रिकॉर्ड बदला) और IP Address (किस इंटरनेट एड्रेस से हुआ) - अगर वो सेव हुआ हो।",
          },
          shot: {
            id: "audit-log-table",
            as: "admin",
            path: "/admin/audit-log",
            crop: { role: "table" },
          },
        },
        {
          text: {
            en: "Action is a short code for what happened, like CREATE, UPDATE, role:update or auth:login (someone signed in). Read it together with the Module to understand the line - for example, UPDATE under leave means something about leave was changed.",
            hi: "Action एक छोटा कोड है जो बताता है क्या हुआ, जैसे CREATE, UPDATE, role:update या auth:login (किसी ने साइन इन किया)। लाइन समझने के लिए इसे Module के साथ पढ़ें - जैसे leave में UPDATE का मतलब है कि छुट्टी से जुड़ा कुछ बदला गया।",
          },
        },
        {
          text: {
            en: "Click Refresh at the top right to load the newest lines. Use the Next page and Previous page arrows under the table to go further back.",
            hi: "सबसे नई लाइनें देखने के लिए ऊपर दाईं ओर Refresh पर क्लिक करें। और पीछे की लाइनें देखने के लिए टेबल के नीचे Next page और Previous page वाले तीर इस्तेमाल करें।",
          },
        },
      ],
      tips: [
        {
          en: "Actor shows System when no person is linked to the line - for example, an automatic job, or a person whose record was later deleted.",
          hi: "अगर लाइन से कोई व्यक्ति जुड़ा न हो, तो Actor में System दिखता है - जैसे कोई ऑटोमैटिक काम, या ऐसा व्यक्ति जिसका रिकॉर्ड बाद में डिलीट हो गया।",
        },
        {
          en: "Entity shows the record type and the first 8 characters of its ID - enough to tell two lines about different records apart.",
          hi: "Entity में रिकॉर्ड का टाइप और उसकी ID के पहले 8 अक्षर दिखते हैं - इतना काफी है ये पहचानने के लिए कि दो लाइनें अलग-अलग रिकॉर्ड की हैं।",
        },
      ],
    },
    {
      id: "filter",
      title: { en: "Find a specific change", hi: "कोई खास बदलाव ढूँढें" },
      steps: [
        {
          text: {
            en: "Use the filters at the top of the table. Pick a module in the first box (1), type part of an action in Filter by action (2), or pick a From date (3) and a To date (4).",
            hi: "टेबल में सबसे ऊपर वाले फ़िल्टर इस्तेमाल करें। पहले बॉक्स (1) में मॉड्यूल चुनें, Filter by action (2) में action का कोई हिस्सा टाइप करें, या From date (3) और To date (4) चुनें।",
          },
          shot: {
            id: "audit-log-filters",
            as: "admin",
            path: "/admin/audit-log",
            highlight: [
              { role: "combobox" },
              { role: "textbox", name: "Filter by action" },
              { role: "button", name: "From date" },
              { role: "button", name: "To date" },
            ],
          },
        },
        {
          text: {
            en: "For example, type role (1) to see only role changes - the list updates as you type. The count under the table says how many entries match. Click Clear filters (2) to see everything again.",
            hi: "जैसे, role (1) टाइप करें - सिर्फ़ रोल के बदलाव दिखेंगे, लिस्ट टाइप करते ही बदल जाती है। टेबल के नीचे वाली गिनती बताती है कि कितनी एंट्री मिलीं। सब कुछ फिर से देखने के लिए Clear filters (2) पर क्लिक करें।",
          },
          shot: {
            id: "audit-log-filter-role",
            as: "admin",
            path: "/admin/audit-log",
            actions: [
              { fill: { role: "textbox", name: "Filter by action" }, value: "role" },
              { waitFor: { role: "button", name: "Clear filters" } },
            ],
            highlight: [
              { role: "textbox", name: "Filter by action" },
              { role: "button", name: "Clear filters" },
            ],
          },
        },
      ],
      tips: [
        {
          en: "The action search ignores capital letters and matches any part of the code - delete finds DELETE, HARD_DELETE and role:delete alike.",
          hi: "Action वाली सर्च में कैपिटल या छोटे अक्षर से फ़र्क नहीं पड़ता, और कोड का कोई भी हिस्सा मिल जाता है - delete लिखने पर DELETE, HARD_DELETE और role:delete सब मिल जाएँगे।",
        },
        {
          en: "To date includes the whole of that day.",
          hi: "To date में चुना गया पूरा दिन शामिल होता है।",
        },
        {
          en: "Changes made on the Integrations and Storage pages are filed under the Admin module, and sign-ins under the Auth module.",
          hi: "Integrations और Storage पेज पर किए गए बदलाव Admin मॉड्यूल में मिलते हैं, और साइन इन Auth मॉड्यूल में।",
        },
      ],
    },
    {
      id: "what-is-recorded",
      title: { en: "What gets recorded", hi: "क्या-क्या दर्ज होता है" },
      intro: {
        en: "The log is for changes. Changes to roles and who holds them, settings and storage, employee records and documents, leave, WFH, attendance, payroll, performance, resignations, onboarding and exits, projects, tasks and clients, announcements and the photo gallery are written here - and so are sign-ins.",
        hi: "ये लॉग बदलावों के लिए है। रोल और किसके पास कौन सा रोल है, सेटिंग्स और स्टोरेज, कर्मचारियों के रिकॉर्ड और डॉक्युमेंट्स, छुट्टी, WFH, हाज़िरी, पेरोल, परफॉर्मेंस, इस्तीफ़े, ऑनबोर्डिंग और एग्ज़िट, प्रोजेक्ट्स, टास्क और क्लाइंट्स, घोषणाएँ और फोटो गैलरी - इन सबके बदलाव यहाँ दर्ज होते हैं, और साइन इन भी।",
      },
      tips: [
        {
          en: "Just opening or reading a page is not recorded.",
          hi: "सिर्फ़ कोई पेज खोलना या पढ़ना दर्ज नहीं होता।",
        },
        {
          en: "Passwords and secret keys are never written to the log. For settings, only the names of the fields that changed are saved, not their values.",
          hi: "पासवर्ड और सीक्रेट keys कभी लॉग में नहीं लिखे जाते। सेटिंग्स के लिए सिर्फ़ बदले गए फ़ील्ड के नाम सेव होते हैं, उनकी वैल्यू नहीं।",
        },
        {
          en: "Lines can't be edited or deleted from this page, so the log stays a true record.",
          hi: "इस पेज से लाइनें न बदली जा सकती हैं, न डिलीट की जा सकती हैं, ताकि लॉग एक सच्चा रिकॉर्ड बना रहे।",
        },
      ],
      faq: [
        {
          q: { en: "Who can see the Audit Log?", hi: "Audit Log कौन देख सकता है?" },
          a: {
            en: "Anyone whose role has the audit:read permission - by default, Admin and HR Manager.",
            hi: "जिसके रोल में audit:read परमिशन हो - शुरुआत में Admin और HR Manager के पास होती है।",
          },
        },
        {
          q: {
            en: "Why is the IP Address empty on some lines?",
            hi: "कुछ लाइनों में IP Address खाली क्यों है?",
          },
          a: {
            en: "Not every kind of change saves the IP address. A dash (-) only means it wasn't saved for that line.",
            hi: "हर तरह के बदलाव के साथ IP एड्रेस सेव नहीं होता। डैश (-) का मतलब बस इतना है कि उस लाइन के लिए ये सेव नहीं हुआ।",
          },
        },
      ],
    },
  ],
}
