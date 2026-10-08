import { CalendarRange } from "lucide-react"
import type { HelpGuide } from "../../types"

export const calendarGuide: HelpGuide = {
  slug: "calendar",
  group: "self",
  icon: CalendarRange,
  href: "/calendar",
  title: { en: "Calendar", hi: "कैलेंडर (Calendar)" },
  summary: {
    en: "See the company holidays and everyone's birthdays month by month or as a list, and apply for your floating holidays.",
    hi: "कंपनी की छुट्टियाँ और सबके जन्मदिन महीने के हिसाब से या लिस्ट में देखें, और अपने floating holidays के लिए अप्लाई करें।",
  },
  keywords: [
    "calendar",
    "holiday",
    "holidays",
    "holiday list",
    "public holiday",
    "floating holiday",
    "optional holiday",
    "birthday",
    "birthdays",
    "कैलेंडर",
    "छुट्टी",
    "हॉलिडे",
    "त्योहार",
    "जन्मदिन",
    "बर्थडे",
  ],
  sections: [
    {
      id: "pick",
      title: { en: "Pick a calendar", hi: "कैलेंडर चुनें" },
      steps: [
        {
          text: {
            en: "Click Calendar in the sidebar. It opens on the Holiday Calendar.",
            hi: "साइडबार में Calendar पर क्लिक करें। ये Holiday Calendar के साथ खुलता है।",
          },
        },
        {
          text: {
            en: "To switch, click the box at the top right and pick Holiday Calendar (1) or Birthday Calendar (2).",
            hi: "बदलने के लिए ऊपर दाईं ओर वाले बॉक्स पर क्लिक करें और Holiday Calendar (1) या Birthday Calendar (2) चुनें।",
          },
          shot: {
            id: "calendar-picker",
            as: "employee",
            path: "/calendar",
            actions: [{ click: { role: "combobox", name: "Which calendar" } }],
            highlight: [
              { role: "option", name: "Holiday Calendar" },
              { role: "option", name: "Birthday Calendar" },
            ],
          },
        },
      ],
      tips: [
        {
          en: "Both calendars have a Calendar tab (one month at a time) and a Table tab (the whole year as a list).",
          hi: "दोनों कैलेंडर में Calendar टैब (एक बार में एक महीना) और Table टैब (पूरा साल एक लिस्ट में) होता है।",
        },
      ],
    },
    {
      id: "holidays-month",
      title: { en: "See holidays month by month", hi: "महीने के हिसाब से छुट्टियाँ देखें" },
      steps: [
        {
          text: {
            en: "The Calendar tab (1) shows one month at a time. Move between months with the arrows (4) and (5), or pick another year in the Year box (3). The Table tab (2) lists the whole year.",
            hi: "Calendar टैब (1) एक बार में एक महीना दिखाता है। तीर वाले बटन (4) और (5) से महीने बदलें, या Year बॉक्स (3) में दूसरा साल चुनें। Table टैब (2) में पूरे साल की लिस्ट है।",
          },
          shot: {
            id: "calendar-holidays-month",
            as: "employee",
            path: "/calendar",
            // Next month, so the grid has a floating (amber) day as well as a public one.
            actions: [{ click: { role: "button", name: "Next month", exact: true } }],
            highlight: [
              { role: "tab", name: "Calendar", exact: true },
              { role: "tab", name: "Table" },
              { role: "combobox", name: "Year" },
              { role: "button", name: "Previous month" },
              { role: "button", name: "Next month" },
            ],
          },
        },
        {
          text: {
            en: "Blue days are public holidays - everyone is off. Amber days are floating holidays - optional days off you can apply for. A tick on a day means that floating holiday is approved for you.",
            hi: "नीले दिन public holiday हैं - सबकी छुट्टी। हल्के नारंगी (amber) दिन floating holiday हैं - ऐसी वैकल्पिक छुट्टियाँ जिनके लिए आप अप्लाई कर सकते हैं। किसी दिन पर टिक का मतलब है वो floating holiday आपके लिए मंज़ूर हो चुका है।",
          },
        },
        {
          text: {
            en: "Click any day to see the holiday's name and whether it is a public or a floating holiday.",
            hi: "किसी भी दिन पर क्लिक करें, आपको हॉलिडे का नाम और ये दिखेगा कि वो public holiday है या floating holiday।",
          },
        },
        {
          text: {
            en: "The cards at the top show how many holidays the year has (Company Holidays) and how many floating holidays you have used (Floating Holidays Availed).",
            hi: "ऊपर के कार्ड बताते हैं कि साल में कुल कितनी छुट्टियाँ हैं (Company Holidays) और आपने कितने floating holidays लिए हैं (Floating Holidays Availed)।",
          },
        },
      ],
      faq: [
        {
          q: { en: "Who adds the holidays?", hi: "छुट्टियाँ कौन जोड़ता है?" },
          a: {
            en: "HR adds and changes them for the whole company. If a holiday is missing or wrong, tell HR.",
            hi: "पूरी कंपनी के लिए HR इन्हें जोड़ता और बदलता है। अगर कोई छुट्टी नहीं है या गलत है, तो HR को बताएँ।",
          },
        },
      ],
    },
    {
      id: "holidays-table",
      title: { en: "See the whole year as a list", hi: "पूरे साल की लिस्ट देखें" },
      steps: [
        {
          text: {
            en: "Open the Table tab. Each row shows the Holiday, its Date, its Type (1) - Fixed or Floating - and When (2): Today, Tomorrow, in a number of days or months, or Passed.",
            hi: "Table टैब खोलें। हर लाइन में Holiday, उसकी Date, उसका Type (1) - Fixed या Floating - और When (2) दिखता है: Today, Tomorrow, कितने दिन या महीने बाद, या Passed।",
          },
          shot: {
            id: "calendar-holidays-table",
            as: "employee",
            path: "/calendar?tab=table",
            // Page 2: page 1 is the start of the year, all Passed. The table's page
            // is local state (not in the URL), so it takes a click on Next.
            actions: [{ click: { role: "button", name: "Next", exact: true } }],
            highlight: [{ css: "th:text-is('Type')" }, { css: "th:text-is('When')" }],
            crop: { role: "table" },
          },
        },
        {
          text: {
            en: "A floating holiday that is approved for you is marked Approved for you.",
            hi: "जो floating holiday आपके लिए मंज़ूर हो चुका है, उस पर Approved for you लिखा होता है।",
          },
        },
      ],
    },
    {
      id: "floating",
      title: { en: "Apply for a floating holiday", hi: "floating holiday के लिए अप्लाई करें" },
      intro: {
        en: "Floating holidays are optional days off from a list HR sets up. You can pick up to 3 in a year.",
        hi: "Floating holidays वैकल्पिक छुट्टियाँ हैं, जिनकी लिस्ट HR बनाता है। आप साल में ज़्यादा से ज़्यादा 3 चुन सकते हैं।",
      },
      steps: [
        {
          text: {
            en: "Open the Floating Holidays tab. It lists the floating holidays for the year picked in the Year box.",
            hi: "Floating Holidays टैब खोलें। इसमें Year बॉक्स में चुने गए साल के floating holidays दिखते हैं।",
          },
        },
        {
          text: {
            en: "Click Apply (1) next to the holiday you want. The request goes to your manager and HR, and its Status stays Pending until HR gives the final approval.",
            hi: "जो हॉलिडे चाहिए, उसके आगे Apply (1) पर क्लिक करें। रिक्वेस्ट आपके मैनेजर और HR के पास जाती है, और HR की फाइनल मंज़ूरी तक उसका Status, Pending रहता है।",
          },
          shot: {
            id: "calendar-floating",
            as: "employee",
            // Page 1 is the year's past holidays; this list keeps its page in the URL, so open page 2.
            path: "/calendar?tab=floating&page=2",
            highlight: [
              { role: "button", name: "Apply", exact: true },
              { role: "button", name: "Withdraw" },
              { text: "Floating Holidays Availed" },
            ],
          },
        },
        {
          text: {
            en: "Changed your mind? Click Withdraw (2). It works on Pending and Approved requests and gives the slot back.",
            hi: "मन बदल गया? Withdraw (2) पर क्लिक करें। ये Pending और Approved दोनों रिक्वेस्ट पर काम करता है और आपकी गिनती वापस हो जाती है।",
          },
        },
        {
          text: {
            en: "Floating Holidays Availed (3) shows how many approved floating holidays you have out of your limit. Requests still waiting for approval don't count. A floating holiday is a paid day off.",
            hi: "Floating Holidays Availed (3) बताता है कि आपकी लिमिट में से कितने floating holidays approve हो चुके हैं। जो requests अभी approval का इंतज़ार कर रही हैं, वो नहीं गिनी जातीं। Floating holiday एक paid छुट्टी है।",
          },
        },
      ],
      tips: [
        {
          en: "Once all your floating holidays are approved, the Apply buttons turn grey. Withdraw one to choose a different day.",
          hi: "सारे floating holidays approve हो जाने पर Apply बटन ग्रे हो जाते हैं। कोई दूसरा दिन चुनना हो तो पहले एक Withdraw करें।",
        },
        {
          en: "If a request is rejected, the reason shows under its status and you can click Re-apply.",
          hi: "अगर रिक्वेस्ट reject हो जाए, तो उसकी वजह स्टेटस के नीचे दिखती है और आप Re-apply पर क्लिक कर सकते हैं।",
        },
        {
          en: "Holidays that are already over show Passed and can't be applied for.",
          hi: "जो हॉलिडे बीत चुके हैं, उन पर Passed लिखा होता है और उनके लिए अप्लाई नहीं हो सकता।",
        },
        {
          en: "An approved floating holiday shows as a Holiday on My Attendance.",
          hi: "मंज़ूर हुआ floating holiday, My Attendance में Holiday की तरह दिखता है।",
        },
      ],
    },
    {
      id: "floating-requests",
      title: {
        en: "For managers and HR: approve floating holidays",
        hi: "मैनेजर्स और HR के लिए: floating holidays मंज़ूर करें",
      },
      intro: {
        en: "If people report to you, or you are HR, the Holiday Calendar has a Floating Requests tab with the requests waiting for a decision.",
        hi: "अगर लोग आपको रिपोर्ट करते हैं, या आप HR हैं, तो Holiday Calendar में Floating Requests टैब दिखता है, जिसमें फैसले का इंतज़ार कर रही रिक्वेस्ट होती हैं।",
      },
      steps: [
        {
          text: {
            en: "Open the Floating Requests tab (1). Each row shows the employee, the holiday and its date, and the Manager's decision so far.",
            hi: "Floating Requests टैब (1) खोलें। हर लाइन में कर्मचारी, हॉलिडे और उसकी तारीख, और अब तक का Manager का फैसला दिखता है।",
          },
          shot: {
            id: "calendar-floating-requests",
            as: "manager",
            path: "/calendar?tab=requests",
            highlight: [
              { role: "tab", name: "Floating Requests" },
              { role: "button", name: "Approve" },
              { role: "button", name: "Reject" },
            ],
          },
        },
        {
          text: {
            en: "Click Approve (2) or Reject (3). Rejecting asks for a reason.",
            hi: "Approve (2) या Reject (3) पर क्लिक करें। Reject करने पर वजह पूछी जाती है।",
          },
        },
        {
          text: {
            en: "A manager's decision is the first step - the request stays Pending and goes to HR. HR sees every pending request, and HR's decision is the final one.",
            hi: "मैनेजर का फैसला पहला कदम है - रिक्वेस्ट Pending रहती है और HR के पास जाती है। HR सारी pending रिक्वेस्ट देखता है, और HR का फैसला ही फाइनल होता है।",
          },
        },
      ],
      tips: [
        {
          en: "You can't approve your own floating holiday request.",
          hi: "आप अपनी खुद की floating holiday रिक्वेस्ट मंज़ूर नहीं कर सकते।",
        },
      ],
    },
    {
      id: "birthdays",
      title: { en: "See birthdays", hi: "जन्मदिन देखें" },
      steps: [
        {
          text: {
            en: "Pick Birthday Calendar in the box at the top right. Birthdays show in pink on the month grid - click a day to see whose birthday it is.",
            hi: "ऊपर दाईं ओर वाले बॉक्स में Birthday Calendar चुनें। महीने के कैलेंडर में जन्मदिन गुलाबी रंग में दिखते हैं - किसका जन्मदिन है, ये देखने के लिए उस दिन पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "The Employee Birthdays card (1) lists the birthdays coming up in the next 30 days. On someone's birthday, click Send wishes to send them a notification.",
            hi: "Employee Birthdays कार्ड (1) में अगले 30 दिनों के जन्मदिन दिखते हैं। किसी के जन्मदिन वाले दिन Send wishes पर क्लिक करें, उन्हें नोटिफिकेशन चला जाएगा।",
          },
          shot: {
            id: "calendar-birthdays",
            as: "employee",
            path: "/calendar?view=birthdays",
            highlight: [{ text: "Employee Birthdays" }, { role: "tab", name: "Table" }],
          },
        },
        {
          text: {
            en: "The Table tab (2) lists everyone's birthdays for the year, with the day, Month and When.",
            hi: "Table टैब (2) में पूरे साल के सबके जन्मदिन दिखते हैं - दिन, Month और When के साथ।",
          },
        },
      ],
      tips: [
        {
          en: "Only the day and month of a birthday are shown - never anyone's age.",
          hi: "जन्मदिन की सिर्फ तारीख और महीना दिखता है - किसी की उम्र कभी नहीं।",
        },
      ],
    },
  ],
}
