import { Package } from "lucide-react"
import { PERMISSIONS } from "@/lib/constants"
import type { HelpGuide } from "../../types"

export const stockRegisterGuide: HelpGuide = {
  slug: "stock-register",
  group: "hr",
  icon: Package,
  href: "/stock",
  title: { en: "Stock Register", hi: "स्टॉक रजिस्टर (Stock Register)" },
  summary: {
    en: "Keep track of what HR buys - like diaries, T-shirts and ID card holders - who it was given to, and how much is left.",
    hi: "HR जो सामान खरीदता है - जैसे डायरी, टी-शर्ट और ID कार्ड होल्डर - वो किसे दिया गया और कितना बचा है, इसका हिसाब रखें।",
  },
  keywords: [
    "stock",
    "inventory",
    "assets",
    "laptop",
    "id card",
    "issue",
    "return",
    "excel import",
    "export",
    "स्टॉक",
    "सामान",
    "रजिस्टर",
  ],
  sections: [
    {
      id: "overview",
      title: { en: "Read the stock register", hi: "स्टॉक रजिस्टर पढ़ें" },
      steps: [
        {
          text: {
            en: "In the sidebar, under HRMS, click Stock Register. Each card at the top is one item (1). The big number is how many are left, and below it how many were issued out of how many were bought.",
            hi: "साइडबार में HRMS के नीचे Stock Register पर क्लिक करें। ऊपर का हर कार्ड एक आइटम है (1)। बड़ा नंबर बताता है कि कितने बचे हैं, और उसके नीचे कि जितने खरीदे उनमें से कितने दिए जा चुके हैं।",
          },
          shot: {
            id: "stock-register-overview",
            as: "hr",
            path: "/stock",
            highlight: [
              { css: "section.grid > div" },
              { placeholder: "Search holder, employee or item…" },
              { css: "button[role=combobox]:has-text('All items')" },
              { role: "button", name: "Unlinked only" },
            ],
          },
        },
        {
          text: {
            en: "The table below is the register. Each row is what one person got on one date, with a column for each item. Type a person's name in the search box (2), pick one item (3), or click Unlinked only (4) to see rows that are not linked to an employee.",
            hi: "नीचे की टेबल रजिस्टर है। हर लाइन बताती है कि किसी एक व्यक्ति को एक तारीख को क्या मिला, और हर आइटम का अपना कॉलम है। सर्च बॉक्स (2) में व्यक्ति का नाम टाइप करें, कोई एक आइटम (3) चुनें, या Unlinked only (4) पर क्लिक करके वो लाइनें देखें जो किसी कर्मचारी से जुड़ी नहीं हैं।",
          },
        },
        {
          text: {
            en: "A holder with a grey icon and Not linked to an employee was saved as a plain name. Deactivated next to a name means that person has left.",
            hi: "जिस holder के साथ ग्रे आइकन और Not linked to an employee लिखा हो, उसे सिर्फ़ नाम के रूप में सेव किया गया है। नाम के साथ deactivated लिखा हो तो वो व्यक्ति कंपनी छोड़ चुका है।",
          },
        },
        {
          text: {
            en: "To download it, click Export at the top right and pick the Register (1), which keeps your current filters, or the Items summary (2) - as Excel (.xlsx) or CSV (.csv).",
            hi: "डाउनलोड करने के लिए ऊपर दाईं ओर Export पर क्लिक करें और Register (1) चुनें, जिसमें आपके लगाए फ़िल्टर रहते हैं, या Items summary (2) - Excel (.xlsx) या CSV (.csv) में।",
          },
          shot: {
            id: "stock-register-export",
            as: "hr",
            path: "/stock",
            actions: [{ click: { role: "button", name: "Export" } }],
            highlight: [{ text: "Register (current filters)" }, { text: "Items summary" }],
            crop: { css: "[role=menu]" },
          },
        },
      ],
      tips: [
        {
          en: "Everyone who can see employees can open this page and export it. Adding, issuing and editing stock is only for people who can edit employees, like HR Managers and Admins.",
          hi: "जो कर्मचारियों की जानकारी देख सकते हैं, वो यह पेज खोलकर export कर सकते हैं। सामान जोड़ना, देना और बदलना सिर्फ़ उनके लिए है जो कर्मचारियों की जानकारी बदल सकते हैं, जैसे HR Manager और Admin।",
        },
      ],
    },
    {
      id: "items",
      title: { en: "Add an item or restock it", hi: "नया आइटम जोड़ें या स्टॉक बढ़ाएँ" },
      permission: PERMISSIONS.EMPLOYEE_WRITE,
      steps: [
        {
          text: {
            en: "Click Add item. Type the Name (1), the Price per piece (2) if you know it, and the Purchased qty (3). Then click Add item (4).",
            hi: "Add item पर क्लिक करें। Name (1), पता हो तो Price per piece (2), और Purchased qty (3) भरें। फिर Add item (4) पर क्लिक करें।",
          },
          shot: {
            id: "stock-register-add-item",
            as: "hr",
            path: "/stock",
            actions: [
              { click: { role: "button", name: "Add item" } },
              { waitFor: { role: "dialog" } },
            ],
            highlight: [
              { label: "Name" },
              { label: "Price per piece" },
              { label: "Purchased qty" },
              { role: "button", name: "Add item", exact: true, nth: -1 },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Bought more of something? Click the box-with-plus icon on that item's card. Type Pieces bought and click Add stock. This adds to the total already bought.",
            hi: "किसी आइटम का और सामान खरीदा? उस आइटम के कार्ड पर प्लस वाले डिब्बे के आइकन पर क्लिक करें। Pieces bought लिखें और Add stock पर क्लिक करें। यह पहले से खरीदे गए कुल में जुड़ जाता है।",
          },
        },
        {
          text: {
            en: "To fix a wrong total instead, click the pencil on the card, correct Purchased qty and click Save.",
            hi: "अगर कुल गिनती गलत लिखी है और उसे ठीक करना है, तो कार्ड पर पेंसिल पर क्लिक करें, Purchased qty सही करें और Save पर क्लिक करें।",
          },
        },
      ],
    },
    {
      id: "issue",
      title: { en: "Give stock to someone", hi: "किसी को सामान दें" },
      permission: PERMISSIONS.EMPLOYEE_WRITE,
      steps: [
        {
          text: {
            en: "Click Issue stock. Pick the Item (1) and the Quantity (2).",
            hi: "Issue stock पर क्लिक करें। Item (1) और Quantity (2) चुनें।",
          },
          shot: {
            id: "stock-register-issue",
            as: "hr",
            path: "/stock",
            actions: [
              { click: { role: "button", name: "Issue stock" } },
              { waitFor: { role: "dialog" } },
              { fill: { label: "Issued to (any name)" }, value: "Priya" },
              { waitFor: { role: "button", name: "Priya Sharma" } },
            ],
            highlight: [
              { css: "[role=dialog] [role=combobox]" },
              { label: "Quantity" },
              { label: "Issued to (any name)" },
              { role: "button", name: "Priya Sharma" },
              { role: "button", name: "Issue", exact: true },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "In Issued to (any name) (3), start typing the name. Click the employee in the list (4) to link the entry to them. You can also keep just the typed name - for example for someone who is not an employee.",
            hi: "Issued to (any name) (3) में नाम टाइप करना शुरू करें। लिस्ट में कर्मचारी (4) पर क्लिक करें, ताकि एंट्री उनसे जुड़ जाए। चाहें तो सिर्फ़ टाइप किया नाम भी रख सकते हैं - जैसे किसी ऐसे व्यक्ति के लिए जो कर्मचारी नहीं है।",
          },
        },
        {
          text: {
            en: "Check Issued on - it is today by default - and click Issue (5). The item's left count goes down.",
            hi: "Issued on देख लें - इसमें अपने आप आज की तारीख होती है - और Issue (5) पर क्लिक करें। आइटम की बची हुई गिनती कम हो जाती है।",
          },
        },
      ],
    },
    {
      id: "edit",
      title: {
        en: "Record a return, fix or remove a row",
        hi: "सामान वापसी दर्ज करें, लाइन ठीक करें या हटाएँ",
      },
      permission: PERMISSIONS.EMPLOYEE_WRITE,
      steps: [
        {
          text: {
            en: "Each row has three buttons on the right: the pencil (1) edits the row, the link icon (2) links a plain name to an employee, and the bin (3) deletes the row.",
            hi: "हर लाइन के दाईं ओर तीन बटन होते हैं: पेंसिल (1) से लाइन बदलें, लिंक आइकन (2) से सिर्फ़ नाम वाली एंट्री को किसी कर्मचारी से जोड़ें, और डस्टबिन (3) से लाइन डिलीट करें।",
          },
          shot: {
            id: "stock-register-row-actions",
            as: "hr",
            path: "/stock",
            // Only plain-name rows have the link icon (linked rows show unlink),
            // so filter to them - then all three boxes land on the same row.
            actions: [{ click: { role: "button", name: "Unlinked only" } }],
            highlight: [
              { role: "button", name: "Edit this row" },
              { role: "button", name: "Link to an employee" },
              { role: "button", name: "Delete row" },
            ],
            crop: { role: "table" },
          },
        },
        {
          text: {
            en: "When something comes back, click the pencil. In Edit register row, change that item's number - put 0 to remove it from the row. You can also fix the Holder (1) or the Issued on date. Click Save (2).",
            hi: "जब कोई सामान वापस आए, तो पेंसिल पर क्लिक करें। Edit register row में उस आइटम की गिनती बदलें - 0 लिखेंगे तो वो आइटम उस लाइन से हट जाएगा। Holder (1) का नाम या Issued on की तारीख भी ठीक कर सकते हैं। Save (2) पर क्लिक करें।",
          },
          shot: {
            id: "stock-register-edit-row",
            as: "hr",
            path: "/stock",
            actions: [
              { click: { role: "button", name: "Edit this row" } },
              { waitFor: { role: "dialog" } },
              // The Holder box opens focused with its text selected - deselect it.
              { press: "End" },
            ],
            highlight: [{ label: "Holder" }, { role: "button", name: "Save", exact: true }],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "To link a plain name, click the link icon and pick the employee. People who have left are listed too. A linked row shows an unlink icon instead, if you need to undo it.",
            hi: "सिर्फ़ नाम वाली एंट्री जोड़ने के लिए लिंक आइकन पर क्लिक करें और कर्मचारी चुनें। कंपनी छोड़ चुके लोग भी लिस्ट में आते हैं। जुड़ी हुई लाइन पर उसकी जगह unlink आइकन दिखता है, अगर वापस हटाना हो।",
          },
        },
        {
          text: {
            en: "To work on many rows at once, tick them. A bar appears with Link to employee, Unlink, Delete and Clear.",
            hi: "कई लाइनों पर एक साथ काम करना हो तो उन्हें टिक करें। एक पट्टी आती है जिसमें Link to employee, Unlink, Delete और Clear होते हैं।",
          },
        },
      ],
      tips: [
        {
          en: "Deleting a row removes everything given to that person on that date. It can't be undone - to record a return, edit the number instead.",
          hi: "लाइन डिलीट करने से उस तारीख को उस व्यक्ति को दिया गया सब कुछ हट जाता है। यह वापस नहीं होता - सामान वापसी दर्ज करनी हो तो गिनती बदलें।",
        },
      ],
    },
    {
      id: "import",
      title: { en: "Import from Excel", hi: "Excel से इम्पोर्ट करें" },
      permission: PERMISSIONS.EMPLOYEE_WRITE,
      steps: [
        {
          text: {
            en: "Click Import Excel, then click Choose a .xlsx file (1). Sheets with a Given to column are read as stock given to people. Sheets with an Item column are read as the item list.",
            hi: "Import Excel पर क्लिक करें, फिर Choose a .xlsx file (1) पर क्लिक करें। जिन शीट्स में Given to कॉलम है, उन्हें लोगों को दिया गया सामान माना जाता है। जिनमें Item कॉलम है, उन्हें आइटम की लिस्ट माना जाता है।",
          },
          shot: {
            id: "stock-register-import",
            as: "hr",
            path: "/stock",
            actions: [
              { click: { role: "button", name: "Import Excel" } },
              { waitFor: { role: "dialog" } },
            ],
            highlight: [
              { role: "button", name: "Choose a .xlsx file" },
              { role: "button", name: "Import", exact: true },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "DNMS shows how many rows it found. Click Import (2). Names are matched to employees, including people who have left. Names it can't match are kept as plain names that you can link later.",
            hi: "DNMS दिखाता है कि उसे कितनी लाइनें मिलीं। Import (2) पर क्लिक करें। नाम कर्मचारियों से मिलाए जाते हैं, कंपनी छोड़ चुके लोगों से भी। जो नाम नहीं मिलते, वो सिर्फ़ नाम के रूप में रहते हैं, जिन्हें आप बाद में जोड़ सकते हैं।",
          },
        },
      ],
      tips: [
        {
          en: "Importing adds to the register. Uploading the same file twice records everything twice.",
          hi: "इम्पोर्ट करने से एंट्री रजिस्टर में जुड़ती हैं। एक ही फ़ाइल दो बार अपलोड करेंगे तो सब कुछ दो बार दर्ज हो जाएगा।",
        },
        {
          en: "Rows like Stock left or Total in your sheet are skipped - DNMS works those out itself.",
          hi: "शीट में Stock left या Total जैसी लाइनें छोड़ दी जाती हैं - DNMS ये हिसाब खुद लगाता है।",
        },
      ],
    },
  ],
}
