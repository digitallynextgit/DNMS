import { IndianRupee } from "lucide-react"
import { PERMISSIONS } from "@/lib/constants"
import type { HelpGuide } from "../../types"

export const payrollGuide: HelpGuide = {
  slug: "payroll",
  group: "hr",
  icon: IndianRupee,
  href: "/payroll/payroll-directory",
  title: { en: "Payroll & Salary Structures", hi: "पेरोल और सैलरी स्ट्रक्चर (Payroll)" },
  summary: {
    en: "Set each person's salary, make the month's payslips, check them, and mark them paid.",
    hi: "हर व्यक्ति की सैलरी सेट करें, महीने की पेस्लिप बनाएँ, उन्हें चेक करें और Paid मार्क करें।",
  },
  keywords: [
    "payroll",
    "salary",
    "payslip",
    "salary slip",
    "salary structure",
    "gross",
    "net pay",
    "lop",
    "loss of pay",
    "overtime",
    "generate payroll",
    "सैलरी",
    "वेतन",
    "पेस्लिप",
    "तनख्वाह",
  ],
  sections: [
    {
      id: "how-pay-works",
      title: { en: "How pay is worked out", hi: "सैलरी का हिसाब कैसे होता है" },
      intro: {
        en: "Payroll has two pages under HRMS > Payroll. In Salary Structures you set each person's monthly salary. In Payroll Directory you make the month's payslips and pay them.",
        hi: "HRMS > Payroll के नीचे दो पेज हैं। Salary Structures में आप हर व्यक्ति की महीने की सैलरी सेट करते हैं। Payroll Directory में महीने की पेस्लिप बनाते हैं और उनका भुगतान दर्ज करते हैं।",
      },
      tips: [
        {
          en: "Pay for a month = monthly salary ÷ 30 × paid days.",
          hi: "महीने की सैलरी = महीने की सैलरी ÷ 30 × पेड डेज़।",
        },
        {
          en: "Weekends and company holidays are paid days. A working day is paid when the person was present or late, or was on approved paid leave.",
          hi: "वीकेंड और कंपनी की छुट्टियाँ पेड डेज़ हैं। वर्किंग डे तब पेड होता है जब व्यक्ति प्रेज़ेंट या लेट रहा हो, या मंज़ूर हुई पेड छुट्टी पर हो।",
        },
        {
          en: "An absent day, a working day with no attendance and no paid leave, or a day of unpaid leave is Loss of Pay (LOP). A half day pays half.",
          hi: "Absent वाला दिन, ऐसा वर्किंग डे जिसमें न हाज़िरी हो न पेड छुट्टी, या बिना वेतन वाली छुट्टी का दिन - ये Loss of Pay (LOP) हैं। Half day पर आधे दिन की सैलरी मिलती है।",
        },
        {
          en: "Days before the joining date are not paid. Days still to come in the current month are counted as present.",
          hi: "जॉइनिंग से पहले के दिनों की सैलरी नहीं मिलती। चालू महीने के आने वाले दिनों को प्रेज़ेंट माना जाता है।",
        },
        {
          en: "There are no deductions like PF, ESI or TDS - the full amount is paid in hand.",
          hi: "PF, ESI या TDS जैसी कोई कटौती नहीं होती - पूरी रकम हाथ में मिलती है।",
        },
      ],
      faq: [
        {
          q: {
            en: "Why is the gross a little more than the monthly salary?",
            hi: "Gross महीने की सैलरी से थोड़ा ज़्यादा क्यों है?",
          },
          a: {
            en: "Pay is worked out per day (salary ÷ 30). A 31-day month with no unpaid days pays 31 days, so it is a little more. February pays a little less.",
            hi: "सैलरी रोज़ के हिसाब से बनती है (सैलरी ÷ 30)। 31 दिन के महीने में अगर कोई LOP नहीं है तो 31 दिन की सैलरी बनती है, इसलिए थोड़ी ज़्यादा होती है। फ़रवरी में थोड़ी कम होती है।",
          },
        },
      ],
    },
    {
      id: "salary-structures",
      title: { en: "Set an employee's salary", hi: "कर्मचारी की सैलरी सेट करें" },
      steps: [
        {
          text: {
            en: "Open Payroll > Salary Structures. The table shows each person's Basic, HRA, Gross, Net (in-hand) and Effective From date. Click Add Structure (1) to set up someone new.",
            hi: "Payroll > Salary Structures खोलें। टेबल में हर व्यक्ति का Basic, HRA, Gross, Net (in-hand) और Effective From तारीख दिखती है। किसी नए व्यक्ति की सैलरी सेट करने के लिए Add Structure (1) पर क्लिक करें।",
          },
          shot: {
            id: "payroll-structures-list",
            as: "hr",
            path: "/payroll/salary-structures",
            highlight: [{ role: "button", name: "Add Structure" }],
          },
        },
        {
          text: {
            en: "Pick the Employee (1) and type the Monthly Gross Salary (in-hand) (2).",
            hi: "Employee (1) चुनें और Monthly Gross Salary (in-hand) (2) लिखें।",
          },
          shot: {
            id: "payroll-structure-form",
            as: "hr",
            path: "/payroll/salary-structures",
            // The employee list opens on its own (the field gets focus), so pick
            // someone first - that closes it and uncovers the rest of the form.
            actions: [
              { click: { role: "button", name: "Add Structure" } },
              { waitFor: { role: "dialog" } },
              { click: { css: "[role=dialog] [role=combobox]" } },
              { click: { role: "option", name: "Rahul Das" } },
              { fill: { label: "Monthly Gross Salary" }, value: "30000" },
            ],
            highlight: [
              // The whole field box, not just the text input inside it.
              { css: "[role=dialog] div.h-10:has([role=combobox])" },
              { label: "Monthly Gross Salary" },
              { text: "Salary Split", exact: true },
              { role: "button", name: "Create", exact: true },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Under Salary Split (3), the gross is shared out into Basic, HRA, Transport Allowance, Medical Allowance, Telephone / Mobile Bill and Special Allowance by percentage. The usual split is already filled in. You can change any percentage, but the Total must be 100%.",
            hi: "Salary Split (3) में gross को प्रतिशत के हिसाब से Basic, HRA, Transport Allowance, Medical Allowance, Telephone / Mobile Bill और Special Allowance में बाँटा जाता है। आम तौर पर इस्तेमाल होने वाला बँटवारा पहले से भरा होता है। आप कोई भी प्रतिशत बदल सकते हैं, पर Total 100% होना चाहिए।",
          },
        },
        {
          text: {
            en: "Check the amounts on the right and click Create (4).",
            hi: "दाईं ओर की रकम चेक करें और Create (4) पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "To change a salary later, click the pencil on that row, make the change and click Update.",
            hi: "बाद में सैलरी बदलनी हो तो उस लाइन की पेंसिल पर क्लिक करें, बदलाव करें और Update पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "Each person has one salary structure. To change their pay, edit it - don't add a second one.",
          hi: "हर व्यक्ति का एक ही salary structure होता है। सैलरी बदलनी हो तो उसी को एडिट करें - दूसरा न बनाएँ।",
        },
        {
          en: "A change counts from the next payslip you generate. Payslips already made keep their old amounts. To redo a Draft payslip, delete it and generate again.",
          hi: "बदलाव अगली बार बनने वाली पेस्लिप से लागू होता है। पहले बनी पेस्लिप में पुरानी रकम ही रहती है। किसी Draft पेस्लिप को दोबारा बनाना हो तो उसे डिलीट करके फिर से generate करें।",
        },
        {
          en: "A salary structure that is already used on a payslip can't be deleted.",
          hi: "जो salary structure किसी पेस्लिप में इस्तेमाल हो चुका है, उसे डिलीट नहीं किया जा सकता।",
        },
        {
          en: "Click a column heading to sort by it. To download the list as a spreadsheet, click Export above the table and pick CSV file or Excel file - tick rows first to download only those.",
          hi: "किसी कॉलम के नाम पर क्लिक करके उसी से sort करें। लिस्ट को spreadsheet में डाउनलोड करने के लिए टेबल के ऊपर Export पर क्लिक करें और CSV file या Excel file चुनें - सिर्फ़ कुछ लाइनें चाहिए तो पहले उन्हें टिक करें।",
        },
      ],
    },
    {
      id: "generate",
      title: { en: "Make the month's payslips", hi: "महीने की पेस्लिप बनाएँ" },
      permission: PERMISSIONS.PAYROLL_PROCESS,
      steps: [
        {
          text: {
            en: "Open Payroll > Payroll Directory and click Generate Payroll. Pick the Month (1), type the Year (2), and click Generate Payroll (3).",
            hi: "Payroll > Payroll Directory खोलें और Generate Payroll पर क्लिक करें। Month (1) चुनें, Year (2) लिखें, और Generate Payroll (3) पर क्लिक करें।",
          },
          shot: {
            id: "payroll-generate-dialog",
            as: "hr",
            path: "/payroll/payroll-directory",
            actions: [
              { click: { role: "button", name: "Generate Payroll" } },
              { waitFor: { css: "[role=alertdialog]" } },
            ],
            highlight: [
              { label: "Month", nth: -1 },
              { label: "Year", nth: -1 },
              { role: "button", name: "Generate Payroll", nth: -1 },
            ],
            crop: { css: "[role=alertdialog]" },
          },
        },
        {
          text: {
            en: "DNMS makes a Draft payslip for every active employee who has a salary structure. Anyone who already has a payslip for that month is skipped, so it is safe to run again after you add someone.",
            hi: "DNMS हर उस active कर्मचारी की Draft पेस्लिप बनाता है जिसका salary structure है। जिसकी उस महीने की पेस्लिप पहले से है, उसे छोड़ दिया जाता है, इसलिए किसी को जोड़ने के बाद इसे दोबारा चलाना सुरक्षित है।",
          },
        },
        {
          text: {
            en: "Each employee gets a Payslip Ready notification and can see the payslip in My Payslips straight away.",
            hi: "हर कर्मचारी को Payslip Ready का नोटिफिकेशन मिलता है और वो तुरंत My Payslips में अपनी पेस्लिप देख सकता है।",
          },
        },
      ],
      tips: [
        {
          en: "Generate after the month's attendance and leave are complete - pay is worked out from them.",
          hi: "महीने की हाज़िरी और छुट्टियाँ पूरी होने के बाद ही generate करें - सैलरी उन्हीं से बनती है।",
        },
      ],
      faq: [
        {
          q: {
            en: "Someone is missing from the payslips. Why?",
            hi: "किसी की पेस्लिप नहीं बनी। क्यों?",
          },
          a: {
            en: "They may not be active, may have no salary structure, or may join after that month. Fix it and click Generate Payroll again - existing payslips are skipped.",
            hi: "हो सकता है वो active न हों, उनका salary structure न हो, या वो उस महीने के बाद जॉइन कर रहे हों। इसे ठीक करें और फिर से Generate Payroll पर क्लिक करें - पहले से बनी पेस्लिप छोड़ दी जाती हैं।",
          },
        },
      ],
    },
    {
      id: "check",
      title: { en: "Check payslips", hi: "पेस्लिप चेक करें" },
      steps: [
        {
          text: {
            en: "Payroll Directory shows one month at a time - the current month at first. Pick another with the month box and Year (1) at the top. In the table, the Status menu (2) and Search employee... (3) narrow the list.",
            hi: "Payroll Directory में एक बार में एक महीना दिखता है - शुरू में चालू महीना। दूसरा महीना ऊपर month बॉक्स और Year (1) से चुनें। टेबल में Status मेन्यू (2) और Search employee... (3) से लिस्ट छोटी करें।",
          },
          shot: {
            id: "payroll-directory",
            as: "hr",
            path: "/payroll/payroll-directory",
            highlight: [
              { label: "Year" },
              { role: "button", name: "Status: All" },
              { placeholder: "Search employee..." },
              { text: "Net Payable (in hand)" },
            ],
          },
        },
        {
          text: {
            en: "The cards show Total Employees, Total Payroll (all gross pay) and Net Payable (in hand) (4) for that month. Below them you see how many payslips are in each status.",
            hi: "कार्ड्स में उस महीने के Total Employees, Total Payroll (कुल gross) और Net Payable (in hand) (4) दिखते हैं। उनके नीचे दिखता है कि किस status में कितनी पेस्लिप हैं।",
          },
        },
        {
          text: {
            en: "Click a row, or the eye icon, to open the payslip. You see the official payslip, and below it Attendance, Earnings, Deductions and Net Pay. Attendance shows the paid days and the Unpaid days (LOP). Click Download PDF (1) to print or save the payslip.",
            hi: "पेस्लिप खोलने के लिए किसी लाइन पर या आँख वाले आइकन पर क्लिक करें। ऊपर असली पेस्लिप दिखती है, और नीचे Attendance, Earnings, Deductions और Net Pay। Attendance में पेड डेज़ और Unpaid days (LOP) दिखते हैं। पेस्लिप प्रिंट या सेव करने के लिए Download PDF (1) पर क्लिक करें।",
          },
          shot: {
            id: "payroll-payslip",
            as: "hr",
            path: "/payroll/payroll-directory",
            actions: [
              { click: { role: "button", name: "View", exact: true } },
              { waitFor: { text: "Unpaid days (LOP)" } },
            ],
            highlight: [{ role: "button", name: "Download PDF" }],
          },
        },
        {
          text: {
            en: "On a Draft payslip, Adjustments (draft only) lets you add Overtime (₹) (1) or Other deductions (₹) (2). Click Apply & recompute (3).",
            hi: "Draft पेस्लिप में Adjustments (draft only) से Overtime (₹) (1) या Other deductions (₹) (2) जोड़ सकते हैं। Apply & recompute (3) पर क्लिक करें।",
          },
          shot: {
            id: "payroll-payslip-adjustments",
            as: "hr",
            path: "/payroll/payroll-directory",
            actions: [
              { click: { role: "button", name: "View", exact: true } },
              { waitFor: { text: "Adjustments (draft only)" } },
              { fill: { label: "Overtime (₹)" }, value: "2000" },
            ],
            highlight: [
              { label: "Overtime (₹)" },
              { label: "Other deductions (₹)" },
              { role: "button", name: "Apply & recompute" },
            ],
            // The card sits at the bottom of the payslip page. Every Card has
            // .text-card-foreground; the last match is the innermost one.
            crop: { css: "div.text-card-foreground:has-text('Adjustments (draft only)')", nth: -1 },
          },
        },
      ],
      tips: [
        {
          en: "Adjustments are shown only to people who can process payroll, and only while the payslip is a Draft.",
          hi: "Adjustments सिर्फ़ उन लोगों को दिखते हैं जो पेरोल प्रोसेस कर सकते हैं, और तभी जब पेस्लिप Draft में हो।",
        },
        {
          en: "To download payslips as a spreadsheet, click Export above the table and pick CSV file or Excel file. It downloads the rows on the current page, or only the rows you have ticked.",
          hi: "पेस्लिप्स को spreadsheet में डाउनलोड करने के लिए टेबल के ऊपर Export पर क्लिक करें और CSV file या Excel file चुनें। इसमें चालू पेज की लाइनें आती हैं, या सिर्फ़ वो लाइनें जो आपने टिक की हैं।",
        },
      ],
    },
    {
      id: "statuses",
      title: { en: "Move payslips to Paid", hi: "पेस्लिप को Paid तक ले जाएँ" },
      permission: PERMISSIONS.PAYROLL_PROCESS,
      intro: {
        en: "A payslip moves through four statuses, one step at a time: Draft, Processing, Approved and Paid.",
        hi: "पेस्लिप चार status से एक-एक करके गुज़रती है: Draft, Processing, Approved और Paid।",
      },
      steps: [
        {
          text: {
            en: "On a payslip, click the button next to its status - Mark Processing, then Mark Approved, then Mark Paid.",
            hi: "पेस्लिप पर उसके status के बगल वाले बटन पर क्लिक करें - पहले Mark Processing, फिर Mark Approved, फिर Mark Paid।",
          },
        },
        {
          text: {
            en: "To move many at once, tick the rows (1) in Payroll Directory. Update Status (2) appears in the table's header row - click it and pick Mark as Processing, Mark as Approved or Mark as Paid (3).",
            hi: "कई पेस्लिप एक साथ आगे बढ़ानी हों, तो Payroll Directory में लाइनें टिक करें (1)। टेबल की हेडर लाइन में Update Status (2) आ जाता है - उस पर क्लिक करें और Mark as Processing, Mark as Approved या Mark as Paid (3) चुनें।",
          },
          shot: {
            id: "payroll-bulk-status",
            as: "hr",
            path: "/payroll/payroll-directory",
            actions: [
              { click: { role: "checkbox", name: "Select row" } },
              { click: { role: "button", name: "Update Status" } },
            ],
            // The open menu hides the page from the accessibility tree, so the
            // row checkbox and the menu button are found by CSS / text instead.
            highlight: [
              { css: "table [aria-label='Select row']" },
              { text: "Update Status", exact: true },
              { role: "menuitem", name: "Mark as Processing" },
            ],
          },
        },
        {
          text: {
            en: "When a payslip is marked Paid, the employee gets a notification and an email with the amount.",
            hi: "पेस्लिप Paid मार्क होते ही कर्मचारी को रकम के साथ नोटिफिकेशन और ईमेल मिलता है।",
          },
        },
      ],
      tips: [
        {
          en: "A payslip can't skip a step. Mark a Draft as Processing before you mark it Approved.",
          hi: "पेस्लिप कोई स्टेप छोड़ नहीं सकती। Draft को Approved करने से पहले Processing मार्क करें।",
        },
        {
          en: "Only a Draft payslip can be changed or deleted (bin icon). After that, the amounts are fixed.",
          hi: "सिर्फ़ Draft पेस्लिप बदली या डिलीट (डस्टबिन आइकन) की जा सकती है। उसके बाद रकम पक्की हो जाती है।",
        },
        {
          en: "Marking a payslip Paid only records it in DNMS - it does not send any money.",
          hi: "Paid मार्क करने से सिर्फ़ DNMS में रिकॉर्ड बनता है - इससे कोई पैसा नहीं भेजा जाता।",
        },
      ],
    },
  ],
}
