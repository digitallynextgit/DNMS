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
    "short name",
    "services",
    "SMO",
    "SEO",
    "प्रोजेक्ट",
    "सर्विसेज़",
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
            en: "Click My Projects in the sidebar. Your projects are listed in one table, newest first, with columns for Project (the name, with its DN code underneath), Short name, Client, Services, Status / Phase, Account Manager, Tasks and Employees.",
            hi: "साइडबार में My Projects पर क्लिक करें। आपके प्रोजेक्ट्स एक ही टेबल में दिखते हैं, सबसे नए सबसे ऊपर - Project (नाम, और उसके नीचे DN कोड), Short name, Client, Services, Status / Phase, Account Manager, Tasks और Employees के कॉलम के साथ।",
          },
        },
        {
          text: {
            en: "To narrow the list, pick a status in the Status box (1), type in the search box (2), or pick a service like SEO in the All services box (3). Click a column heading to sort by it. If the table is wider than your screen, scroll it sideways. Click the eye button (4) to open a project. The pencil button (5) is there only if you can edit that project.",
            hi: "लिस्ट छोटी करने के लिए Status बॉक्स (1) में कोई status चुनें, सर्च बॉक्स (2) में लिखें, या All services बॉक्स (3) में कोई service चुनें, जैसे SEO। किसी कॉलम के नाम पर क्लिक करके उसी से sort करें। अगर टेबल स्क्रीन से चौड़ी हो, तो उसे साइड में स्क्रॉल करें। प्रोजेक्ट खोलने के लिए आँख वाले बटन (4) पर क्लिक करें। पेंसिल वाला बटन (5) तभी दिखता है जब आप उस प्रोजेक्ट को बदल सकते हैं।",
          },
          shot: {
            id: "my-projects-table",
            as: "manager",
            path: "/projects/my-projects",
            actions: [
              // The table scrolls sideways; this brings the action buttons into view.
              { hover: { role: "button", name: "Edit Sunmeadow Organics Launch" } },
            ],
            highlight: [
              { role: "button", name: "Status: All" },
              { placeholder: "Name, short name, client or AM" },
              { role: "combobox", name: "Filter by service" },
              { role: "link", name: "View Sunmeadow Organics Launch" },
              { role: "button", name: "Edit Sunmeadow Organics Launch" },
            ],
          },
        },
        {
          text: {
            en: "To download projects as a spreadsheet, tick their boxes - or the box in the header (1) to tick every project on the page - then click Export (2) and pick CSV or Excel. With nothing ticked, Export downloads every project in the list.",
            hi: "प्रोजेक्ट्स को spreadsheet में डाउनलोड करने के लिए उनके बॉक्स पर टिक करें - या पेज के सारे प्रोजेक्ट्स चुनने के लिए हेडर वाले बॉक्स (1) पर - फिर Export (2) पर क्लिक करके CSV या Excel चुनें। अगर कुछ भी टिक नहीं है, तो Export लिस्ट के सारे प्रोजेक्ट्स डाउनलोड करता है।",
          },
          shot: {
            id: "my-projects-table-export",
            as: "manager",
            path: "/projects/my-projects",
            actions: [{ click: { role: "checkbox", name: "Select all" } }],
            highlight: [
              { role: "checkbox", name: "Select all" },
              { role: "button", name: "Export", exact: true },
            ],
          },
        },
        {
          text: {
            en: "Click a project's services in the table to see who owns each one (1) and open its calendar (2). Every ticked service gets its own monthly calendar, owned by the service's owner - the same person shows as Owner on the calendar, and they get a notification and an email when picked; Campaign Planning leads all the other calendars. The calendar button lists the months that exist - pick one to open it. If you manage the project you can change an owner here, start a missing month from the same button, add a service with Add a service, or create a calendar a service is missing.",
            hi: "टेबल में किसी प्रोजेक्ट की services पर क्लिक करें, तो दिखता है कि हर service का owner कौन है (1), और उसका कैलेंडर (2) खुलता है। हर टिक की गई service का अपना महीने वार कैलेंडर होता है, जिसका owner वही होता है जो service का owner है - कैलेंडर पर भी Owner में वही व्यक्ति दिखता है, और चुने जाने पर उसे notification और ईमेल मिलता है; Campaign Planning बाकी सारे कैलेंडर्स की दिशा तय करता है। कैलेंडर वाले बटन में वो सारे महीने दिखते हैं जो बने हुए हैं - जिसे खोलना हो उसे चुनें। अगर आप प्रोजेक्ट संभालते हैं, तो यहीं owner बदल सकते हैं, उसी बटन से कोई छूटा हुआ महीना शुरू कर सकते हैं, Add a service से नई service जोड़ सकते हैं, या जिस service का कैलेंडर नहीं है उसका कैलेंडर बना सकते हैं।",
          },
          shot: {
            id: "my-projects-services-popup",
            as: "manager",
            path: "/projects/my-projects",
            actions: [
              { click: { role: "button", name: "Services of Sunmeadow Organics Launch" } },
              { waitFor: { role: "button", name: "Social Media calendar months" } },
            ],
            highlight: [
              { role: "combobox", name: "Owner of Social Media" },
              { role: "button", name: "Social Media calendar months" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "To take a service off the project, click the X at the end of its row. DNMS asks you to confirm first (1). Its owner is cleared, but its calendar and everything in it stay.",
            hi: "किसी service को प्रोजेक्ट से हटाने के लिए उसकी लाइन के आखिर में X पर क्लिक करें। DNMS पहले पुष्टि माँगता है (1)। उसका owner हट जाता है, लेकिन उसका कैलेंडर और उसमें लिखा सब कुछ बना रहता है।",
          },
          shot: {
            id: "my-projects-services-remove",
            as: "manager",
            path: "/projects/my-projects",
            actions: [
              { click: { role: "button", name: "Services of Sunmeadow Organics Launch" } },
              { click: { role: "button", name: "Remove Campaign Planning" } },
              { waitFor: { role: "alertdialog" } },
            ],
            highlight: [{ role: "alertdialog" }],
          },
        },
      ],
      tips: [
        {
          en: "DNMS remembers, on this computer, the columns you hid (with the columns button at the top right of the table) and your Rows per page (at the bottom).",
          hi: "आपने जो कॉलम छिपाए (टेबल के ऊपर दाईं ओर वाले कॉलम बटन से) और Rows per page (नीचे), DNMS उन्हें इस कंप्यूटर पर याद रखता है।",
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
        en: "What a project's labels mean",
        hi: "प्रोजेक्ट के लेबल्स का मतलब",
      },
      intro: {
        en: "Every project carries a few labels. You see them in the projects table and at the top of the project page.",
        hi: "हर प्रोजेक्ट पर कुछ लेबल होते हैं। ये प्रोजेक्ट्स की टेबल में और प्रोजेक्ट पेज के ऊपर दिखते हैं।",
      },
      tips: [
        {
          en: "Short name - the few letters the team uses for the project, like DN. Each project has its own; two projects can't share one, even with different capital letters.",
          hi: "Short name - वो छोटा नाम जिससे टीम प्रोजेक्ट को बुलाती है, जैसे DN। हर प्रोजेक्ट का अपना होता है; दो प्रोजेक्ट्स का एक जैसा नहीं हो सकता, चाहे बड़े-छोटे अक्षर अलग हों।",
        },
        {
          en: "Services - what we do for the client: SMO (Social Media), SEO (SEO / AEO / GEO), PM (Paid Performance), Email/WA/SMS, Inf. (Influencers & Collabs), All. (Alliances & Partnerships), DPR (Digital PR), Web (Website), Camp. (Campaign Planning), Offline (Offline Marketing), BD (BD / Sales) and Brand (Branding Kit). A small photo on a service is its owner - the person who answers for it. Hover over a service to see its full name and owner.",
          hi: "Services - हम क्लाइंट के लिए क्या करते हैं: SMO (Social Media), SEO (SEO / AEO / GEO), PM (Paid Performance), Email/WA/SMS, Inf. (Influencers & Collabs), All. (Alliances & Partnerships), DPR (Digital PR), Web (Website), Camp. (Campaign Planning), Offline (Offline Marketing), BD (BD / Sales) और Brand (Branding Kit)। किसी service पर छोटी फ़ोटो उसके owner की है - वो व्यक्ति जो उस service के लिए ज़िम्मेदार है। किसी service पर माउस ले जाने से उसका पूरा नाम और owner दिखता है।",
        },
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
            en: "Upload a Logo if you have one. Type the Project Name (1) and a Short name (2) - the few letters the team uses for it, like DN or H2S. No two projects can share a short name. Pick the Client (3) it is for - leave Client empty for internal work - and tick the Services (4) we provide on it. A project code starting with DN is created for you.",
            hi: "अगर लोगो है तो Logo अपलोड करें। Project Name (1) और Short name (2) लिखें - वो छोटा नाम जिससे टीम प्रोजेक्ट को बुलाती है, जैसे DN या H2S। दो प्रोजेक्ट्स का short name एक जैसा नहीं हो सकता। Client (3) चुनें जिसके लिए ये प्रोजेक्ट है - अंदरूनी काम के लिए Client खाली छोड़ दें - और जो Services (4) हम इस प्रोजेक्ट पर देते हैं उन पर टिक करें। DN से शुरू होने वाला प्रोजेक्ट कोड अपने आप बन जाता है।",
          },
          shot: {
            id: "my-projects-new",
            as: "admin",
            path: "/projects/my-projects",
            actions: [{ click: { role: "button", name: "New Project" } }],
            highlight: [
              { placeholder: "e.g. Acme Website Redesign" },
              { placeholder: "e.g. DN" },
              { placeholder: "Search clients" },
              { css: '[role=dialog] div.space-y-2:has(> label:text-is("Services"))' },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Scroll down and pick the Account Manager (1) - the lead manager for this project. The Account Manager can manage everything on their project, even without admin rights.",
            hi: "नीचे स्क्रॉल करें और Account Manager (1) चुनें - इस प्रोजेक्ट का मुख्य मैनेजर। Account Manager अपने प्रोजेक्ट पर सब कुछ संभाल सकता है, चाहे उसके पास एडमिन के अधिकार न हों।",
          },
          shot: {
            id: "my-projects-new-details",
            as: "admin",
            path: "/projects/my-projects",
            actions: [
              { click: { role: "button", name: "New Project" } },
              // Brings the bottom of the form into view.
              { hover: { placeholder: "500000" } },
            ],
            highlight: [
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
            en: "Set the Status, Priority and Phase (2), then the Onboarding Date (3) - the day the client was onboarded. You can also add a Budget; only admins see it.",
            hi: "Status, Priority और Phase (2) सेट करें, फिर Onboarding Date (3) - जिस दिन क्लाइंट जुड़ा। चाहें तो Budget भी डालें; ये सिर्फ़ एडमिन को दिखता है।",
          },
        },
        {
          text: {
            en: "Click Create Project (4). The project gets the 11 standard teams straight away - AM, WEB, DESIGN, VIDEO, CONTENT, SMO, SEO, PERFORMANCE, PR, ALLIANCES & PARTNERSHIPS and ADMIN - with the Account Manager already on the AM team, so you can start adding people.",
            hi: "Create Project (4) पर क्लिक करें। प्रोजेक्ट में तुरंत 11 तय टीमें बन जाती हैं - AM, WEB, DESIGN, VIDEO, CONTENT, SMO, SEO, PERFORMANCE, PR, ALLIANCES & PARTNERSHIPS और ADMIN - और Account Manager पहले से AM टीम में होते हैं, ताकि आप लोगों को जोड़ना शुरू कर सकें।",
          },
        },
      ],
      tips: [
        {
          en: "Client not in the list yet? If you are allowed to add clients, click New next to the Client box and add it without leaving the form.",
          hi: "क्लाइंट लिस्ट में नहीं है? अगर आपको क्लाइंट जोड़ने की अनुमति है, तो Client बॉक्स के पास New पर क्लिक करें और फॉर्म छोड़े बिना उसे जोड़ दें।",
        },
        {
          en: "The Create Project button stays grey until the Project Name, Short name and Account Manager are filled in.",
          hi: "जब तक Project Name, Short name और Account Manager न भरें, Create Project बटन ग्रे रहता है।",
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
            en: "Click the pencil button (1) at the end of the project's row. Inside a project, use the Edit button at the top.",
            hi: "प्रोजेक्ट की लाइन के आखिर में पेंसिल बटन (1) पर क्लिक करें। प्रोजेक्ट के अंदर से ऊपर दिए Edit बटन का इस्तेमाल करें।",
          },
          shot: {
            id: "my-projects-edit-menu",
            as: "admin",
            path: "/projects/my-projects",
            // The table scrolls sideways; this brings the pencil into view.
            actions: [{ hover: { role: "button", name: "Edit Sunmeadow Organics Launch" } }],
            highlight: [{ role: "button", name: "Edit Sunmeadow Organics Launch" }],
          },
        },
        {
          text: {
            en: "Change what you need - including the Short name and Services - and click Save Changes. Unticking a service also removes its owner. The project code can't be changed, and only admins see the Budget field.",
            hi: "जो बदलना है बदलें - Short name और Services भी - और Save Changes पर क्लिक करें। किसी service से टिक हटाने पर उसका owner भी हट जाता है। प्रोजेक्ट कोड नहीं बदला जा सकता, और Budget फ़ील्ड सिर्फ़ एडमिन को दिखता है।",
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
            en: "There is no delete or archive button. When the work ends, set the Status to Completed (or Cancelled if it was dropped). Pick that status in the Status box to see those projects.",
            hi: "डिलीट या आर्काइव का कोई बटन नहीं है। काम खत्म होने पर Status को Completed कर दें (या Cancelled, अगर प्रोजेक्ट बंद हो गया)। ऐसे प्रोजेक्ट्स देखने के लिए Status बॉक्स में वही status चुनें।",
          },
        },
      ],
    },
  ],
}
