import { Bell } from "lucide-react"
import type { HelpGuide } from "../../types"

export const notificationsGuide: HelpGuide = {
  slug: "notifications",
  group: "self",
  icon: Bell,
  href: "/notifications",
  title: { en: "Notifications", hi: "नोटिफिकेशन (Notifications)" },
  summary: {
    en: "See every update DNMS sends you, clear out old ones, and set when you are reminded about your tasks.",
    hi: "DNMS से आने वाला हर अपडेट देखें, पुराने हटाएँ, और तय करें कि टास्क की याद कब दिलाई जाए।",
  },
  keywords: [
    "notifications",
    "alerts",
    "bell",
    "unread",
    "mark as read",
    "delete",
    "clear",
    "reminder",
    "task reminder",
    "pop-up",
    "नोटिफिकेशन",
    "सूचना",
    "अलर्ट",
    "घंटी",
    "रिमाइंडर",
  ],
  sections: [
    {
      id: "read",
      title: { en: "See your notifications", hi: "अपने नोटिफिकेशन देखें" },
      intro: {
        en: "DNMS tells you when something changes or needs you - your leave is approved, a request needs your approval, your referral moves ahead, and so on.",
        hi: "जब कुछ बदलता है या आपकी ज़रूरत होती है, DNMS आपको बताता है - आपकी छुट्टी मंज़ूर हुई, किसी रिक्वेस्ट पर आपकी मंज़ूरी चाहिए, आपका रेफ़रल आगे बढ़ा, वगैरह।",
      },
      steps: [
        {
          text: {
            en: "Click the bell at the top right, or Notifications in the sidebar. The red number shows how many you haven't read.",
            hi: "ऊपर दाईं ओर घंटी पर, या साइडबार में Notifications पर क्लिक करें। लाल नंबर बताता है कि कितने अभी नहीं पढ़े।",
          },
        },
        {
          text: {
            en: "New ones have a blue line on the left and a blue dot. Click a notification to open the page it is about - it is marked as read at the same time.",
            hi: "नए नोटिफिकेशन के बाईं ओर नीली लाइन और एक नीला डॉट होता है। किसी नोटिफिकेशन पर क्लिक करें तो उससे जुड़ा पेज खुल जाता है - और वो उसी समय पढ़ा हुआ (read) मान लिया जाता है।",
          },
        },
        {
          text: {
            en: "Click Mark all as read (1) to clear the unread count in one go. Reminder settings (2) and Clear all (3) are explained below.",
            hi: "सारे एक साथ पढ़ा हुआ करने के लिए Mark all as read (1) पर क्लिक करें। Reminder settings (2) और Clear all (3) के बारे में नीचे बताया गया है।",
          },
          shot: {
            id: "notifications-page",
            as: "employee",
            path: "/notifications",
            highlight: [
              { role: "button", name: "Mark all as read" },
              { role: "button", name: "Reminder settings" },
              { role: "button", name: "Clear all" },
            ],
          },
        },
        {
          text: {
            en: "Ten notifications show per page. Use the page buttons at the bottom to see older ones.",
            hi: "एक पेज पर 10 नोटिफिकेशन दिखते हैं। पुराने देखने के लिए नीचे पेज वाले बटन इस्तेमाल करें।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "I clicked a notification and no page opened. Why?",
            hi: "मैंने नोटिफिकेशन पर क्लिक किया पर कोई पेज नहीं खुला। क्यों?",
          },
          a: {
            en: "Some notifications are only for your information and have no page to open. Clicking them just marks them as read.",
            hi: "कुछ नोटिफिकेशन सिर्फ़ जानकारी के लिए होते हैं और उनका कोई पेज नहीं होता। उन पर क्लिक करने से वो बस पढ़े हुए मान लिए जाते हैं।",
          },
        },
      ],
    },
    {
      id: "pop-ups",
      title: { en: "Alerts while you work", hi: "काम करते समय आने वाले अलर्ट" },
      steps: [
        {
          text: {
            en: "When a notification arrives while DNMS is open, a small pop-up shows at the top right for a few seconds. Click View on it to open the page.",
            hi: "DNMS खुला हो और कोई नोटिफिकेशन आए, तो ऊपर दाईं ओर कुछ सेकंड के लिए एक छोटा पॉप-अप दिखता है। पेज खोलने के लिए उस पर View पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Your browser may ask whether DNMS can show notifications. Click Allow. Then DNMS can alert you even when its tab is in the background or closed.",
            hi: "आपका ब्राउज़र पूछ सकता है कि क्या DNMS नोटिफिकेशन दिखा सकता है। Allow पर क्लिक करें। फिर DNMS का टैब पीछे हो या बंद हो, तब भी आपको अलर्ट मिल सकता है।",
          },
        },
      ],
      tips: [
        {
          en: "Blocked notifications by mistake? Click the icon to the left of the web address in your browser, and allow notifications for DNMS.",
          hi: "गलती से नोटिफिकेशन ब्लॉक कर दिए? ब्राउज़र में वेब एड्रेस के बाईं ओर वाले आइकन पर क्लिक करें, और DNMS के लिए notifications को allow करें।",
        },
      ],
    },
    {
      id: "delete",
      title: { en: "Delete notifications", hi: "नोटिफिकेशन डिलीट करें" },
      steps: [
        {
          text: {
            en: "Point at a notification and a bin icon (1) appears on its right. Click it to delete that one.",
            hi: "किसी नोटिफिकेशन पर माउस ले जाएँ, उसके दाईं ओर एक डस्टबिन आइकन (1) दिखेगा। उसे डिलीट करने के लिए उस पर क्लिक करें।",
          },
          shot: {
            id: "notifications-delete",
            as: "employee",
            path: "/notifications",
            actions: [{ hover: { role: "button", name: "Delete notification" } }],
            highlight: [{ role: "button", name: "Delete notification" }],
          },
        },
        {
          text: {
            en: "To delete all of them, click Clear all at the top and confirm. Deleted notifications can't be brought back.",
            hi: "सारे डिलीट करने के लिए ऊपर Clear all पर क्लिक करें और कन्फ़र्म करें। डिलीट हुए नोटिफिकेशन वापस नहीं आते।",
          },
        },
      ],
    },
    {
      id: "reminders",
      title: { en: "Task time reminders", hi: "टास्क के समय की याद (Task time reminders)" },
      intro: {
        en: "When you start a task, DNMS can warn you before the hours booked for it run out. For example, a task booked for one hour and started at 10:00 is due at 11:00.",
        hi: "जब आप कोई टास्क शुरू करते हैं, तो DNMS उसके लिए तय (booked) घंटे खत्म होने से पहले आपको याद दिला सकता है। जैसे, एक घंटे वाला टास्क 10:00 बजे शुरू किया तो वो 11:00 बजे ड्यू है।",
      },
      steps: [
        {
          text: {
            en: "Click Reminder settings at the top of the page. The Task time reminders card opens. Use the switch (1) to turn reminders on or off. They are on by default, with one warning 15 minutes before the time is up.",
            hi: "पेज के ऊपर Reminder settings पर क्लिक करें। Task time reminders वाला कार्ड खुल जाएगा। रिमाइंडर चालू या बंद करने के लिए स्विच (1) इस्तेमाल करें। ये पहले से चालू रहते हैं, समय खत्म होने से 15 मिनट पहले एक याद के साथ।",
          },
          shot: {
            id: "notifications-reminders",
            as: "employee",
            path: "/notifications",
            actions: [{ click: { role: "button", name: "Reminder settings" } }],
            highlight: [
              { role: "switch", name: "Enable task time reminders" },
              { label: "Warn me this many minutes before the time is up" },
              { label: "How many times" },
              { label: "Minutes between reminders" },
              { role: "button", name: "Save", exact: true },
            ],
          },
        },
        {
          text: {
            en: "In Warn me this many minutes before the time is up (2), type a number, or click 5, 10, 15, 30 or 60 min.",
            hi: "Warn me this many minutes before the time is up (2) में कोई नंबर टाइप करें, या 5, 10, 15, 30 या 60 min पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Want more than one reminder? Set How many times (3) and Minutes between reminders (4). The You will be reminded box below shows exactly when each one will come.",
            hi: "एक से ज़्यादा बार याद दिलाना है? How many times (3) और Minutes between reminders (4) भरें। नीचे You will be reminded वाला बॉक्स दिखाता है कि हर रिमाइंडर ठीक कब आएगा।",
          },
        },
        {
          text: {
            en: "Click Save (5). Changed your mind before saving? Click Cancel to go back to your saved settings.",
            hi: "Save (5) पर क्लिक करें। सेव करने से पहले मन बदल गया? अपनी पुरानी सेटिंग्स पर लौटने के लिए Cancel पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "A reminder that comes after the deadline tells you how far over the booked time the task has run.",
          hi: "जो रिमाइंडर डेडलाइन के बाद आता है, वो बताता है कि टास्क तय समय से कितना ऊपर चला गया है।",
        },
        {
          en: "The same settings are on the Notifications tab of My Profile. Change them in either place.",
          hi: "यही सेटिंग्स My Profile के Notifications टैब में भी हैं। किसी भी जगह से बदल सकते हैं।",
        },
      ],
      faq: [
        {
          q: {
            en: "Why don't I get any task reminders?",
            hi: "मुझे टास्क के रिमाइंडर क्यों नहीं आते?",
          },
          a: {
            en: "Reminders only work for a task you have started (In Progress) that has hours booked on it. Also check that the switch is on.",
            hi: "रिमाइंडर सिर्फ़ उस टास्क के लिए आते हैं जो आपने शुरू किया है (In Progress) और जिस पर घंटे तय (booked) हैं। साथ ही देखें कि स्विच चालू है।",
          },
        },
      ],
    },
  ],
}
