import { PackageCheck } from "lucide-react"
import type { HelpGuide } from "../../types"

// Screens: features/projects/components/deliverables-tab.tsx (the board and a
// deliverable's own page), plan-period-dialog.tsx, log-work-dialog.tsx, and the
// report dialog on the Progress page (deliverables-report-dialog.tsx).

const BOARD = "/projects/sunmeadow-organics-launch?tab=deliverables"

export const projectDeliverablesGuide: HelpGuide = {
  slug: "project-deliverables",
  group: "projects",
  icon: PackageCheck,
  href: "/projects/my-projects",
  title: { en: "Deliverables", hi: "डिलिवरेबल्स (Deliverables)" },
  summary: {
    en: "Plan what each team owes the client, week by week, log the finished work with proof, and get it checked and accepted.",
    hi: "हर हफ्ते कौन सी टीम क्लाइंट को क्या देगी, ये प्लान करें, पूरा हुआ काम प्रूफ के साथ लॉग करें, और उसे चेक और accept करवाएँ।",
  },
  keywords: [
    "deliverables",
    "deliverable",
    "plan",
    "log work",
    "proof",
    "accept",
    "revision",
    "made",
    "export",
    "csv",
    "report",
    "excel",
    "powerpoint",
    "डिलिवरेबल",
    "काम",
    "प्रूफ",
    "रिपोर्ट",
    "मंज़ूरी",
  ],
  sections: [
    {
      id: "about",
      title: { en: "What the Deliverables tab is for", hi: "Deliverables टैब किस काम का है" },
      intro: {
        en: "A deliverable is one period of work promised to the client - usually one working week, Monday to Friday. Inside it, each team owes some items, like 4 blogs from WEB or 2 reels from VIDEO. The Account Manager plans it, the team makes the items and logs proof, and managers check and accept the work.",
        hi: "एक deliverable काम का एक पीरियड है जो क्लाइंट से वादा किया गया है - आमतौर पर एक वर्किंग वीक, सोमवार से शुक्रवार। उसके अंदर हर टीम को कुछ आइटम देने होते हैं, जैसे WEB से 4 ब्लॉग या VIDEO से 2 रील। Account Manager इसे प्लान करते हैं, टीम आइटम बनाकर प्रूफ लॉग करती है, और मैनेजर काम चेक करके accept करते हैं।",
      },
      steps: [
        {
          text: {
            en: "Open the project from My Projects and click the Deliverables tab. Each row is one deliverable. Planned is how many items were promised, and Delivered shows how many are made so far.",
            hi: "My Projects से प्रोजेक्ट खोलें और Deliverables टैब पर क्लिक करें। हर लाइन एक deliverable है। Planned बताता है कितने आइटम का वादा हुआ, और Delivered बताता है अब तक कितने बन चुके हैं।",
          },
        },
        {
          text: {
            en: "The date button (1) narrows the list to a period - it shows All time to start with. Export CSV (2) downloads a sheet. Plan deliverable (3) appears only for the Account Manager. Click the eye icon (4) to open a deliverable and see its items.",
            hi: "तारीख वाला बटन (1) लिस्ट को किसी पीरियड तक सीमित करता है - शुरू में ये All time दिखाता है। Export CSV (2) से शीट डाउनलोड होती है। Plan deliverable (3) सिर्फ Account Manager को दिखता है। किसी deliverable के आइटम देखने के लिए आँख वाले आइकन (4) पर क्लिक करें।",
          },
          shot: {
            id: "project-deliverables-board",
            as: "manager",
            path: BOARD,
            highlight: [
              { role: "button", name: "All time" },
              { role: "button", name: "Export CSV" },
              { role: "button", name: "Plan deliverable" },
              { role: "link", name: "Open deliverable" },
            ],
          },
        },
        {
          text: {
            en: "Prefer cards? Use the Card view and Table view buttons on the right. Both show the same deliverables.",
            hi: "कार्ड में देखना है? दाईं ओर Card view और Table view बटन इस्तेमाल करें। दोनों में वही deliverables दिखते हैं।",
          },
        },
      ],
      tips: [
        {
          en: "Who does what: the project's Account Manager (or anyone with project admin rights) plans deliverables, accepts the work and can delete a whole deliverable. A team's manager puts names on its items and checks the work. Team members log their own work. Whoever works on an item can also fix it (pencil) or remove it (bin) until its period is locked - only the Account Manager can remove accepted work. Everyone on the project can see the board.",
          hi: "कौन क्या करता है: प्रोजेक्ट के Account Manager (या जिनके पास प्रोजेक्ट एडमिन के अधिकार हैं) deliverables प्लान करते हैं, काम accept करते हैं और पूरा deliverable डिलीट कर सकते हैं। टीम मैनेजर अपनी टीम के आइटम किसी को सौंपते हैं और काम चेक करते हैं। टीम मेंबर अपना काम लॉग करते हैं। जो व्यक्ति किसी आइटम पर काम करता है, वो उसे ठीक (पेंसिल) या हटा (डिब्बा) भी सकता है, जब तक उसका पीरियड locked न हो - accept हो चुका काम सिर्फ Account Manager हटा सकते हैं। प्रोजेक्ट का हर व्यक्ति बोर्ड देख सकता है।",
        },
      ],
    },
    {
      id: "plan",
      title: {
        en: "For Account Managers: plan a deliverable",
        hi: "Account Managers के लिए: deliverable प्लान करें",
      },
      steps: [
        {
          text: {
            en: "Click Plan deliverable. Step 1 is When: pick This week (1) or Next week, Another week (pick any day in it), or A date range for work that is not weekly. Click Next (2).",
            hi: "Plan deliverable पर क्लिक करें। पहला स्टेप When है: This week (1) या Next week चुनें, Another week (उस हफ्ते का कोई भी दिन चुनें), या जो काम हफ्ते के हिसाब से नहीं है उसके लिए A date range चुनें। Next (2) पर क्लिक करें।",
          },
          shot: {
            id: "project-deliverables-plan",
            as: "manager",
            path: BOARD,
            actions: [{ click: { role: "button", name: "Plan deliverable" } }],
            highlight: [
              { role: "button", name: "This week" },
              { role: "button", name: "Next", exact: true },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Step 2 is Teams: tick every team that has something to make in this period. Click Next.",
            hi: "दूसरा स्टेप Teams है: हर उस टीम पर टिक करें जिसे इस पीरियड में कुछ बनाना है। Next पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Step 3 is Work: for each team, type the type of item (like Reel, Blog or Banner), what it is, and how many. Click Another for (team name) to add more lines. Then click Create.",
            hi: "तीसरा स्टेप Work है: हर टीम के लिए आइटम का टाइप (जैसे Reel, Blog या Banner), वो क्या है, और कितने चाहिए - ये लिखें। और लाइन जोड़ने के लिए Another for (टीम का नाम) पर क्लिक करें। फिर Create पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Need more items in a deliverable later? Open it and click Add items at the top. Delete deliverable removes it together with every item inside.",
            hi: "बाद में किसी deliverable में और आइटम चाहिए? उसे खोलें और ऊपर Add items पर क्लिक करें। Delete deliverable उसे अंदर के सारे आइटम के साथ हटा देता है।",
          },
        },
      ],
      tips: [
        {
          en: "If the week you pick already has items, the new ones are simply added to it. Nothing already there changes.",
          hi: "अगर चुने गए हफ्ते में पहले से आइटम हैं, तो नए आइटम उसी में जुड़ जाते हैं। पहले वाले में कुछ नहीं बदलता।",
        },
      ],
    },
    {
      id: "assign",
      title: { en: "Put a name on each item", hi: "हर आइटम किसी को सौंपें" },
      intro: {
        en: "A new item is owed by its team, with nobody on it yet.",
        hi: "नया आइटम उसकी टीम के नाम होता है, अभी किसी व्यक्ति को सौंपा नहीं गया होता।",
      },
      steps: [
        {
          text: {
            en: "Open a deliverable with the eye icon. The card at the top shows Overall progress and how far each team has got. Click a team there, or use the team tabs (1), to see that team's items.",
            hi: "आँख वाले आइकन से deliverable खोलें। ऊपर वाला कार्ड Overall progress दिखाता है और ये भी कि हर टीम कितना कर चुकी है। किसी टीम के आइटम देखने के लिए वहाँ उस टीम पर क्लिक करें, या टीम वाले टैब (1) इस्तेमाल करें।",
          },
          shot: {
            id: "project-deliverables-period",
            as: "manager",
            path: BOARD,
            actions: [
              { click: { role: "link", name: "Open deliverable" } },
              { waitFor: { text: "Overall progress" } },
              { click: { role: "tab", name: "DESIGN" } },
            ],
            highlight: [
              { role: "tab", name: "DESIGN" },
              { role: "button", name: "Assign" },
            ],
          },
        },
        {
          text: {
            en: "In the Owned by column, the team's manager or the Account Manager clicks Assign (2) and picks a member. A team member sees Take this instead - click it to pick up unassigned work for yourself.",
            hi: "Owned by कॉलम में टीम मैनेजर या Account Manager Assign (2) पर क्लिक करके कोई मेंबर चुनते हैं। टीम मेंबर को उसकी जगह Take this दिखता है - बिना नाम वाला काम खुद लेने के लिए उस पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "To hand an item to someone else, click the person's name and pick another member. Pick Nobody - back to (team name) to give it back to the team.",
            hi: "आइटम किसी और को देने के लिए व्यक्ति के नाम पर क्लिक करें और दूसरा मेंबर चुनें। उसे वापस टीम को देने के लिए Nobody - back to (टीम का नाम) चुनें।",
          },
        },
      ],
      tips: [
        {
          en: "Only people on that team can be picked. If the list is empty, add members on the Teams tab first.",
          hi: "सिर्फ उसी टीम के लोग चुने जा सकते हैं। अगर लिस्ट खाली है, तो पहले Teams टैब में मेंबर जोड़ें।",
        },
      ],
    },
    {
      id: "log",
      title: { en: "Log your work", hi: "अपना काम लॉग करें" },
      steps: [
        {
          text: {
            en: "Open the deliverable, click your team's tab and find your item. Click Log work (1) on its row. The item's status (2) is in the Status column of the same row.",
            hi: "deliverable खोलें, अपनी टीम के टैब पर क्लिक करें और अपना आइटम ढूँढें। उसकी लाइन में Log work (1) पर क्लिक करें। आइटम का स्टेटस (2) उसी लाइन के Status कॉलम में है।",
          },
          shot: {
            id: "project-deliverables-my-item",
            as: "employee",
            path: BOARD,
            actions: [
              { click: { role: "link", name: "Open deliverable" } },
              { waitFor: { text: "Overall progress" } },
              { click: { role: "tab", name: "DESIGN" } },
            ],
            // Priya's own item (the demo's "Product label mock-ups", in progress) -
            // the first row in the tab is the team's unassigned one.
            highlight: [
              { css: 'tr:has-text("Product label mock-ups") button:has-text("Log work")' },
              { css: 'tr:has-text("Product label mock-ups") button[aria-label="Change status"]' },
            ],
            crop: { css: 'table:has(tr:has-text("Product label mock-ups"))' },
          },
        },
        {
          text: {
            en: "Type how many are finished so far (1). Under Proof, paste a link (2), or click the paperclip (3) to attach a file instead. Click Another for more links. If there is nothing to link, write a Note (4). Click Save progress (5).",
            hi: "अब तक कितने पूरे हुए, वो लिखें (1)। Proof में लिंक पेस्ट करें (2), या उसकी जगह फाइल जोड़ने के लिए पेपरक्लिप (3) पर क्लिक करें। और लिंक के लिए Another पर क्लिक करें। अगर दिखाने को कोई लिंक नहीं है, तो Note (4) लिखें। Save progress (5) पर क्लिक करें।",
          },
          shot: {
            id: "project-deliverables-log-work",
            as: "employee",
            path: BOARD,
            actions: [
              { click: { role: "link", name: "Open deliverable" } },
              { waitFor: { text: "Overall progress" } },
              { click: { role: "tab", name: "DESIGN" } },
              // Priya's own item, not the team's unassigned one above it.
              {
                click: { css: 'tr:has-text("Product label mock-ups") button:has-text("Log work")' },
              },
            ],
            highlight: [
              { label: "How many are finished" },
              { placeholder: "Paste a link…" },
              { role: "button", name: "Attach a file for 1" },
              { placeholder: "What was done, if there is no link or file to show for it" },
              { role: "button", name: "Save progress" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "When everything is done, mark it made: click the status (2 in the first picture) and pick Made. Pick the day it was completed and click Mark delivered.",
            hi: "सब पूरा हो जाए तो उसे made मार्क करें: स्टेटस (पहली तस्वीर में 2) पर क्लिक करें और Made चुनें। जिस दिन काम पूरा हुआ वो तारीख चुनें और Mark delivered पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "Logging work on an item that is still To do moves it to In progress on its own.",
          hi: "To do वाले आइटम पर काम लॉग करते ही वो अपने आप In progress हो जाता है।",
        },
        {
          en: "Made stays blocked until a link, a file or a note is logged, and until all the promised quantity is logged. The Account Manager can still close an item early.",
          hi: "जब तक लिंक, फाइल या नोट लॉग न हो, और पूरी वादा की गई संख्या लॉग न हो, तब तक Made नहीं चुना जा सकता। Account Manager फिर भी किसी आइटम को पहले बंद कर सकते हैं।",
        },
        {
          en: "Seven days after the completed date an item is locked, because the numbers may already be reported to the client. After that only a project manager can change it.",
          hi: "पूरा होने की तारीख के सात दिन बाद आइटम locked हो जाता है, क्योंकि तब तक नंबर क्लाइंट को भेजे जा चुके हो सकते हैं। उसके बाद सिर्फ प्रोजेक्ट मैनेजर ही उसे बदल सकते हैं।",
        },
      ],
    },
    {
      id: "review",
      title: { en: "Check, accept or send back", hi: "काम चेक करें, accept करें या वापस भेजें" },
      intro: {
        en: "Made work is checked twice: first by the maker's team manager, then by the Account Manager, who gives the final yes.",
        hi: "बने हुए काम को दो बार चेक किया जाता है: पहले बनाने वाले के टीम मैनेजर, फिर Account Manager, जो आखिरी हाँ देते हैं।",
      },
      steps: [
        {
          text: {
            en: "Team managers: on a Made item, click the shield icon (Check this work) in the Actions column. The status then shows checked by, with your name. Click the shield again to undo it.",
            hi: "टीम मैनेजर: Made आइटम पर Actions कॉलम में शील्ड आइकन (Check this work) पर क्लिक करें। फिर स्टेटस के नीचे checked by और आपका नाम दिखेगा। वापस लेने के लिए शील्ड पर दोबारा क्लिक करें।",
          },
        },
        {
          text: {
            en: "Account Manager: click the item's status to open the Status menu. Pick Accepted (1) to sign it off. To send it back, pick Awaiting revision (2), write what needs changing, and click Request revision.",
            hi: "Account Manager: आइटम के स्टेटस पर क्लिक करके Status मेन्यू खोलें। मंज़ूरी देने के लिए Accepted (1) चुनें। वापस भेजने के लिए Awaiting revision (2) चुनें, क्या बदलना है वो लिखें, और Request revision पर क्लिक करें।",
          },
          shot: {
            id: "project-deliverables-status-menu",
            as: "manager",
            path: BOARD,
            actions: [
              { click: { role: "link", name: "Open deliverable" } },
              { waitFor: { text: "Overall progress" } },
              { click: { role: "tab", name: "DESIGN" } },
              // A Made item, so Accepted is a real choice (the demo's "Website
              // banner - Diwali offer"); on a To do item it is greyed out.
              {
                click: {
                  css: 'tr:has-text("Website banner - Diwali offer") button[aria-label="Change status"]',
                },
              },
            ],
            highlight: [
              { role: "menuitem", name: "Accepted" },
              { role: "menuitem", name: "Awaiting revision" },
            ],
            crop: { css: "[role='menu']" },
          },
        },
        {
          text: {
            en: "The reason is shown to whoever fixes it. After fixing, they pick Made again - the box now says Redeliver - and the item shows rev 1, so everyone can see it took two goes.",
            hi: "वजह उस व्यक्ति को दिखती है जो इसे ठीक करेगा। ठीक करने के बाद वो फिर से Made चुनते हैं - अब बॉक्स में Redeliver लिखा होता है - और आइटम पर rev 1 दिखता है, ताकि सबको पता रहे कि ये दो बार में हुआ।",
          },
        },
        {
          text: {
            en: "Click the clock icon (History) on any item to see every change, who made it and the reason they gave.",
            hi: "किसी भी आइटम का हर बदलाव, किसने किया और क्या वजह बताई - ये देखने के लिए घड़ी वाले आइकन (History) पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "Only the Account Manager can accept. They can also reopen an accepted item (Un-accept), with a reason.",
          hi: "सिर्फ Account Manager ही accept कर सकते हैं। वो accept हो चुके आइटम को वजह लिखकर दोबारा खोल (Un-accept) भी सकते हैं।",
        },
        {
          en: "Two more statuses: Stuck means blocked, and Discarded means dropped. Both ask for a reason, so the next person knows why.",
          hi: "दो और स्टेटस हैं: Stuck मतलब काम अटका है, और Discarded मतलब काम छोड़ दिया गया। दोनों में वजह लिखनी पड़ती है, ताकि अगले व्यक्ति को पता रहे क्यों।",
        },
        {
          en: "A grey option in the Status menu is not available yet. Click it anyway - a message tells you why, like a missing log.",
          hi: "Status मेन्यू में ग्रे विकल्प अभी उपलब्ध नहीं है। फिर भी उस पर क्लिक करें - मैसेज बताएगा क्यों, जैसे लॉग अधूरा है।",
        },
      ],
      faq: [
        {
          q: {
            en: "Can the client accept or reject work?",
            hi: "क्या क्लाइंट खुद काम accept या reject कर सकता है?",
          },
          a: {
            en: "No. If the client's portal includes the Content plan section, they can see the plan, add items they want, attach finished work, and mark items as Made, Stuck or Discarded. Accepting and sending back stay with your team.",
            hi: "नहीं। अगर क्लाइंट के पोर्टल में Content plan सेक्शन है, तो वो प्लान देख सकते हैं, अपनी ज़रूरत के आइटम जोड़ सकते हैं, बना हुआ काम अटैच कर सकते हैं, और आइटम को Made, Stuck या Discarded मार्क कर सकते हैं। Accept करना और वापस भेजना आपकी टीम का काम है।",
          },
        },
      ],
    },
    {
      id: "export",
      title: { en: "Download a report", hi: "रिपोर्ट डाउनलोड करें" },
      steps: [
        {
          text: {
            en: "On the Deliverables tab, click Export CSV and pick Internal (1) - with hours, notes and who logged it - or Client-safe (2), which has only what the client got.",
            hi: "Deliverables टैब में Export CSV पर क्लिक करें और Internal (1) चुनें - इसमें घंटे, नोट्स और किसने लॉग किया, सब होता है - या Client-safe (2) चुनें, जिसमें सिर्फ वो होता है जो क्लाइंट को मिला।",
          },
          shot: {
            id: "project-deliverables-export-csv",
            as: "manager",
            path: BOARD,
            actions: [{ click: { role: "button", name: "Export CSV" } }],
            highlight: [
              { role: "menuitem", name: "Internal" },
              { role: "menuitem", name: "Client-safe" },
            ],
            crop: { css: "[role='menu']" },
          },
        },
        {
          text: {
            en: "If the date button says All time, a Which period? box asks for dates first. The last 90 days is filled in - change it if you need to and click Download.",
            hi: "अगर तारीख वाला बटन All time दिखा रहा है, तो पहले Which period? बॉक्स तारीखें पूछेगा। पिछले 90 दिन पहले से भरे होते हैं - ज़रूरत हो तो बदलें और Download पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "For a ready-made report, open Progress (My Progress) in the sidebar and click Export. Pick Excel (1), Word (2) or PowerPoint (3). Leave Include AI-generated summary and speaker takeaways ticked if you want an AI summary in it.",
            hi: "तैयार रिपोर्ट के लिए साइडबार में Progress (My Progress) खोलें और Export पर क्लिक करें। Excel (1), Word (2) या PowerPoint (3) चुनें। अगर रिपोर्ट में AI समरी चाहिए, तो Include AI-generated summary and speaker takeaways पर टिक रहने दें।",
          },
          shot: {
            id: "project-deliverables-report",
            as: "manager",
            path: "/projects/progress",
            actions: [{ click: { role: "button", name: "Export", exact: true } }],
            highlight: [
              { role: "button", name: "Excel" },
              { role: "button", name: "Word" },
              { role: "button", name: "PowerPoint" },
            ],
            crop: { role: "dialog" },
          },
        },
      ],
      tips: [
        {
          en: "Send the client the Client-safe file. The Internal one shows your team's hours and internal notes.",
          hi: "क्लाइंट को Client-safe फाइल भेजें। Internal फाइल में आपकी टीम के घंटे और अंदरूनी नोट्स होते हैं।",
        },
        {
          en: "The report covers what you are allowed to see: a team member gets their own deliverables, a team manager their team, and an Account Manager their projects.",
          hi: "रिपोर्ट में वही आता है जो आप देख सकते हैं: टीम मेंबर को अपने deliverables, टीम मैनेजर को अपनी टीम के, और Account Manager को अपने प्रोजेक्ट्स के।",
        },
      ],
    },
  ],
}
