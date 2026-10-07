import { DoorOpen } from "lucide-react"
import { PERMISSIONS } from "@/lib/constants"
import type { HelpAction, HelpGuide } from "../../types"

/** From /exit-clearance: open the (only) leaver's checklist - Pooja Bansal in the demo. */
const OPEN_EXIT: HelpAction[] = [
  { click: { role: "button", name: "Open", exact: true } },
  { waitFor: { role: "button", name: "Complete exit" } },
]

export const exitClearanceGuide: HelpGuide = {
  slug: "exit-clearance",
  group: "hr",
  icon: DoorOpen,
  href: "/exit-clearance",
  title: { en: "Exit Clearance", hi: "एग्ज़िट क्लियरेंस (Exit Clearance)" },
  summary: {
    en: "Track everyone serving notice, collect each department's sign-off, and close the account when they leave.",
    hi: "नोटिस पीरियड पर चल रहे सभी लोगों को ट्रैक करें, हर department का sign-off लें, और जाते समय उनका अकाउंट बंद करें।",
  },
  keywords: [
    "exit",
    "clearance",
    "notice period",
    "relieving",
    "last working day",
    "full and final",
    "sign off",
    "offboarding",
    "leaving",
    "एग्ज़िट",
    "क्लियरेंस",
    "नोटिस पीरियड",
    "रिलीविंग",
  ],
  sections: [
    {
      id: "serving-notice",
      title: { en: "See who is serving notice", hi: "देखें कौन नोटिस पीरियड पर है" },
      intro: {
        en: "An exit clearance starts automatically when a resignation is approved. The person keeps full access during their notice period, so they can hand over their work.",
        hi: "Resignation approve होते ही exit clearance अपने आप शुरू हो जाता है। नोटिस पीरियड के दौरान व्यक्ति का पूरा एक्सेस बना रहता है, ताकि वो अपना काम हैंडओवर कर सकें।",
      },
      steps: [
        {
          text: {
            en: "Click Exit Clearance in the sidebar. The strip at the top shows how many people are Serving notice (1), how many leave within 7 days, and how many are Blocked on clearances (2).",
            hi: "साइडबार में Exit Clearance पर क्लिक करें। ऊपर की पट्टी दिखाती है कि कितने लोग Serving notice (1) पर हैं, कितने 7 दिन के अंदर जा रहे हैं, और कितने Blocked on clearances (2) हैं।",
          },
          shot: {
            id: "exit-clearance-list",
            as: "hr",
            path: "/exit-clearance",
            highlight: [
              { text: "Serving notice", exact: true },
              { text: "Blocked on clearances", exact: true },
              { role: "button", name: "Open", exact: true },
            ],
          },
        },
        {
          text: {
            en: "Each card shows when the person resigned, their last working day, how many days are left, and how far the checklist has got. A highlighted line names the clearances still blocking their relieving.",
            hi: "हर कार्ड में दिखता है कि व्यक्ति ने कब resign किया, उनका last working day, कितने दिन बचे हैं, और checklist कितनी पूरी हुई है। एक हाइलाइट की हुई लाइन बताती है कि कौन से clearances अभी relieving को रोक रहे हैं।",
          },
        },
        {
          text: {
            en: "Click Open (3) to see their full exit checklist.",
            hi: "उनकी पूरी exit checklist देखने के लिए Open (3) पर क्लिक करें।",
          },
        },
      ],
    },
    {
      id: "owners",
      title: { en: "Who does what", hi: "कौन क्या करता है" },
      intro: {
        en: "Every item already has an owner when the checklist is created - you don't assign them by hand.",
        hi: "Checklist बनते ही हर आइटम का owner पहले से तय होता है - आपको हाथ से assign नहीं करना पड़ता।",
      },
      steps: [
        {
          text: {
            en: "HR items show HR as the owner. Handover items, like preparing the handover document, belong to the person who is leaving. The handover meeting belongs to their manager.",
            hi: "HR वाले आइटम पर owner की जगह HR लिखा होता है। हैंडओवर वाले आइटम, जैसे handover document बनाना, जाने वाले व्यक्ति के होते हैं। Handover meeting उनके मैनेजर का काम है।",
          },
        },
        {
          text: {
            en: "The items in Step 3. Department-Wise Clearance are sign-offs. The manager signs Manager / Reporting Head, and the heads of the departments concerned sign Finance and IT / Admin.",
            hi: "Step 3. Department-Wise Clearance वाले आइटम sign-offs हैं। Manager / Reporting Head मैनेजर साइन करता है, और Finance और IT / Admin उन departments के head साइन करते हैं।",
          },
        },
        {
          text: {
            en: "Everyone who owns an item gets a notification, and the item shows up on their Waiting on you page. There they click Sign off (1) for a clearance, or Mark done (2) for a task.",
            hi: "जिस-जिस के पास कोई आइटम है, उसे नोटिफिकेशन मिलता है, और वो आइटम उनके Waiting on you पेज पर दिखता है। वहाँ वो clearance के लिए Sign off (1), या task के लिए Mark done (2) पर क्लिक करते हैं।",
          },
          shot: {
            id: "exit-clearance-waiting",
            as: "manager",
            path: "/clearances",
            highlight: [
              { role: "button", name: "Sign off" },
              { role: "button", name: "Mark done" },
            ],
          },
        },
      ],
      tips: [
        {
          en: "Waiting on you is in everyone's sidebar, even for people with no HR access - but it only shows up when something is waiting on them.",
          hi: "Waiting on you सबके साइडबार में होता है, उनके भी जिनके पास HR एक्सेस नहीं है - लेकिन ये तभी दिखता है जब उनके लिए कुछ बाकी हो।",
        },
        {
          en: "If a clearance shows HR instead of a person's name, no head is set for that department, so HR signs it.",
          hi: "अगर किसी clearance पर व्यक्ति के नाम की जगह HR लिखा है, तो उस department का कोई head सेट नहीं है, इसलिए उसे HR साइन करता है।",
        },
      ],
      faq: [
        {
          q: {
            en: "Can I add an item or change who owns one?",
            hi: "क्या मैं कोई आइटम जोड़ सकता हूँ या उसका owner बदल सकता हूँ?",
          },
          a: {
            en: "Not from this screen. The items and their owners come from the company's exit checklist and are filled in automatically when the resignation is approved.",
            hi: "इस स्क्रीन से नहीं। आइटम और उनके owners कंपनी की exit checklist से आते हैं, और resignation approve होते ही अपने आप भर जाते हैं।",
          },
        },
      ],
    },
    {
      id: "sign",
      title: { en: "Tick items and sign clearances", hi: "आइटम टिक करें और क्लियरेंस साइन करें" },
      permission: PERMISSIONS.EXIT_WRITE,
      steps: [
        {
          text: {
            en: "Open a person's exit. The box at the top shows their last working day and how many clearances are signed. While something is blocking relieving, a line says which clearances are still waiting (1).",
            hi: "किसी व्यक्ति का exit खोलें। ऊपर के बॉक्स में उनका last working day और कितने clearances साइन हुए हैं, ये दिखता है। जब तक कुछ relieving को रोक रहा है, एक लाइन बताती है कि कौन से clearances अभी बाकी हैं (1)।",
          },
          shot: {
            id: "exit-clearance-detail",
            as: "hr",
            path: "/exit-clearance",
            actions: OPEN_EXIT,
            highlight: [
              { text: "Relieving is blocked until" },
              { role: "checkbox", name: "Finance", exact: true },
            ],
          },
        },
        {
          text: {
            en: "Tick an ordinary item when it is done. Clearances (2) have a shield icon and say blocks relieving until they are signed.",
            hi: "कोई आम आइटम हो जाए तो उसे टिक करें। Clearances (2) पर शील्ड का आइकन होता है, और साइन होने तक उन पर blocks relieving लिखा रहता है।",
          },
        },
        {
          text: {
            en: "Ticking a clearance opens Sign this clearance. Add a Note (optional) (1), such as the asset tag of a returned laptop, and click Sign off (2).",
            hi: "Clearance टिक करने पर Sign this clearance खुलता है। Note (optional) (1) में कुछ लिखें, जैसे लौटाए गए लैपटॉप का asset tag, और Sign off (2) पर क्लिक करें।",
          },
          shot: {
            id: "exit-clearance-sign",
            as: "hr",
            path: "/exit-clearance",
            actions: [...OPEN_EXIT, { click: { role: "checkbox", name: "IT / Admin" } }],
            highlight: [{ label: "Note (optional)" }, { role: "button", name: "Sign off" }],
            crop: { role: "dialog" },
          },
        },
      ],
      tips: [
        {
          en: "If a department head is away, HR can sign their clearance for them. The item shows who actually signed it.",
          hi: "अगर किसी department का head मौजूद नहीं है, तो HR उनकी जगह clearance साइन कर सकता है। आइटम पर दिखता है कि असल में किसने साइन किया।",
        },
      ],
    },
    {
      id: "complete",
      title: { en: "Complete the exit", hi: "एग्ज़िट पूरा करें" },
      permission: PERMISSIONS.EXIT_WRITE,
      steps: [
        {
          text: {
            en: "Once every required clearance is signed, the person's card on the Exit Clearance page says All clearances signed - ready for HR sign-off.",
            hi: "जब सारे ज़रूरी clearances साइन हो जाते हैं, तो Exit Clearance पेज पर उस व्यक्ति के कार्ड पर All clearances signed - ready for HR sign-off लिखा आता है।",
          },
        },
        {
          text: {
            en: "Open their exit and click Complete exit (1). The button stays grey while a required clearance is unsigned - point at it to see what it is waiting on.",
            hi: "उनका exit खोलें और Complete exit (1) पर क्लिक करें। जब तक कोई ज़रूरी clearance साइन नहीं होता, ये बटन ग्रे रहता है - उस पर माउस ले जाएँ तो दिखेगा कि किसका इंतज़ार है।",
          },
          shot: {
            id: "exit-clearance-complete",
            as: "hr",
            path: "/exit-clearance",
            actions: OPEN_EXIT,
            highlight: [{ role: "button", name: "Complete exit" }],
          },
        },
        {
          text: {
            en: "Confirm with Complete exit. The person is marked Resigned, their account is closed, they are taken off every project team, and a relieving confirmation is emailed to them.",
            hi: "Complete exit पर क्लिक करके कन्फर्म करें। व्यक्ति Resigned मार्क हो जाता है, उनका अकाउंट बंद हो जाता है, वो हर प्रोजेक्ट टीम से हट जाते हैं, और उन्हें relieving का कन्फर्मेशन ईमेल हो जाता है।",
          },
        },
      ],
      tips: [
        {
          en: "If nobody completes the exit, DNMS closes the account by itself the day after the last working day and tells HR. The clearances still need to be signed and the exit completed after that.",
          hi: "अगर कोई exit पूरा नहीं करता, तो last working day के अगले दिन DNMS खुद अकाउंट बंद कर देता है और HR को बता देता है। उसके बाद भी clearances साइन करने और exit पूरा करने बाकी रहते हैं।",
        },
        {
          en: "You can't complete your own exit.",
          hi: "आप अपना खुद का exit पूरा नहीं कर सकते।",
        },
      ],
      faq: [
        {
          q: {
            en: "Can I complete the exit before every clearance is signed?",
            hi: "क्या सारे clearances साइन होने से पहले exit पूरा कर सकते हैं?",
          },
          a: {
            en: "No. Relieving stays blocked until every required clearance is signed. Optional ones, like Other departments worked with, don't block it.",
            hi: "नहीं। जब तक सारे ज़रूरी clearances साइन नहीं होते, relieving रुका रहता है। Optional वाले, जैसे Other departments worked with, इसे नहीं रोकते।",
          },
        },
      ],
    },
  ],
}
