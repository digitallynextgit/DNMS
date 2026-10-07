import { UserMinus } from "lucide-react"
import { PERMISSIONS } from "@/lib/constants"
import type { HelpGuide } from "../../types"

export const resignationsGuide: HelpGuide = {
  slug: "resignations",
  group: "hr",
  icon: UserMinus,
  href: "/resignations",
  title: { en: "Resignations", hi: "इस्तीफे (Resignations)" },
  summary: {
    en: "See how an employee resigns, and approve or decline the resignations waiting for you.",
    hi: "जानें employee resign कैसे करते हैं, और आपके पास आए resignations को approve या decline करें।",
  },
  keywords: [
    "resignation",
    "resign",
    "quit",
    "notice period",
    "last working day",
    "withdraw",
    "approve",
    "decline",
    "इस्तीफा",
    "रिज़ाइन",
    "नोटिस पीरियड",
  ],
  sections: [
    {
      id: "employee-resigns",
      title: { en: "How an employee resigns", hi: "Employee resign कैसे करता है" },
      steps: [
        {
          text: {
            en: "The employee clicks their name at the top right and opens My Profile. There they click Apply Resignation (1).",
            hi: "Employee ऊपर दाईं ओर अपने नाम पर क्लिक करके My Profile खोलता है। वहाँ वो Apply Resignation (1) पर क्लिक करता है।",
          },
          shot: {
            id: "resignations-apply-button",
            as: "employee",
            path: "/profile",
            highlight: [{ role: "button", name: "Apply Resignation" }],
          },
        },
        {
          text: {
            en: "They write a Reason (1), pick their Requested Last Working Day (2), and click Submit Request (3).",
            hi: "वो Reason (1) लिखते हैं, अपना Requested Last Working Day (2) चुनते हैं, और Submit Request (3) पर क्लिक करते हैं।",
          },
          shot: {
            id: "resignations-apply-dialog",
            as: "employee",
            path: "/profile",
            actions: [{ click: { role: "button", name: "Apply Resignation" } }],
            highlight: [
              { label: "Reason" },
              { text: "Requested Last Working Day" },
              { role: "button", name: "Submit Request" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Their manager and HR get a notification. Until someone decides, the employee's profile shows Resignation Pending with a Withdraw button, so they can take it back.",
            hi: "उनके मैनेजर और HR को नोटिफिकेशन मिलता है। जब तक कोई फैसला नहीं होता, employee की प्रोफाइल पर Resignation Pending और एक Withdraw बटन दिखता है, ताकि वो इसे वापस ले सकें।",
          },
        },
      ],
      tips: [
        {
          en: "The last working day the employee asks for is the one used when the resignation is approved, so check it before you approve.",
          hi: "Employee ने जो last working day माँगा है, approve होने पर वही इस्तेमाल होता है, इसलिए approve करने से पहले उसे ज़रूर देख लें।",
        },
      ],
    },
    {
      id: "review",
      title: { en: "Review pending resignations", hi: "Pending resignations देखें" },
      permission: PERMISSIONS.RESIGNATION_APPROVE,
      steps: [
        {
          text: {
            en: "Click Resignations in the sidebar - the number next to it is how many are waiting. Each card shows the person, their designation and department, when they applied, the last day they asked for (1), and their reason.",
            hi: "साइडबार में Resignations पर क्लिक करें - इसके बगल वाला नंबर बताता है कि कितने बाकी हैं। हर कार्ड में व्यक्ति, उनका designation और department, कब अप्लाई किया, उन्होंने कौन सा last day माँगा (1), और उनकी वजह दिखती है।",
          },
          shot: {
            id: "resignations-review",
            as: "hr",
            path: "/resignations",
            highlight: [
              { text: "Requested last day" },
              { role: "button", name: "Approve" },
              { role: "button", name: "Decline" },
            ],
          },
        },
        {
          text: {
            en: "Click Approve (2) to accept the resignation, or Decline (3) to turn it down.",
            hi: "Resignation स्वीकार करने के लिए Approve (2), या मना करने के लिए Decline (3) पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "HR sees every pending resignation. A manager can also decide on resignations from their own team - their notification opens this page.",
          hi: "HR को सभी pending resignations दिखते हैं। मैनेजर भी अपनी टीम के resignations पर फैसला ले सकता है - उनका नोटिफिकेशन यही पेज खोलता है।",
        },
      ],
    },
    {
      id: "approve",
      title: { en: "Approve a resignation", hi: "Resignation approve करें" },
      permission: PERMISSIONS.RESIGNATION_APPROVE,
      steps: [
        {
          text: {
            en: "Click Approve. Read the note in the box, then click Accept resignation (1).",
            hi: "Approve पर क्लिक करें। बॉक्स में लिखी बात पढ़ें, फिर Accept resignation (1) पर क्लिक करें।",
          },
          shot: {
            id: "resignations-approve-dialog",
            as: "hr",
            path: "/resignations",
            actions: [{ click: { role: "button", name: "Approve" } }],
            highlight: [{ role: "button", name: "Accept resignation" }],
            crop: { css: "[role=alertdialog]" },
          },
        },
        {
          text: {
            en: "Their notice period starts. They keep full access until their last working day, so they can hand over their work.",
            hi: "उनका नोटिस पीरियड शुरू हो जाता है। Last working day तक उनका पूरा एक्सेस बना रहता है, ताकि वो अपना काम हैंडओवर कर सकें।",
          },
        },
        {
          text: {
            en: "Their exit clearance is created straight away and shows up on the Exit Clearance page. The employee gets a notification.",
            hi: "उनका exit clearance तुरंत बन जाता है और Exit Clearance पेज पर दिखने लगता है। Employee को नोटिफिकेशन मिलता है।",
          },
        },
      ],
      tips: [
        {
          en: "Approving does not close the account. It closes when HR completes the exit clearance.",
          hi: "Approve करने से अकाउंट बंद नहीं होता। ये तब बंद होता है जब HR exit clearance पूरा करता है।",
        },
      ],
    },
    {
      id: "decline",
      title: { en: "Decline a resignation", hi: "Resignation decline करें" },
      permission: PERMISSIONS.RESIGNATION_APPROVE,
      steps: [
        {
          text: {
            en: "Click Decline. Write a Note (optional) (1) - the employee will see it - and click Decline (2).",
            hi: "Decline पर क्लिक करें। Note (optional) (1) लिखें - ये employee को दिखेगा - और Decline (2) पर क्लिक करें।",
          },
          shot: {
            id: "resignations-decline-dialog",
            as: "hr",
            path: "/resignations",
            actions: [{ click: { role: "button", name: "Decline" } }],
            highlight: [{ label: "Note (optional)" }, { role: "button", name: "Decline", nth: -1 }],
            crop: { css: "[role=alertdialog]" },
          },
        },
        {
          text: {
            en: "The employee is told it was declined, and carries on working as before.",
            hi: "Employee को बता दिया जाता है कि resignation decline हुआ, और वो पहले की तरह काम करता रहता है।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "How long is the notice period?",
            hi: "नोटिस पीरियड कितना होता है?",
          },
          a: {
            en: "DNMS doesn't work it out. It uses the last working day the employee asked for. If they didn't pick one, the day you approve becomes their last working day.",
            hi: "DNMS इसे खुद नहीं गिनता। ये वही last working day लेता है जो employee ने माँगा है। अगर उन्होंने कोई तारीख नहीं चुनी, तो जिस दिन आप approve करते हैं वही उनका last working day बन जाता है।",
          },
        },
        {
          q: {
            en: "The requested last day is wrong. Can I change it?",
            hi: "माँगा गया last day गलत है। क्या मैं इसे बदल सकता हूँ?",
          },
          a: {
            en: "Not on this page. Decline it with a note asking them to apply again with the agreed date. While it is still pending, the employee can also Withdraw it and apply again.",
            hi: "इस पेज पर नहीं। इसे एक नोट के साथ decline करें और कहें कि तय की गई तारीख के साथ दोबारा अप्लाई करें। जब तक ये pending है, employee खुद भी इसे Withdraw करके दोबारा अप्लाई कर सकता है।",
          },
        },
      ],
    },
  ],
}
