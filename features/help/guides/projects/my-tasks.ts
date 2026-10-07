import { ListChecks } from "lucide-react"
import type { HelpGuide } from "../../types"

export const myTasksGuide: HelpGuide = {
  slug: "my-tasks",
  group: "projects",
  icon: ListChecks,
  href: "/projects/my-tasks",
  title: { en: "My Tasks", hi: "मेरे टास्क (My Tasks)" },
  summary: {
    en: "Plan your week across all your clients, update your tasks as you work, and export them. Managers can open a team member's tasks too.",
    hi: "अपने सभी क्लाइंट्स का हफ़्ता प्लान करें, काम करते हुए tasks अपडेट करें, और उन्हें export करें। मैनेजर अपनी टीम के किसी व्यक्ति के tasks भी देख सकते हैं।",
  },
  keywords: [
    "tasks",
    "my tasks",
    "weekly sheet",
    "plan",
    "actual",
    "hours",
    "adhoc",
    "export",
    "excel",
    "csv",
    "new task",
    "टास्क",
    "मेरे काम",
    "हफ़्ते का प्लान",
    "घंटे",
  ],
  sections: [
    {
      id: "overview",
      title: { en: "What My Tasks shows", hi: "My Tasks में क्या दिखता है" },
      intro: {
        en: "My Tasks is your own work across every project, in one place. It opens on the weekly sheet - the same plan-and-actual sheet the team uses in Excel.",
        hi: "My Tasks में सारे प्रोजेक्ट्स का आपका काम एक ही जगह दिखता है। ये हफ़्ते की शीट पर खुलता है - वही plan और actual वाली शीट जो टीम Excel में इस्तेमाल करती है।",
      },
      steps: [
        {
          text: {
            en: "Click My Tasks in the sidebar. The strip at the top counts your Total tasks, how many are Done and how many are Overdue.",
            hi: "साइडबार में My Tasks पर क्लिक करें। ऊपर की पट्टी में आपके Total tasks, कितने Done हैं और कितने Overdue हैं, ये गिनती होती है।",
          },
        },
        {
          text: {
            en: "Use Project: (1) to show one client (or ADHOC work) and Status: (2) to show one status. The buttons on the right switch between Card view (3) and Sheet view (4). Export (5) and New Task (6) are at the top.",
            hi: "एक क्लाइंट (या ADHOC काम) देखने के लिए Project: (1) और एक status देखने के लिए Status: (2) इस्तेमाल करें। दाईं ओर के बटन Card view (3) और Sheet view (4) के बीच बदलते हैं। ऊपर Export (5) और New Task (6) हैं।",
          },
          shot: {
            id: "my-tasks-header",
            as: "employee",
            path: "/projects/my-tasks",
            highlight: [
              // The dropdown right after each caption, not the caption alone.
              { css: 'span:text-is("Project:") + button' },
              { css: 'span:text-is("Status:") + button' },
              // Screen order: Card view sits left of Sheet view.
              { role: "tab", name: "Card view" },
              { role: "tab", name: "Sheet view" },
              { role: "button", name: "Export" },
              { role: "button", name: "New Task" },
            ],
          },
        },
      ],
    },
    {
      id: "sheet",
      title: { en: "Read your week in the sheet", hi: "शीट में अपना हफ़्ता देखें" },
      steps: [
        {
          text: {
            en: "Each row is one of your clients - every project you are on, listed under Client (1). The last row, ADHOC (2), is for work with no client, like meetings and interviews.",
            hi: "हर लाइन आपका एक क्लाइंट है - हर वो प्रोजेक्ट जिस पर आप हैं, Client (1) के नीचे। आखिरी लाइन ADHOC (2) बिना क्लाइंट वाले काम के लिए है, जैसे मीटिंग और इंटरव्यू।",
          },
          shot: {
            id: "my-tasks-sheet",
            as: "employee",
            path: "/projects/my-tasks",
            highlight: [
              { text: "Client", exact: true },
              { text: "ADHOC", exact: true },
              { text: "Plan", exact: true },
            ],
          },
        },
        {
          text: {
            en: "Each working day has four columns, starting with Plan (3): Plan is the tasks for that day, Actual is what really happened, Hrs is hours allocated (top) and spent (below), and Resources holds links like the brief or the published page.",
            hi: "हर वर्किंग डे के चार कॉलम हैं, Plan (3) से शुरू: Plan में उस दिन के tasks, Actual में असल में क्या हुआ, Hrs में दिए गए घंटे (ऊपर) और लगे घंटे (नीचे), और Resources में लिंक जैसे brief या पब्लिश हुआ पेज।",
          },
        },
        {
          text: {
            en: "Scroll the sheet to the right end. Week total (1) adds up each client's hours for the week, and Daily total (2) at the bottom adds up each day. Use the arrow buttons and This week above the sheet to move between weeks.",
            hi: "शीट को दाईं ओर आखिर तक स्क्रॉल करें। Week total (1) हर क्लाइंट के हफ़्ते भर के घंटे जोड़ता है, और नीचे Daily total (2) हर दिन के। हफ़्ते बदलने के लिए शीट के ऊपर तीर वाले बटन और This week इस्तेमाल करें।",
          },
          shot: {
            id: "my-tasks-sheet-totals",
            as: "employee",
            path: "/projects/my-tasks",
            // Week total is the last column, past the right edge of the window -
            // pointing at it scrolls the sheet sideways. Daily total stays pinned
            // on the left.
            actions: [{ hover: { text: "Week total", exact: true } }],
            highlight: [
              { text: "Week total", exact: true },
              { text: "Daily total", exact: true },
            ],
          },
        },
      ],
      tips: [
        {
          en: "Each task's colour is its status: plain for To-do, blue for In Progress, green for Completed, amber for On Hold, red for Discarded.",
          hi: "हर task का रंग उसका status है: To-do सादा, In Progress नीला, Completed हरा, On Hold पीला-नारंगी, Discarded लाल।",
        },
        {
          en: "Days you are on leave, holidays and your birthday are marked in the day's heading.",
          hi: "जिन दिनों आप छुट्टी पर हैं, हॉलिडे, और आपका जन्मदिन - ये दिन के हेडिंग में लिखे आते हैं।",
        },
      ],
    },
    {
      id: "plan",
      title: { en: "Plan your week", hi: "अपना हफ़्ता प्लान करें" },
      steps: [
        {
          text: {
            en: "Click the Plan cell for a client on the day you want.",
            hi: "जिस दिन काम करना है, उस क्लाइंट की Plan सेल पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Write one task per line, with the hours at the end after @ - for example Instagram post design @2h. You can also write @90m, @1h30m or just @2.",
            hi: "हर लाइन में एक task लिखें, आखिर में @ के बाद घंटे - जैसे Instagram post design @2h। आप @90m, @1h30m या सिर्फ़ @2 भी लिख सकते हैं।",
          },
        },
        {
          text: {
            en: "Press Enter to save. Shift+Enter starts the next line and Esc cancels. Clicking somewhere else also saves. Each line in a client's row becomes a task on that project, and your team manager is told.",
            hi: "सेव करने के लिए Enter दबाएँ। अगली लाइन के लिए Shift+Enter और कैंसल के लिए Esc। कहीं और क्लिक करने से भी सेव हो जाता है। किसी क्लाइंट की लाइन में लिखी हर लाइन उस प्रोजेक्ट पर एक task बन जाती है, और आपके टीम मैनेजर को बताया जाता है।",
          },
        },
        {
          text: {
            en: "Later, click add… under Actual to write what happened, click the top number under Hrs (or set) to change the allocation, and click add… under Resources to paste links.",
            hi: "बाद में, Actual में add… पर क्लिक करके लिखें क्या हुआ, Hrs में ऊपर वाले नंबर (या set) पर क्लिक करके allocation बदलें, और Resources में add… पर क्लिक करके लिंक पेस्ट करें।",
          },
        },
      ],
      tips: [
        {
          en: "You can correct a task's wording, date and hours for 15 minutes after you add it. After that it shows a lock and only your team manager can change it. Your own ADHOC tasks stay editable.",
          hi: "Task जोड़ने के 15 मिनट तक आप उसके शब्द, तारीख और घंटे ठीक कर सकते हैं। उसके बाद उस पर ताला दिखता है और सिर्फ़ आपका टीम मैनेजर उसे बदल सकता है। आपके अपने ADHOC tasks हमेशा बदले जा सकते हैं।",
        },
        {
          en: "Only a manager can delete a task. If you remove a line you are not allowed to delete, the sheet tells you and keeps it - put it On Hold or Discard it instead.",
          hi: "Task सिर्फ़ मैनेजर डिलीट कर सकता है। अगर आप ऐसी लाइन हटाते हैं जिसे डिलीट करने की अनुमति नहीं, तो शीट बता देती है और उसे रहने देती है - उसकी जगह उसे On Hold या Discard करें।",
        },
        {
          en: "The small ? under the sheet opens How this sheet works.",
          hi: "शीट के नीचे छोटा ? How this sheet works खोलता है।",
        },
      ],
    },
    {
      id: "status",
      title: { en: "Update a task's status", hi: "Task का status अपडेट करें" },
      steps: [
        {
          text: {
            en: "Click the number in front of a task. Pick the new status: To-do, In Progress (1), Completed (2), On Hold (3) or Discarded.",
            hi: "Task के आगे वाले नंबर पर क्लिक करें। नया status चुनें: To-do, In Progress (1), Completed (2), On Hold (3) या Discarded।",
          },
          shot: {
            id: "my-tasks-status-menu",
            as: "employee",
            path: "/projects/my-tasks",
            // The number button itself: a role+name lookup also hits the Plan cell
            // around it (a div role=button whose name contains this label).
            actions: [
              { click: { css: 'button[aria-label^="Status of task"]' } },
              { waitFor: { role: "menu" } },
            ],
            highlight: [
              { role: "menuitem", name: "In Progress" },
              { role: "menuitem", name: "Completed" },
              { role: "menuitem", name: "On Hold" },
            ],
          },
        },
        {
          text: {
            en: "On Hold asks for a Reason and an Expected completion date; Discarded asks for a Reason.",
            hi: "On Hold के लिए Reason और Expected completion date, और Discarded के लिए Reason पूछा जाता है।",
          },
        },
        {
          text: {
            en: "Put a task In Progress when you start and move it on when you stop. The time it spends In Progress is your spent time - it shows under Hrs and in your Work report.",
            hi: "काम शुरू करते ही task को In Progress करें और रुकते ही आगे बढ़ा दें। जितना समय वो In Progress में रहता है, वही आपका लगा समय है - ये Hrs में और आपकी Work report में दिखता है।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "Where do I add comments or a checklist to a task?",
            hi: "Task पर comment या checklist कहाँ जोड़ूँ?",
          },
          a: {
            en: "Open the project's Tasks tab, click the task's number and pick Open task… - the comments, checklist and history are there.",
            hi: "प्रोजेक्ट का Tasks टैब खोलें, task के नंबर पर क्लिक करें और Open task… चुनें - comments, checklist और history वहीं हैं।",
          },
        },
      ],
    },
    {
      id: "cards",
      title: { en: "Use Card view", hi: "Card view इस्तेमाल करें" },
      steps: [
        {
          text: {
            en: "Click Card view. Your tasks are grouped by day. Today (1) and any day with overdue work start open - click a day to open or close it, or use Expand all.",
            hi: "Card view पर क्लिक करें। आपके tasks दिन के हिसाब से ग्रुप में दिखते हैं। आज का दिन (1) और जिस दिन का काम overdue है, वो खुले रहते हैं - किसी दिन को खोलने या बंद करने के लिए उस पर क्लिक करें, या Expand all इस्तेमाल करें।",
          },
          shot: {
            id: "my-tasks-cards",
            as: "employee",
            path: "/projects/my-tasks",
            actions: [{ click: { role: "tab", name: "Card view" } }],
            // Only today's group: the list runs back weeks, so a full-window
            // picture lands on old, closed days.
            highlight: [
              { css: 'button[aria-expanded]:has-text("Today ·")' },
              {
                css: 'div:has(> div > button[aria-expanded]:has-text("Today ·")) button[role=combobox]',
              },
              {
                css: 'div:has(> div > button[aria-expanded]:has-text("Today ·")) button[aria-label^="Activity log for"]',
              },
            ],
            crop: { css: 'div:has(> div > button[aria-expanded]:has-text("Today ·"))' },
          },
        },
        {
          text: {
            en: "Each task has a status box (2) on the left. Under the title you see its client, team, priority, allocated and spent time, and History (3) for its activity log. You can add links with add… here too.",
            hi: "हर task के बाईं ओर status बॉक्स (2) होता है। टाइटल के नीचे उसका क्लाइंट, टीम, priority, दिया और लगा समय, और activity log के लिए History (3) दिखता है। यहाँ भी add… से लिंक जोड़ सकते हैं।",
          },
        },
        {
          text: {
            en: "Red Overdue means the due date has passed. Blocked means the task is waiting on a requirement - point at it to see which one.",
            hi: "लाल Overdue का मतलब due date निकल गई। Blocked का मतलब task किसी requirement के इंतज़ार में है - कौन सी, ये देखने के लिए उस पर माउस ले जाएँ।",
          },
        },
        {
          text: {
            en: "In Card view you can also pick a single due date with the All dates (1) button next to Due:. Click the X next to it to show all dates again.",
            hi: "Card view में Due: के पास वाले All dates (1) बटन से एक due date भी चुन सकते हैं। सारी तारीखें दोबारा देखने के लिए उसके पास X पर क्लिक करें।",
          },
          shot: {
            id: "my-tasks-cards-date",
            as: "employee",
            path: "/projects/my-tasks",
            actions: [{ click: { role: "tab", name: "Card view" } }],
            highlight: [{ role: "button", name: "All dates" }],
            // The filter bar - Due: and its date button only show in Card view.
            crop: { css: 'div:has(> div > span:text-is("Due:"))' },
          },
        },
      ],
    },
    {
      id: "new-task",
      title: { en: "Add a task with the form", hi: "फॉर्म से task जोड़ें" },
      steps: [
        {
          text: {
            en: "Click New Task. Pick the Project (1) - or ADHOC · no client for meetings and other work with no client. Then pick the Team (2); you only see teams you belong to.",
            hi: "New Task पर क्लिक करें। Project (1) चुनें - या मीटिंग और बिना क्लाइंट वाले काम के लिए ADHOC · no client। फिर Team (2) चुनें; आपको सिर्फ़ वही टीमें दिखती हैं जिनमें आप हैं।",
          },
          shot: {
            id: "my-tasks-new",
            as: "employee",
            path: "/projects/my-tasks",
            actions: [{ click: { role: "button", name: "New Task" } }],
            // The whole dropdowns (Radix triggers are buttons with role combobox),
            // not just the grey placeholder text inside them.
            highlight: [
              { css: '[role=dialog] button[role=combobox]:has-text("Select a project")' },
              { css: '[role=dialog] button[role=combobox]:has-text("Pick a project first")' },
              { placeholder: "What needs doing" },
              { role: "button", name: "Create task" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Pick yourself as the Assignee (team managers can pick anyone on their team). Type the Title (3), and add a Description, Priority, Due date and Estimated time if you like.",
            hi: "Assignee में अपना नाम चुनें (टीम मैनेजर अपनी टीम में किसी को भी चुन सकते हैं)। Title (3) लिखें, और चाहें तो Description, Priority, Due date और Estimated time भी डालें।",
          },
        },
        {
          text: {
            en: "Click Create task (4). It appears in your sheet on its due date, or in a No date column if it has none.",
            hi: "Create task (4) पर क्लिक करें। ये आपकी शीट में अपनी due date पर दिखेगा, या due date न हो तो No date कॉलम में।",
          },
        },
      ],
    },
    {
      id: "export",
      title: { en: "Export your tasks", hi: "अपने tasks export करें" },
      steps: [
        {
          text: {
            en: "Set the Project: and Status: filters to what you want, then click Export. Pick Excel (.xlsx) (1) or CSV (2). The file holds exactly the tasks the filters show - the menu tells you how many.",
            hi: "Project: और Status: फ़िल्टर अपने हिसाब से सेट करें, फिर Export पर क्लिक करें। Excel (.xlsx) (1) या CSV (2) चुनें। फ़ाइल में ठीक वही tasks आते हैं जो फ़िल्टर दिखा रहे हैं - मेन्यू में गिनती लिखी होती है।",
          },
          shot: {
            id: "my-tasks-export",
            as: "employee",
            path: "/projects/my-tasks",
            actions: [{ click: { role: "button", name: "Export" } }],
            highlight: [
              { role: "menuitem", name: "Excel" },
              { role: "menuitem", name: "CSV" },
            ],
          },
        },
      ],
    },
    {
      id: "others",
      title: {
        en: "For managers: see a team member's tasks",
        hi: "मैनेजर्स के लिए: टीम के किसी व्यक्ति के tasks देखें",
      },
      intro: {
        en: "If people report to you, a picker with your name appears at the top. Managers see their direct reports in it. Project admins see everyone in the company.",
        hi: "अगर लोग आपको रिपोर्ट करते हैं, तो ऊपर आपके नाम वाला एक picker दिखता है। मैनेजर को इसमें अपने direct reports दिखते हैं। प्रोजेक्ट एडमिन को कंपनी के सारे लोग दिखते हैं।",
      },
      steps: [
        {
          text: {
            en: "Click the picker with your name (1) and pick a person (2). The page title changes to Tasks · their name, and the sheet shows their week across their clients.",
            hi: "अपने नाम वाले picker (1) पर क्लिक करें और कोई व्यक्ति (2) चुनें। पेज का टाइटल Tasks · उनका नाम हो जाता है, और शीट में उनके क्लाइंट्स का हफ़्ता दिखता है।",
          },
          shot: {
            id: "my-tasks-whose",
            as: "manager",
            path: "/projects/my-tasks",
            actions: [
              { click: { role: "combobox", name: "Whose tasks" } },
              { waitFor: { role: "option", name: "Priya Sharma" } },
            ],
            highlight: [
              // By css: while the list is open, Radix marks the rest of the page
              // aria-hidden, so a role lookup no longer finds the picker itself.
              { css: 'button[aria-label="Whose tasks"]' },
              { role: "option", name: "Priya Sharma" },
            ],
          },
        },
        {
          text: {
            en: "To go back to your own tasks, pick your own name at the top of the list. DNMS remembers who you last looked at.",
            hi: "अपने tasks पर वापस आने के लिए लिस्ट में सबसे ऊपर अपना नाम चुनें। DNMS याद रखता है कि आपने आखिरी बार किसके tasks देखे थे।",
          },
        },
      ],
      tips: [
        {
          en: "People who have left are listed separately under Archived · no longer with us, so their old tasks can still be read. You can't add new tasks for them.",
          hi: "जो लोग कंपनी छोड़ चुके हैं, वो Archived · no longer with us में अलग दिखते हैं, ताकि उनके पुराने tasks पढ़े जा सकें। उनके लिए नया task नहीं जोड़ सकते।",
        },
      ],
    },
  ],
}
