import { FolderKanban } from "lucide-react"
import { PERMISSIONS } from "@/lib/constants"
import type { HelpGuide } from "../../types"

export const myProjectsGuide: HelpGuide = {
  slug: "my-projects",
  group: "projects",
  icon: FolderKanban,
  href: "/projects/my-projects",
  title: { en: "My Projects", hi: "मेरे प्रोजेक्ट्स (My Projects)" },
  summary: {
    en: "See every client project you work on, open one, and - if you manage projects - create or edit them.",
    hi: "जिन क्लाइंट प्रोजेक्ट्स पर आप काम करते हैं वो सब देखें, किसी को खोलें, और अगर आप प्रोजेक्ट्स संभालते हैं तो नए बनाएँ या बदलें।",
  },
  keywords: [
    "project",
    "projects",
    "client",
    "phase",
    "status",
    "priority",
    "account manager",
    "new project",
    "budget",
    "प्रोजेक्ट",
    "क्लाइंट",
    "नया प्रोजेक्ट",
    "अकाउंट मैनेजर",
  ],
  sections: [
    {
      id: "list",
      title: { en: "See your projects", hi: "अपने प्रोजेक्ट्स देखें" },
      intro: {
        en: "My Projects lists every project you are on a team of, plus any project where you are the Account Manager. Admins who manage projects see every project in the company.",
        hi: "My Projects में वो सारे प्रोजेक्ट्स दिखते हैं जिनकी किसी टीम में आप हैं, और वो भी जिनके आप Account Manager हैं। जो एडमिन प्रोजेक्ट्स संभालते हैं, उन्हें कंपनी के सारे प्रोजेक्ट्स दिखते हैं।",
      },
      steps: [
        {
          text: {
            en: "Click My Projects in the sidebar. Projects are grouped by status - Planning, Active, On Hold, Completed and Cancelled - with a count next to each group.",
            hi: "साइडबार में My Projects पर क्लिक करें। प्रोजेक्ट्स उनके status के हिसाब से ग्रुप में दिखते हैं - Planning, Active, On Hold, Completed और Cancelled - और हर ग्रुप के आगे गिनती लिखी होती है।",
          },
        },
        {
          text: {
            en: "Use the two buttons at the top right to switch between Card view (1) and Table view (2). Each card shows the project's name and code, its Phase (like Launch or Growth), the client it is for, the Account Manager, and how many tasks and members it has. Click anywhere on a card (3) to open the project.",
            hi: "ऊपर दाईं ओर के दो बटन से Card view (1) और Table view (2) के बीच बदलें। हर कार्ड पर प्रोजेक्ट का नाम और कोड, उसका Phase (जैसे Launch या Growth), किस क्लाइंट के लिए है, Account Manager, और कितने tasks और members हैं - ये सब दिखता है। प्रोजेक्ट खोलने के लिए कार्ड (3) पर कहीं भी क्लिक करें।",
          },
          shot: {
            id: "my-projects-cards",
            as: "employee",
            path: "/projects/my-projects",
            highlight: [
              { role: "tab", name: "Card view" },
              { role: "tab", name: "Table view" },
              { role: "link", name: "Open Sunmeadow Organics Launch" },
            ],
          },
        },
        {
          text: {
            en: "Table view puts each project on one row, with columns for Code, Name, Client, Phase (1), Account Manager, Tasks and Members. It shows 10 projects per page. Click the eye button (2) to open a project. The pencil button (3) is there only if you can edit that project.",
            hi: "Table view में हर प्रोजेक्ट एक लाइन में दिखता है - Code, Name, Client, Phase (1), Account Manager, Tasks और Members के कॉलम के साथ। एक पेज पर 10 प्रोजेक्ट्स आते हैं। प्रोजेक्ट खोलने के लिए आँख वाले बटन (2) पर क्लिक करें। पेंसिल वाला बटन (3) तभी दिखता है जब आप उस प्रोजेक्ट को बदल सकते हैं।",
          },
          shot: {
            id: "my-projects-table",
            as: "manager",
            path: "/projects/my-projects",
            actions: [{ click: { role: "tab", name: "Table view" } }],
            highlight: [
              { text: "Phase", exact: true },
              { role: "link", name: "View Sunmeadow Organics Launch" },
              { role: "button", name: "Edit Sunmeadow Organics Launch" },
            ],
          },
        },
      ],
      tips: [
        {
          en: "DNMS remembers the view you picked on this computer, so the page opens the same way next time.",
          hi: "आपने जो view चुना, DNMS उसे इस कंप्यूटर पर याद रखता है, तो अगली बार पेज वैसे ही खुलेगा।",
        },
        {
          en: "If you are the Account Manager of a project (or an admin), you also see a Budget column.",
          hi: "अगर आप किसी प्रोजेक्ट के Account Manager (या एडमिन) हैं, तो आपको Budget कॉलम भी दिखता है।",
        },
      ],
      faq: [
        {
          q: {
            en: "A project I work on is missing. Why?",
            hi: "जिस प्रोजेक्ट पर मैं काम करता हूँ, वो दिख नहीं रहा। क्यों?",
          },
          a: {
            en: "You only see a project once you are on one of its teams. Ask the project's Account Manager to add you to the right team.",
            hi: "प्रोजेक्ट तभी दिखता है जब आप उसकी किसी टीम में हों। प्रोजेक्ट के Account Manager से कहें कि आपको सही टीम में जोड़ दें।",
          },
        },
      ],
    },
    {
      id: "fields",
      title: {
        en: "What Status, Priority and Phase mean",
        hi: "Status, Priority और Phase का मतलब",
      },
      intro: {
        en: "Every project carries three labels. You see them on the cards and at the top of the project page.",
        hi: "हर प्रोजेक्ट पर तीन लेबल होते हैं। ये कार्ड पर और प्रोजेक्ट पेज के ऊपर दिखते हैं।",
      },
      tips: [
        {
          en: "Status - where the work is: Planning, Active, On Hold, Completed or Cancelled.",
          hi: "Status - काम किस हालत में है: Planning, Active, On Hold, Completed या Cancelled।",
        },
        {
          en: "Priority - how urgent the project is: Low, Medium, High or Urgent.",
          hi: "Priority - प्रोजेक्ट कितना ज़रूरी है: Low, Medium, High या Urgent।",
        },
        {
          en: "Phase - where the client's brand is in its life: Launch (a new brand), Growth, Rebranding or Decline. It can also be left as Not set.",
          hi: "Phase - क्लाइंट का ब्रांड किस दौर में है: Launch (नया ब्रांड), Growth, Rebranding या Decline। इसे Not set भी छोड़ सकते हैं।",
        },
      ],
    },
    {
      id: "create",
      title: { en: "Create a new project", hi: "नया प्रोजेक्ट बनाएँ" },
      permission: PERMISSIONS.PROJECT_WRITE,
      intro: {
        en: "Only people who manage projects see the New Project button.",
        hi: "New Project बटन सिर्फ़ उन्हें दिखता है जो प्रोजेक्ट्स संभालते हैं।",
      },
      steps: [
        {
          text: {
            en: "On My Projects, click New Project at the top right.",
            hi: "My Projects पेज पर ऊपर दाईं ओर New Project पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Upload a Logo if you have one. Type the Project Name (1) and pick the Client (2) it is for - leave Client empty for internal work. A project code starting with DN is created for you.",
            hi: "अगर लोगो है तो Logo अपलोड करें। Project Name (1) लिखें और Client (2) चुनें जिसके लिए ये प्रोजेक्ट है - अंदरूनी काम के लिए Client खाली छोड़ दें। DN से शुरू होने वाला प्रोजेक्ट कोड अपने आप बन जाता है।",
          },
          shot: {
            id: "my-projects-new",
            as: "admin",
            path: "/projects/my-projects",
            actions: [{ click: { role: "button", name: "New Project" } }],
            highlight: [
              { placeholder: "e.g. Acme Website Redesign" },
              { placeholder: "Search clients" },
              { placeholder: "Search employees" },
              // The whole Status / Priority / Phase row.
              { css: '[role=dialog] div.grid:has(> div > label:text-is("Phase"))' },
              { role: "button", name: "Pick the onboarding date" },
              { role: "button", name: "Create Project" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Pick the Account Manager (3) - the lead manager for this project. The Account Manager can manage everything on their project, even without admin rights.",
            hi: "Account Manager (3) चुनें - इस प्रोजेक्ट का मुख्य मैनेजर। Account Manager अपने प्रोजेक्ट पर सब कुछ संभाल सकता है, चाहे उसके पास एडमिन के अधिकार न हों।",
          },
        },
        {
          text: {
            en: "Set the Status, Priority and Phase (4), then the Onboarding Date (5) - the day the client was onboarded. You can also add a Budget; only admins see it.",
            hi: "Status, Priority और Phase (4) सेट करें, फिर Onboarding Date (5) - जिस दिन क्लाइंट जुड़ा। चाहें तो Budget भी डालें; ये सिर्फ़ एडमिन को दिखता है।",
          },
        },
        {
          text: {
            en: "Click Create Project (6). The project gets the 11 standard teams straight away - AM, WEB, DESIGN, VIDEO, CONTENT, SMO, SEO, PERFORMANCE, PR, ALLIANCES & PARTNERSHIPS and ADMIN - with the Account Manager already on the AM team, so you can start adding people.",
            hi: "Create Project (6) पर क्लिक करें। प्रोजेक्ट में तुरंत 11 तय टीमें बन जाती हैं - AM, WEB, DESIGN, VIDEO, CONTENT, SMO, SEO, PERFORMANCE, PR, ALLIANCES & PARTNERSHIPS और ADMIN - और Account Manager पहले से AM टीम में होते हैं, ताकि आप लोगों को जोड़ना शुरू कर सकें।",
          },
        },
      ],
      tips: [
        {
          en: "Client not in the list yet? If you are allowed to add clients, click New next to the Client box and add it without leaving the form.",
          hi: "क्लाइंट लिस्ट में नहीं है? अगर आपको क्लाइंट जोड़ने की अनुमति है, तो Client बॉक्स के पास New पर क्लिक करें और फॉर्म छोड़े बिना उसे जोड़ दें।",
        },
        {
          en: "The Create Project button stays grey until the Project Name and Account Manager are filled in.",
          hi: "जब तक Project Name और Account Manager न भरें, Create Project बटन ग्रे रहता है।",
        },
      ],
    },
    {
      id: "edit",
      title: { en: "Edit a project", hi: "प्रोजेक्ट में बदलाव करें" },
      intro: {
        en: "The project's Account Manager and project admins can change its details.",
        hi: "प्रोजेक्ट की जानकारी उसका Account Manager और प्रोजेक्ट एडमिन बदल सकते हैं।",
      },
      steps: [
        {
          text: {
            en: "In Table view, click the pencil button on the project's row. Admins can also click the three-dot button on a card and pick Edit (1). Inside a project, use the Edit button at the top.",
            hi: "Table view में प्रोजेक्ट की लाइन पर पेंसिल बटन पर क्लिक करें। एडमिन कार्ड पर तीन-डॉट बटन दबाकर Edit (1) भी चुन सकते हैं। प्रोजेक्ट के अंदर से ऊपर दिए Edit बटन का इस्तेमाल करें।",
          },
          shot: {
            id: "my-projects-edit-menu",
            as: "admin",
            path: "/projects/my-projects",
            actions: [{ click: { role: "button", name: "More actions" } }],
            highlight: [{ role: "menuitem", name: "Edit", exact: true }],
          },
        },
        {
          text: {
            en: "Change what you need and click Save Changes. The project code can't be changed, and only admins see the Budget field.",
            hi: "जो बदलना है बदलें और Save Changes पर क्लिक करें। प्रोजेक्ट कोड नहीं बदला जा सकता, और Budget फ़ील्ड सिर्फ़ एडमिन को दिखता है।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "Can I delete or archive a project?",
            hi: "क्या प्रोजेक्ट को डिलीट या आर्काइव कर सकते हैं?",
          },
          a: {
            en: "There is no delete or archive button. When the work ends, set the Status to Completed (or Cancelled if it was dropped). The project moves to that group in the list.",
            hi: "डिलीट या आर्काइव का कोई बटन नहीं है। काम खत्म होने पर Status को Completed कर दें (या Cancelled, अगर प्रोजेक्ट बंद हो गया)। प्रोजेक्ट लिस्ट में उसी ग्रुप में चला जाता है।",
          },
        },
        {
          q: {
            en: "I am the Account Manager but I don't see the three-dot menu on the card.",
            hi: "मैं Account Manager हूँ, फिर भी कार्ड पर तीन-डॉट मेन्यू नहीं दिख रहा।",
          },
          a: {
            en: "That menu is for admins. Switch to Table view and use the pencil button, or open the project and click Edit.",
            hi: "वो मेन्यू एडमिन के लिए है। Table view पर जाकर पेंसिल बटन इस्तेमाल करें, या प्रोजेक्ट खोलकर Edit पर क्लिक करें।",
          },
        },
      ],
    },
  ],
}
