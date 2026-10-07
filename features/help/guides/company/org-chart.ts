import { Network } from "lucide-react"
import type { HelpGuide } from "../../types"

export const orgChartGuide: HelpGuide = {
  slug: "org-chart",
  group: "company",
  icon: Network,
  href: "/employees/org-chart",
  title: { en: "Organisation Chart", hi: "ऑर्गनाइज़ेशन चार्ट (Organisation Chart)" },
  summary: {
    en: "See who reports to whom across the company, from the top down.",
    hi: "देखें कि पूरी कंपनी में कौन किसे रिपोर्ट करता है, ऊपर से नीचे तक।",
  },
  keywords: [
    "org chart",
    "organisation chart",
    "organization chart",
    "hierarchy",
    "reporting",
    "manager",
    "team",
    "reports to",
    "structure",
    "ऑर्ग चार्ट",
    "टीम",
    "मैनेजर",
    "रिपोर्टिंग",
    "कौन किसे रिपोर्ट करता है",
  ],
  sections: [
    {
      id: "read",
      title: { en: "Read the chart", hi: "चार्ट पढ़ें" },
      intro: {
        en: "The chart shows every active employee as a card, joined by lines from each manager down to the people who report to them.",
        hi: "चार्ट में हर एक्टिव कर्मचारी एक कार्ड के रूप में दिखता है, और हर मैनेजर से उनको रिपोर्ट करने वाले लोगों तक लाइनें जुड़ी होती हैं।",
      },
      steps: [
        {
          text: {
            en: "Click Organisation Chart in the sidebar. The page is called Org Chart. The person at the top (1) leads the company, and each row below reports to the card above it.",
            hi: "साइडबार में Organisation Chart पर क्लिक करें। पेज का नाम Org Chart है। सबसे ऊपर वाला व्यक्ति (1) कंपनी को लीड करता है, और नीचे की हर लाइन अपने ऊपर वाले कार्ड को रिपोर्ट करती है।",
          },
          shot: {
            id: "org-chart-overview",
            as: "employee",
            path: "/employees/org-chart",
            highlight: [
              { text: "Aarav Mehta", exact: true },
              { text: "Creative Lead", exact: true },
            ],
          },
        },
        {
          text: {
            en: "Each card shows a photo or initials, the person's name, their job title (2), their department and their role in DNMS, such as Employee or HR Manager.",
            hi: "हर कार्ड में फोटो या नाम के पहले अक्षर, व्यक्ति का नाम, उनका पद (2), उनका डिपार्टमेंट और DNMS में उनका रोल दिखता है, जैसे Employee या HR Manager।",
          },
        },
      ],
    },
    {
      id: "expand",
      title: { en: "Show or hide a team", hi: "किसी टीम को दिखाएँ या छुपाएँ" },
      steps: [
        {
          text: {
            en: "Under every manager's card you see how many people report to them, like 7 reports. Click it (1) to hide or show their team.",
            hi: "हर मैनेजर के कार्ड के नीचे लिखा होता है कि कितने लोग उन्हें रिपोर्ट करते हैं, जैसे 7 reports। उनकी टीम छुपाने या दिखाने के लिए उस पर (1) क्लिक करें।",
          },
          shot: {
            id: "org-chart-expand",
            as: "employee",
            path: "/employees/org-chart",
            // exact: the topbar also has "Collapse sidebar" / "Expand sidebar".
            actions: [{ click: { role: "button", name: "Collapse", exact: true, nth: -1 } }],
            highlight: [{ role: "button", name: "Expand", exact: true }],
          },
        },
        {
          text: {
            en: "An arrow pointing down means the team is open; an arrow pointing right means it is hidden. The first levels are open when the page loads.",
            hi: "नीचे की तरफ वाला तीर मतलब टीम खुली है; दाईं तरफ वाला तीर मतलब टीम छुपी हुई है। पेज खुलने पर ऊपर के लेवल खुले रहते हैं।",
          },
        },
      ],
    },
    {
      id: "zoom",
      title: { en: "Zoom in and out", hi: "ज़ूम इन और ज़ूम आउट करें" },
      steps: [
        {
          text: {
            en: "The chart shrinks to fit your screen. Use the buttons at the top right to make it smaller (1) or bigger (2) - the number between them is the current size.",
            hi: "चार्ट आपकी स्क्रीन में फिट होने के लिए छोटा हो जाता है। ऊपर दाईं ओर के बटनों से उसे छोटा (1) या बड़ा (2) करें - बीच का नंबर अभी का साइज़ बताता है।",
          },
          shot: {
            id: "org-chart-zoom",
            as: "employee",
            path: "/employees/org-chart",
            highlight: [
              { role: "button", name: "Zoom out" },
              { role: "button", name: "Zoom in" },
              { role: "button", name: "Fit to screen" },
            ],
          },
        },
        {
          text: {
            en: "When the chart is bigger than the screen, scroll sideways or down to move around it. Click Fit to screen (3) to see the whole chart again.",
            hi: "जब चार्ट स्क्रीन से बड़ा हो, तो उसमें घूमने के लिए साइड में या नीचे स्क्रॉल करें। पूरा चार्ट फिर से देखने के लिए Fit to screen (3) पर क्लिक करें।",
          },
        },
      ],
    },
    {
      id: "faq",
      title: { en: "Good to know", hi: "जानने लायक बातें" },
      tips: [
        {
          en: "There is no search box on this page. To find someone fast, press Ctrl + F (Cmd + F on a Mac) and type their name - your browser jumps to their card.",
          hi: "इस पेज पर सर्च बॉक्स नहीं है। किसी को जल्दी ढूँढना हो, तो Ctrl + F (Mac पर Cmd + F) दबाएँ और उनका नाम टाइप करें - ब्राउज़र सीधे उनके कार्ड पर ले जाएगा।",
        },
      ],
      faq: [
        {
          q: {
            en: "Can I click a card to see someone's details?",
            hi: "क्या कार्ड पर क्लिक करके किसी की डिटेल्स देख सकते हैं?",
          },
          a: {
            en: "No, the cards are only for reading. To see a colleague's work email, phone and team, open a Chat with them and click their name at the top of the chat.",
            hi: "नहीं, कार्ड सिर्फ पढ़ने के लिए हैं। किसी साथी का ऑफिस ईमेल, फोन और टीम देखनी हो, तो उनसे Chat खोलें और चैट के ऊपर उनके नाम पर क्लिक करें।",
          },
        },
        {
          q: {
            en: "Someone is in the wrong place, or missing. How is that fixed?",
            hi: "कोई गलत जगह पर है, या दिख ही नहीं रहा। ये कैसे ठीक होगा?",
          },
          a: {
            en: "The chart is built from the Manager set in each person's employee record, and only active employees are shown. Ask HR to correct the manager.",
            hi: "चार्ट हर व्यक्ति के एम्प्लॉई रिकॉर्ड में सेट Manager से बनता है, और इसमें सिर्फ एक्टिव कर्मचारी दिखते हैं। HR से Manager ठीक करवाने को कहें।",
          },
        },
        {
          q: {
            en: "Why do I see more than one chart?",
            hi: "मुझे एक से ज़्यादा चार्ट क्यों दिख रहे हैं?",
          },
          a: {
            en: "Anyone without a manager starts their own chart at the top. Once HR sets their manager, they move under that person.",
            hi: "जिसका कोई Manager सेट नहीं है, उसका अलग चार्ट सबसे ऊपर से शुरू होता है। जैसे ही HR उनका Manager सेट करेगा, वो उस व्यक्ति के नीचे आ जाएँगे।",
          },
        },
      ],
    },
  ],
}
