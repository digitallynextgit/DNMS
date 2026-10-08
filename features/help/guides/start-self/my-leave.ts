import { CalendarDays } from "lucide-react"
import type { HelpAction, HelpGuide } from "../../types"

/** Next month (so every day is future), then its first pickable Mon-Fri (grid columns 2-6). */
const pickWeekdayNextMonth: HelpAction[] = [
  { click: { role: "button", name: "Go to the Next Month" } },
  {
    click: {
      css: "[role=dialog] [role=gridcell]:not([data-disabled]):not([data-outside]):nth-child(n+2):nth-child(-n+6) button",
    },
  },
]

export const myLeaveGuide: HelpGuide = {
  slug: "my-leave",
  group: "self",
  icon: CalendarDays,
  href: "/leave",
  title: { en: "My Leave", hi: "मेरी छुट्टी (My Leave)" },
  summary: {
    en: "Check how many leave days you have, apply for leave, and cancel a request you no longer need.",
    hi: "देखें आपके पास कितनी छुट्टियाँ बची हैं, छुट्टी के लिए अप्लाई करें, और ज़रूरत न हो तो रिक्वेस्ट कैंसल करें।",
  },
  keywords: ["leave", "holiday", "off", "sick", "casual", "half day", "छुट्टी", "अवकाश"],
  sections: [
    {
      id: "balances",
      title: { en: "See how much leave you have", hi: "अपनी बची हुई छुट्टियाँ देखें" },
      intro: {
        en: "Every type of leave you get has its own card at the top of the page.",
        hi: "आपको मिलने वाली हर तरह की छुट्टी का पेज के ऊपर अपना एक कार्ड होता है।",
      },
      steps: [
        {
          text: {
            en: "Click My Leave in the sidebar. Each card shows one leave type, like Casual Leave (1) or Sick Leave, and the big number is how many days you can still take. Apply Leave (2) at the top right starts a new request.",
            hi: "साइडबार में My Leave पर क्लिक करें। हर कार्ड एक तरह की छुट्टी दिखाता है, जैसे Casual Leave (1) या Sick Leave, और बड़ा नंबर बताता है कि आप अभी कितने दिन ले सकते हैं। ऊपर दाईं ओर Apply Leave (2) से नई रिक्वेस्ट शुरू होती है।",
          },
          shot: {
            id: "my-leave-balances",
            as: "employee",
            path: "/leave",
            highlight: [{ text: "Casual Leave" }, { role: "link", name: "Apply Leave" }],
          },
        },
        {
          text: {
            en: "Under the big number, Used is what you have already taken, and Pending is what is still waiting for approval. Pending days are held back, so you can't book the same days twice.",
            hi: "बड़े नंबर के नीचे, Used वो दिन हैं जो आप ले चुके हैं, और Pending वो दिन हैं जिनकी मंज़ूरी बाकी है। Pending दिन पहले से रोक लिए जाते हैं, ताकि वही दिन दोबारा बुक न हों।",
          },
        },
      ],
      tips: [
        {
          en: "Just joined? Paid leave starts after your probation. Until then you can still apply for Leave Without Pay.",
          hi: "अभी जॉइन किया है? पेड छुट्टियाँ प्रोबेशन खत्म होने के बाद मिलती हैं। तब तक आप Leave Without Pay के लिए अप्लाई कर सकते हैं।",
        },
      ],
    },
    {
      id: "apply",
      title: { en: "Apply for leave", hi: "छुट्टी के लिए अप्लाई करें" },
      steps: [
        {
          text: {
            en: "On the My Leave page, click Apply Leave at the top right.",
            hi: "My Leave पेज पर, ऊपर दाईं ओर Apply Leave पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Pick the Leave Type (1), then the Start Date (2) and End Date (3). For a single day, pick the same date in both.",
            hi: "Leave Type (1) चुनें, फिर Start Date (2) और End Date (3) चुनें। एक दिन की छुट्टी के लिए दोनों में एक ही तारीख चुनें।",
          },
          shot: {
            id: "my-leave-apply-form",
            as: "employee",
            path: "/leave/apply",
            // A filled-in form, so the email preview shows real values instead of "0 days".
            actions: [
              { click: { label: "Leave Type" } },
              { click: { role: "option", name: "Casual Leave" } },
              // Start Date. Once picked, its button shows the date, so the
              // next "Pick a date" is End Date - set to the same day.
              { click: { role: "button", name: "Pick a date" } },
              ...pickWeekdayNextMonth,
              { click: { role: "button", name: "Pick a date" } },
              ...pickWeekdayNextMonth,
              { fill: { label: "Reason" }, value: "Family function at home." },
            ],
            highlight: [
              { label: "Leave Type" },
              // The date buttons by their labels: their names are the picked dates now.
              { css: "label:has-text('Start Date') + button" },
              { css: "label:has-text('End Date') + button" },
              { label: "Reason" },
              { role: "button", name: "Submit Leave Request" },
            ],
          },
        },
        {
          text: {
            en: "Only need half the day? For Casual, Sick or Personal Leave, tick Half day. DNMS counts the days for you and shows them under Leave days charged.",
            hi: "आधे दिन की छुट्टी चाहिए? Casual, Sick या Personal Leave में Half day पर टिक करें। DNMS अपने आप दिन गिनता है और उन्हें Leave days charged में दिखाता है।",
          },
        },
        {
          text: {
            en: "Write a short Reason (4). Not sure how to word it? Click Improve with AI for clearer wording - you can undo it.",
            hi: "छोटा सा Reason (4) लिखें। समझ नहीं आ रहा कैसे लिखें? Improve with AI पर क्लिक करें, वो बेहतर शब्द सुझाएगा - चाहें तो undo कर सकते हैं।",
          },
        },
        {
          text: {
            en: "Click Submit Leave Request (5). Your manager is notified straight away, and you get a notification when they decide.",
            hi: "Submit Leave Request (5) पर क्लिक करें। आपके मैनेजर को तुरंत सूचना मिलती है, और फैसला होते ही आपको नोटिफिकेशन मिलता है।",
          },
        },
      ],
      tips: [
        {
          en: "If a weekend falls between your leave days, it may be counted too (the sandwich rule). The form warns you before you submit.",
          hi: "अगर आपकी छुट्टियों के बीच वीकेंड आता है, तो वो भी गिना जा सकता है (sandwich rule)। सबमिट करने से पहले फॉर्म आपको बता देता है।",
        },
        {
          en: "The Submit button stays grey until the form is complete and you have enough balance.",
          hi: "जब तक फॉर्म पूरा न हो और बैलेंस काफी न हो, Submit बटन ग्रे रहता है।",
        },
      ],
    },
    {
      id: "cancel",
      title: { en: "Cancel a leave request", hi: "छुट्टी की रिक्वेस्ट कैंसल करें" },
      steps: [
        {
          text: {
            en: "Your requests are listed under your balance cards. A request that is still Pending has a cancel button on the right (1) - click it and the days go back to your balance.",
            hi: "आपकी रिक्वेस्ट बैलेंस कार्ड्स के नीचे दिखती हैं। जो रिक्वेस्ट अभी Pending है, उसके दाईं ओर कैंसल बटन (1) होता है - उस पर क्लिक करें और दिन वापस आपके बैलेंस में आ जाएँगे।",
          },
          shot: {
            id: "my-leave-cancel",
            as: "employee",
            path: "/leave",
            highlight: [{ role: "button", name: "Cancel" }],
            crop: { role: "table" },
          },
        },
      ],
      faq: [
        {
          q: {
            en: "Can I cancel leave that is already approved?",
            hi: "क्या मंज़ूर हो चुकी छुट्टी कैंसल कर सकते हैं?",
          },
          a: {
            en: "No. Only a request that is still Pending can be cancelled - once your manager decides, it is final in DNMS. If your plans change, tell your manager and HR.",
            hi: "नहीं। सिर्फ़ वही रिक्वेस्ट कैंसल हो सकती है जो अभी Pending है - मैनेजर के फैसले के बाद DNMS में वो फाइनल हो जाती है। प्लान बदल जाए तो अपने मैनेजर और HR को बता दें।",
          },
        },
      ],
    },
    {
      id: "team-requests",
      title: {
        en: "For managers: approve your team's leave",
        hi: "मैनेजर्स के लिए: अपनी टीम की छुट्टी मंज़ूर करें",
      },
      intro: {
        en: "If people report to you, My Leave gets a second tab with their requests.",
        hi: "अगर लोग आपको रिपोर्ट करते हैं, तो My Leave में उनकी रिक्वेस्ट्स के लिए एक दूसरा टैब दिखता है।",
      },
      steps: [
        {
          text: {
            en: "Open the Leave Requests tab. Each pending request has Approve (1) and Reject (2) buttons on the right.",
            hi: "Leave Requests टैब खोलें। हर pending रिक्वेस्ट के दाईं ओर Approve (1) और Reject (2) बटन होते हैं।",
          },
          shot: {
            id: "my-leave-team-requests",
            as: "manager",
            path: "/leave?tab=requests",
            highlight: [
              { role: "button", name: "Approve" },
              { role: "button", name: "Reject" },
            ],
            crop: { role: "table" },
          },
        },
        {
          text: {
            en: "The employee is notified of your decision straight away, and their balance updates on its own.",
            hi: "आपके फैसले की सूचना कर्मचारी को तुरंत मिल जाती है, और उनका बैलेंस अपने आप अपडेट हो जाता है।",
          },
        },
      ],
    },
  ],
}
