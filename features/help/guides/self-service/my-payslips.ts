import { DollarSign } from "lucide-react"
import type { HelpAction, HelpGuide } from "../../types"

/** The second row, not the first: the newest is usually the current month's Draft. */
const openLastMonthPayslip: HelpAction[] = [
  { click: { role: "link", name: "View", nth: 1 } },
  { waitFor: { role: "button", name: "Download PDF" } },
]

export const myPayslipsGuide: HelpGuide = {
  slug: "my-payslips",
  group: "self",
  icon: DollarSign,
  href: "/payroll/me",
  title: { en: "My Payslips", hi: "मेरी सैलरी स्लिप (My Payslips)" },
  summary: {
    en: "See your payslip for each month, understand what each line means, and save it as a PDF.",
    hi: "हर महीने की अपनी सैलरी स्लिप देखें, समझें कि हर लाइन का क्या मतलब है, और उसे PDF में सेव करें।",
  },
  keywords: [
    "payslip",
    "pay slip",
    "salary slip",
    "salary",
    "pay",
    "net pay",
    "gross",
    "deductions",
    "pdf",
    "download",
    "सैलरी",
    "सैलरी स्लिप",
    "वेतन",
    "तनख्वाह",
    "पे स्लिप",
  ],
  sections: [
    {
      id: "list",
      title: { en: "Find your payslips", hi: "अपनी सैलरी स्लिप ढूँढें" },
      intro: {
        en: "My Payslips lists one row per month, newest first. Only you can see your payslips.",
        hi: "My Payslips में हर महीने की एक लाइन होती है, सबसे नई सबसे ऊपर। आपकी सैलरी स्लिप सिर्फ आप देख सकते हैं।",
      },
      steps: [
        {
          text: {
            en: "Click My Payslips in the sidebar. Gross (1) is your total pay for the month before anything is taken off, Deductions (2) is what was taken off, and Net (3) is what you actually get.",
            hi: "साइडबार में My Payslips पर क्लिक करें। Gross (1) महीने की आपकी कुल सैलरी है, कुछ भी कटने से पहले। Deductions (2) वो रकम है जो कटी, और Net (3) वो है जो आपको असल में मिलता है।",
          },
          shot: {
            id: "my-payslips-list",
            as: "employee",
            path: "/payroll/me",
            highlight: [
              { css: "th:text-is('Gross')" },
              { css: "th:text-is('Deductions')" },
              { css: "th:text-is('Net')" },
              { css: "th:text-is('Status')" },
              { role: "link", name: "View" },
            ],
            crop: { role: "table" },
          },
        },
        {
          text: {
            en: "Status (4) tells you where the payslip is: Draft or Processing means HR is still working on it, Approved means HR has signed it off, and Paid means the salary has been paid.",
            hi: "Status (4) बताता है कि स्लिप किस स्टेज पर है: Draft या Processing का मतलब HR अभी इस पर काम कर रहा है, Approved का मतलब HR ने इसे फाइनल कर दिया है, और Paid का मतलब सैलरी दे दी गई है।",
          },
        },
        {
          text: {
            en: "Click View (5) on a month to open that payslip.",
            hi: "किसी महीने की स्लिप खोलने के लिए उसकी लाइन में View (5) पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "The amounts on a Draft or Processing payslip can still change. Wait until it is Approved or Paid before you rely on them.",
          hi: "Draft या Processing वाली स्लिप की रकम अभी बदल सकती है। उस पर भरोसा करने से पहले उसके Approved या Paid होने का इंतज़ार करें।",
        },
      ],
      faq: [
        {
          q: { en: "I don't see any payslips.", hi: "मुझे कोई सैलरी स्लिप नहीं दिख रही।" },
          a: {
            en: "A payslip appears here once HR runs payroll for that month. If one is missing for a month you were paid, ask HR.",
            hi: "HR जब उस महीने का पेरोल बनाता है, तब स्लिप यहाँ दिखती है। अगर किसी ऐसे महीने की स्लिप नहीं है जिसकी सैलरी आपको मिली थी, तो HR से पूछें।",
          },
        },
      ],
    },
    {
      id: "read",
      title: { en: "Understand your payslip", hi: "अपनी सैलरी स्लिप समझें" },
      intro: {
        en: "The payslip looks like the printed salary slip. Here is what each part means.",
        hi: "स्लिप बिल्कुल छपी हुई सैलरी स्लिप जैसी दिखती है। यहाँ जानिए हर हिस्से का मतलब।",
      },
      steps: [
        {
          text: {
            en: "At the top are your Name, the Month, your Employee Code, the Payment Mode, and Annual (1) - your full yearly salary (your full monthly salary times 12).",
            hi: "सबसे ऊपर आपका Name, Month, आपका Employee Code, Payment Mode, और Annual (1) होता है - यानी आपकी पूरी सालाना सैलरी (पूरी मंथली सैलरी गुणा 12)।",
          },
          shot: {
            id: "my-payslips-breakup",
            as: "employee",
            path: "/payroll/me",
            actions: openLastMonthPayslip,
            highlight: [
              { text: "Annual", exact: true },
              { text: "Break up", exact: true },
              { text: "No of days attended" },
              // The amount next to "Total", not the label - the label sits under box 3 and would overlap.
              { css: "td:text-is('Total') + td" },
              { text: "Amount in words (Rs.)" },
            ],
            crop: { css: "#print-area" },
          },
        },
        {
          text: {
            en: "Break up (2) lists this month's pay in parts: Basic is your basic salary, HRA is House Rent Allowance, Transport Allowance is for travel, Medical Allowance is for health costs, Telephone/Mobile Bill is for your phone, and Special Allowance covers your other allowances.",
            hi: "Break up (2) में इस महीने की सैलरी हिस्सों में लिखी होती है: Basic आपकी बेसिक सैलरी है, HRA यानी House Rent Allowance (घर के किराये का भत्ता), Transport Allowance आने-जाने के लिए, Medical Allowance इलाज के खर्च के लिए, Telephone/Mobile Bill आपके फोन के लिए, और Special Allowance में आपके बाकी भत्ते आते हैं।",
          },
        },
        {
          text: {
            en: "Below that are the No of days in the month, the No of working days (Monday to Friday) and the No of days attended (3). If you had unpaid days, days attended is lower than working days, and the amounts above are already reduced for them.",
            hi: "उसके नीचे No of days in the month, No of working days (सोमवार से शुक्रवार) और No of days attended (3) लिखे होते हैं। अगर आपके कुछ दिन बिना वेतन के थे, तो days attended, working days से कम होगा, और ऊपर की रकम उसी हिसाब से पहले ही कम कर दी गई है।",
          },
        },
        {
          text: {
            en: "Next to Total is your net pay (4) - the amount paid into your bank. Amount in words (Rs.) (5) writes the same amount in words.",
            hi: "Total के आगे आपकी नेट सैलरी (4) लिखी होती है - यानी जो रकम आपके बैंक में आती है। Amount in words (Rs.) (5) में वही रकम शब्दों में लिखी होती है।",
          },
        },
      ],
      tips: [
        {
          en: "Your pay is worked out per day. Weekends, holidays, days you were present and approved paid leave are paid. A working day with no attendance and no paid leave, or a day of unpaid leave, is not paid, and a half day is paid half.",
          hi: "आपकी सैलरी दिनों के हिसाब से बनती है। वीकेंड, हॉलिडे, जिन दिनों आप present थे और मंज़ूर हुई पेड छुट्टी - इन सबका पैसा मिलता है। बिना हाज़िरी और बिना पेड छुट्टी वाले वर्किंग डे का, या बिना वेतन वाली छुट्टी का पैसा नहीं मिलता, और half day का आधा मिलता है।",
        },
      ],
      faq: [
        {
          q: { en: "Why is my pay lower this month?", hi: "इस महीने मेरी सैलरी कम क्यों है?" },
          a: {
            en: "Most often because of unpaid days. Compare No of working days with No of days attended. If a day looks wrong, check My Attendance and ask HR to fix it.",
            hi: "ज़्यादातर बिना वेतन वाले दिनों की वजह से। No of working days और No of days attended को मिलाकर देखें। अगर कोई दिन गलत लगे, तो My Attendance देखें और HR से उसे ठीक करवाएँ।",
          },
        },
        {
          q: {
            en: "Something on my payslip looks wrong. Can I change it?",
            hi: "मेरी स्लिप में कुछ गलत लग रहा है। क्या इसे बदला जा सकता है?",
          },
          a: {
            en: "No - only HR can change a payslip. Tell HR what looks wrong.",
            hi: "नहीं - स्लिप सिर्फ HR बदल सकता है। HR को बताएँ कि क्या गलत लग रहा है।",
          },
        },
      ],
    },
    {
      id: "download",
      title: { en: "Save or print your payslip", hi: "अपनी सैलरी स्लिप सेव या प्रिंट करें" },
      steps: [
        {
          text: {
            en: "Open the payslip and click Download PDF (1) at the top right.",
            hi: "सैलरी स्लिप खोलें और ऊपर दाईं ओर Download PDF (1) पर क्लिक करें।",
          },
          shot: {
            id: "my-payslips-download",
            as: "employee",
            path: "/payroll/me",
            actions: openLastMonthPayslip,
            highlight: [{ role: "button", name: "Download PDF" }],
          },
        },
        {
          text: {
            en: "Your browser's print window opens. To get a file, pick Save as PDF as the printer (the exact name differs a little between browsers) and save it. To print on paper, pick your printer instead.",
            hi: "आपके ब्राउज़र की प्रिंट विंडो खुलती है। फाइल चाहिए तो प्रिंटर में Save as PDF चुनें (हर ब्राउज़र में नाम थोड़ा अलग हो सकता है) और सेव करें। कागज़ पर प्रिंट करना है तो अपना प्रिंटर चुनें।",
          },
        },
      ],
      tips: [
        {
          en: "Only the payslip is printed - the DNMS menus and buttons are left out.",
          hi: "सिर्फ सैलरी स्लिप प्रिंट होती है - DNMS के मेन्यू और बटन उसमें नहीं आते।",
        },
      ],
    },
  ],
}
