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
            en: "Open the project from Projects and click the Brand tab. Its five parts are listed in order on the left (1) - across the top on a phone: Brand Brief, Digital Objectives, Manifestation Plan, Brand Overview and Brand Guidelines. A tick means the part has something saved, and Unsaved changes marks one you have edited but not saved. Next, under each part, takes you to the next one.",
            hi: "Projects से प्रोजेक्ट खोलें और Brand टैब पर क्लिक करें। इसके पाँच हिस्से बाईं ओर क्रम से लिखे हैं (1) - फ़ोन पर ऊपर की पट्टी में: Brand Brief, Digital Objectives, Manifestation Plan, Brand Overview और Brand Guidelines। टिक का मतलब है कि उस हिस्से में कुछ सेव है, और Unsaved changes बताता है कि वहाँ आपने कुछ बदला है जो अभी सेव नहीं हुआ। हर हिस्से के नीचे Next अगले हिस्से पर ले जाता है।",
          },
          shot: {
            id: "project-brand-tab",
            as: "manager",
            path: BRAND,
            highlight: [
              // The Brand tab's own list of its five parts.
              { css: "nav[aria-label='Brand sections']" },
              { role: "button", name: "Edit Brand Brief" },
              { role: "button", name: "Upload files" },
            ],
          },
        },
        {
          text: {
            en: "Each part opens read-only, as a page to read. To change it, click Edit (2): the boxes open, with Save and Cancel at the top. Save keeps your changes; Cancel throws them away. Moving between the five parts keeps what you typed, but press Save before you open another project tab or leave the page.",
            hi: "हर हिस्सा पहले सिर्फ़ पढ़ने के लिए खुलता है। बदलना हो तो Edit (2) पर क्लिक करें: बॉक्स खुल जाते हैं, और ऊपर Save और Cancel आ जाते हैं। Save आपके बदलाव रखता है; Cancel उन्हें हटा देता है। पाँचों हिस्सों के बीच आने-जाने से आपका लिखा हुआ नहीं मिटता, लेकिन प्रोजेक्ट का कोई दूसरा टैब खोलने या पेज छोड़ने से पहले Save दबाएँ।",
          },
        },
        {
          text: {
            en: "Each part's files are below its text, as cards. They are saved the moment you upload them with Upload files (3) - no need to click Edit or Save. View opens a file and Download saves it. The bin icon deletes it straight away, without asking first.",
            hi: "हर हिस्से की फाइलें उसके टेक्स्ट के नीचे कार्ड्स में होती हैं। Upload files (3) से फाइल अपलोड करते ही वो सेव हो जाती है - Edit या Save की ज़रूरत नहीं। View फाइल खोलता है और Download उसे सेव करता है। डस्टबिन वाला आइकन बिना पूछे तुरंत फाइल हटा देता है।",
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
            en: "In Brand Brief, click Edit and paste or write the brief under Written brief. Upload the client's brief documents under Brief documents, below it.",
            hi: "Brand Brief में Edit पर क्लिक करके Written brief में ब्रीफ पेस्ट करें या लिखें। क्लाइंट के ब्रीफ डॉक्युमेंट्स उसके नीचे Brief documents में अपलोड करें।",
          },
        },
        {
          text: {
            en: "While editing the brief, click Draft with AI under the text box. The documents it can read are already ticked - untick any you want to leave out - then click Analyse (1). In up to a minute you get a Draft brief, Recommendations and Questions for the client.",
            hi: "ब्रीफ edit करते समय टेक्स्ट बॉक्स के नीचे Draft with AI पर क्लिक करें। जो डॉक्युमेंट्स पढ़े जा सकते हैं उन पर पहले से टिक लगा होता है - जिसे छोड़ना हो उसका टिक हटा दें - फिर Analyse (1) पर क्लिक करें। करीब एक मिनट में आपको Draft brief, Recommendations और Questions for the client मिल जाते हैं।",
          },
          shot: {
            id: "project-brand-ai",
            as: "manager",
            path: BRAND,
            // Draft with AI is disabled with no Brief documents; the demo seeds one
            // BRIEF file row (prisma/demo/projects.ts), so the click opens the dialog.
            actions: [
              { click: { role: "button", name: "Edit Brand Brief" } },
              { click: { role: "button", name: "Draft with AI" } },
            ],
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
            en: "Open Digital Objectives (1), click Edit, and click Add objective (2) for each target. Pick the Platform, type the Metric (like Followers), the Current and Target numbers, and pick a Deadline. Press Save.",
            hi: "Digital Objectives (1) खोलें, Edit पर क्लिक करें, और हर टारगेट के लिए Add objective (2) पर क्लिक करें। Platform चुनें, Metric (जैसे Followers), Current और Target नंबर लिखें, और Deadline चुनें। Save दबाएँ।",
          },
          shot: {
            id: "project-brand-objectives",
            as: "manager",
            path: BRAND,
            actions: [
              { click: { role: "tab", name: "Digital Objectives" } },
              { click: { role: "button", name: "Edit Digital Objectives" } },
            ],
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
            en: "Manifestation Plan has four themes: Brand Awareness, Demand Generation, Thought Leadership and Community Engagement. Click Edit, and for each one write how it shows up on Social media and on the Website. Press Save. Keep the plan files under Plan documents.",
            hi: "Manifestation Plan में चार थीम हैं: Brand Awareness, Demand Generation, Thought Leadership और Community Engagement। Edit पर क्लिक करें, और हर थीम के लिए लिखें कि वो Social media पर और Website पर कैसे दिखेगी। Save दबाएँ। प्लान की फाइलें Plan documents में रखें।",
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
            en: "In Brand Guidelines, click Edit, then Color (1) for each brand colour. Click the colour square to pick the shade, and type its Name. Fill in Fonts (2), UI / UX direction and Logo notes, then press Save (3).",
            hi: "Brand Guidelines में Edit पर क्लिक करें, फिर हर ब्रांड रंग के लिए Color (1) पर क्लिक करें। शेड चुनने के लिए रंग वाले चौकोर पर क्लिक करें, और उसका Name लिखें। Fonts (2), UI / UX direction और Logo notes भरें, फिर Save (3) दबाएँ।",
          },
          shot: {
            id: "project-brand-guidelines",
            as: "manager",
            path: BRAND,
            actions: [
              { click: { role: "tab", name: "Brand Guidelines" } },
              { click: { role: "button", name: "Edit Brand Guidelines" } },
            ],
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
