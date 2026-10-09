import { Clock } from "lucide-react"
import type { HelpGuide } from "../../types"

export const attendanceAdminGuide: HelpGuide = {
  slug: "attendance-admin",
  group: "hr",
  icon: Clock,
  href: "/attendance/attendance-directory",
  title: {
    en: "Attendance Directory and Devices",
    hi: "अटेंडेंस डायरेक्टरी और डिवाइस (Attendance)",
  },
  summary: {
    en: "See everyone's attendance for a day or a date range, fix wrong punches, and manage the attendance machines that record them.",
    hi: "किसी दिन या तारीखों की रेंज के लिए सबकी अटेंडेंस देखें, गलत पंच ठीक करें, और पंच रिकॉर्ड करने वाली अटेंडेंस मशीनें मैनेज करें।",
  },
  keywords: [
    "attendance",
    "punch",
    "check in",
    "check out",
    "biometric",
    "device",
    "machine",
    "hikvision",
    "missing punch",
    "correction",
    "sync",
    "हाज़िरी",
    "अटेंडेंस",
    "पंच",
    "बायोमेट्रिक",
    "मशीन",
  ],
  sections: [
    {
      id: "today",
      title: { en: "See who's in today", hi: "देखें आज कौन आया है" },
      steps: [
        {
          text: {
            en: "In the sidebar, open Attendance and click Attendance Directory. The boxes at the top count Total Employees (1), Present, Not Present and Half Day for the day.",
            hi: "साइडबार में Attendance खोलें और Attendance Directory पर क्लिक करें। ऊपर के बॉक्स उस दिन के Total Employees (1), Present, Not Present और Half Day गिनते हैं।",
          },
          shot: {
            id: "attendance-admin-directory",
            as: "hr",
            path: "/attendance/attendance-directory",
            highlight: [
              { text: "Total Employees" },
              { placeholder: "Search by name or ID..." },
              { role: "button", name: "Correct Punch" },
            ],
          },
        },
        {
          text: {
            en: "The table has one row per active employee, with their Check In, Check Out, Work Hours and Status. To find someone, type their name or employee code in the search box at the top of the table (2).",
            hi: "टेबल में हर active employee की एक लाइन है, जिसमें उनका Check In, Check Out, Work Hours और Status है। किसी को ढूँढने के लिए टेबल के ऊपर वाले सर्च बॉक्स (2) में उनका नाम या employee code टाइप करें।",
          },
        },
        {
          text: {
            en: "Spotted a wrong or missing time? Use Correct Punch (3) - see Correct a punch below.",
            hi: "कोई समय गलत है या छूट गया है? Correct Punch (3) इस्तेमाल करें - नीचे पंच ठीक करें वाला सेक्शन देखें।",
          },
        },
      ],
      tips: [
        {
          en: "Not Present counts everyone with no punch that day - people on leave, people absent, and anyone whose machine hasn't synced yet.",
          hi: "Not Present में वो सब गिने जाते हैं जिनका उस दिन कोई पंच नहीं है - छुट्टी वाले, गैरहाज़िर, और वो भी जिनकी मशीन अभी sync नहीं हुई।",
        },
        {
          en: "Missing punch means there is a check-in without a check-out, or the other way round.",
          hi: "Missing punch का मतलब है कि check-in है पर check-out नहीं, या उल्टा।",
        },
      ],
    },
    {
      id: "range",
      title: { en: "Look at a date range", hi: "तारीखों की रेंज देखें" },
      steps: [
        {
          text: {
            en: "Pick a From (1) and a To (2) date. For more than one day the table switches to totals for each person: Present, Half Day, Absent and Avg Hours.",
            hi: "From (1) और To (2) तारीख चुनें। एक से ज़्यादा दिन चुनने पर टेबल हर व्यक्ति का टोटल दिखाने लगती है: Present, Half Day, Absent और Avg Hours।",
          },
          shot: {
            id: "attendance-admin-range",
            as: "hr",
            path: "/attendance/attendance-directory",
            highlight: [
              { text: "From", exact: true },
              { text: "To", exact: true },
            ],
          },
        },
        {
          text: {
            en: "Click Clear to go back to today.",
            hi: "वापस आज पर आने के लिए Clear पर क्लिक करें।",
          },
        },
      ],
    },
    {
      id: "person",
      title: { en: "See one person's month", hi: "किसी एक व्यक्ति का पूरा महीना देखें" },
      steps: [
        {
          text: {
            en: "Click a name in the table. Their page shows Present Days (1), Missing Punch (2), Half Days and Avg Work Hours for the month, and a calendar coloured by status.",
            hi: "टेबल में किसी नाम पर क्लिक करें। उनके पेज पर महीने के Present Days (1), Missing Punch (2), Half Days और Avg Work Hours, और status के हिसाब से रंगा हुआ एक कैलेंडर दिखता है।",
          },
          shot: {
            id: "attendance-admin-person",
            as: "hr",
            path: "/attendance/attendance-directory/DM004-priya-sharma",
            highlight: [{ text: "Present Days" }, { text: "Missing Punch", exact: true }],
          },
        },
        {
          text: {
            en: "Use the arrows at the top right to move between months. Click any day to see its check-in, check-out and work hours.",
            hi: "महीना बदलने के लिए ऊपर दाईं ओर के तीर इस्तेमाल करें। किसी भी दिन पर क्लिक करें तो उस दिन का check-in, check-out और work hours दिखेगा।",
          },
        },
      ],
    },
    {
      id: "correct",
      title: { en: "Correct a punch", hi: "पंच ठीक करें" },
      intro: {
        en: "Use this when someone forgot to punch, or the machine recorded the wrong time.",
        hi: "इसे तब इस्तेमाल करें जब कोई पंच करना भूल गया हो, या मशीन ने गलत समय रिकॉर्ड किया हो।",
      },
      steps: [
        {
          text: {
            en: "Click Correct Punch at the top right of the Attendance Directory.",
            hi: "Attendance Directory में ऊपर दाईं ओर Correct Punch पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Pick the Employee (1) and the Date. Set the Check In and Check Out times - you can fill in just one of them. DNMS shows the status it will save, such as Present or Half Day, and the hours worked.",
            hi: "Employee (1) और Date चुनें। Check In और Check Out का समय डालें - चाहें तो इनमें से सिर्फ एक भी भर सकते हैं। DNMS दिखाता है कि कौन सा status सेव होगा, जैसे Present या Half Day, और कितने घंटे काम हुआ।",
          },
          shot: {
            id: "attendance-admin-correct",
            as: "hr",
            path: "/attendance/attendance-directory",
            actions: [{ click: { role: "button", name: "Correct Punch" } }],
            highlight: [
              { placeholder: "Select employee..." },
              { label: "Notes" },
              { role: "button", name: "Apply" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Add Notes (2) if they help, then click Apply (3).",
            hi: "ज़रूरत हो तो Notes (2) लिखें, फिर Apply (3) पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "If Check Out is before Check In, the form tells you so before you save.",
          hi: "अगर Check Out का समय Check In से पहले है, तो सेव करने से पहले ही फॉर्म बता देता है।",
        },
        {
          en: "Your corrections are kept even when a machine is fully re-synced.",
          hi: "मशीन को पूरा re-sync करने पर भी आपके किए हुए सुधार बने रहते हैं।",
        },
      ],
    },
    {
      id: "devices",
      title: { en: "Manage the attendance machines", hi: "अटेंडेंस मशीनें मैनेज करें" },
      intro: {
        en: "Punches come from the Hikvision attendance machines in the office. The Devices page connects them to DNMS.",
        hi: "पंच ऑफिस में लगी Hikvision अटेंडेंस मशीनों से आते हैं। Devices पेज इन मशीनों को DNMS से जोड़ता है।",
      },
      steps: [
        {
          text: {
            en: "In the sidebar, open Attendance and click Devices. The table lists each machine with its Serial, IP Address, Location, whether it is Enabled, and its Last Sync.",
            hi: "साइडबार में Attendance खोलें और Devices पर क्लिक करें। टेबल में हर मशीन का Serial, IP Address, Location, वो Enabled है या नहीं, और उसका Last Sync दिखता है।",
          },
        },
        {
          text: {
            en: "Click Test (1) to check DNMS can reach the machine. Click Sync (2) to pull in new punches now - a progress bar shows how far it has got.",
            hi: "DNMS मशीन तक पहुँच पा रहा है या नहीं, ये चेक करने के लिए Test (1) पर क्लिक करें। नए पंच अभी लाने के लिए Sync (2) पर क्लिक करें - एक progress bar दिखाती है कि कितना हुआ।",
          },
          shot: {
            id: "attendance-admin-devices",
            as: "hr",
            path: "/attendance/devices",
            highlight: [
              { role: "button", name: "Test", exact: true },
              { role: "button", name: "Sync", exact: true },
              { role: "button", name: "Full re-sync" },
              { role: "button", name: "Edit device" },
            ],
            crop: { role: "table" },
          },
        },
        {
          text: {
            en: "The clock-arrow button (3) is Full re-sync, which you confirm with Full re-sync. It rebuilds everyone's attendance from the machine, back to their joining date. Use it only to fix old, wrong days - it can take a while and has to run on the office network.",
            hi: "घड़ी-तीर वाला बटन (3) Full re-sync है, जिसे Full re-sync पर क्लिक करके कन्फर्म करना होता है। ये मशीन से सबकी अटेंडेंस उनकी जॉइनिंग की तारीख तक दोबारा बनाता है। इसे सिर्फ पुराने गलत दिनों को ठीक करने के लिए इस्तेमाल करें - इसमें समय लग सकता है और ये ऑफिस नेटवर्क पर ही चलता है।",
          },
        },
        {
          text: {
            en: "The pencil (4) edits the machine's details, and the bin next to it deletes the machine. Deleting a machine keeps the attendance it has already recorded.",
            hi: "पेंसिल (4) से मशीन की डिटेल्स edit होती हैं, और उसके बगल वाले डस्टबिन से मशीन delete होती है। मशीन delete करने पर उसकी रिकॉर्ड की हुई अटेंडेंस बनी रहती है।",
          },
        },
      ],
      tips: [
        {
          en: "Below the table, Sync by employee lists each person with their Device ID. Its Sync button pulls just that one person's punches, which is much faster. No code means the Device ID on their profile is empty.",
          hi: "टेबल के नीचे Sync by employee में हर व्यक्ति अपने Device ID के साथ दिखता है। वहाँ का Sync बटन सिर्फ उसी एक व्यक्ति के पंच लाता है, जो काफी तेज़ है। No code का मतलब है कि उनकी प्रोफाइल पर Device ID खाली है।",
        },
        {
          en: "Realtime push shows a web address to paste into the machine's settings. The machine then sends each punch to DNMS the moment it happens. Treat that address like a password.",
          hi: "Realtime push में एक वेब एड्रेस दिखता है जिसे मशीन की settings में डालना होता है। फिर मशीन हर पंच उसी समय DNMS को भेज देती है। इस एड्रेस को पासवर्ड की तरह संभाल कर रखें।",
        },
      ],
      faq: [
        {
          q: {
            en: "Someone's punches are not showing up. What should I check?",
            hi: "किसी के पंच नहीं दिख रहे। क्या चेक करें?",
          },
          a: {
            en: "On the Devices page, find them under Sync by employee. If it says No code, open their profile, click Edit on Employment Details and fill in Device ID with their code from the machine. Then click Sync on their row.",
            hi: "Devices पेज पर Sync by employee में उन्हें ढूँढें। अगर No code लिखा है, तो उनकी प्रोफाइल खोलें, Employment Details पर Edit क्लिक करें और Device ID में मशीन वाला उनका code भरें। फिर उनकी लाइन पर Sync पर क्लिक करें।",
          },
        },
      ],
    },
    {
      id: "add-device",
      title: { en: "Add a machine", hi: "नई मशीन जोड़ें" },
      steps: [
        {
          text: {
            en: "On the Devices page, click Add Device at the top right.",
            hi: "Devices पेज पर ऊपर दाईं ओर Add Device पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Fill in the Device Name (1), the Device Serial, the machine's IP Address (2) and Port (3), and the Username and Password used to sign in to the machine. Location is optional. Click Add Device (4).",
            hi: "Device Name (1), Device Serial, मशीन का IP Address (2) और Port (3), और मशीन में लॉगिन करने वाला Username और Password भरें। Location भरना ज़रूरी नहीं है। Add Device (4) पर क्लिक करें।",
          },
          shot: {
            id: "attendance-admin-add-device",
            as: "hr",
            path: "/attendance/devices",
            actions: [{ click: { role: "button", name: "Add Device" } }],
            highlight: [
              { label: "Device Name" },
              { label: "IP Address" },
              { label: "Port" },
              { role: "button", name: "Add Device", nth: -1 },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Click Test on the new row to make sure DNMS can reach it, then Sync.",
            hi: "नई लाइन पर Test क्लिक करके पक्का करें कि DNMS उस तक पहुँच रहा है, फिर Sync करें।",
          },
        },
      ],
      tips: [
        {
          en: "The IP address and login are the ones set on the machine itself. Ask whoever installed the machine if you don't have them.",
          hi: "IP address और लॉगिन वही होते हैं जो मशीन पर सेट किए गए हैं। अगर आपके पास नहीं हैं, तो जिसने मशीन लगाई है उससे पूछें।",
        },
      ],
    },
  ],
}
