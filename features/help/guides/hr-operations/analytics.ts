import { BarChart3 } from "lucide-react"
import type { HelpGuide } from "../../types"

export const analyticsGuide: HelpGuide = {
  slug: "analytics",
  group: "hr",
  icon: BarChart3,
  href: "/analytics",
  title: { en: "Analytics", hi: "एनालिटिक्स (Analytics)" },
  summary: {
    en: "A one-page summary of the whole company - people, hiring, projects, leave, attendance and payroll - and how to read it.",
    hi: "पूरी कंपनी का एक पेज का सारांश - लोग, भर्ती, प्रोजेक्ट्स, छुट्टी, हाज़िरी और पेरोल - और इसे कैसे पढ़ें।",
  },
  keywords: [
    "analytics",
    "dashboard",
    "reports",
    "headcount",
    "hires",
    "charts",
    "statistics",
    "रिपोर्ट",
    "आंकड़े",
    "चार्ट",
  ],
  sections: [
    {
      id: "overview",
      title: { en: "Open Analytics", hi: "Analytics खोलें" },
      steps: [
        {
          text: {
            en: "In the sidebar, under HRMS, click Analytics. The cards at the top give the key numbers, like Total Employees (1), Pending Leaves (2), Attendance This Month (3) and Last Payroll Net (4). The charts are below them.",
            hi: "साइडबार में HRMS के नीचे Analytics पर क्लिक करें। ऊपर के कार्ड्स ज़रूरी नंबर दिखाते हैं, जैसे Total Employees (1), Pending Leaves (2), Attendance This Month (3) और Last Payroll Net (4)। उनके नीचे चार्ट्स हैं।",
          },
          shot: {
            id: "analytics-cards",
            as: "hr",
            path: "/analytics",
            actions: [{ waitFor: { text: "Headcount by Department" } }],
            highlight: [
              { text: "Total Employees", exact: true },
              { text: "Pending Leaves", exact: true },
              { text: "Attendance This Month", exact: true },
              { text: "Last Payroll Net", exact: true },
            ],
          },
        },
        {
          text: {
            en: "The numbers cover the whole company and refresh on their own every few minutes. Reload the page to see the latest straight away.",
            hi: "ये नंबर पूरी कंपनी के हैं और हर कुछ मिनट में अपने आप अपडेट होते हैं। तुरंत ताज़ा नंबर देखने हों तो पेज रीलोड करें।",
          },
        },
      ],
    },
    {
      id: "cards",
      title: { en: "What each card means", hi: "हर कार्ड का मतलब" },
      tips: [
        {
          en: "Total Employees: everyone in DNMS, including people who have left. Below it, how many are active. The small up or down number compares this month's new people with last month's.",
          hi: "Total Employees: DNMS में सभी लोग, कंपनी छोड़ चुके लोग भी। नीचे लिखा है कि कितने active हैं। छोटा ऊपर या नीचे वाला नंबर इस महीने जुड़े लोगों की तुलना पिछले महीने से करता है।",
        },
        {
          en: "New Hires This Month: people added to DNMS this month, with last month's number below.",
          hi: "New Hires This Month: इस महीने DNMS में जोड़े गए लोग, नीचे पिछले महीने का नंबर।",
        },
        {
          en: "Open Jobs: job postings that are open, with the number of applicants this month.",
          hi: "Open Jobs: खुली हुई job postings, और इस महीने के आवेदकों की गिनती।",
        },
        {
          en: "Active Projects: projects marked Active, with the tasks finished this month.",
          hi: "Active Projects: Active मार्क किए गए प्रोजेक्ट, और इस महीने पूरे हुए टास्क।",
        },
        {
          en: "Pending Leaves: leave requests waiting for a decision right now. Below it, how many requests made this month were approved.",
          hi: "Pending Leaves: अभी फैसले का इंतज़ार कर रही छुट्टी की रिक्वेस्ट। नीचे लिखा है कि इस महीने की कितनी रिक्वेस्ट मंज़ूर हुईं।",
        },
        {
          en: "Attendance This Month: the present days recorded this month, added up for everyone - one per person per day. Below it, the absent and half-day counts.",
          hi: "Attendance This Month: इस महीने दर्ज हुए प्रेज़ेंट दिन, सबके जोड़कर - हर व्यक्ति का हर दिन एक। नीचे absent और half-day की गिनती।",
        },
        {
          en: "Last Payroll Net: the total take-home pay on last month's payslips, and how many payslips there are. It shows only after last month's payroll has been generated.",
          hi: "Last Payroll Net: पिछले महीने की पेस्लिप्स की कुल हाथ में मिलने वाली सैलरी, और कितनी पेस्लिप हैं। यह तभी दिखता है जब पिछले महीने का पेरोल generate हो चुका हो।",
        },
        {
          en: "Departments: how many departments the company has.",
          hi: "Departments: कंपनी में कितने डिपार्टमेंट हैं।",
        },
      ],
      faq: [
        {
          q: {
            en: "Why does Attendance This Month look so big?",
            hi: "Attendance This Month इतना बड़ा नंबर क्यों दिखा रहा है?",
          },
          a: {
            en: "It counts days, not people. 10 people present for 5 days shows 50.",
            hi: "यह लोगों को नहीं, दिनों को गिनता है। 10 लोग 5 दिन प्रेज़ेंट रहे तो 50 दिखेगा।",
          },
        },
      ],
    },
    {
      id: "charts",
      title: { en: "Read the charts", hi: "चार्ट्स पढ़ें" },
      steps: [
        {
          text: {
            en: "Monthly Hires (6 months) (1) shows how many people were added each month. Headcount by Department (2) shows the active people in the 8 biggest departments.",
            hi: "Monthly Hires (6 months) (1) दिखाता है कि हर महीने कितने लोग जुड़े। Headcount by Department (2) सबसे बड़े 8 डिपार्टमेंट्स में active लोगों की गिनती दिखाता है।",
          },
          shot: {
            id: "analytics-charts",
            as: "hr",
            path: "/analytics",
            // The charts draw themselves in (a JS animation) - let them finish.
            actions: [{ waitFor: { text: "Recruitment Pipeline" } }, { wait: 1500 }],
            highlight: [
              { text: "Monthly Hires (6 months)" },
              { text: "Headcount by Department" },
              { text: "Employee Status Distribution" },
              { text: "Recruitment Pipeline" },
            ],
            crop: { css: "div.lg\\:grid-cols-2:has-text('Recruitment Pipeline')" },
          },
        },
        {
          text: {
            en: "Employee Status Distribution (3) splits everyone by status, like Active or Resigned. Recruitment Pipeline (4) shows applicants at each stage: Applied, Screening, Interview, Offer, Hired and Rejected.",
            hi: "Employee Status Distribution (3) सबको status के हिसाब से बाँटता है, जैसे Active या Resigned। Recruitment Pipeline (4) हर स्टेज पर आवेदकों की गिनती दिखाता है: Applied, Screening, Interview, Offer, Hired और Rejected।",
          },
        },
        {
          text: {
            en: "Point at a bar or a slice to see its exact number.",
            hi: "किसी बार या हिस्से पर माउस ले जाएँ, उसका सही नंबर दिख जाएगा।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "Open Jobs and Recruitment Pipeline show 0, but the Applications page has candidates. Why?",
            hi: "Open Jobs और Recruitment Pipeline में 0 दिख रहा है, पर Applications पेज पर उम्मीदवार हैं। क्यों?",
          },
          a: {
            en: "These two count job postings and their applicants, which are kept apart from the applications that come in through the careers site. So they can differ from the Applications page.",
            hi: "ये दोनों job postings और उनके आवेदकों को गिनते हैं, जो careers साइट से आने वाले आवेदनों से अलग रखे जाते हैं। इसलिए ये Applications पेज से अलग हो सकते हैं।",
          },
        },
      ],
    },
  ],
}
