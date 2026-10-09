import { Layers } from "lucide-react"
import type { HelpGuide } from "../../types"

export const projectWorkspaceGuide: HelpGuide = {
  slug: "project-workspace",
  group: "projects",
  icon: Layers,
  href: "/projects/my-projects",
  title: {
    en: "Inside a project: Overview, Teams and Activity",
    hi: "प्रोजेक्ट के अंदर: Overview, Teams और Activity",
  },
  summary: {
    en: "Find your way around a project page, see who is on each team, add people, and follow what has happened.",
    hi: "प्रोजेक्ट पेज पर रास्ता समझें, देखें हर टीम में कौन है, लोगों को जोड़ें, और देखें क्या-क्या हुआ।",
  },
  keywords: [
    "project page",
    "overview",
    "teams",
    "team manager",
    "add people",
    "members",
    "activity",
    "tabs",
    "प्रोजेक्ट पेज",
    "टीम",
    "मेंबर",
    "लोग जोड़ें",
    "गतिविधि",
  ],
  sections: [
    {
      id: "header",
      title: { en: "Open a project", hi: "प्रोजेक्ट खोलें" },
      steps: [
        {
          text: {
            en: "On My Projects, click a project to open it. The top of the page shows its logo, name and code, and the client it is for.",
            hi: "My Projects पर किसी प्रोजेक्ट पर क्लिक करके उसे खोलें। पेज के ऊपर उसका लोगो, नाम, कोड और क्लाइंट का नाम दिखता है।",
          },
        },
        {
          text: {
            en: "On the right you see the project's Phase (1), its Status (2) and its priority. The Edit button (3) is shown only to the project's Account Manager and project admins.",
            hi: "दाईं ओर प्रोजेक्ट का Phase (1), Status (2) और priority दिखती है। Edit बटन (3) सिर्फ़ प्रोजेक्ट के Account Manager और प्रोजेक्ट एडमिन को दिखता है।",
          },
          shot: {
            id: "project-workspace-header",
            as: "manager",
            path: "/projects/sunmeadow-organics-launch",
            highlight: [
              { text: "Launch phase" },
              { text: "Active", exact: true },
              { role: "button", name: "Edit", exact: true },
              { role: "tab", name: "Overview" },
            ],
          },
        },
        {
          text: {
            en: "Under the header is a row of tabs, starting with Overview (4). Each tab is one part of the project. If they don't all fit on one line, the rest move to a second row.",
            hi: "हेडर के नीचे टैब्स की एक लाइन है, जो Overview (4) से शुरू होती है। हर टैब प्रोजेक्ट का एक हिस्सा है। अगर सारे टैब एक लाइन में न आएँ, तो बाकी दूसरी लाइन में चले जाते हैं।",
          },
        },
        {
          text: {
            en: "Two tabs carry a small count: Requirements shows how many requirements are still open, and Chats shows your unread messages.",
            hi: "दो टैब पर छोटी सी गिनती दिखती है: Requirements पर बताया जाता है कितनी requirements अभी खुली हैं, और Chats पर आपके बिना पढ़े मैसेज।",
          },
        },
      ],
      tips: [
        {
          en: "The browser address keeps the tab you are on. Copy it and share it, and the other person lands on the same tab.",
          hi: "ब्राउज़र का एड्रेस उस टैब को याद रखता है जिस पर आप हैं। उसे कॉपी करके भेजें, तो सामने वाला उसी टैब पर पहुँचेगा।",
        },
        {
          en: "The Passwords tab is shown only to the Account Manager and project admins.",
          hi: "Passwords टैब सिर्फ़ Account Manager और प्रोजेक्ट एडमिन को दिखता है।",
        },
        {
          en: "Most other tabs - Tasks, Goals, Requirements, Chats, Passwords, Deliverables, Brand and more - have their own guide in Help.",
          hi: "बाकी ज़्यादातर टैब - Tasks, Goals, Requirements, Chats, Passwords, Deliverables, Brand वगैरह - की अपनी अलग गाइड Help में है।",
        },
      ],
    },
    {
      id: "overview",
      title: { en: "The Overview tab", hi: "Overview टैब" },
      steps: [
        {
          text: {
            en: "Overview opens first. The strip at the top counts the project's Teams, Members and Tasks. The Account Manager and project admins also see the Budget there.",
            hi: "सबसे पहले Overview खुलता है। ऊपर की पट्टी में प्रोजेक्ट की Teams, Members और Tasks की गिनती होती है। Account Manager और प्रोजेक्ट एडमिन को वहाँ Budget भी दिखता है।",
          },
        },
        {
          text: {
            en: "The card below shows who the Account Manager (1) is, the project Code, and the Onboarding Date (2) - the day the client came on board.",
            hi: "नीचे के कार्ड में दिखता है कि Account Manager (1) कौन है, प्रोजेक्ट का Code, और Onboarding Date (2) - जिस दिन क्लाइंट जुड़ा।",
          },
          shot: {
            id: "project-workspace-overview",
            as: "employee",
            path: "/projects/sunmeadow-organics-launch",
            highlight: [
              { text: "Account Manager", exact: true },
              { text: "Onboarding Date", exact: true },
              { role: "button", name: "Open goals" },
            ],
          },
        },
        {
          text: {
            en: "The Goals card shows how far the project's goals have got. Click Open goals (3) to see them all. If the project tracks websites, a card for them shows here too.",
            hi: "Goals कार्ड बताता है कि प्रोजेक्ट के goals कितने आगे बढ़े हैं। सब देखने के लिए Open goals (3) पर क्लिक करें। अगर प्रोजेक्ट में वेबसाइट्स ट्रैक होती हैं, तो उनका कार्ड भी यहीं दिखता है।",
          },
        },
      ],
    },
    {
      id: "teams",
      title: { en: "See and staff the teams", hi: "टीमें देखें और लोग जोड़ें" },
      intro: {
        en: "Every project has the same 11 teams: AM, WEB, DESIGN, VIDEO, CONTENT, SMO, SEO, PERFORMANCE, PR, ALLIANCES & PARTNERSHIPS and ADMIN. The AM team holds the project's Account Manager. The teams themselves never change - only the people on them do.",
        hi: "हर प्रोजेक्ट में वही 11 टीमें होती हैं: AM, WEB, DESIGN, VIDEO, CONTENT, SMO, SEO, PERFORMANCE, PR, ALLIANCES & PARTNERSHIPS और ADMIN। AM टीम में प्रोजेक्ट का Account Manager होता है। टीमें कभी नहीं बदलतीं - सिर्फ़ उनमें के लोग बदलते हैं।",
      },
      steps: [
        {
          text: {
            en: "Open the Teams tab. Each team lists its people. The team's manager is listed first and marked Manager (1). A team with nobody in charge shows no manager. If you staff the team, you also see Add people (2) on the team and a three-dot button (3) on each person.",
            hi: "Teams टैब खोलें। हर टीम में उसके लोग दिखते हैं। टीम मैनेजर सबसे ऊपर होता है और उस पर Manager (1) लिखा होता है। जिस टीम का कोई इंचार्ज नहीं, उस पर no manager लिखा आता है। अगर आप टीम में लोग जोड़ते हैं, तो आपको टीम पर Add people (2) और हर व्यक्ति के आगे तीन-डॉट बटन (3) भी दिखता है।",
          },
          shot: {
            id: "project-workspace-teams",
            as: "manager",
            path: "/projects/sunmeadow-organics-launch?tab=teams",
            highlight: [
              { text: "Manager", exact: true },
              { role: "button", name: "Add people" },
              { role: "button", name: "More actions", nth: 1 },
            ],
          },
        },
        {
          text: {
            en: "Click a team's name to fold it open or shut. The two buttons at the top right switch between cards and a table.",
            hi: "टीम के नाम पर क्लिक करके उसे खोलें या बंद करें। ऊपर दाईं ओर के दो बटन कार्ड और टेबल के बीच बदलते हैं।",
          },
        },
        {
          text: {
            en: "To add people, click Add people on the team. Search by name, employee number or designation (1), tick everyone you need (2), then click the Add button at the bottom - it says how many people you picked. They are all added at once.",
            hi: "लोग जोड़ने के लिए टीम पर Add people पर क्लिक करें। नाम, employee number या designation से खोजें (1), जिन्हें जोड़ना है उन पर टिक करें (2), फिर नीचे Add बटन पर क्लिक करें - उस पर लिखा होता है आपने कितने लोग चुने। सब एक साथ जुड़ जाते हैं।",
          },
          shot: {
            id: "project-workspace-add-people",
            as: "manager",
            path: "/projects/sunmeadow-organics-launch?tab=teams",
            actions: [{ click: { role: "button", name: "Add people" } }],
            highlight: [
              { placeholder: "Search by name, employee no. or designation" },
              { role: "checkbox" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "To change someone's role, click the three-dot button on their row. Make manager (1) makes them the team's manager. Remove from team (2) takes them off the team, after you confirm - their tasks stay on the project.",
            hi: "किसी का रोल बदलने के लिए उसकी लाइन पर तीन-डॉट बटन पर क्लिक करें। Make manager (1) से वो टीम का मैनेजर बन जाता है। Remove from team (2) से, कन्फ़र्म करने के बाद, वो टीम से हट जाता है - उसके tasks प्रोजेक्ट पर बने रहते हैं।",
          },
          shot: {
            id: "project-workspace-member-menu",
            as: "manager",
            path: "/projects/sunmeadow-organics-launch?tab=teams",
            // The third person: AM's Rohan and WEB's manager come first, and a manager has no Make manager.
            actions: [{ click: { role: "button", name: "More actions", nth: 2 } }],
            highlight: [
              { role: "menuitem", name: "Make manager" },
              { role: "menuitem", name: "Remove from team" },
            ],
          },
        },
      ],
      tips: [
        {
          en: "Who can add or remove people: the Account Manager, project admins, and the manager of that team. Only the Account Manager and project admins can use Make manager.",
          hi: "लोग जोड़ या हटा कौन सकता है: Account Manager, प्रोजेक्ट एडमिन, और उस टीम का मैनेजर। Make manager सिर्फ़ Account Manager और प्रोजेक्ट एडमिन इस्तेमाल कर सकते हैं।",
        },
        {
          en: "Someone can be on more than one team of the same project.",
          hi: "एक व्यक्ति एक ही प्रोजेक्ट की एक से ज़्यादा टीमों में हो सकता है।",
        },
        {
          en: "When the project's Account Manager changes, the new one becomes the AM team's manager. The old one stays on the team until someone removes them.",
          hi: "जब प्रोजेक्ट का Account Manager बदलता है, तो नया Account Manager AM टीम का मैनेजर बन जाता है। पुराना तब तक टीम में रहता है जब तक कोई उसे हटा न दे।",
        },
      ],
      faq: [
        {
          q: {
            en: "Can I create a new team or rename one?",
            hi: "क्या मैं नई टीम बना सकता हूँ या किसी टीम का नाम बदल सकता हूँ?",
          },
          a: {
            en: "No. The 11 teams are the same on every project, for everyone - even admins. Add or remove people instead.",
            hi: "नहीं। ये 11 टीमें हर प्रोजेक्ट पर सबके लिए एक जैसी हैं - एडमिन के लिए भी। इसकी जगह लोगों को जोड़ें या हटाएँ।",
          },
        },
      ],
    },
    {
      id: "activity",
      title: { en: "Follow what happened", hi: "देखें क्या-क्या हुआ" },
      steps: [
        {
          text: {
            en: "Open the Activity tab. It lists what has happened on the project, newest first, with who did it and when.",
            hi: "Activity टैब खोलें। इसमें प्रोजेक्ट पर हुई चीज़ें दिखती हैं, सबसे नई सबसे ऊपर, साथ में किसने किया और कब।",
          },
        },
        {
          text: {
            en: "Key events (1) is shown first: the big moments - tasks completed, put on hold or discarded, people added to or removed from teams, milestones and requirements. Click Everything (2) for the full feed, including every new task, status change and comment.",
            hi: "पहले Key events (1) दिखते हैं: बड़ी बातें - tasks का पूरा होना, hold पर जाना या discard होना, टीमों में लोगों का जुड़ना या हटना, milestones और requirements। पूरी लिस्ट के लिए Everything (2) पर क्लिक करें - इसमें हर नया task, status का बदलाव और comment भी आता है।",
          },
          shot: {
            id: "project-workspace-activity",
            as: "employee",
            path: "/projects/sunmeadow-organics-launch?tab=activity",
            highlight: [
              { role: "button", name: "Key events" },
              { role: "button", name: "Everything" },
            ],
          },
        },
      ],
      faq: [
        {
          q: {
            en: "Why don't I see the Edit button or the Passwords tab?",
            hi: "मुझे Edit बटन या Passwords टैब क्यों नहीं दिख रहा?",
          },
          a: {
            en: "Both are only for the project's Account Manager and project admins. Everyone else on the project can read the other tabs.",
            hi: "ये दोनों सिर्फ़ प्रोजेक्ट के Account Manager और प्रोजेक्ट एडमिन के लिए हैं। प्रोजेक्ट के बाकी लोग दूसरे टैब देख सकते हैं।",
          },
        },
      ],
    },
  ],
}
