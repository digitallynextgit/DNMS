import { HardDrive } from "lucide-react"
import type { HelpGuide } from "../../types"

// Screens: features/projects/components/drive-tab.tsx (the Repository tab, once
// called Drive) and files/*.tsx (link, name, move and details dialogs).

const REPOSITORY = "/projects/sunmeadow-organics-launch?tab=repository"

export const projectRepositoryGuide: HelpGuide = {
  slug: "project-repository",
  group: "projects",
  icon: HardDrive,
  href: "/projects/my-projects",
  title: { en: "Repository (project files)", hi: "रिपॉज़िटरी - प्रोजेक्ट फाइलें (Repository)" },
  summary: {
    en: "Keep all of a project's files, folders and links in one place - stored in DNMS or in the project's Google Drive folder.",
    hi: "प्रोजेक्ट की सारी फाइलें, फोल्डर और लिंक एक जगह रखें - DNMS में या प्रोजेक्ट के Google Drive फोल्डर में।",
  },
  keywords: [
    "repository",
    "drive",
    "files",
    "folder",
    "upload",
    "download",
    "link",
    "google drive",
    "google doc",
    "google sheet",
    "backblaze",
    "फाइल",
    "फोल्डर",
    "अपलोड",
    "डाउनलोड",
  ],
  sections: [
    {
      id: "find",
      title: { en: "Find a file", hi: "फाइल ढूँढें" },
      steps: [
        {
          text: {
            en: "Open the project from My Projects and click the Repository tab. Folders come first, then files and links.",
            hi: "My Projects से प्रोजेक्ट खोलें और Repository टैब पर क्लिक करें। पहले फोल्डर दिखते हैं, फिर फाइलें और लिंक।",
          },
        },
        {
          text: {
            en: "Type in the search box (1) to search by name. Narrow the list by Tag (2), Storage (3) - Backblaze (B2), Google Drive or Links - and Type (4). Clear resets the filters.",
            hi: "नाम से खोजने के लिए सर्च बॉक्स (1) में टाइप करें। लिस्ट को Tag (2), Storage (3) - Backblaze (B2), Google Drive या Links - और Type (4) से छोटा करें। Clear से फिल्टर हट जाते हैं।",
          },
          shot: {
            id: "project-repository-list",
            as: "employee",
            path: REPOSITORY,
            // The filters are Radix selects: a combobox takes no name from its
            // content, so they are found by the value they show - the whole
            // dropdown, not just the words inside it.
            highlight: [
              { placeholder: "Search in Repository..." },
              { css: 'button[role=combobox]:has-text("All tags")' },
              { css: 'button[role=combobox]:has-text("All storage")' },
              { css: 'button[role=combobox]:has-text("All types")' },
            ],
          },
        },
        {
          text: {
            en: "Click a folder to open it. The path at the top, starting with Repository, takes you back up. Card view and Table view on the right change how the list looks.",
            hi: "फोल्डर खोलने के लिए उस पर क्लिक करें। ऊपर दिखने वाला रास्ता, जो Repository से शुरू होता है, वापस ऊपर ले जाता है। दाईं ओर Card view और Table view से लिस्ट का रूप बदलता है।",
          },
        },
      ],
    },
    {
      id: "add",
      title: { en: "Add files, folders and links", hi: "फाइलें, फोल्डर और लिंक जोड़ें" },
      steps: [
        {
          text: {
            en: "Click Upload and pick where the file goes: Backblaze (B2) (1), the default, or Google Drive (2) if the project's Drive is connected. You can also drag files straight onto the page.",
            hi: "Upload पर क्लिक करें और चुनें कि फाइल कहाँ जाएगी: Backblaze (B2) (1), जो डिफ़ॉल्ट है, या Google Drive (2) अगर प्रोजेक्ट का Drive जुड़ा है। आप फाइलें सीधे पेज पर खींचकर भी छोड़ सकते हैं।",
          },
          shot: {
            id: "project-repository-upload",
            as: "employee",
            path: REPOSITORY,
            actions: [{ click: { role: "button", name: "Upload", exact: true } }],
            highlight: [
              { role: "menuitem", name: "Backblaze (B2)" },
              { role: "menuitem", name: "Google Drive" },
            ],
            // The Repository tab itself (toolbar, path, filters, list) - the menu
            // opens over it, and the Upload button stays in the picture.
            crop: { css: 'div:has(> nav[aria-label="Folder"])' },
          },
        },
        {
          text: {
            en: "Click New for a Folder or a Link. When Drive is connected, New can also make a Google Doc or a Google Sheet.",
            hi: "Folder या Link के लिए New पर क्लिक करें। Drive जुड़ा हो तो New से Google Doc या Google Sheet भी बन सकती है।",
          },
        },
        {
          text: {
            en: "For a link, type the URL and a Title, pick a Tag if you like, and click Add link. Good for a Figma board, a Notion page or a live site. Pasting or dropping a web address on the page opens the same box.",
            hi: "लिंक के लिए URL और Title लिखें, चाहें तो Tag चुनें, और Add link पर क्लिक करें। Figma बोर्ड, Notion पेज या लाइव साइट के लिए अच्छा है। पेज पर कोई वेब एड्रेस पेस्ट करने या खींचकर छोड़ने से भी यही बॉक्स खुलता है।",
          },
        },
      ],
      tips: [
        {
          en: "One file can be up to 250 MB. Bigger files are skipped with a message.",
          hi: "एक फाइल 250 MB तक की हो सकती है। इससे बड़ी फाइलें मैसेज के साथ छोड़ दी जाती हैं।",
        },
      ],
    },
    {
      id: "manage",
      title: {
        en: "Open, move, rename and delete",
        hi: "खोलें, मूव करें, नाम बदलें और डिलीट करें",
      },
      steps: [
        {
          text: {
            en: "Click a file to open it. PDFs and images open in a preview. The ... More button on each item has Open, Copy link (1), Download, Details (2), Rename (Edit link for a link), Move to... (3) and Delete.",
            hi: "फाइल खोलने के लिए उस पर क्लिक करें। PDF और इमेज प्रीव्यू में खुलती हैं। हर आइटम के ... More बटन में Open, Copy link (1), Download, Details (2), Rename (लिंक के लिए Edit link), Move to... (3) और Delete होते हैं।",
          },
          shot: {
            id: "project-repository-more",
            as: "manager",
            path: REPOSITORY,
            actions: [{ click: { role: "button", name: "More", exact: true } }],
            highlight: [
              { role: "menuitem", name: "Copy link" },
              { role: "menuitem", name: "Details" },
              { role: "menuitem", name: "Move to..." },
            ],
            crop: { css: "[role='menu']" },
          },
        },
        {
          text: {
            en: "In Table view, click a file's tag to change its Document type - Brand, Strategy, Research, Report, Creative and so on. The tag filter uses it.",
            hi: "Table view में किसी फाइल के टैग पर क्लिक करके उसका Document type बदलें - Brand, Strategy, Research, Report, Creative वगैरह। टैग वाला फिल्टर इसी से चलता है।",
          },
        },
        {
          text: {
            en: "Tick several items to work on them together: Download, Move or Delete.",
            hi: "कई आइटम पर एक साथ काम करने के लिए उन पर टिक करें: Download, Move या Delete।",
          },
        },
      ],
      tips: [
        {
          en: "You can rename, move and delete what you added yourself. The Account Manager or a project admin can do it to everything, and only they can delete several items at once or delete Google Drive files.",
          hi: "जो आपने खुद जोड़ा है उसका नाम बदल सकते हैं, उसे मूव और डिलीट कर सकते हैं। Account Manager या प्रोजेक्ट एडमिन सब कुछ बदल सकते हैं, और एक साथ कई आइटम डिलीट करना या Google Drive की फाइलें डिलीट करना सिर्फ वही कर सकते हैं।",
        },
        {
          en: "A Backblaze file is deleted for good. A Google Drive file goes to the Drive trash and can be recovered there. A folder can be deleted only when it is empty.",
          hi: "Backblaze की फाइल हमेशा के लिए डिलीट हो जाती है। Google Drive की फाइल Drive के ट्रैश में जाती है और वहाँ से वापस लाई जा सकती है। फोल्डर सिर्फ खाली होने पर ही डिलीट हो सकता है।",
        },
      ],
      faq: [
        {
          q: {
            en: "Why is there no Download for a Google Doc?",
            hi: "Google Doc के लिए Download क्यों नहीं है?",
          },
          a: {
            en: "Google Docs and Sheets live in Google Drive. Open the file - it opens in Drive - and download a copy from there if you need one.",
            hi: "Google Docs और Sheets, Google Drive में रहती हैं। फाइल खोलें - वो Drive में खुलेगी - और कॉपी चाहिए तो वहीं से डाउनलोड करें।",
          },
        },
      ],
    },
  ],
}
