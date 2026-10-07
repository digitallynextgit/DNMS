import { Laptop } from "lucide-react"
import type { HelpGuide } from "../../types"

export const wfhApprovalsGuide: HelpGuide = {
  slug: "wfh-approvals",
  group: "hr",
  icon: Laptop,
  href: "/wfh/requests",
  title: { en: "Work From Home Requests", hi: "वर्क फ्रॉम होम रिक्वेस्ट (Work From Home)" },
  summary: {
    en: "See every Work From Home request in the company and approve or reject it.",
    hi: "कंपनी की हर Work From Home रिक्वेस्ट देखें और उसे approve या reject करें।",
  },
  keywords: [
    "wfh",
    "work from home",
    "remote",
    "approve wfh",
    "reject wfh",
    "emergency wfh",
    "घर से काम",
    "वर्क फ्रॉम होम",
  ],
  sections: [
    {
      id: "list",
      title: { en: "See all WFH requests", hi: "सारी WFH रिक्वेस्ट देखें" },
      steps: [
        {
          text: {
            en: "In the sidebar, under HRMS, click Work From Home. You see every request in the company, newest first. Each row shows the Employee, the Date (with the number of working days), the Reason, and the Type - Standard or Emergency (1).",
            hi: "साइडबार में HRMS के नीचे Work From Home पर क्लिक करें। यहाँ कंपनी की हर रिक्वेस्ट दिखती है, सबसे नई सबसे ऊपर। हर लाइन में Employee, Date (कितने वर्किंग डेज़ के साथ), Reason, और Type - Standard या Emergency (1) - दिखता है।",
          },
          shot: {
            id: "wfh-approvals-list",
            as: "hr",
            path: "/wfh/requests",
            highlight: [{ role: "cell", name: "Emergency", exact: true }],
          },
        },
        {
          text: {
            en: "Status shows where each request stands. The Manager column shows Approved or Rejected when it was the employee's manager who decided.",
            hi: "Status बताता है कि रिक्वेस्ट किस हाल में है। जब फैसला कर्मचारी के मैनेजर ने किया हो, तब Manager कॉलम में Approved या Rejected दिखता है।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "How do I see older requests?",
            hi: "पुरानी रिक्वेस्ट कैसे देखें?",
          },
          a: {
            en: "Use the page numbers under the list. The newest requests are always on the first page.",
            hi: "लिस्ट के नीचे दिए पेज नंबर इस्तेमाल करें। सबसे नई रिक्वेस्ट हमेशा पहले पेज पर होती हैं।",
          },
        },
      ],
    },
    {
      id: "decide",
      title: { en: "Approve or reject a request", hi: "रिक्वेस्ट approve या reject करें" },
      steps: [
        {
          text: {
            en: "For a Pending request, click Approve (1) or Reject (2). Approve works straight away - there is no second screen.",
            hi: "Pending रिक्वेस्ट के लिए Approve (1) या Reject (2) पर क्लिक करें। Approve करते ही रिक्वेस्ट तुरंत मंज़ूर हो जाती है - कोई दूसरी स्क्रीन नहीं आती।",
          },
          shot: {
            id: "wfh-approvals-actions",
            as: "hr",
            path: "/wfh/requests",
            highlight: [
              { role: "button", name: "Approve" },
              { role: "button", name: "Reject" },
            ],
            crop: { role: "table" },
          },
        },
        {
          text: {
            en: "To turn it down, click Reject in that row. Type the Reason for rejection (1) - it is required - and click Reject (2).",
            hi: "मना करना हो तो उसी लाइन में Reject पर क्लिक करें। Reason for rejection (1) लिखें - यह ज़रूरी है - और Reject (2) पर क्लिक करें।",
          },
          shot: {
            id: "wfh-approvals-reject-dialog",
            as: "hr",
            path: "/wfh/requests",
            // Reject stays disabled until a reason is typed.
            actions: [
              { click: { role: "button", name: "Reject" } },
              { waitFor: { css: "[role=alertdialog]" } },
              {
                fill: { label: "Reason for rejection" },
                value: "Client shoot that day - need you in office.",
              },
            ],
            highlight: [
              { label: "Reason for rejection" },
              { role: "button", name: "Reject", exact: true, nth: -1 },
            ],
            crop: { css: "[role=alertdialog]" },
          },
        },
        {
          text: {
            en: "The employee gets a notification and an email with your decision.",
            hi: "कर्मचारी को आपके फैसले का नोटिफिकेशन और ईमेल मिल जाता है।",
          },
        },
      ],
      tips: [
        {
          en: "The employee's own manager can also approve or reject from their Work From Home page. The first decision is final.",
          hi: "कर्मचारी का अपना मैनेजर भी अपने Work From Home पेज से approve या reject कर सकता है। जो फैसला पहले होगा, वही आखिरी है।",
        },
        {
          en: "Requests that are no longer Pending show a dash instead of buttons. A decision can't be changed later.",
          hi: "जो रिक्वेस्ट अब Pending नहीं है, उसमें बटन की जगह डैश (-) दिखता है। फैसला बाद में बदला नहीं जा सकता।",
        },
      ],
      faq: [
        {
          q: {
            en: "I get an error when I click Approve. Why?",
            hi: "Approve पर क्लिक करने पर एरर आता है। क्यों?",
          },
          a: {
            en: "Only HR Managers, Admins and the employee's own manager can decide WFH requests. If you can, someone may have decided it a moment ago - refresh the page.",
            hi: "WFH रिक्वेस्ट का फैसला सिर्फ़ HR Manager, Admin और कर्मचारी का अपना मैनेजर कर सकते हैं। अगर आप कर सकते हैं, तो हो सकता है किसी ने अभी-अभी फैसला कर दिया हो - पेज रिफ्रेश करें।",
          },
        },
      ],
    },
    {
      id: "rules",
      title: { en: "WFH rules employees follow", hi: "WFH के नियम जो कर्मचारियों पर लागू हैं" },
      intro: {
        en: "DNMS checks these rules when an employee applies, so the requests you see already follow them.",
        hi: "कर्मचारी के अप्लाई करते समय DNMS ये नियम चेक करता है, इसलिए आपको जो रिक्वेस्ट दिखती हैं वो पहले से इन नियमों के हिसाब से होती हैं।",
      },
      tips: [
        {
          en: "On probation, or in the first 6 months after probation ends: only Emergency WFH is allowed.",
          hi: "प्रोबेशन में, या प्रोबेशन खत्म होने के बाद पहले 6 महीनों में: सिर्फ़ Emergency WFH मिलता है।",
        },
        {
          en: "After that: 1 regular WFH day per month. An Emergency request does not use up this day.",
          hi: "उसके बाद: हर महीने 1 सामान्य WFH दिन। Emergency रिक्वेस्ट से यह दिन खर्च नहीं होता।",
        },
        {
          en: "WFH can't be for a past date, a weekend or a company holiday. Weekends and holidays inside a date range are not counted.",
          hi: "WFH किसी बीती तारीख, वीकेंड या कंपनी की छुट्टी के दिन के लिए नहीं लिया जा सकता। तारीखों की रेंज के बीच आने वाले वीकेंड और छुट्टियाँ गिनी नहीं जातीं।",
        },
        {
          en: "WFH can't be on a day that already has a leave request.",
          hi: "जिस दिन पहले से छुट्टी की रिक्वेस्ट है, उस दिन WFH नहीं लिया जा सकता।",
        },
      ],
    },
  ],
}
