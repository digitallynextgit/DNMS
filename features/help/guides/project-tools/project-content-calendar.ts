import { CalendarDays } from "lucide-react"
import type { HelpGuide } from "../../types"

// Screens: features/projects/components/project-sheet.tsx (Calendars tab) and calendar/*.

const CALENDARS = "/projects/sunmeadow-organics-launch?tab=calendar"

export const projectContentCalendarGuide: HelpGuide = {
  slug: "project-content-calendar",
  group: "projects",
  icon: CalendarDays,
  href: "/projects/my-projects",
  title: { en: "Content Calendar", hi: "कंटेंट कैलेंडर (Calendars)" },
  summary: {
    en: "Plan a project's content month by month in a shared spreadsheet, and track what each team owes for the month.",
    hi: "प्रोजेक्ट का कंटेंट महीने-दर-महीने एक शेयर्ड स्प्रेडशीट में प्लान करें, और देखें कि महीने में हर टीम को क्या देना है।",
  },
  keywords: [
    "content calendar",
    "calendar",
    "calendars",
    "sheet",
    "spreadsheet",
    "month",
    "team plan",
    "import",
    "excel",
    "google sheet",
    "share with client",
    "कैलेंडर",
    "कंटेंट",
    "शीट",
    "महीना",
  ],
  sections: [
    {
      id: "about",
      title: { en: "What the Calendars tab is for", hi: "Calendars टैब किस काम का है" },
      intro: {
        en: "The Calendars tab holds the project's calendars - spreadsheets your team builds itself, like a content calendar, a campaign plan or a tracker. Each calendar has a page for every month, and a month can have several tabs.",
        hi: "Calendars टैब में प्रोजेक्ट के कैलेंडर रहते हैं - ऐसी स्प्रेडशीट जो आपकी टीम खुद बनाती है, जैसे कंटेंट कैलेंडर, कैंपेन प्लान या ट्रैकर। हर कैलेंडर में हर महीने का अलग पेज होता है, और एक महीने में कई टैब हो सकते हैं।",
      },
      steps: [
        {
          text: {
            en: "Open the project from My Projects and click the Calendars tab. The calendar's name (1) switches between calendars. The month name (2), with the arrows on each side, moves between months. New calendar (3) starts another one.",
            hi: "My Projects से प्रोजेक्ट खोलें और Calendars टैब पर क्लिक करें। कैलेंडर का नाम (1) एक कैलेंडर से दूसरे पर ले जाता है। महीने का नाम (2), और उसके दोनों ओर के तीर, एक महीने से दूसरे महीने पर ले जाते हैं। New calendar (3) से नया कैलेंडर शुरू होता है।",
          },
          shot: {
            id: "project-content-calendar-overview",
            as: "manager",
            path: CALENDARS,
            // The strip only appears once the open month's grid has loaded.
            actions: [{ waitFor: { role: "button", name: "Manage plan" } }],
            highlight: [
              { role: "button", name: "Switch calendar" },
              { role: "button", name: "Jump to a month" },
              { role: "button", name: "New calendar" },
              { role: "button", name: "Manage plan" },
            ],
          },
        },
        {
          text: {
            en: "The Team plan strip, with its Manage plan button (4), shows what each team owes - more on that below. Under it, the small buttons are the tabs of this month. Click one to open its grid.",
            hi: "Team plan वाली पट्टी, अपने Manage plan बटन (4) के साथ, दिखाती है कि हर टीम को क्या देना है - इसके बारे में नीचे बताया गया है। उसके नीचे वाले छोटे बटन इस महीने के टैब हैं। किसी का ग्रिड खोलने के लिए उस पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "Anyone on the project can add calendars, tabs, columns and rows, and edit any cell. Only the Account Manager or a project admin can delete them, or share a calendar with the client.",
          hi: "प्रोजेक्ट का कोई भी व्यक्ति कैलेंडर, टैब, कॉलम और रो जोड़ सकता है और कोई भी सेल बदल सकता है। इन्हें डिलीट करना या कैलेंडर क्लाइंट के साथ शेयर करना सिर्फ Account Manager या प्रोजेक्ट एडमिन कर सकते हैं।",
        },
      ],
    },
    {
      id: "start",
      title: { en: "Start a calendar or a new month", hi: "नया कैलेंडर या नया महीना शुरू करें" },
      steps: [
        {
          text: {
            en: "Click New calendar. A box called New sheet opens. Type a Name (1), like Content calendar, and click Create (3). It starts in the current month with one blank tab.",
            hi: "New calendar पर क्लिक करें। New sheet नाम का बॉक्स खुलेगा। Name (1) लिखें, जैसे Content calendar, और Create (3) पर क्लिक करें। ये मौजूदा महीने में एक खाली टैब के साथ शुरू होता है।",
          },
          shot: {
            id: "project-content-calendar-new",
            as: "manager",
            path: CALENDARS,
            actions: [
              { click: { role: "button", name: "New calendar" } },
              // Typed in, so Create shows enabled rather than greyed out.
              { fill: { css: "#sheet-name" }, value: "Content calendar" },
            ],
            highlight: [
              // By id: a grid column may be called "Name" too.
              { css: "#sheet-name" },
              { role: "button", name: "Upload a sheet instead" },
              { role: "button", name: "Create", exact: true },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Already have it in Excel or Google Sheets? Click Upload a sheet instead (2). Choose file takes a CSV or Excel file (.xlsx or .xls). Or paste a Google Sheet link and click Fetch - the sheet must be in this project's Drive folder. Then pick which tabs to import.",
            hi: "पहले से Excel या Google Sheets में है? Upload a sheet instead (2) पर क्लिक करें। Choose file से CSV या Excel फाइल (.xlsx या .xls) चुनें। या Google Sheet का लिंक पेस्ट करके Fetch पर क्लिक करें - शीट इस प्रोजेक्ट के Drive फोल्डर में होनी चाहिए। फिर चुनें कि कौन से टैब इम्पोर्ट करने हैं।",
          },
        },
        {
          text: {
            en: "For the next month, click the month name and pick New month… Choose the Month, then what to Start it from: Nothing (one blank tab), the latest month (shown by its name - Tabs and columns copies its tabs and columns, never its rows), or A file I upload. Click Create month. For a file, the button says Choose a file and opens the import box instead.",
            hi: "अगले महीने के लिए महीने के नाम पर क्लिक करें और New month… चुनें। Month चुनें, फिर Start it from में चुनें: Nothing (एक खाली टैब), सबसे नया महीना (उसके नाम से दिखता है - Tabs and columns उसके टैब और कॉलम कॉपी करता है, रो कभी नहीं), या A file I upload। Create month पर क्लिक करें। फाइल चुनने पर बटन पर Choose a file लिखा होता है और उससे इम्पोर्ट वाला बॉक्स खुलता है।",
          },
        },
      ],
      tips: [
        {
          en: "New month… is shown to the Account Manager, project admins and team managers.",
          hi: "New month… Account Manager, प्रोजेक्ट एडमिन और टीम मैनेजर्स को दिखता है।",
        },
        {
          en: "When you start from the latest month or from a file, Team plan from (that month) is ticked too: it carries over the teams, their people and quantities. Untick it to start the plan empty. Due dates and links are never carried over.",
          hi: "सबसे नए महीने से या फाइल से शुरू करने पर Team plan from (उस महीने) पर भी टिक लगा होता है: इससे टीमें, उनके लोग और संख्या आगे आ जाती है। खाली प्लान से शुरू करना हो तो टिक हटा दें। Due डेट और लिंक कभी आगे नहीं आते।",
        },
      ],
    },
    {
      id: "fill",
      title: { en: "Fill in the grid", hi: "ग्रिड भरें" },
      steps: [
        {
          text: {
            en: "Click a cell and type - what you type replaces what was there. Double-click a cell to change what is already in it. Press Enter or Tab, or click somewhere else, to save it. Escape cancels. The arrow keys move you around, like in Excel. In a Long text cell, Enter starts a new line - press Ctrl+Enter to save.",
            hi: "किसी सेल पर क्लिक करके टाइप करें - जो टाइप करेंगे वो पुरानी वैल्यू की जगह ले लेगा। सेल में पहले से लिखी चीज़ बदलने के लिए उस पर डबल-क्लिक करें। सेव करने के लिए Enter या Tab दबाएँ, या कहीं और क्लिक करें। Escape दबाने से बदलाव रद्द हो जाता है। Excel की तरह एरो की से इधर-उधर जा सकते हैं। Long text सेल में Enter से नई लाइन शुरू होती है - सेव करने के लिए Ctrl+Enter दबाएँ।",
          },
        },
        {
          text: {
            en: "To add a column, click Column at the top. Give it a Name (1) and pick a Type (2): Text, Long text, Number, Date, Select, Checkbox, Link or Person. For Select, type the Choices, one per line. Click Add column (3).",
            hi: "कॉलम जोड़ने के लिए ऊपर Column पर क्लिक करें। उसे Name (1) दें और Type (2) चुनें: Text, Long text, Number, Date, Select, Checkbox, Link या Person। Select के लिए Choices लिखें, हर लाइन में एक। Add column (3) पर क्लिक करें।",
          },
          shot: {
            id: "project-content-calendar-column",
            as: "manager",
            path: CALENDARS,
            actions: [
              { click: { role: "button", name: "Column", exact: true } },
              // Typed in, so Add column shows enabled rather than greyed out.
              { fill: { css: "#col-name" }, value: "Hashtags" },
            ],
            highlight: [
              // By id: grid columns carry their own name as a label (often "Type").
              { css: "#col-name" },
              { css: "#col-type" },
              { role: "button", name: "Add column" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Click a column's heading for Edit column. Drag the right edge of a heading to make the column wider; double-click the edge to fit it to the text. To make a row taller, drag the bottom edge of its row number.",
            hi: "Edit column के लिए कॉलम के हेडिंग पर क्लिक करें। कॉलम चौड़ा करने के लिए हेडिंग का दायाँ किनारा खींचें; टेक्स्ट के हिसाब से फिट करने के लिए किनारे पर डबल-क्लिक करें। किसी रो को ऊँचा करने के लिए उसके रो नंबर का निचला किनारा खींचें।",
          },
        },
        {
          text: {
            en: "New tab adds another grid to this month. Find in this tab… searches the open tab. History shows every change to the open tab - who changed what, and when.",
            hi: "New tab से इस महीने में एक और ग्रिड जुड़ता है। Find in this tab… खुले हुए टैब में खोजता है। History खुले हुए टैब का हर बदलाव दिखाती है - किसने क्या बदला, और कब।",
          },
        },
      ],
      tips: [
        {
          en: "History cannot be edited or deleted. If a row is deleted by mistake, its values are still in History, so you can type them back.",
          hi: "History न बदली जा सकती है न डिलीट होती है। अगर कोई रो गलती से डिलीट हो जाए, तो उसकी वैल्यू History में रहती हैं, जिससे आप उन्हें दोबारा भर सकते हैं।",
        },
      ],
    },
    {
      id: "team-plan",
      title: { en: "The team plan for the month", hi: "महीने का टीम प्लान" },
      intro: {
        en: "The Team plan strip shows what each team owes this month: how many items, how many are handed in, and when they are due.",
        hi: "Team plan वाली पट्टी दिखाती है कि इस महीने हर टीम को क्या देना है: कितने आइटम, कितने जमा हो चुके, और कब तक देने हैं।",
      },
      steps: [
        {
          text: {
            en: "Click a team's card, or Manage plan, to open the Team plan panel. If you cannot change it, the button says See the plan.",
            hi: "Team plan पैनल खोलने के लिए किसी टीम के कार्ड पर, या Manage plan पर क्लिक करें। अगर आप इसे बदल नहीं सकते, तो बटन पर See the plan लिखा होगा।",
          },
          shot: {
            id: "project-content-calendar-team-plan",
            as: "manager",
            path: CALENDARS,
            actions: [{ click: { role: "button", name: "Manage plan" } }],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "The Account Manager, a project admin and the calendar's manager set the People, the Due date and the Quantity for every team; a team's manager can do it for their own team. To add a team, click its name at the bottom, under Not on the plan.",
            hi: "Account Manager, प्रोजेक्ट एडमिन और कैलेंडर के मैनेजर हर टीम के लिए People, Due डेट और Quantity सेट करते हैं; टीम मैनेजर अपनी टीम के लिए ये कर सकते हैं। कोई टीम जोड़ने के लिए नीचे Not on the plan में उसके नाम पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Team members hand in their work under Links and Files (click Upload), and set the team's status at the top of its card. A team can be marked Done only when its links and files together add up to its Quantity.",
            hi: "टीम मेंबर अपना काम Links और Files (Upload पर क्लिक करें) में जमा करते हैं, और टीम का स्टेटस उसके कार्ड के ऊपर बदलते हैं। किसी टीम को Done तभी मार्क कर सकते हैं जब उसके लिंक और फाइलें मिलाकर उसकी Quantity जितनी हो जाएँ।",
          },
        },
      ],
      tips: [
        {
          en: "The person at the top right of the calendar is its manager - the one person who answers for the month. The Account Manager, a project admin or a team manager can change it.",
          hi: "कैलेंडर के ऊपर दाईं ओर दिखने वाला व्यक्ति उसका मैनेजर है - महीने के पूरे काम का जवाबदेह एक व्यक्ति। Account Manager, प्रोजेक्ट एडमिन या टीम मैनेजर इसे बदल सकते हैं।",
        },
        {
          en: "Removing a file from the plan does not delete it - it stays in the project's files.",
          hi: "प्लान से फाइल हटाने पर वो डिलीट नहीं होती - वो प्रोजेक्ट की फाइलों में रहती है।",
        },
      ],
    },
    {
      id: "share",
      title: {
        en: "For Account Managers: share a calendar with the client",
        hi: "Account Managers के लिए: कैलेंडर क्लाइंट के साथ शेयर करें",
      },
      steps: [
        {
          text: {
            en: "Open the month and click Share (1) at the top. The button changes to Shared, and the client can now fill cells and add rows from their portal. Click it again to stop sharing. Each month is shared on its own - a new month starts unshared.",
            hi: "महीना खोलें और ऊपर Share (1) पर क्लिक करें। बटन बदलकर Shared हो जाता है, और अब क्लाइंट अपने पोर्टल से सेल भर सकते हैं और रो जोड़ सकते हैं। शेयर बंद करने के लिए दोबारा क्लिक करें। हर महीना अलग से शेयर होता है - नया महीना बिना शेयर के शुरू होता है।",
          },
          shot: {
            id: "project-content-calendar-share",
            as: "manager",
            path: CALENDARS,
            // Only once the month has loaded. Not exact, so it also matches "Shared".
            actions: [{ waitFor: { role: "button", name: "Share" } }],
            highlight: [{ role: "button", name: "Share" }],
          },
        },
        {
          text: {
            en: "The client cannot change the columns, rename the calendar or delete it. They also need the Calendars section in their portal access, which is set on the client's Contacts tab. A calendar the client starts from their portal shows up on this tab too, already shared.",
            hi: "क्लाइंट कॉलम नहीं बदल सकते, न कैलेंडर का नाम बदल सकते हैं, न उसे डिलीट कर सकते हैं। उनकी पोर्टल एक्सेस में Calendars सेक्शन भी होना चाहिए, जो क्लाइंट के Contacts टैब पर सेट होता है। क्लाइंट अपने पोर्टल से जो कैलेंडर शुरू करते हैं, वो भी इसी टैब पर दिखता है, पहले से शेयर किया हुआ।",
          },
        },
      ],
    },
  ],
}
