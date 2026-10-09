import { Gauge } from "lucide-react"
import type { HelpGuide } from "../../types"

export const performanceAdminGuide: HelpGuide = {
  slug: "performance-admin",
  group: "hr",
  icon: Gauge,
  href: "/performance/evaluations",
  title: {
    en: "Performance Evaluations & KPI Profiles",
    hi: "परफ़ॉर्मेंस इवैल्यूएशन और KPI प्रोफ़ाइल (Performance)",
  },
  summary: {
    en: "Set up each person's KPIs, create evaluations for everyone or for one person, follow their progress, and read the final scores.",
    hi: "हर व्यक्ति के KPI सेट करें, सबके लिए या किसी एक के लिए इवैल्यूएशन बनाएँ, उनकी प्रगति देखें और फ़ाइनल स्कोर पढ़ें।",
  },
  keywords: [
    "performance",
    "evaluation",
    "appraisal",
    "review",
    "kpi",
    "kra",
    "score",
    "generate evaluations",
    "self evaluation",
    "manager review",
    "परफ़ॉर्मेंस",
    "मूल्यांकन",
    "अप्रेज़ल",
  ],
  sections: [
    {
      id: "how-it-works",
      title: { en: "How an evaluation works", hi: "इवैल्यूएशन कैसे काम करता है" },
      intro: {
        en: "An evaluation is a scorecard for one person for one period. The employee fills the Self-Evaluation and their manager fills the Manager Evaluation.",
        hi: "इवैल्यूएशन एक व्यक्ति का एक पीरियड का स्कोरकार्ड है। कर्मचारी Self-Evaluation भरता है और उसका मैनेजर Manager Evaluation भरता है।",
      },
      tips: [
        {
          en: "Both sides rate the same list, in two parts: Section A, Role Performance (KPI), is worth 60%, and Section B, Workplace Discipline & Execution, is worth 40%. The items in a section share its weight equally.",
          hi: "दोनों तरफ़ एक ही लिस्ट पर रेटिंग होती है, जिसके दो हिस्से हैं: Section A, Role Performance (KPI), 60% का है, और Section B, Workplace Discipline & Execution, 40% का। एक सेक्शन के सारे आइटम उसका वज़न बराबर बाँटते हैं।",
        },
        {
          en: "Every item is rated from 1 (Unacceptable) to 5 (Outstanding).",
          hi: "हर आइटम को 1 (Unacceptable) से 5 (Outstanding) तक रेटिंग दी जाती है।",
        },
        {
          en: "The Final Score is the manager's total out of 100. The self score is shown next to it only to compare.",
          hi: "Final Score मैनेजर का 100 में से कुल स्कोर है। Self स्कोर सिर्फ़ तुलना के लिए साथ में दिखता है।",
        },
        {
          en: "The badge next to the Final Score shows the band and what follows, for example 90 to 94%: Eligible for Increment + Promotion.",
          hi: "Final Score के बगल वाला बैज बैंड और उसका नतीजा बताता है, जैसे 90 to 94%: Eligible for Increment + Promotion।",
        },
        {
          en: "Status shows progress: Pending (nobody has submitted), Self done, Manager done, and Completed (both have submitted).",
          hi: "Status से प्रगति पता चलती है: Pending (किसी ने सबमिट नहीं किया), Self done, Manager done, और Completed (दोनों ने सबमिट कर दिया)।",
        },
      ],
    },
    {
      id: "kpi-profiles",
      title: { en: "Set up an employee's KPIs", hi: "कर्मचारी के KPI सेट करें" },
      intro: {
        en: "A KPI profile is the list of items a person is scored on. Set it up before you create evaluations.",
        hi: "KPI प्रोफ़ाइल उन आइटम्स की लिस्ट है जिन पर किसी व्यक्ति को स्कोर किया जाता है। इवैल्यूएशन बनाने से पहले इसे सेट करें।",
      },
      steps: [
        {
          text: {
            en: "In the sidebar, under Performance, click KPI Profiles. Status shows Configured (1) for people with their own KPIs, and Using defaults (2) for people who don't have any yet.",
            hi: "साइडबार में Performance के नीचे KPI Profiles पर क्लिक करें। जिनके अपने KPI हैं उनके Status में Configured (1) दिखता है, और जिनके अभी नहीं हैं उनके Using defaults (2)।",
          },
          shot: {
            id: "performance-admin-kpi-list",
            as: "hr",
            path: "/performance/kpi-profiles",
            // Badges on rows that are not next to each other, so the boxes don't
            // overlap (the first row uses defaults, the next ones are configured).
            highlight: [
              { text: "Configured", exact: true, nth: 2 },
              { text: "Using defaults", exact: true },
            ],
          },
        },
        {
          text: {
            en: "Click a person to open their profile. You edit the list on the left, which the manager rates (1). The employee rates themselves on exactly the same list, shown on the right (2) - it updates as you type.",
            hi: "किसी व्यक्ति पर क्लिक करके उसकी प्रोफ़ाइल खोलें। आप बाईं तरफ़ की लिस्ट बदलते हैं, जिस पर मैनेजर रेटिंग देता है (1)। कर्मचारी इसी लिस्ट पर खुद को रेटिंग देता है, जो दाईं तरफ़ दिखती है (2) - आप लिखते जाते हैं और ये साथ-साथ बदलती है।",
          },
          shot: {
            id: "performance-admin-kpi-editor",
            as: "hr",
            path: "/performance/kpi-profiles",
            // Clickable table rows are role "button", not "row" - so match the <tr>.
            actions: [
              { fill: { placeholder: "Search employee…" }, value: "Priya" },
              { click: { css: "tr:has-text('Priya Sharma')" } },
              { waitFor: { role: "button", name: "Save profile" } },
            ],
            highlight: [
              { text: "Manager evaluates", exact: true },
              { text: "Employee self-rates", exact: true },
              { role: "button", name: "Add kpi" },
              { role: "button", name: "Load sheet defaults" },
              { role: "button", name: "Save profile" },
            ],
          },
        },
        {
          text: {
            en: "Click Add kpi (3) in Section A, or Add parameter in Section B, and type the name. A Description (optional) helps people understand it. The bin removes a line.",
            hi: "Section A में Add kpi (3) पर, या Section B में Add parameter पर क्लिक करें और नाम लिखें। Description (optional) से लोगों को समझने में आसानी होती है। डस्टबिन से लाइन हटती है।",
          },
        },
        {
          text: {
            en: "In a hurry? Click Load sheet defaults (4) to fill in the company's standard list, then change what you need. Click Save profile (5).",
            hi: "जल्दी है? Load sheet defaults (4) पर क्लिक करें, कंपनी की स्टैंडर्ड लिस्ट भर जाएगी, फिर जो बदलना है बदलें। Save profile (5) पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "Weights are worked out for you: for example 6 KPIs in Section A get 10% each.",
          hi: "वज़न अपने आप बँट जाता है: जैसे Section A में 6 KPI हों तो हर एक को 10% मिलता है।",
        },
        {
          en: "Changes apply only to evaluations created after you save. Evaluations already made keep their old list.",
          hi: "बदलाव सिर्फ़ सेव करने के बाद बनने वाले इवैल्यूएशन पर लागू होते हैं। पहले बने इवैल्यूएशन में पुरानी लिस्ट ही रहती है।",
        },
      ],
    },
    {
      id: "generate",
      title: { en: "Create evaluations for everyone", hi: "सबके लिए इवैल्यूएशन बनाएँ" },
      steps: [
        {
          text: {
            en: "In the sidebar, under Performance, click Evaluations, then click Generate Evaluations. Check the message and click Generate & notify (1).",
            hi: "साइडबार में Performance के नीचे Evaluations पर क्लिक करें, फिर Generate Evaluations पर क्लिक करें। मैसेज पढ़ें और Generate & notify (1) पर क्लिक करें।",
          },
          shot: {
            id: "performance-admin-generate",
            as: "hr",
            path: "/performance/evaluations",
            actions: [
              { click: { role: "button", name: "Generate Evaluations" } },
              { waitFor: { css: "[role=alertdialog]" } },
            ],
            highlight: [{ role: "button", name: "Generate & notify" }],
            crop: { css: "[role=alertdialog]" },
          },
        },
        {
          text: {
            en: "DNMS creates an evaluation for every active employee who has a KPI profile (Status Configured) - Admins included if they have one. People still on Using defaults are left out.",
            hi: "DNMS हर उस active कर्मचारी का इवैल्यूएशन बनाता है जिसकी KPI प्रोफ़ाइल है (Status Configured) - अगर Admin की भी प्रोफ़ाइल है तो वो भी शामिल होते हैं। जिनका अभी Using defaults है, वो छूट जाते हैं।",
          },
        },
        {
          text: {
            en: "The batch is named after today's date, like Oct 7, 2026. Each employee and their manager get a notification to fill their side.",
            hi: "इस बैच का नाम आज की तारीख होता है, जैसे Oct 7, 2026। हर कर्मचारी और उसके मैनेजर को अपना हिस्सा भरने का नोटिफिकेशन मिलता है।",
          },
        },
      ],
      tips: [
        {
          en: "Clicking it again on the same day is safe - people who already have today's evaluation are skipped.",
          hi: "उसी दिन दोबारा क्लिक करना सुरक्षित है - जिनका आज का इवैल्यूएशन पहले से बना है, उन्हें छोड़ दिया जाता है।",
        },
        {
          en: "Don't click it on a later day to fill gaps in a batch - that starts a new batch with a new date for everyone. To add someone you missed, use New Evaluation with the same period label (see below).",
          hi: "किसी बैच में छूटे लोगों के लिए अगले दिन इसे दोबारा न दबाएँ - इससे सबके लिए नई तारीख वाला नया बैच बन जाएगा। किसी छूटे हुए व्यक्ति को जोड़ने के लिए उसी period label के साथ New Evaluation इस्तेमाल करें (नीचे देखें)।",
        },
      ],
    },
    {
      id: "new-evaluation",
      title: { en: "Create one evaluation", hi: "एक इवैल्यूएशन बनाएँ" },
      steps: [
        {
          text: {
            en: "On Evaluations, click New Evaluation. Pick the Employee (1). Leave Reviewing Manager (2) empty to use the employee's own manager, or pick someone else.",
            hi: "Evaluations पर New Evaluation पर क्लिक करें। Employee (1) चुनें। Reviewing Manager (2) खाली छोड़ेंगे तो कर्मचारी का अपना मैनेजर लगेगा, या किसी और को चुनें।",
          },
          shot: {
            id: "performance-admin-new-evaluation",
            as: "hr",
            path: "/performance/evaluations",
            actions: [
              { click: { role: "button", name: "New Evaluation" } },
              { waitFor: { role: "dialog" } },
            ],
            highlight: [
              { css: "[role=dialog] button[role=combobox]", nth: 0 },
              { css: "[role=dialog] button[role=combobox]", nth: 1 },
              { placeholder: "e.g. May end '26" },
              { role: "button", name: "Pick a date" },
              { role: "button", name: "Create & notify" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Project Controller (optional) adds a third review column. It is recorded alongside but doesn't change the final score.",
            hi: "Project Controller (optional) से तीसरा रिव्यू कॉलम जुड़ता है। वो साथ में दर्ज होता है, पर फ़ाइनल स्कोर नहीं बदलता।",
          },
        },
        {
          text: {
            en: "Type the Period label (3) and, if you like, a Due date (4). Click Create & notify (5). The employee, the manager and any controller are notified.",
            hi: "Period label (3) लिखें और चाहें तो Due date (4) चुनें। Create & notify (5) पर क्लिक करें। कर्मचारी, मैनेजर और controller (अगर चुना है) को नोटिफिकेशन मिल जाता है।",
          },
        },
      ],
      tips: [
        {
          en: "To add someone to an existing batch, type the batch's period label exactly as it shows in the Period column, like Oct 7, 2026. Then they show up together in the period filter.",
          hi: "किसी पुराने बैच में किसी को जोड़ना हो, तो Period कॉलम में जैसा लिखा है बिल्कुल वैसा ही period label लिखें, जैसे Oct 7, 2026। तब वो period फ़िल्टर में बाकी लोगों के साथ दिखेंगे।",
        },
        {
          en: "Someone with no KPI profile gets the company's standard list.",
          hi: "जिसकी KPI प्रोफ़ाइल नहीं है, उसे कंपनी की स्टैंडर्ड लिस्ट मिलती है।",
        },
      ],
    },
    {
      id: "track",
      title: {
        en: "Follow progress and open an evaluation",
        hi: "प्रगति देखें और इवैल्यूएशन खोलें",
      },
      steps: [
        {
          text: {
            en: "On Evaluations, pick a status in the Status menu (1), type a name in Search employee… (2), or pick a batch in All periods (3). Click Open (4) to see an evaluation.",
            hi: "Evaluations पर Status मेन्यू (1) में कोई status चुनें, Search employee… (2) में नाम लिखें, या All periods (3) में कोई बैच चुनें। इवैल्यूएशन देखने के लिए Open (4) पर क्लिक करें।",
          },
          shot: {
            id: "performance-admin-list",
            as: "hr",
            path: "/performance/evaluations",
            highlight: [
              { role: "button", name: "Status: All" },
              { placeholder: "Search employee…" },
              { css: "button[role=combobox]:has-text('All periods')" },
              { role: "link", name: "Open", exact: true },
            ],
          },
        },
        {
          text: {
            en: "At the top you see whether Self and Manager have submitted, and the Final Score (1). Below are the Manager Evaluation (2) and the Self-Evaluation (3) side by side.",
            hi: "ऊपर दिखता है कि Self और Manager ने सबमिट किया या नहीं, और Final Score (1)। नीचे Manager Evaluation (2) और Self-Evaluation (3) साथ-साथ दिखते हैं।",
          },
          shot: {
            id: "performance-admin-evaluation",
            as: "hr",
            path: "/performance/evaluations",
            // Open a row whose status is Self done. Scoped to <tr>: the table's
            // phone cards come first in the page but are hidden on desktop.
            actions: [
              { click: { css: "tr:has-text('Self done') a:has-text('Open')" } },
              { waitFor: { text: "Final Score", exact: true } },
            ],
            highlight: [
              { text: "Final Score", exact: true },
              { text: "Manager Evaluation", exact: true },
              { text: "Self-Evaluation", exact: true },
            ],
          },
        },
        {
          text: {
            en: "As HR you can also fill the Manager Evaluation, for example when the manager is away. Rate every item from 1 to 5, add notes in the box (1) if you like, and click Submit Manager review (2). Only do this when you are reviewing on the manager's behalf.",
            hi: "HR के तौर पर आप भी Manager Evaluation भर सकते हैं, जैसे जब मैनेजर मौजूद न हो। हर आइटम को 1 से 5 तक रेटिंग दें, चाहें तो बॉक्स (1) में नोट्स लिखें, और Submit Manager review (2) पर क्लिक करें। ऐसा तभी करें जब आप मैनेजर की जगह रिव्यू कर रहे हों।",
          },
          shot: {
            id: "performance-admin-manager-review",
            as: "hr",
            path: "/performance/evaluations",
            actions: [
              { click: { css: "tr:has-text('Self done') a:has-text('Open')" } },
              { waitFor: { role: "button", name: "Submit Manager review" } },
            ],
            highlight: [
              { role: "textbox", name: "Optional notes" },
              { role: "button", name: "Submit Manager review" },
            ],
            // The comments card under the scorecards. Every Card has
            // .text-card-foreground; the last match is the innermost one.
            crop: { css: "div.text-card-foreground:has-text('Manager review comments')", nth: -1 },
          },
        },
        {
          text: {
            en: "Click Print / Save PDF to keep a copy.",
            hi: "कॉपी रखने के लिए Print / Save PDF पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "A submitted side can't be changed.",
          hi: "एक बार सबमिट हुआ हिस्सा बदला नहीं जा सकता।",
        },
        {
          en: "Your own evaluation always opens as your Self-Evaluation, even though you are HR.",
          hi: "आपका अपना इवैल्यूएशन हमेशा आपके Self-Evaluation के रूप में ही खुलता है, भले ही आप HR हों।",
        },
        {
          en: "The employee can't see the manager's ratings until the manager submits.",
          hi: "जब तक मैनेजर सबमिट नहीं करता, कर्मचारी को मैनेजर की रेटिंग नहीं दिखती।",
        },
        {
          en: "To download evaluations as a spreadsheet, click Export above the table and pick CSV file or Excel file. It downloads the rows on the current page, or only the rows you have ticked.",
          hi: "इवैल्यूएशन को spreadsheet में डाउनलोड करने के लिए टेबल के ऊपर Export पर क्लिक करें और CSV file या Excel file चुनें। इसमें चालू पेज की लाइनें आती हैं, या सिर्फ़ वो लाइनें जो आपने टिक की हैं।",
        },
      ],
    },
    {
      id: "delete",
      title: { en: "Delete evaluations", hi: "इवैल्यूएशन डिलीट करें" },
      steps: [
        {
          text: {
            en: "To delete one, click the bin at the end of its row and confirm with Delete.",
            hi: "एक डिलीट करना हो तो उसकी लाइन के आखिर में डस्टबिन पर क्लिक करें और Delete से कन्फ़र्म करें।",
          },
        },
        {
          text: {
            en: "To delete many - for example a batch made by mistake - pick that batch in All periods, tick the rows (1) or the box at the top to select the whole page, then click Delete (2) in the table's header row and confirm.",
            hi: "कई एक साथ डिलीट करने हों - जैसे गलती से बना कोई बैच - तो All periods में वो बैच चुनें, लाइनें टिक करें (1) या पूरा पेज चुनने के लिए ऊपर वाला बॉक्स टिक करें, फिर टेबल की हेडर लाइन में Delete (2) पर क्लिक करके कन्फ़र्म करें।",
          },
          shot: {
            id: "performance-admin-bulk-delete",
            as: "hr",
            path: "/performance/evaluations",
            actions: [
              { click: { role: "checkbox", name: "Select row" } },
              { click: { role: "checkbox", name: "Select row", nth: 1 } },
            ],
            highlight: [
              { role: "checkbox", name: "Select row" },
              { role: "button", name: "Delete", exact: true },
            ],
          },
        },
      ],
      tips: [
        {
          en: "Deleting also removes any self, manager or controller ratings already submitted. It can't be undone.",
          hi: "डिलीट करने से पहले से सबमिट हुई self, manager या controller रेटिंग भी हट जाती हैं। यह वापस नहीं होता।",
        },
      ],
    },
  ],
}
