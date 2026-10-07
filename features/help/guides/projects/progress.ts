import { TrendingUp } from "lucide-react"
import type { HelpGuide } from "../../types"

export const progressGuide: HelpGuide = {
  slug: "progress",
  group: "projects",
  icon: TrendingUp,
  href: "/projects/progress",
  title: { en: "Progress and My Progress", hi: "Progress और My Progress" },
  summary: {
    en: "See what is still to do, what is completed and what is overdue - counted by deliverable - for yourself, your team or the whole company, and export it.",
    hi: "देखें क्या अभी बाकी है, क्या पूरा हुआ और क्या overdue है - deliverables के हिसाब से - अपने लिए, अपनी टीम के लिए या पूरी कंपनी के लिए, और इसे export करें।",
  },
  keywords: [
    "progress",
    "my progress",
    "deliverables",
    "overdue",
    "completed",
    "sent back",
    "report",
    "slides",
    "excel",
    "प्रगति",
    "रिपोर्ट",
    "बाकी काम",
    "पूरा हुआ",
  ],
  sections: [
    {
      id: "what",
      title: { en: "What this page shows", hi: "ये पेज क्या दिखाता है" },
      intro: {
        en: "This page counts deliverables - the things planned for each client, like a reel, a blog post or a banner - not tasks. The sidebar calls it Progress if you manage projects, and My Progress for everyone else.",
        hi: "ये पेज deliverables गिनता है - हर क्लाइंट के लिए प्लान की गई चीज़ें, जैसे reel, blog post या banner - tasks नहीं। अगर आप प्रोजेक्ट्स संभालते हैं तो साइडबार में इसका नाम Progress है, बाकी सबके लिए My Progress।",
      },
      steps: [
        {
          text: {
            en: "Click Progress or My Progress in the sidebar. The line at the top left says whose work you are looking at: Your own deliverables, Your team, The projects you own, or Everything in the company.",
            hi: "साइडबार में Progress या My Progress पर क्लिक करें। ऊपर बाईं ओर की लाइन बताती है कि आप किसका काम देख रहे हैं: Your own deliverables, Your team, The projects you own, या Everything in the company।",
          },
        },
        {
          text: {
            en: "The four boxes at the top are To do (1), Completed (2), Overdue now (3) and Sent back (4) - work returned by the account manager for changes. Click any box to see the list behind the number. The dates button (5) and Export (6) are at the top right.",
            hi: "ऊपर के चार बॉक्स हैं To do (1), Completed (2), Overdue now (3) और Sent back (4) - यानी वो काम जो account manager ने बदलाव के लिए वापस भेजा। नंबर के पीछे की लिस्ट देखने के लिए किसी भी बॉक्स पर क्लिक करें। तारीख वाला बटन (5) और Export (6) ऊपर दाईं ओर हैं।",
          },
          shot: {
            id: "progress-kpis",
            as: "employee",
            path: "/projects/progress",
            highlight: [
              { role: "button", name: "To do:" },
              { role: "button", name: "Completed:" },
              { role: "button", name: "Overdue now:" },
              { role: "button", name: "Sent back:" },
              { role: "button", name: "This week" },
              { role: "button", name: "Export" },
            ],
          },
        },
        {
          text: {
            en: "Where the work stands is a ring of statuses: To do, In progress, Made, Accepted, Awaiting revision, Stuck and Discarded. Click a status in the list to see its share. By project shows the numbers per project - click a project's name to see only that project.",
            hi: "Where the work stands में status का एक गोला है: To do, In progress, Made, Accepted, Awaiting revision, Stuck और Discarded। किसी status का हिस्सा देखने के लिए लिस्ट में उस पर क्लिक करें। By project में हर प्रोजेक्ट के नंबर हैं - सिर्फ़ एक प्रोजेक्ट देखने के लिए उसके नाम पर क्लिक करें।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "My tasks are done but the page says nothing is completed. Why?",
            hi: "मेरे tasks पूरे हो गए, फिर भी पेज पर कुछ completed नहीं दिख रहा। क्यों?",
          },
          a: {
            en: "This page counts deliverables, not tasks. A deliverable counts as completed once it is marked made or accepted on the project's Deliverables tab.",
            hi: "ये पेज deliverables गिनता है, tasks नहीं। Deliverable तब completed गिना जाता है जब प्रोजेक्ट के Deliverables टैब पर उसे made या accepted किया जाए।",
          },
        },
        {
          q: {
            en: "It says Nothing in this window.",
            hi: "पेज पर Nothing in this window लिखा है।",
          },
          a: {
            en: "No deliverables were due, worked on or finished in the dates you picked. Pick a wider window, like Last 30 days.",
            hi: "आपकी चुनी तारीखों में कोई deliverable न due था, न उस पर काम हुआ, न पूरा हुआ। बड़ी अवधि चुनें, जैसे Last 30 days।",
          },
        },
      ],
    },
    {
      id: "window",
      title: { en: "Pick the dates", hi: "तारीखें चुनें" },
      steps: [
        {
          text: {
            en: "The page opens on This week. Click the dates button at the top right to pick All time, This week, Last 7 days, Last 30 days (1) or Next 7 days.",
            hi: "पेज This week पर खुलता है। ऊपर दाईं ओर तारीख वाले बटन पर क्लिक करके All time, This week, Last 7 days, Last 30 days (1) या Next 7 days चुनें।",
          },
          shot: {
            id: "progress-dates",
            as: "employee",
            path: "/projects/progress",
            actions: [{ click: { role: "button", name: "This week" } }],
            highlight: [
              { role: "button", name: "Last 30 days" },
              { role: "button", name: "Apply" },
            ],
          },
        },
        {
          text: {
            en: "For your own dates, click the start day and then the end day on the calendar. Nothing changes until you click Apply (2).",
            hi: "अपनी तारीखें चुननी हों, तो कैलेंडर में पहले शुरू का दिन और फिर आखिरी दिन पर क्लिक करें। जब तक Apply (2) पर क्लिक नहीं करते, कुछ नहीं बदलता।",
          },
        },
      ],
    },
    {
      id: "managers",
      title: {
        en: "For managers: look at a project, team or person",
        hi: "मैनेजर्स के लिए: किसी प्रोजेक्ट, टीम या व्यक्ति को देखें",
      },
      intro: {
        en: "Team managers see their teams and the people who report to them. An Account Manager sees the projects they own and every team on them. Project admins see the whole company. Everyone else sees only their own deliverables.",
        hi: "टीम मैनेजर को अपनी टीमें और उन्हें रिपोर्ट करने वाले लोग दिखते हैं। Account Manager को उसके अपने प्रोजेक्ट्स और उन पर की हर टीम दिखती है। प्रोजेक्ट एडमिन को पूरी कंपनी दिखती है। बाकी सबको सिर्फ़ अपने deliverables दिखते हैं।",
      },
      steps: [
        {
          text: {
            en: "Use the boxes at the top right to narrow the page: the project (1), the team (2) - the same six teams exist on every project - and the person (3). Whole team shows everyone.",
            hi: "ऊपर दाईं ओर के बॉक्स से पेज को छोटा करें: प्रोजेक्ट (1), टीम (2) - हर प्रोजेक्ट पर वही छह टीमें होती हैं - और व्यक्ति (3)। Whole team से सब दिखते हैं।",
          },
          shot: {
            id: "progress-manager-filters",
            as: "manager",
            path: "/projects/progress",
            highlight: [
              { role: "combobox", name: "Project" },
              { role: "combobox", name: "Team", exact: true },
              { role: "combobox", name: "Team member" },
            ],
          },
        },
        {
          text: {
            en: "Lower down, By team member shows each person's Completed, Open, Overdue and Sent back work. Click a name to see only that person.",
            hi: "नीचे By team member में हर व्यक्ति का Completed, Open, Overdue और Sent back काम दिखता है। सिर्फ़ उस व्यक्ति को देखने के लिए नाम पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "In the list behind a box, use the search (1) to find a deliverable, project, person or reason. When more than one person is in the list, you can group it By project or By person.",
            hi: "किसी बॉक्स के पीछे की लिस्ट में, सर्च (1) से deliverable, प्रोजेक्ट, व्यक्ति या कारण ढूँढें। जब लिस्ट में एक से ज़्यादा लोग हों, तो उसे By project या By person के हिसाब से ग्रुप कर सकते हैं।",
          },
          shot: {
            id: "progress-kpi-list",
            as: "manager",
            path: "/projects/progress",
            actions: [{ click: { role: "button", name: "To do:" } }],
            highlight: [{ label: "Search this list" }],
            crop: { role: "dialog" },
          },
        },
      ],
    },
    {
      id: "export",
      title: { en: "Export a report", hi: "रिपोर्ट export करें" },
      steps: [
        {
          text: {
            en: "Set the dates and filters to what you want, then click Export at the top right.",
            hi: "तारीखें और फ़िल्टर अपने हिसाब से सेट करें, फिर ऊपर दाईं ओर Export पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "The box shows the Period and Scope that will be exported. Include AI-generated summary and speaker takeaways (1) is ticked to start with - untick it if you don't want a written summary in the file.",
            hi: "बॉक्स में दिखता है कि कौन सा Period और Scope export होगा। Include AI-generated summary and speaker takeaways (1) पर पहले से टिक लगा होता है - अगर फ़ाइल में लिखा हुआ सार नहीं चाहिए, तो टिक हटा दें।",
          },
          shot: {
            id: "progress-export",
            as: "manager",
            path: "/projects/progress",
            actions: [{ click: { role: "button", name: "Export" } }],
            highlight: [
              { text: "Include AI-generated summary and speaker takeaways" },
              { role: "button", name: "Excel" },
              { role: "button", name: "Word" },
              { role: "button", name: "PowerPoint" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Click Excel (2), Word (3) or PowerPoint (4). The file downloads with exactly what you see on screen.",
            hi: "Excel (2), Word (3) या PowerPoint (4) पर क्लिक करें। फ़ाइल डाउनलोड होती है, उसमें ठीक वही होता है जो स्क्रीन पर दिख रहा है।",
          },
        },
      ],
    },
  ],
}
