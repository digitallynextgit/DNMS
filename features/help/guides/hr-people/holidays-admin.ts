import { CalendarRange } from "lucide-react"
import { PERMISSIONS } from "@/lib/constants"
import type { HelpGuide } from "../../types"

export const holidaysAdminGuide: HelpGuide = {
  slug: "holidays-admin",
  group: "hr",
  icon: CalendarRange,
  href: "/holidays",
  title: { en: "Holiday Calendar for HR", hi: "HR के लिए छुट्टियों का कैलेंडर" },
  summary: {
    en: "Add the company's holidays for the year, mark floating holidays, and approve employees' floating holiday requests.",
    hi: "साल भर की कंपनी की छुट्टियाँ जोड़ें, floating holidays तय करें, और employees की floating holiday requests approve करें।",
  },
  keywords: [
    "holiday",
    "holidays",
    "calendar",
    "floating holiday",
    "optional holiday",
    "festival",
    "public holiday",
    "छुट्टी",
    "त्योहार",
    "कैलेंडर",
    "फ्लोटिंग",
  ],
  sections: [
    {
      id: "overview",
      title: { en: "Open the holiday calendar", hi: "Holiday calendar खोलें" },
      steps: [
        {
          text: {
            en: "In the HR part of the sidebar, click Calendar. Make sure Holiday Calendar is picked at the top right (1) - the other choice is the Birthday Calendar.",
            hi: "साइडबार के HR वाले हिस्से में Calendar पर क्लिक करें। पक्का करें कि ऊपर दाईं ओर (1) Holiday Calendar चुना हुआ है - दूसरा ऑप्शन Birthday Calendar है।",
          },
          shot: {
            id: "holidays-admin-overview",
            as: "hr",
            path: "/holidays",
            highlight: [
              { role: "combobox", name: "Which calendar" },
              { role: "tab", name: "Table", exact: true },
              { role: "tab", name: "Floating Requests" },
              { role: "combobox", name: "Year" },
            ],
          },
        },
        {
          text: {
            en: "Choose how to look at it: Table (2) lists every holiday, Calendar shows them month by month, and Floating Requests (3) holds the requests waiting for you. Pick a Year (4) to see another year.",
            hi: "देखने का तरीका चुनें: Table (2) में सारी छुट्टियों की लिस्ट है, Calendar में महीने के हिसाब से दिखती हैं, और Floating Requests (3) में आपके पास आई requests हैं। दूसरा साल देखने के लिए Year (4) चुनें।",
          },
        },
        {
          text: {
            en: "The boxes count Total Holidays, Fixed Holidays and Floating Holidays for the year.",
            hi: "बॉक्स साल की Total Holidays, Fixed Holidays और Floating Holidays गिनते हैं।",
          },
        },
      ],
      tips: [
        {
          en: "Employees see the same holidays on their own Calendar page, just without the buttons to add or change them.",
          hi: "Employees को यही छुट्टियाँ अपने Calendar पेज पर दिखती हैं, बस उनमें जोड़ने या बदलने के बटन नहीं होते।",
        },
      ],
    },
    {
      id: "add",
      title: { en: "Add a holiday", hi: "छुट्टी जोड़ें" },
      permission: PERMISSIONS.ATTENDANCE_WRITE,
      steps: [
        {
          text: {
            en: "Click Add Holiday at the top right.",
            hi: "ऊपर दाईं ओर Add Holiday पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Type the Holiday Name (1), pick the Date, and add a short Description (optional) (2) if you like.",
            hi: "Holiday Name (1) टाइप करें, Date चुनें, और चाहें तो छोटा सा Description (optional) (2) लिखें।",
          },
          shot: {
            id: "holidays-admin-add",
            as: "hr",
            path: "/holidays",
            actions: [{ click: { role: "button", name: "Add Holiday" } }],
            highlight: [
              { label: "Holiday Name" },
              { label: "Description (optional)" },
              { role: "checkbox", name: "Floating holiday" },
              { role: "button", name: "Add Holiday", nth: -1 },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Tick Floating holiday (3) for an optional day off that employees can choose to take. Leave it unticked for a fixed holiday the whole company gets. Click Add Holiday (4).",
            hi: "अगर ये ऐसी optional छुट्टी है जिसे employees अपनी मर्ज़ी से ले सकते हैं, तो Floating holiday (3) पर टिक करें। पूरी कंपनी की fixed छुट्टी के लिए इसे खाली छोड़ दें। Add Holiday (4) पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "Each employee can take any 3 of the floating holidays.",
          hi: "हर employee floating holidays में से कोई भी 3 ले सकता है।",
        },
        {
          en: "The date picker only offers days in the year you are viewing. To add next year's holidays, switch the Year first.",
          hi: "Date picker में सिर्फ उसी साल के दिन आते हैं जो आप देख रहे हैं। अगले साल की छुट्टियाँ जोड़नी हों, तो पहले Year बदलें।",
        },
      ],
    },
    {
      id: "edit-delete",
      title: { en: "Edit or delete a holiday", hi: "छुट्टी edit या delete करें" },
      permission: PERMISSIONS.ATTENDANCE_WRITE,
      steps: [
        {
          text: {
            en: "On the Table view, click the pencil (1) on a row to change that holiday, then click Save Changes.",
            hi: "Table view में किसी लाइन की पेंसिल (1) पर क्लिक करके वो छुट्टी बदलें, फिर Save Changes पर क्लिक करें।",
          },
          shot: {
            id: "holidays-admin-table",
            as: "hr",
            path: "/holidays",
            highlight: [
              { role: "button", name: "Edit", exact: true },
              { role: "button", name: "Delete", exact: true },
              { role: "checkbox", name: "Select all" },
            ],
            crop: { role: "table" },
          },
        },
        {
          text: {
            en: "Click the bin (2) to delete a holiday, then Delete to confirm. To delete several at once, tick their boxes - or the box at the top (3) for the whole page - and click Delete in the bar that appears.",
            hi: "छुट्टी delete करने के लिए डस्टबिन (2) पर क्लिक करें, फिर कन्फर्म करने के लिए Delete पर। कई एक साथ delete करनी हों तो उनके बॉक्स टिक करें - या पूरे पेज के लिए ऊपर वाला बॉक्स (3) - और जो बार दिखे उसमें Delete पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "Deleting a holiday can't be undone.",
          hi: "Delete की गई छुट्टी वापस नहीं आती।",
        },
      ],
    },
    {
      id: "floating",
      title: {
        en: "Approve floating holiday requests",
        hi: "Floating holiday requests approve करें",
      },
      permission: PERMISSIONS.ATTENDANCE_WRITE,
      intro: {
        en: "Employees ask for a floating holiday from the Floating Holidays tab of their own Calendar. Their manager gives an opinion first, and HR makes the final call.",
        hi: "Employees अपने Calendar के Floating Holidays टैब से floating holiday माँगते हैं। पहले उनका मैनेजर अपनी राय देता है, और आखिरी फैसला HR का होता है।",
      },
      steps: [
        {
          text: {
            en: "Open the Floating Requests tab. Each row shows the employee, the Holiday and its Date, their Reason, and what their Manager decided so far.",
            hi: "Floating Requests टैब खोलें। हर लाइन में employee, Holiday और उसकी Date, उनका Reason, और उनके Manager ने अब तक क्या फैसला किया, ये दिखता है।",
          },
        },
        {
          text: {
            en: "Click Approve (1) to give them the day. To turn it down, click Reject (2), write a Reason for rejection, and click Reject again.",
            hi: "उन्हें छुट्टी देने के लिए Approve (1) पर क्लिक करें। मना करना हो तो Reject (2) पर क्लिक करें, Reason for rejection लिखें, और दोबारा Reject पर क्लिक करें।",
          },
          shot: {
            id: "holidays-admin-requests",
            as: "hr",
            path: "/holidays?tab=requests",
            highlight: [
              { role: "button", name: "Approve" },
              { role: "button", name: "Reject" },
            ],
            crop: { role: "table" },
          },
        },
        {
          text: {
            en: "The employee gets a notification either way.",
            hi: "दोनों ही हालत में employee को नोटिफिकेशन मिलता है।",
          },
        },
      ],
      tips: [
        {
          en: "HR's decision is final. You can still approve a request even if the manager declined it.",
          hi: "HR का फैसला आखिरी होता है। मैनेजर ने मना किया हो, तब भी आप request approve कर सकते हैं।",
        },
      ],
    },
  ],
}
