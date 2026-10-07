import { LayoutDashboard } from "lucide-react"
import { PERMISSIONS } from "@/lib/constants"
import type { HelpGuide } from "../../types"

export const dashboardGuide: HelpGuide = {
  slug: "dashboard",
  group: "start",
  icon: LayoutDashboard,
  href: "/dashboard",
  title: { en: "Dashboard", hi: "डैशबोर्ड (Dashboard)" },
  summary: {
    en: "Your home page: today's work, attendance, leave, payslip and company news in one place.",
    hi: "आपका होम पेज: आज का काम, हाज़िरी, छुट्टी, सैलरी स्लिप और कंपनी की खबरें, सब एक जगह।",
  },
  keywords: [
    "home",
    "dashboard",
    "overview",
    "today",
    "tasks",
    "overdue",
    "holidays",
    "birthday",
    "announcements",
    "headcount",
    "होम",
    "डैशबोर्ड",
    "आज का काम",
    "छुट्टियाँ",
    "जन्मदिन",
  ],
  sections: [
    {
      id: "your-day",
      title: { en: "Your day at a glance", hi: "आपका दिन एक नज़र में" },
      intro: {
        en: "The Dashboard is the first page you see after signing in. Click Dashboard in the sidebar (Home on a phone) to come back to it. Employees and team leads see their own work here, with Welcome back and your name at the top.",
        hi: "साइन इन करने के बाद सबसे पहले Dashboard ही दिखता है। यहाँ वापस आने के लिए साइडबार में Dashboard पर (फ़ोन पर Home पर) क्लिक करें। कर्मचारी और टीम लीड यहाँ अपना काम देखते हैं, और ऊपर Welcome back के साथ आपका नाम होता है।",
      },
      steps: [
        {
          text: {
            en: "The boxes at the top count your work and time. Due Today (1) and Overdue (2) are your open tasks, and In Progress shows tasks you have started. Present This Month (3) is your attendance, Leave Available adds up all your leave, and Pending Requests (4) is your leave and WFH requests still waiting for approval.",
            hi: "ऊपर के बॉक्स आपके काम और समय की गिनती दिखाते हैं। Due Today (1) और Overdue (2) आपके खुले टास्क हैं, और In Progress वो टास्क हैं जो आपने शुरू कर रखे हैं। Present This Month (3) आपकी हाज़िरी है, Leave Available आपकी सारी छुट्टियों का जोड़ है, और Pending Requests (4) आपकी वो leave और WFH रिक्वेस्ट हैं जिनकी मंज़ूरी बाकी है।",
          },
          shot: {
            id: "dashboard-employee-top",
            as: "employee",
            path: "/dashboard",
            highlight: [
              { text: "Due Today", exact: true },
              { text: "Overdue", exact: true },
              { text: "Present This Month", exact: true },
              { text: "Pending Requests", exact: true },
              { role: "link", name: "Apply Leave" },
            ],
          },
        },
        {
          text: {
            en: "The row of buttons below is a shortcut to My Tasks, Apply Leave (5), Apply WFH, My Attendance and My Payslips.",
            hi: "नीचे वाली बटनों की लाइन से सीधे My Tasks, Apply Leave (5), Apply WFH, My Attendance और My Payslips पर जा सकते हैं।",
          },
        },
        {
          text: {
            en: "Today's Work (1) lists the tasks due today. A task marked overdue is late, and running means you have started it. Click a task, or View all, to open My Tasks.",
            hi: "Today's Work (1) में आज के ड्यू टास्क दिखते हैं। जिस टास्क पर overdue लिखा है वो लेट है, और running का मतलब है आपने उसे शुरू कर रखा है। टास्क पर या View all पर क्लिक करें, My Tasks खुल जाएगा।",
          },
          shot: {
            id: "dashboard-employee-work",
            as: "employee",
            path: "/dashboard",
            highlight: [
              { text: "Today's Work" },
              { text: "This Week", exact: true },
              { text: "My Clients", exact: true },
            ],
          },
        },
        {
          text: {
            en: "This Week (2) compares the hours you have spent on tasks with the hours booked for them, and counts your tasks that are Done, Overdue, On hold and Open.",
            hi: "This Week (2) टास्क पर लगाए गए आपके घंटों की तुलना उनके लिए तय (booked) घंटों से करता है, और गिनता है कि कितने टास्क Done, Overdue, On hold और Open हैं।",
          },
        },
        {
          text: {
            en: "My Clients (3) lists the projects where you still have open tasks. A red late tag means some of them are overdue. Click a project name to open it.",
            hi: "My Clients (3) में वो प्रोजेक्ट्स दिखते हैं जिनमें आपके टास्क अभी खुले हैं। लाल late टैग का मतलब है कुछ टास्क overdue हैं। प्रोजेक्ट खोलने के लिए उसके नाम पर क्लिक करें।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "Why do all my task boxes show 0?",
            hi: "मेरे सारे टास्क वाले बॉक्स 0 क्यों दिखा रहे हैं?",
          },
          a: {
            en: "They only count project tasks assigned to you. If nobody has given you a task yet, they stay at 0.",
            hi: "ये सिर्फ़ आपको दिए गए प्रोजेक्ट टास्क गिनते हैं। अगर अभी तक किसी ने आपको टास्क नहीं दिया है, तो ये 0 ही रहेंगे।",
          },
        },
        {
          q: {
            en: "I just applied for leave, but Pending Requests hasn't changed.",
            hi: "मैंने अभी छुट्टी अप्लाई की, पर Pending Requests नहीं बदला।",
          },
          a: {
            en: "The Dashboard refreshes every few minutes. Reload the page to see the latest numbers.",
            hi: "Dashboard हर कुछ मिनट में अपडेट होता है। ताज़ा नंबर देखने के लिए पेज reload करें।",
          },
        },
      ],
    },
    {
      id: "leave-pay-holidays",
      title: { en: "Leave, payslip and holidays", hi: "छुट्टी, सैलरी स्लिप और हॉलिडे" },
      steps: [
        {
          text: {
            en: "Scroll down to My Leave Balances (1). Each card shows one type of leave and how many days of it you have left.",
            hi: "नीचे My Leave Balances (1) तक जाएँ। हर कार्ड एक तरह की छुट्टी दिखाता है और बताता है कि उसमें कितने दिन बचे हैं।",
          },
          shot: {
            id: "dashboard-employee-leave-pay",
            as: "employee",
            path: "/dashboard",
            highlight: [
              { text: "My Leave Balances" },
              { text: "Latest Payslip" },
              { text: "Upcoming Holidays" },
            ],
          },
        },
        {
          text: {
            en: "Latest Payslip (2) shows your most recent month and your net pay. Click it to open My Payslips.",
            hi: "Latest Payslip (2) में आपका सबसे नया महीना और हाथ में आने वाली सैलरी (net pay) दिखती है। My Payslips खोलने के लिए उस पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Upcoming Holidays (3) lists the next company holidays. Floating / optional means it is an optional holiday, not a day off for everyone.",
            hi: "Upcoming Holidays (3) में कंपनी की अगली छुट्टियाँ दिखती हैं। Floating / optional का मतलब है वो एक optional छुट्टी है, सबके लिए छुट्टी का दिन नहीं।",
          },
        },
      ],
      tips: [
        {
          en: "Every card has View all at the top right. Click it to open the full page for that card.",
          hi: "हर कार्ड में ऊपर दाईं ओर View all होता है। उस कार्ड का पूरा पेज खोलने के लिए उस पर क्लिक करें।",
        },
      ],
    },
    {
      id: "company-news",
      title: { en: "Company news and birthdays", hi: "कंपनी की खबरें और जन्मदिन" },
      intro: {
        en: "Everyone sees this part at the bottom of the Dashboard, including HR and admins.",
        hi: "Dashboard के नीचे वाला यह हिस्सा सबको दिखता है, HR और एडमिन को भी।",
      },
      steps: [
        {
          text: {
            en: "Recent Announcements (1) shows the latest notices from HR. Photo Gallery below it shows pictures from team events. Click View all to see more.",
            hi: "Recent Announcements (1) में HR की सबसे नई सूचनाएँ दिखती हैं। उसके नीचे Photo Gallery में टीम इवेंट्स की फ़ोटो हैं। और देखने के लिए View all पर क्लिक करें।",
          },
          shot: {
            id: "dashboard-company-news",
            as: "employee",
            path: "/dashboard",
            highlight: [{ text: "Recent Announcements" }, { text: "Employee Birthdays" }],
          },
        },
        {
          text: {
            en: "Employee Birthdays (2) lists birthdays in the next 30 days. On someone's birthday, click Send wishes to send them your greetings.",
            hi: "Employee Birthdays (2) में अगले 30 दिनों के जन्मदिन दिखते हैं। किसी के जन्मदिन वाले दिन Send wishes पर क्लिक करके उन्हें शुभकामनाएँ भेजें।",
          },
        },
      ],
    },
    {
      id: "hr-dashboard",
      title: {
        en: "For HR and admins: the company dashboard",
        hi: "HR और एडमिन के लिए: कंपनी का डैशबोर्ड",
      },
      permission: PERMISSIONS.EMPLOYEE_READ,
      intro: {
        en: "If you can open the employee directory, the Dashboard shows the whole company instead of your own work.",
        hi: "अगर आप employee directory खोल सकते हैं, तो Dashboard आपके अपने काम की जगह पूरी कंपनी का हाल दिखाता है।",
      },
      steps: [
        {
          text: {
            en: "The boxes at the top show Total Employees (1), New This Month, Total Documents and Unread Notifications.",
            hi: "ऊपर के बॉक्स Total Employees (1), New This Month, Total Documents और Unread Notifications दिखाते हैं।",
          },
          shot: {
            id: "dashboard-hr",
            as: "hr",
            path: "/dashboard",
            highlight: [
              { text: "Total Employees" },
              { text: "Department Headcount" },
              { text: "Employee Status", exact: true },
              { text: "Recent Joiners" },
              { text: "Quick Actions" },
            ],
          },
        },
        {
          text: {
            en: "Department Headcount (2) shows how many people work in each department. Employee Status (3) shows how many people are in each status, such as Active, On Leave or Resigned.",
            hi: "Department Headcount (2) बताता है कि हर डिपार्टमेंट में कितने लोग हैं। Employee Status (3) बताता है कि हर स्टेटस में कितने लोग हैं, जैसे Active, On Leave या Resigned।",
          },
        },
        {
          text: {
            en: "Recent Joiners (4) lists the newest people with their joining date. Quick Actions (5) has shortcuts to Add New Employee, Upload Document and View Audit Log.",
            hi: "Recent Joiners (4) में सबसे नए लोग उनकी joining date के साथ दिखते हैं। Quick Actions (5) में Add New Employee, Upload Document और View Audit Log के शॉर्टकट हैं।",
          },
        },
      ],
      tips: [
        {
          en: "Your own leave, tasks and payslips are not on this view. Open them from the Employee section of the sidebar, like My Leave or My Payslips.",
          hi: "आपकी अपनी छुट्टी, टास्क और सैलरी स्लिप इस व्यू में नहीं हैं। उन्हें साइडबार के Employee हिस्से से खोलें, जैसे My Leave या My Payslips।",
        },
      ],
    },
  ],
}
