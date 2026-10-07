import { Palette } from "lucide-react"
import type { HelpGuide } from "../../types"

// Screens: features/projects/components/brand-tab.tsx and brand-ai-dialog.tsx.

const BRAND = "/projects/sunmeadow-organics-launch?tab=brand"

export const projectBrandGuide: HelpGuide = {
  slug: "project-brand",
  group: "projects",
  icon: Palette,
  href: "/projects/my-projects",
  title: { en: "Brand", hi: "ब्रांड (Brand)" },
  summary: {
    en: "Keep the client's brand brief, digital targets, content themes, strategy and brand guidelines in one place on the project.",
    hi: "क्लाइंट का ब्रांड ब्रीफ, डिजिटल टारगेट, कंटेंट थीम, स्ट्रेटेजी और ब्रांड गाइडलाइन्स प्रोजेक्ट में एक ही जगह रखें।",
  },
  keywords: [
    "brand",
    "brief",
    "brand brief",
    "objectives",
    "targets",
    "manifestation",
    "guidelines",
    "logo",
    "colours",
    "colors",
    "fonts",
    "strategy",
    "ब्रांड",
    "ब्रीफ",
    "लोगो",
    "रंग",
    "फॉन्ट",
  ],
  sections: [
    {
      id: "about",
      title: { en: "What is on the Brand tab", hi: "Brand टैब में क्या है" },
      steps: [
        {
          text: {
            en: "Open the project from My Projects and click the Brand tab. It has five parts, each with its own tab (1): Brand Brief, Digital Objectives, Manifestation Plan, Brand Overview and Brand Guidelines.",
            hi: "My Projects से प्रोजेक्ट खोलें और Brand टैब पर क्लिक करें। इसमें पाँच हिस्से हैं, हर एक का अपना टैब (1): Brand Brief, Digital Objectives, Manifestation Plan, Brand Overview और Brand Guidelines।",
          },
          shot: {
            id: "project-brand-tab",
            as: "manager",
            path: BRAND,
            highlight: [
              // The Brand tab's own strip of five part-tabs (the project's tab bar
              // above it has "Brand" but never "Brand Brief").
              { css: "[role=tablist]:has-text('Brand Brief')" },
              { role: "button", name: "Save", exact: true },
              { role: "button", name: "Upload files" },
              { role: "button", name: "Draft with AI" },
            ],
          },
        },
        {
          text: {
            en: "Each part has its own Save button (2). It stays grey until you change something, and then Unsaved appears next to it. Moving between the five parts keeps what you typed, but press Save before you open another project tab or leave the page.",
            hi: "हर हिस्से का अपना Save बटन (2) है। जब तक आप कुछ बदलते नहीं, वो ग्रे रहता है, और कुछ बदलते ही उसके पास Unsaved दिखता है। पाँचों हिस्सों के बीच आने-जाने से आपका लिखा हुआ नहीं मिटता, लेकिन प्रोजेक्ट का कोई दूसरा टैब खोलने या पेज छोड़ने से पहले Save दबाएँ।",
          },
        },
        {
          text: {
            en: "Files are saved the moment you upload them with Upload files (3) - no need to press Save. Next to each file, the eye icon opens it and the arrow downloads it. The bin icon deletes it straight away, without asking first.",
            hi: "Upload files (3) से फाइल अपलोड करते ही वो सेव हो जाती है - Save दबाने की ज़रूरत नहीं। हर फाइल के पास आँख वाला आइकन उसे खोलता है और तीर वाला आइकन डाउनलोड करता है। डस्टबिन वाला आइकन बिना पूछे तुरंत फाइल हटा देता है।",
          },
        },
      ],
      tips: [
        {
          en: "Only the project's Account Manager or a project admin can edit or upload here. Everyone else on the project can read everything and download the files.",
          hi: "यहाँ बदलाव या अपलोड सिर्फ प्रोजेक्ट के Account Manager या प्रोजेक्ट एडमिन कर सकते हैं। प्रोजेक्ट के बाकी सब लोग सब कुछ पढ़ सकते हैं और फाइलें डाउनलोड कर सकते हैं।",
        },
      ],
    },
    {
      id: "brief",
      title: { en: "Write the brief, with help from AI", hi: "ब्रीफ लिखें, AI की मदद से" },
      steps: [
        {
          text: {
            en: "In Brand Brief, paste or write the brief the client gave you, and upload their brief documents under Brief documents.",
            hi: "Brand Brief में क्लाइंट का दिया हुआ ब्रीफ पेस्ट करें या लिखें, और उनके ब्रीफ डॉक्युमेंट्स Brief documents में अपलोड करें।",
          },
        },
        {
          text: {
            en: "Click Draft with AI (4 in the first picture). The documents it can read are already ticked - untick any you want to leave out - then click Analyse (1). In up to a minute you get a Draft brief, Recommendations and Questions for the client.",
            hi: "Draft with AI (पहली तस्वीर में 4) पर क्लिक करें। जो डॉक्युमेंट्स पढ़े जा सकते हैं उन पर पहले से टिक लगा होता है - जिसे छोड़ना हो उसका टिक हटा दें - फिर Analyse (1) पर क्लिक करें। करीब एक मिनट में आपको Draft brief, Recommendations और Questions for the client मिल जाते हैं।",
          },
          shot: {
            id: "project-brand-ai",
            as: "manager",
            path: BRAND,
            // Draft with AI is disabled with no Brief documents; the demo seeds one
            // BRIEF file row (prisma/demo/projects.ts), so the click opens the dialog.
            actions: [{ click: { role: "button", name: "Draft with AI" } }],
            // Reads "Analyse 1 document" - a substring match.
            highlight: [{ role: "button", name: "Analyse" }],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Click Use as brief - or Replace brief or Append to brief if a brief is already there. Read it through, change what you need, and press Save.",
            hi: "Use as brief पर क्लिक करें - या अगर ब्रीफ पहले से है तो Replace brief या Append to brief चुनें। उसे पढ़ें, जो बदलना है बदलें, और Save दबाएँ।",
          },
        },
      ],
      tips: [
        {
          en: "Draft with AI stays grey until at least one brief document is uploaded. Nothing from the AI is saved until you press Save.",
          hi: "जब तक कम से कम एक ब्रीफ डॉक्युमेंट अपलोड न हो, Draft with AI ग्रे रहता है। जब तक आप Save न दबाएँ, AI का लिखा कुछ भी सेव नहीं होता।",
        },
        {
          en: "AI reads PDF, Word, Excel/CSV and text files. Anything else - images, PowerPoint, design files - shows not readable and is left out. A scanned PDF with no real text cannot be read either.",
          hi: "AI PDF, Word, Excel/CSV और टेक्स्ट फाइलें पढ़ता है। बाकी फाइलें - इमेज, PowerPoint, डिज़ाइन फाइलें - not readable दिखती हैं और छोड़ दी जाती हैं। बिना असली टेक्स्ट वाली स्कैन की हुई PDF भी नहीं पढ़ी जा सकती।",
        },
      ],
    },
    {
      id: "objectives",
      title: {
        en: "Set targets and the content plan by theme",
        hi: "टारगेट और थीम के हिसाब से कंटेंट प्लान सेट करें",
      },
      steps: [
        {
          text: {
            en: "Open Digital Objectives (1) and click Add objective (2) for each target. Pick the Platform, type the Metric (like Followers), the Current and Target numbers, and pick a Deadline. Press Save.",
            hi: "Digital Objectives (1) खोलें और हर टारगेट के लिए Add objective (2) पर क्लिक करें। Platform चुनें, Metric (जैसे Followers), Current और Target नंबर लिखें, और Deadline चुनें। Save दबाएँ।",
          },
          shot: {
            id: "project-brand-objectives",
            as: "manager",
            path: BRAND,
            actions: [{ click: { role: "tab", name: "Digital Objectives" } }],
            highlight: [
              { role: "tab", name: "Digital Objectives" },
              { role: "button", name: "Add objective" },
            ],
          },
        },
        {
          text: {
            en: "Keep the client's target sheets under Target sheets & reports.",
            hi: "क्लाइंट की टारगेट शीट्स Target sheets & reports में रखें।",
          },
        },
        {
          text: {
            en: "Manifestation Plan has four themes: Brand Awareness, Demand Generation, Thought Leadership and Community Engagement. For each one, write how it shows up on Social media and on the Website. Press Save. Keep the plan files under Plan documents.",
            hi: "Manifestation Plan में चार थीम हैं: Brand Awareness, Demand Generation, Thought Leadership और Community Engagement। हर थीम के लिए लिखें कि वो Social media पर और Website पर कैसे दिखेगी। Save दबाएँ। प्लान की फाइलें Plan documents में रखें।",
          },
        },
      ],
    },
    {
      id: "guidelines",
      title: { en: "Strategy and brand guidelines", hi: "स्ट्रेटेजी और ब्रांड गाइडलाइन्स" },
      steps: [
        {
          text: {
            en: "Brand Overview is the strategy document: positioning, competitors, market research and key takeaways. Upload supporting files under Strategy & research documents.",
            hi: "Brand Overview स्ट्रेटेजी डॉक्युमेंट है: पोज़िशनिंग, कॉम्पिटिटर्स, मार्केट रिसर्च और मुख्य बातें। इससे जुड़ी फाइलें Strategy & research documents में अपलोड करें।",
          },
        },
        {
          text: {
            en: "In Brand Guidelines, click Color (1) for each brand colour. Click the colour square to pick the shade, and type its Name. Fill in Fonts (2), UI / UX direction and Logo notes, then press Save (3).",
            hi: "Brand Guidelines में हर ब्रांड रंग के लिए Color (1) पर क्लिक करें। शेड चुनने के लिए रंग वाले चौकोर पर क्लिक करें, और उसका Name लिखें। Fonts (2), UI / UX direction और Logo notes भरें, फिर Save (3) दबाएँ।",
          },
          shot: {
            id: "project-brand-guidelines",
            as: "manager",
            path: BRAND,
            actions: [{ click: { role: "tab", name: "Brand Guidelines" } }],
            highlight: [
              { role: "button", name: "Color", exact: true },
              // The Fonts input (filled in the demo; the placeholder attribute still matches).
              { placeholder: "e.g. Inter, Poppins" },
              { role: "button", name: "Save", exact: true },
            ],
          },
        },
        {
          text: {
            en: "Upload logos and guideline files under Logos & guideline files - images, PDF, AI, SVG or ZIP.",
            hi: "लोगो और गाइडलाइन फाइलें Logos & guideline files में अपलोड करें - इमेज, PDF, AI, SVG या ZIP।",
          },
        },
      ],
    },
  ],
}
