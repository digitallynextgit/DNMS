import { Table2 } from "lucide-react"
import type { HelpGuide } from "../../types"

export const projectTasksGuide: HelpGuide = {
  slug: "project-tasks",
  group: "projects",
  icon: Table2,
  href: "/projects/my-projects",
  title: { en: "A project's Tasks tab", hi: "प्रोजेक्ट का Tasks टैब" },
  summary: {
    en: "See the whole team's week on one project, plan work day by day, update status and hours, and add new tasks.",
    hi: "एक प्रोजेक्ट पर पूरी टीम का हफ़्ता एक जगह देखें, दिन-ब-दिन काम प्लान करें, status और घंटे अपडेट करें, और नए tasks जोड़ें।",
  },
  keywords: [
    "tasks",
    "task sheet",
    "weekly plan",
    "allocation",
    "plan",
    "actual",
    "hours",
    "resources",
    "new task",
    "checklist",
    "comments",
    "on hold",
    "टास्क",
    "काम",
    "प्लान",
    "घंटे",
    "हफ़्ता",
  ],
  sections: [
    {
      id: "sheet",
      title: { en: "Read the week at a glance", hi: "पूरा हफ़्ता एक नज़र में देखें" },
      intro: {
        en: "The Tasks tab is a weekly sheet, like the Excel sheet the team plans in. Each row is one person on the project, and each working day has four columns: Plan, Actual, Hrs and Resources.",
        hi: "Tasks टैब एक हफ़्ते की शीट है, बिल्कुल उस Excel जैसी जिसमें टीम प्लान करती है। हर लाइन प्रोजेक्ट पर काम करने वाला एक व्यक्ति है, और हर वर्किंग डे के चार कॉलम हैं: Plan, Actual, Hrs और Resources।",
      },
      steps: [
        {
          text: {
            en: "Open the project and click the Tasks tab. The week shown is Monday to Friday. Use Previous week (1), This week (2) and Next week (3) to move between weeks. Today's column is lightly shaded.",
            hi: "प्रोजेक्ट खोलें और Tasks टैब पर क्लिक करें। हफ़्ता सोमवार से शुक्रवार तक दिखता है। हफ़्ते बदलने के लिए Previous week (1), This week (2) और Next week (3) इस्तेमाल करें। आज का कॉलम हल्के रंग से अलग दिखता है।",
          },
          shot: {
            id: "project-tasks-sheet",
            as: "manager",
            path: "/projects/sunmeadow-organics-launch?tab=tasks",
            highlight: [
              { role: "button", name: "Previous week" },
              { role: "button", name: "This week" },
              { role: "button", name: "Next week" },
              { text: "Plan", exact: true },
              { text: "Actual", exact: true },
              { text: "Hrs", exact: true },
              { text: "Resources", exact: true },
            ],
          },
        },
        {
          text: {
            en: "Plan (4) lists the day's tasks, numbered 1, 2, 3. Actual (5) is a note on what really happened. Hrs (6) shows the hours allocated on top and the time actually spent underneath. Resources (7) holds links - the brief, the doc, the published page. The same number ties a task together across all four columns.",
            hi: "Plan (4) में उस दिन के tasks 1, 2, 3 नंबर के साथ होते हैं। Actual (5) में लिखा होता है कि असल में क्या हुआ। Hrs (6) में ऊपर दिए गए घंटे (allocation) और नीचे असल में लगा समय दिखता है। Resources (7) में लिंक होते हैं - brief, doc, या पब्लिश हुआ पेज। एक ही नंबर चारों कॉलम में एक ही task को जोड़ता है।",
          },
        },
        {
          text: {
            en: "Each task's colour shows its status: plain text for To-do, blue for In Progress, green for Completed, amber for On Hold and red for Discarded. Completed and Discarded tasks are also struck through. The colour key sits under the sheet.",
            hi: "हर task का रंग उसका status बताता है: To-do सादा, In Progress नीला, Completed हरा, On Hold पीला-नारंगी और Discarded लाल। Completed और Discarded tasks पर लाइन भी कटी होती है। रंगों की जानकारी शीट के नीचे दी होती है।",
          },
        },
        {
          text: {
            en: "Week total on the right adds up each person's hours, and Daily total at the bottom adds up each day.",
            hi: "दाईं ओर Week total हर व्यक्ति के घंटे जोड़ता है, और नीचे Daily total हर दिन के।",
          },
        },
      ],
      tips: [
        {
          en: "A Saturday or Sunday column appears only when there is work on it. Tasks with no due date collect in a No date column at the end.",
          hi: "शनिवार या रविवार का कॉलम तभी आता है जब उस दिन कोई काम हो। बिना due date वाले tasks आखिर में No date कॉलम में दिखते हैं।",
        },
        {
          en: "If someone is on leave or it is a holiday, the cell or day heading says so, so a quiet day doesn't look like no work.",
          hi: "अगर कोई छुट्टी पर है या उस दिन हॉलिडे है, तो उस सेल या दिन के ऊपर लिखा आता है, ताकि खाली दिन को 'काम नहीं किया' न समझा जाए।",
        },
        {
          en: "Work nobody owns yet collects in an Unassigned row at the bottom.",
          hi: "जिस काम का अभी कोई मालिक नहीं, वो नीचे Unassigned लाइन में दिखता है।",
        },
      ],
    },
    {
      id: "filters",
      title: { en: "Narrow the sheet", hi: "शीट को छोटा करें (फ़िल्टर)" },
      steps: [
        {
          text: {
            en: "Use Team (1) to show one team, Employee (2) to show one person (or Unassigned work), and Status (3) to show only tasks in one status. If you manage a team, the sheet opens on your team.",
            hi: "Team (1) से एक टीम देखें, Employee (2) से एक व्यक्ति (या Unassigned काम), और Status (3) से सिर्फ़ एक status वाले tasks। अगर आप किसी टीम के मैनेजर हैं, तो शीट आपकी टीम पर ही खुलती है।",
          },
          shot: {
            id: "project-tasks-toolbar",
            as: "manager",
            path: "/projects/sunmeadow-organics-launch?tab=tasks",
            // Each caption with its dropdown, scoped to the toolbar row - a bare
            // "Employee" also matches the sidebar's EMPLOYEE heading.
            highlight: [
              {
                css: 'div:has(> button:has-text("Raise requirement")) > div:has(> label:text-is("Team"))',
              },
              {
                css: 'div:has(> button:has-text("Raise requirement")) > div:has(> label:text-is("Employee"))',
              },
              {
                css: 'div:has(> button:has-text("Raise requirement")) > div:has(> label:text-is("Status"))',
              },
              { role: "button", name: "Raise requirement" },
              { role: "button", name: "New Task" },
            ],
          },
        },
        {
          text: {
            en: "Raise requirement (4) is for when you are stuck waiting on someone - see the Requirements guide. New Task (5) opens the full task form.",
            hi: "Raise requirement (4) तब के लिए है जब आप किसी के इंतज़ार में अटके हों - इसके लिए Requirements गाइड देखें। New Task (5) से task का पूरा फॉर्म खुलता है।",
          },
        },
      ],
    },
    {
      id: "plan",
      title: { en: "Plan work in the sheet", hi: "शीट में काम प्लान करें" },
      intro: {
        en: "You can type new work into your own row. A team manager can type into the rows of their team, and the Account Manager and project admins into any row. Other rows still show, but you can't type in them.",
        hi: "आप अपनी लाइन में नया काम लिख सकते हैं। टीम मैनेजर अपनी टीम की लाइनों में, और Account Manager व प्रोजेक्ट एडमिन किसी भी लाइन में लिख सकते हैं। बाकी लाइनें दिखती हैं, पर उनमें लिख नहीं सकते।",
      },
      steps: [
        {
          text: {
            en: "Click a Plan cell on the day you want. It turns into a text box with that day's tasks, one per numbered line. An empty cell starts at 1.",
            hi: "जिस दिन काम करना है, उसकी Plan सेल पर क्लिक करें। वो एक टेक्स्ट बॉक्स बन जाती है जिसमें उस दिन के tasks नंबर वाली लाइनों में होते हैं। खाली सेल 1. से शुरू होती है।",
          },
        },
        {
          text: {
            en: "Write one task per line. Add the hours at the end with @, for example Design product banner @2h. You can also write @90m, @1h30m, or just @2 for two hours.",
            hi: "हर लाइन में एक task लिखें। आखिर में @ लगाकर घंटे लिखें, जैसे Design product banner @2h। आप @90m, @1h30m, या सिर्फ़ @2 (दो घंटे) भी लिख सकते हैं।",
          },
        },
        {
          text: {
            en: "Press Enter to save the cell. Press Shift+Enter to start the next line, or Esc to cancel. Clicking somewhere else also saves.",
            hi: "सेल सेव करने के लिए Enter दबाएँ। अगली लाइन शुरू करने के लिए Shift+Enter, और कैंसल करने के लिए Esc दबाएँ। कहीं और क्लिक करने से भी सेव हो जाता है।",
          },
        },
        {
          text: {
            en: "Forgot how it works? Click the small ? next to the colour key under the sheet. How this sheet works opens with one line per column.",
            hi: "भूल गए कैसे करना है? शीट के नीचे रंगों की जानकारी के पास छोटे ? पर क्लिक करें। How this sheet works खुलेगा, जिसमें हर कॉलम के लिए एक लाइन है।",
          },
          shot: {
            id: "project-tasks-how-it-works",
            as: "manager",
            path: "/projects/sunmeadow-organics-launch?tab=tasks",
            actions: [{ click: { role: "button", name: "How this sheet works" } }],
            crop: { role: "dialog" },
          },
        },
      ],
      tips: [
        {
          en: "Each new line becomes a real task, filed under a team the person is on. When you plan your own work, your team manager gets a notification.",
          hi: "हर नई लाइन एक असली task बन जाती है, उस व्यक्ति की टीम के अंदर। जब आप अपना काम प्लान करते हैं, तो आपके टीम मैनेजर को नोटिफिकेशन जाता है।",
        },
        {
          en: "Deleting a line from a cell deletes that task. DNMS asks first, and only the team manager, the Account Manager or a project admin can do it.",
          hi: "सेल से कोई लाइन मिटाने पर वो task डिलीट हो जाता है। DNMS पहले पूछता है, और ये सिर्फ़ टीम मैनेजर, Account Manager या प्रोजेक्ट एडमिन कर सकते हैं।",
        },
      ],
    },
    {
      id: "status",
      title: { en: "Change a task's status", hi: "Task का status बदलें" },
      steps: [
        {
          text: {
            en: "Click the number in front of a task. A menu opens with Open task… (1) at the top, then the statuses: To-do, In Progress (2), Completed (3), On Hold and Discarded. Pick one and the colour changes.",
            hi: "Task के आगे वाले नंबर पर क्लिक करें। एक मेन्यू खुलता है - सबसे ऊपर Open task… (1), फिर status: To-do, In Progress (2), Completed (3), On Hold और Discarded। एक चुनें और रंग बदल जाएगा।",
          },
          shot: {
            id: "project-tasks-status-menu",
            as: "manager",
            path: "/projects/sunmeadow-organics-launch?tab=tasks",
            // The number button itself: a role+name lookup also hits the Plan cell
            // around it (a div role=button whose name contains this label).
            actions: [
              { click: { css: 'button[aria-label^="Status of task"]' } },
              { waitFor: { role: "menu" } },
            ],
            highlight: [
              { role: "menuitem", name: "Open task" },
              { role: "menuitem", name: "In Progress" },
              { role: "menuitem", name: "Completed" },
            ],
          },
        },
        {
          text: {
            en: "Picking On Hold asks for a Reason and an Expected completion date, then Put on hold. Picking Discarded asks for a Reason, then Discard.",
            hi: "On Hold चुनने पर Reason और Expected completion date पूछी जाती है, फिर Put on hold पर क्लिक करें। Discarded चुनने पर Reason पूछा जाता है, फिर Discard पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Move a task to In Progress when you start it. The time you spend is counted while it stays In Progress, and shows as the lower number in Hrs.",
            hi: "काम शुरू करते ही task को In Progress करें। जब तक वो In Progress में रहता है, आपका लगा समय गिना जाता है, और Hrs में नीचे वाले नंबर में दिखता है।",
          },
        },
      ],
      tips: [
        {
          en: "The 15-minute edit window doesn't apply to status. You can move a task assigned to you through its statuses at any time.",
          hi: "15 मिनट की edit window status पर लागू नहीं होती। आपको दिया गया task आप कभी भी एक status से दूसरे में ले जा सकते हैं।",
        },
      ],
    },
    {
      id: "details",
      title: {
        en: "Open a task: checklist, comments and history",
        hi: "Task खोलें: checklist, comments और history",
      },
      steps: [
        {
          text: {
            en: "Click a task's number and pick Open task… - a panel opens on the right with the task's status, priority, due date, and the time allocated and spent.",
            hi: "Task के नंबर पर क्लिक करें और Open task… चुनें। दाईं ओर एक पैनल खुलता है जिसमें task का status, priority, due date, और दिया गया व लगा समय दिखता है।",
          },
        },
        {
          text: {
            en: "Use the Checklist (1) to break the task into small steps - type in Add an item and press Enter. History (2) shows when it was created, started and moved between statuses. Under Comments (3), type in the Add a comment box (4) and press Ctrl+Enter or the send button.",
            hi: "Checklist (1) से task को छोटे-छोटे स्टेप्स में बाँटें - Add an item में लिखें और Enter दबाएँ। History (2) में दिखता है कि task कब बना, कब शुरू हुआ और किस-किस status में गया। Comments (3) में, Add a comment बॉक्स (4) में लिखें और Ctrl+Enter या send बटन दबाएँ।",
          },
          shot: {
            id: "project-tasks-detail",
            as: "manager",
            path: "/projects/sunmeadow-organics-launch?tab=tasks",
            actions: [
              { click: { css: 'button[aria-label^="Status of task"]' } },
              { waitFor: { role: "menu" } },
              { click: { role: "menuitem", name: "Open task" } },
              { waitFor: { text: "Checklist", exact: true } },
              // The panel body scrolls; bring the comment box at its foot into view.
              { hover: { placeholder: "Add a comment" } },
            ],
            highlight: [
              { text: "Checklist", exact: true },
              { text: "History", exact: true },
              { text: "Comments", exact: true },
              { placeholder: "Add a comment" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "The team manager, the Account Manager and project admins also see Mark as milestone and a Goal picker here. The Produces output button is for them and for the person doing the task - click it to switch it off (it then reads Nothing to log for this one) when the task won't produce anything, like a page, video or design.",
            hi: "टीम मैनेजर, Account Manager और प्रोजेक्ट एडमिन को यहाँ Mark as milestone और Goal चुनने का विकल्प भी दिखता है। Produces output बटन उनके और task करने वाले व्यक्ति के लिए है - जब task से कोई चीज़ (जैसे पेज, वीडियो या डिज़ाइन) न बननी हो, तो उस पर क्लिक करके उसे बंद करें (फिर उस पर Nothing to log for this one लिखा आता है)।",
          },
        },
      ],
      tips: [
        {
          en: "A line you can't change any more still opens: click its number to read its comments and history.",
          hi: "जिस लाइन को अब आप बदल नहीं सकते, वो भी खुलती है: उसके comments और history पढ़ने के लिए नंबर पर क्लिक करें।",
        },
        {
          en: "The faint history icon at the end of each Plan line opens that task's Activity log - when it was created, started, and every status change.",
          hi: "हर Plan लाइन के आखिर में हल्का सा history आइकन उस task का Activity log खोलता है - कब बना, कब शुरू हुआ, और status के सारे बदलाव।",
        },
      ],
    },
    {
      id: "actual-hours",
      title: {
        en: "Fill in Actual, Hrs and Resources",
        hi: "Actual, Hrs और Resources भरें",
      },
      steps: [
        {
          text: {
            en: "Actual: click add… next to a task's number and write what really happened. Enter saves, Shift+Enter adds a new line.",
            hi: "Actual: task के नंबर के आगे add… पर क्लिक करें और लिखें कि असल में क्या हुआ। Enter से सेव होता है, Shift+Enter से नई लाइन।",
          },
        },
        {
          text: {
            en: "Hrs: the top number is the allocation - click it (or set if empty) to change it, for example 2h or 90m. The number underneath is time spent. It is measured from the task's In Progress time and can't be typed. It turns amber when more time was spent than allocated.",
            hi: "Hrs: ऊपर वाला नंबर allocation है - बदलने के लिए उस पर (या खाली हो तो set पर) क्लिक करें, जैसे 2h या 90m। नीचे वाला नंबर लगा हुआ समय है। ये task के In Progress समय से अपने आप गिना जाता है, इसे टाइप नहीं कर सकते। अगर दिए गए समय से ज़्यादा लगे, तो ये पीला-नारंगी हो जाता है।",
          },
        },
        {
          text: {
            en: "Resources: click add… and paste a link, one per line. You can add the live link any time, even days later.",
            hi: "Resources: add… पर क्लिक करें और लिंक पेस्ट करें, हर लाइन में एक। लाइव लिंक आप कभी भी जोड़ सकते हैं, कई दिन बाद भी।",
          },
        },
      ],
    },
    {
      id: "new-task",
      title: { en: "Add a task with the full form", hi: "पूरे फॉर्म से task जोड़ें" },
      intro: {
        en: "Use New Task when you want to add a description, priority or goal, or assign the work to someone.",
        hi: "जब description, priority या goal डालना हो, या काम किसी और को देना हो, तब New Task इस्तेमाल करें।",
      },
      steps: [
        {
          text: {
            en: "Click New Task. Pick the Team (1). If the project has goals, you can also pick the Goal this work serves.",
            hi: "New Task पर क्लिक करें। Team (1) चुनें। अगर प्रोजेक्ट में goals हैं, तो आप वो Goal भी चुन सकते हैं जिसके लिए ये काम है।",
          },
          shot: {
            id: "project-tasks-new",
            as: "manager",
            path: "/projects/sunmeadow-organics-launch?tab=tasks",
            actions: [{ click: { role: "button", name: "New Task" } }],
            // The whole Team dropdown (a Radix trigger: button role combobox) and
            // both Estimated time boxes, not just the text inside them.
            highlight: [
              { css: '[role=dialog] button[role=combobox]:has-text("Select a team")' },
              { placeholder: "What needs doing" },
              { css: '[role=dialog] div:has(> label:text-is("Estimated time")) > div.grid' },
              { role: "switch", name: "Produces output" },
              { role: "button", name: "Create task" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Pick the Assignee. Team managers, the Account Manager and project admins can give the task to anyone on the team - left as Team manager (default), it goes to the team manager. Everyone else can only raise a task on themselves, so pick your own name.",
            hi: "Assignee चुनें। टीम मैनेजर, Account Manager और प्रोजेक्ट एडमिन टीम में किसी को भी task दे सकते हैं - Team manager (default) छोड़ने पर task टीम मैनेजर को जाता है। बाकी लोग सिर्फ़ अपने नाम पर task बना सकते हैं, इसलिए अपना नाम चुनें।",
          },
        },
        {
          text: {
            en: "Type the Title (2), and add a Description, Priority and Due date if you like. Under Estimated time (3), fill in hours and minutes.",
            hi: "Title (2) लिखें, और चाहें तो Description, Priority और Due date भी डालें। Estimated time (3) में घंटे और मिनट भरें।",
          },
        },
        {
          text: {
            en: "Leave Produces output (4) on if the task will make something - a page, a video, a design. Then click Create task (5).",
            hi: "अगर task से कुछ बनेगा - पेज, वीडियो, डिज़ाइन - तो Produces output (4) चालू रहने दें। फिर Create task (5) पर क्लिक करें।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "Why does a task show a small lock?",
            hi: "किसी task पर छोटा ताला क्यों दिख रहा है?",
          },
          a: {
            en: "Whoever raises a task can change its wording, dates and hours for 15 minutes. After that only the team manager, the Account Manager or a project admin can. Point at the task to see why it is locked. You can still change its status.",
            hi: "जिसने task बनाया, वो 15 मिनट तक उसके शब्द, तारीख और घंटे बदल सकता है। उसके बाद सिर्फ़ टीम मैनेजर, Account Manager या प्रोजेक्ट एडमिन बदल सकते हैं। ताला क्यों लगा है, ये देखने के लिए task पर माउस ले जाएँ। Status आप फिर भी बदल सकते हैं।",
          },
        },
        {
          q: {
            en: "I can't type in a colleague's row. Why?",
            hi: "मैं किसी साथी की लाइन में क्यों नहीं लिख पा रहा?",
          },
          a: {
            en: "You can only plan work for yourself, unless you manage that person's team on this project or you are the Account Manager or a project admin.",
            hi: "आप सिर्फ़ अपने लिए काम प्लान कर सकते हैं, जब तक कि आप इस प्रोजेक्ट पर उस व्यक्ति की टीम के मैनेजर, Account Manager या प्रोजेक्ट एडमिन न हों।",
          },
        },
        {
          q: {
            en: "The sheet says to add a team first. What do I do?",
            hi: "शीट कह रही है पहले टीम जोड़ें। क्या करूँ?",
          },
          a: {
            en: "Nobody is on the project's teams yet. Ask the Account Manager to add people on the Teams tab.",
            hi: "प्रोजेक्ट की टीमों में अभी कोई नहीं है। Account Manager से कहें कि Teams टैब पर लोगों को जोड़ें।",
          },
        },
      ],
    },
  ],
}
