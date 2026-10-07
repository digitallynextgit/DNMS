import { Clock } from "lucide-react"
import type { HelpGuide } from "../../types"

export const myAttendanceGuide: HelpGuide = {
  slug: "my-attendance",
  group: "self",
  icon: Clock,
  href: "/attendance/me",
  title: { en: "My Attendance", hi: "मेरी हाज़िरी (My Attendance)" },
  summary: {
    en: "See your attendance for any month - the days you were in, your punch times and hours, and your leave, WFH and holidays.",
    hi: "किसी भी महीने की अपनी हाज़िरी देखें - आप किन दिनों ऑफिस आए, आपके पंच टाइम और घंटे, और आपकी छुट्टी, WFH और हॉलिडे।",
  },
  keywords: [
    "attendance",
    "punch",
    "check in",
    "check out",
    "biometric",
    "missing punch",
    "half day",
    "work hours",
    "हाज़िरी",
    "हाजिरी",
    "उपस्थिति",
    "पंच",
  ],
  sections: [
    {
      id: "how-it-works",
      title: { en: "How your attendance gets here", hi: "आपकी हाज़िरी यहाँ कैसे आती है" },
      intro: {
        en: "You don't check in or out in DNMS. You punch on the office attendance machine when you arrive and again when you leave. Your punches reach DNMS on their own, and My Attendance shows them.",
        hi: "DNMS में आपको check in या check out नहीं करना होता। ऑफिस आते समय अटेंडेंस मशीन पर पंच करें और जाते समय फिर से पंच करें। आपके पंच अपने आप DNMS में आ जाते हैं, और My Attendance उन्हें दिखाता है।",
      },
      tips: [
        {
          en: "Your first punch of the day counts as your check-in, and your last punch as your check-out.",
          hi: "दिन का आपका पहला पंच check-in माना जाता है, और आखिरी पंच check-out।",
        },
        {
          en: "Today's punches can take a little while to show up. If a day is still wrong the next day, tell HR.",
          hi: "आज के पंच दिखने में थोड़ा समय लग सकता है। अगर अगले दिन भी कोई दिन गलत दिखे, तो HR को बताएँ।",
        },
      ],
      faq: [
        {
          q: {
            en: "Can I check in from the app or my phone?",
            hi: "क्या ऐप या फोन से check in हो सकता है?",
          },
          a: {
            en: "No. Attendance comes only from the office attendance machine.",
            hi: "नहीं। हाज़िरी सिर्फ ऑफिस की अटेंडेंस मशीन से आती है।",
          },
        },
        {
          q: {
            en: "Does DNMS mark me late or absent here?",
            hi: "क्या DNMS यहाँ मुझे late या absent दिखाता है?",
          },
          a: {
            en: "No. This calendar doesn't mark late arrivals, and a working day with no punch shows as an empty box, not as Absent.",
            hi: "नहीं। यह कैलेंडर देर से आने को मार्क नहीं करता, और बिना पंच वाला वर्किंग डे खाली बॉक्स दिखता है, Absent नहीं।",
          },
        },
      ],
    },
    {
      id: "month-summary",
      title: { en: "See your month at a glance", hi: "अपना पूरा महीना एक नज़र में देखें" },
      steps: [
        {
          text: {
            en: "Click My Attendance in the sidebar. The month you are looking at is written under the title. Use the arrows to go to the previous month (1) or the next month (2).",
            hi: "साइडबार में My Attendance पर क्लिक करें। आप कौन सा महीना देख रहे हैं, वो टाइटल के नीचे लिखा होता है। पिछले महीने (1) या अगले महीने (2) पर जाने के लिए तीर वाले बटन इस्तेमाल करें।",
          },
          shot: {
            id: "my-attendance-overview",
            as: "employee",
            path: "/attendance/me",
            highlight: [
              { role: "button", name: "Previous month" },
              { role: "button", name: "Next month" },
              { text: "Present Days" },
              { text: "Avg Work Hours" },
            ],
          },
        },
        {
          text: {
            en: "The cards show that month's totals: Present Days (3), Missing Punch, Half Days, and Avg Work Hours (4) - your average hours on the days you worked.",
            hi: "कार्ड्स उस महीने का हिसाब दिखाते हैं: Present Days (3), Missing Punch, Half Days, और Avg Work Hours (4) - यानी जिन दिनों आपने काम किया, उन दिनों के औसत घंटे।",
          },
        },
      ],
      tips: [
        {
          en: "The arrows stop at the month of your first punch and at the current month - there is nothing to see before or after.",
          hi: "तीर वाले बटन आपके पहले पंच वाले महीने और चालू महीने पर रुक जाते हैं - उससे पहले या बाद का कुछ दिखाने को नहीं होता।",
        },
      ],
      faq: [
        {
          q: { en: "Can I download my attendance?", hi: "क्या मेरी हाज़िरी डाउनलोड हो सकती है?" },
          a: {
            en: "Not from this page. If you need an attendance report, ask HR.",
            hi: "इस पेज से नहीं। अगर आपको हाज़िरी की रिपोर्ट चाहिए, तो HR से माँगें।",
          },
        },
      ],
    },
    {
      id: "calendar-colours",
      title: { en: "Read the calendar colours", hi: "कैलेंडर के रंग समझें" },
      intro: {
        en: "Each box is one day of the month, and its colour tells you what kind of day it was. The key under the calendar lists every colour.",
        hi: "हर बॉक्स महीने का एक दिन है, और उसका रंग बताता है कि वो दिन कैसा था। कैलेंडर के नीचे हर रंग का मतलब लिखा होता है।",
      },
      steps: [
        {
          text: {
            en: "Green is Present (1) - you punched in and out. The box shows the hours you worked and your check-in and check-out times.",
            hi: "हरा रंग Present (1) है - आपने आते और जाते समय पंच किया। बॉक्स में आपके काम के घंटे और check-in व check-out का टाइम दिखता है।",
          },
          shot: {
            id: "my-attendance-calendar",
            as: "employee",
            path: "/attendance/me",
            actions: [{ click: { role: "button", name: "Previous month" } }],
            highlight: [
              { role: "button", name: "Present. View details" },
              { role: "button", name: "Half day. View details" },
              { role: "button", name: "Missing punch. View details" },
              { role: "button", name: "Leave. View details" },
              { role: "button", name: "Work from home. View details" },
            ],
          },
        },
        {
          text: {
            en: "Orange is a Half day (2) - you punched in and out, but worked less than a full day (usually under 8 hours).",
            hi: "नारंगी रंग Half day (2) है - आपने आते और जाते समय पंच किया, लेकिन पूरे दिन से कम काम किया (आमतौर पर 8 घंटे से कम)।",
          },
        },
        {
          text: {
            en: "Purple is a Missing punch (3) - only one punch was recorded that day, so DNMS can't work out your hours. Usually it means you forgot to punch in or out.",
            hi: "बैंगनी रंग Missing punch (3) है - उस दिन सिर्फ एक पंच दर्ज हुआ, इसलिए DNMS आपके घंटे नहीं गिन पाता। आमतौर पर इसका मतलब है कि आप आते या जाते समय पंच करना भूल गए।",
          },
        },
        {
          text: {
            en: "Red is Leave (4), yellow is Work from home (5), and blue is a Holiday. These boxes show the leave type or the holiday name. Grey days are weekends.",
            hi: "लाल रंग Leave (4) है, पीला Work from home (5), और नीला Holiday। इन बॉक्स में छुट्टी का टाइप या हॉलिडे का नाम लिखा होता है। ग्रे दिन वीकेंड हैं।",
          },
        },
      ],
      tips: [
        {
          en: "A box with a dashed border and no colour has no record. It is a future day, a day before you started punching, or a working day with no punch and no leave, WFH or holiday.",
          hi: "डैश वाली बॉर्डर और बिना रंग वाले बॉक्स का कोई रिकॉर्ड नहीं है। ये आने वाला दिन हो सकता है, आपके पंच शुरू होने से पहले का दिन, या ऐसा वर्किंग डे जिस पर न पंच है, न छुट्टी, न WFH, न हॉलिडे।",
        },
        {
          en: "Only approved leave and approved WFH show on the calendar. A request that is still Pending does not.",
          hi: "कैलेंडर पर सिर्फ मंज़ूर हुई छुट्टी और मंज़ूर हुआ WFH दिखता है। जो रिक्वेस्ट अभी Pending है, वो नहीं दिखती।",
        },
        {
          en: "Your birthday is a paid day off. If you don't come in that day, it shows as a blue Holiday.",
          hi: "आपका जन्मदिन पेड छुट्टी है। अगर आप उस दिन नहीं आते, तो वो नीले Holiday की तरह दिखता है।",
        },
      ],
    },
    {
      id: "day-detail",
      title: { en: "See the details of one day", hi: "किसी एक दिन की पूरी जानकारी देखें" },
      steps: [
        {
          text: {
            en: "Click any day on the calendar. A small window opens with the full date, the day's status, and your Check in (1) and Check out (2) times and Work hours.",
            hi: "कैलेंडर में किसी भी दिन पर क्लिक करें। एक छोटी विंडो खुलती है जिसमें पूरी तारीख, उस दिन का स्टेटस, और आपका Check in (1) और Check out (2) टाइम और Work hours दिखते हैं।",
          },
          shot: {
            id: "my-attendance-day-detail",
            as: "employee",
            path: "/attendance/me",
            actions: [
              { click: { role: "button", name: "Previous month" } },
              { click: { role: "button", name: "Missing punch. View details" } },
            ],
            highlight: [
              { text: "Check in", exact: true },
              { text: "Check out", exact: true },
              { text: "One punch is missing for this day" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "On a Missing punch day, the missing time shows as --:-- and a note (3) tells you one punch is missing.",
            hi: "Missing punch वाले दिन, जो टाइम नहीं है वो --:-- दिखता है, और एक नोट (3) बताता है कि एक पंच गायब है।",
          },
        },
      ],
      tips: [
        {
          en: "On a phone the boxes are too small for times - tap a day to see them in this window.",
          hi: "फोन पर बॉक्स इतने छोटे होते हैं कि टाइम नहीं दिखता - किसी दिन पर टैप करें और इस विंडो में देख लें।",
        },
      ],
    },
    {
      id: "fix-a-day",
      title: { en: "Something looks wrong?", hi: "कुछ गलत दिख रहा है?" },
      intro: {
        en: "You can't edit your own attendance. HR corrects wrong days for you.",
        hi: "आप अपनी हाज़िरी खुद नहीं बदल सकते। गलत दिनों को HR आपके लिए ठीक करता है।",
      },
      steps: [
        {
          text: {
            en: "Note the date and what is wrong - for example, you forgot to punch out, or you were in the office on a day that shows no record.",
            hi: "तारीख और गलती नोट कर लें - जैसे, आप जाते समय पंच करना भूल गए, या आप ऑफिस में थे लेकिन उस दिन का कोई रिकॉर्ड नहीं दिख रहा।",
          },
        },
        {
          text: {
            en: "Send it to HR, for example in Chat, with your real in and out times. Once HR corrects it, your calendar updates.",
            hi: "ये जानकारी अपने असली आने और जाने के टाइम के साथ HR को भेजें, जैसे Chat में। HR के ठीक करते ही आपका कैलेंडर अपडेट हो जाता है।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "The day window says to raise a regularization request. Where do I do that?",
            hi: "दिन वाली विंडो में regularization request डालने को कहा गया है। वो कहाँ करें?",
          },
          a: {
            en: "There is no separate form for it in DNMS. Message HR with the date and your real times, and they will correct it.",
            hi: "DNMS में इसके लिए अलग से कोई फॉर्म नहीं है। तारीख और अपने असली टाइम के साथ HR को मैसेज करें, वो इसे ठीक कर देंगे।",
          },
        },
        {
          q: {
            en: "Why should I get a wrong day fixed quickly?",
            hi: "गलत दिन को जल्दी ठीक करवाना क्यों ज़रूरी है?",
          },
          a: {
            en: "Your salary is worked out from your attendance. A past working day with no record and no approved paid leave can be counted as unpaid, so get it fixed before the month's payroll is made.",
            hi: "आपकी सैलरी आपकी हाज़िरी के हिसाब से बनती है। बिना रिकॉर्ड और बिना मंज़ूर पेड छुट्टी वाला पुराना वर्किंग डे बिना वेतन का गिना जा सकता है, इसलिए महीने का पेरोल बनने से पहले इसे ठीक करवा लें।",
          },
        },
      ],
    },
  ],
}
