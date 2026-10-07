import { FileText } from "lucide-react"
import { PERMISSIONS } from "@/lib/constants"
import type { HelpGuide } from "../../types"

export const documentsGuide: HelpGuide = {
  slug: "documents",
  group: "company",
  icon: FileText,
  href: "/documents",
  title: { en: "Documents", hi: "डॉक्युमेंट्स (Documents)" },
  summary: {
    en: "Find and download company policies and templates, and keep your own personal documents in your profile.",
    hi: "कंपनी की पॉलिसी और टेम्पलेट ढूँढें और डाउनलोड करें, और अपने पर्सनल डॉक्युमेंट्स अपनी प्रोफाइल में रखें।",
  },
  keywords: [
    "document",
    "policy",
    "template",
    "form",
    "handbook",
    "pdf",
    "download",
    "upload",
    "certificate",
    "id proof",
    "expiry",
    "डॉक्युमेंट",
    "दस्तावेज़",
    "पॉलिसी",
    "नियम",
    "फॉर्म",
    "डाउनलोड",
  ],
  sections: [
    {
      id: "find-open",
      title: { en: "Find and open a company document", hi: "कंपनी का डॉक्युमेंट ढूँढें और खोलें" },
      intro: {
        en: "Documents keeps the company's shared files - policies, templates and other reference papers - in one place. Everyone can read and download them.",
        hi: "Documents में कंपनी की शेयर की हुई फाइलें - पॉलिसी, टेम्पलेट और बाकी ज़रूरी कागज़ - एक ही जगह रहती हैं। इन्हें हर कोई पढ़ और डाउनलोड कर सकता है।",
      },
      steps: [
        {
          text: {
            en: "Click Documents in the sidebar. The page is called Company Documents, and the newest files are at the top.",
            hi: "साइडबार में Documents पर क्लिक करें। पेज का नाम Company Documents है, और सबसे नई फाइलें सबसे ऊपर होती हैं।",
          },
        },
        {
          text: {
            en: "Use the tabs to narrow the list: Policies (1), Templates, Employment or Other. All shows everything.",
            hi: "लिस्ट छोटी करने के लिए टैब इस्तेमाल करें: Policies (1), Templates, Employment या Other। All में सब कुछ दिखता है।",
          },
          shot: {
            id: "documents-list",
            as: "employee",
            path: "/documents",
            highlight: [
              { role: "tab", name: "Policies" },
              { role: "button", name: "View Leave Policy" },
              { role: "button", name: "Download Leave Policy" },
            ],
          },
        },
        {
          text: {
            en: "Each card shows the title, its category, the file name, the size and the date it was uploaded. Click the eye (2) to open the file in a new browser tab, or the arrow (3) to download it.",
            hi: "हर कार्ड में टाइटल, कैटेगरी, फाइल का नाम, साइज़ और अपलोड की तारीख दिखती है। फाइल को ब्राउज़र के नए टैब में खोलने के लिए आँख वाले आइकन (2) पर क्लिक करें, या डाउनलोड करने के लिए तीर (3) पर।",
          },
        },
        {
          text: {
            en: "If there are many files, use Previous and Next at the bottom of the list to see more.",
            hi: "अगर फाइलें बहुत हैं, तो और देखने के लिए लिस्ट के नीचे Previous और Next इस्तेमाल करें।",
          },
        },
      ],
      tips: [
        {
          en: "Some documents have an expiry date. The card then shows Expires and the date - in orange when it is less than 30 days away - or Expired in red once the date has passed.",
          hi: "कुछ डॉक्युमेंट्स की एक्सपायरी डेट होती है। तब कार्ड पर Expires और तारीख दिखती है - 30 दिन से कम बचे हों तो नारंगी रंग में - और तारीख निकल जाने पर लाल रंग में Expired।",
        },
      ],
      faq: [
        {
          q: {
            en: "Nothing happens when I click the eye. Why?",
            hi: "आँख वाले आइकन पर क्लिक करने से कुछ नहीं होता। क्यों?",
          },
          a: {
            en: "Your browser may have blocked the new tab. Allow pop-ups for DNMS in your browser, or use the download arrow instead.",
            hi: "हो सकता है आपके ब्राउज़र ने नया टैब ब्लॉक कर दिया हो। ब्राउज़र में DNMS के लिए pop-ups allow करें, या डाउनलोड वाला तीर इस्तेमाल करें।",
          },
        },
      ],
    },
    {
      id: "my-documents",
      title: { en: "Your personal documents", hi: "आपके पर्सनल डॉक्युमेंट्स" },
      intro: {
        en: "Your own papers - like ID proof, certificates and employment letters - are not on the Documents page. They are kept in your profile.",
        hi: "आपके अपने कागज़ - जैसे ID प्रूफ, सर्टिफिकेट और नौकरी से जुड़े लेटर - Documents पेज पर नहीं होते। वो आपकी प्रोफाइल में रखे जाते हैं।",
      },
      steps: [
        {
          text: {
            en: "Click your name at the top right and pick My Profile. Then open the Documents tab (1).",
            hi: "ऊपर दाईं ओर अपने नाम पर क्लिक करें और My Profile चुनें। फिर Documents टैब (1) खोलें।",
          },
          shot: {
            id: "documents-my-documents",
            as: "employee",
            path: "/profile",
            actions: [{ click: { role: "tab", name: "Documents" } }],
            highlight: [
              { role: "tab", name: "Documents" },
              { role: "button", name: "Upload Document" },
            ],
          },
        },
        {
          text: {
            en: "Under My Documents you see everything on file for you. Use the eye to view a document and the arrow to download it.",
            hi: "My Documents में आपके नाम से रखे सारे डॉक्युमेंट्स दिखते हैं। देखने के लिए आँख वाला आइकन और डाउनलोड करने के लिए तीर इस्तेमाल करें।",
          },
        },
        {
          text: {
            en: "To add one yourself, click Upload Document (2), choose the file, check the Title and Category, and click Upload.",
            hi: "खुद कोई डॉक्युमेंट जोड़ना हो, तो Upload Document (2) पर क्लिक करें, फाइल चुनें, Title और Category चेक करें, और Upload पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "Only you, HR and admins can see your personal documents.",
          hi: "आपके पर्सनल डॉक्युमेंट्स सिर्फ आप, HR और एडमिन देख सकते हैं।",
        },
        {
          en: "If one of your documents has an expiry date, you get a Document expiring soon notification about 30 days before it expires.",
          hi: "अगर आपके किसी डॉक्युमेंट की एक्सपायरी डेट है, तो उसके खत्म होने से लगभग 30 दिन पहले आपको Document expiring soon नोटिफिकेशन मिलता है।",
        },
      ],
      faq: [
        {
          q: {
            en: "I uploaded the wrong file. How do I remove it?",
            hi: "मैंने गलत फाइल अपलोड कर दी। उसे कैसे हटाऊँ?",
          },
          a: {
            en: "You can't delete your personal documents yourself. Ask HR to remove it, then upload the right one.",
            hi: "आप अपने पर्सनल डॉक्युमेंट्स खुद डिलीट नहीं कर सकते। HR से उसे हटाने को कहें, फिर सही फाइल अपलोड करें।",
          },
        },
      ],
    },
    {
      id: "upload",
      title: {
        en: "For HR: upload a company document",
        hi: "HR के लिए: कंपनी का डॉक्युमेंट अपलोड करें",
      },
      permission: PERMISSIONS.DOCUMENT_WRITE,
      steps: [
        {
          text: {
            en: "On the Documents page, click Upload Document at the top right.",
            hi: "Documents पेज पर, ऊपर दाईं ओर Upload Document पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Drag the file into the box (1), or click the box to browse for it. PDF, DOC, DOCX, JPG, PNG and WEBP files up to 20 MB are allowed.",
            hi: "फाइल को बॉक्स (1) में खींचकर छोड़ें, या बॉक्स पर क्लिक करके फाइल चुनें। PDF, DOC, DOCX, JPG, PNG और WEBP फाइलें, 20 MB तक, अपलोड हो सकती हैं।",
          },
          shot: {
            id: "documents-upload",
            as: "hr",
            path: "/documents",
            actions: [{ click: { role: "button", name: "Upload Document" } }],
            highlight: [
              { role: "button", name: "Drag and drop or browse" },
              { label: "Title" },
              { label: "Category" },
              { label: "Description" },
              { role: "button", name: "Upload", exact: true },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "The Title (2) fills in from the file name - change it to something people will recognise. Pick a Category (3) and, if you like, add a short Description (4).",
            hi: "Title (2) फाइल के नाम से अपने आप भर जाता है - उसे ऐसा नाम दें जो लोग आसानी से पहचान सकें। Category (3) चुनें और चाहें तो छोटा सा Description (4) लिखें।",
          },
        },
        {
          text: {
            en: "Click Upload (5). The file shows up in the list for everyone straight away.",
            hi: "Upload (5) पर क्लिक करें। फाइल तुरंत सबके लिए लिस्ट में दिखने लगती है।",
          },
        },
      ],
      tips: [
        {
          en: "The category decides the tab: Company Policy shows under Policies, Template under Templates, Employment under Employment and Other under Other. Files in Identity, Academic, Professional or Tax show only under All.",
          hi: "कैटेगरी से तय होता है कि फाइल किस टैब में दिखेगी: Company Policy वाली Policies में, Template वाली Templates में, Employment वाली Employment में और Other वाली Other में। Identity, Academic, Professional या Tax वाली फाइलें सिर्फ All में दिखती हैं।",
        },
        {
          en: "To add a document to one employee's file instead, open them from Employee Directory, go to their Documents tab and click Upload.",
          hi: "किसी एक कर्मचारी की फाइल में डॉक्युमेंट जोड़ना हो, तो Employee Directory से उन्हें खोलें, उनके Documents टैब में जाएँ और Upload पर क्लिक करें।",
        },
      ],
    },
    {
      id: "delete",
      title: { en: "For HR: delete a document", hi: "HR के लिए: डॉक्युमेंट डिलीट करें" },
      permission: PERMISSIONS.DOCUMENT_DELETE,
      steps: [
        {
          text: {
            en: "Click the bin (1) on the document's card.",
            hi: "डॉक्युमेंट के कार्ड पर डस्टबिन (1) पर क्लिक करें।",
          },
          shot: {
            id: "documents-delete",
            as: "hr",
            path: "/documents",
            highlight: [{ role: "button", name: "Delete Leave Policy" }],
          },
        },
        {
          text: {
            en: "Click Delete to confirm. The file is deleted for good and can't be recovered, so download a copy first if you might need it.",
            hi: "पक्का करने के लिए Delete पर क्लिक करें। फाइल हमेशा के लिए डिलीट हो जाती है और वापस नहीं मिलती, इसलिए अगर बाद में ज़रूरत पड़ सकती है तो पहले उसकी कॉपी डाउनलोड कर लें।",
          },
        },
      ],
      tips: [
        {
          en: "By default, HR Managers and admins can delete documents. HR Employees can upload them but not delete them.",
          hi: "डिफ़ॉल्ट रूप से HR Manager और एडमिन डॉक्युमेंट्स डिलीट कर सकते हैं। HR Employee अपलोड तो कर सकते हैं, पर डिलीट नहीं।",
        },
      ],
    },
  ],
}
