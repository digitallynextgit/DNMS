import { FileStack } from "lucide-react"
import type { HelpGuide } from "../../types"

export const toolsPdfGuide: HelpGuide = {
  slug: "tools-pdf",
  group: "company",
  icon: FileStack,
  href: "/tools",
  title: { en: "Tools: PDF Toolkit", hi: "Tools: PDF के काम (PDF Toolkit)" },
  summary: {
    en: "Merge, split, reorder and compress PDFs, and turn images into a PDF or a PDF into images - all on your own computer.",
    hi: "PDFs को जोड़ें, अलग करें, pages का क्रम बदलें और compress करें, और images से PDF या PDF से images बनाएँ - सब आपके अपने कंप्यूटर पर।",
  },
  keywords: [
    "pdf",
    "merge",
    "combine",
    "split",
    "compress",
    "jpg to pdf",
    "pdf to jpg",
    "pages",
    "rotate",
  ],
  sections: [
    {
      id: "merge",
      title: { en: "Merge PDFs", hi: "PDFs जोड़ें (Merge)" },
      steps: [
        {
          text: {
            en: "Open Tools > PDF Toolkit. On the Merge tab, drop your PDFs in or click to choose them.",
            hi: "Tools > PDF Toolkit खोलें। Merge tab पर अपनी PDFs drop करें या क्लिक करके चुनें।",
          },
          shot: { id: "tools-pdf-merge", as: "employee", path: "/tools/pdf-toolkit" },
        },
        {
          text: {
            en: "Put them in order - drag a file, or use the up and down arrows - then click Merge PDFs. You get merged.pdf.",
            hi: "उन्हें क्रम में लगाएँ - file को खींचें, या ऊपर-नीचे वाले arrows इस्तेमाल करें - फिर Merge PDFs पर क्लिक करें। आपको merged.pdf मिलेगी।",
          },
        },
      ],
    },
    {
      id: "split",
      title: { en: "Split a PDF", hi: "PDF अलग करें (Split)" },
      steps: [
        {
          text: {
            en: "On the Split tab, choose one PDF. Pick Extract pages and type the pages you want, like 1-3, 5 - or pick Every page as its own file.",
            hi: "Split tab पर एक PDF चुनें। Extract pages चुनकर जो pages चाहिए वो लिखें, जैसे 1-3, 5 - या Every page as its own file चुनें।",
          },
        },
        {
          text: {
            en: "Click the button. You get one new PDF, or a ZIP with one PDF per page.",
            hi: "button पर क्लिक करें। आपको एक नई PDF मिलेगी, या हर page की अलग PDF वाली एक ZIP।",
          },
        },
      ],
    },
    {
      id: "organise",
      title: { en: "Organise pages", hi: "Pages व्यवस्थित करें (Organise)" },
      steps: [
        {
          text: {
            en: "On the Organise pages tab, choose one PDF - you'll see all its pages. Use the arrows to move a page, the round arrow to rotate it and the bin to remove it (undo puts it back). Then click Save PDF.",
            hi: "Organise pages tab पर एक PDF चुनें - उसके सारे pages दिखेंगे। page को आगे-पीछे करने के लिए arrows, घुमाने के लिए गोल arrow और हटाने के लिए डिब्बे वाला आइकन इस्तेमाल करें (undo से वापस आ जाता है)। फिर Save PDF पर क्लिक करें।",
          },
        },
      ],
    },
    {
      id: "compress",
      title: { en: "Compress a PDF", hi: "PDF छोटी करें (Compress)" },
      steps: [
        {
          text: {
            en: "On the Compress tab, choose one PDF, pick Smallest file, Balanced or Better quality, and click Compress PDF. Check the new size, then download it.",
            hi: "Compress tab पर एक PDF चुनें, Smallest file, Balanced या Better quality चुनें, और Compress PDF पर क्लिक करें। नया size देखें, फिर download करें।",
          },
        },
      ],
      tips: [
        {
          en: "Compressing turns every page into a picture, so text can't be selected or searched and links stop working. Keep your original - and for text-only PDFs it often won't get smaller.",
          hi: "Compress करने पर हर page तस्वीर बन जाता है, इसलिए text select या search नहीं होता और links काम नहीं करते। अपनी original रखें - और सिर्फ़ text वाली PDFs अक्सर छोटी नहीं होतीं।",
        },
      ],
    },
    {
      id: "images",
      title: { en: "Images to PDF, and PDF to images", hi: "Images से PDF, और PDF से images" },
      steps: [
        {
          text: {
            en: "Images to PDF: drop in JPG, PNG or WebP images (or paste one), put them in order - each becomes one page - choose the page size and margin, and click Make PDF.",
            hi: "Images to PDF: JPG, PNG या WebP images डालें (या एक paste करें), क्रम में लगाएँ - हर image एक page बनती है - page size और margin चुनें, और Make PDF पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "PDF to images: choose one PDF, pick PNG or JPG and a resolution (150 DPI for screens, 300 DPI for print), optionally type the pages you want, and click Convert. One page downloads as an image; more come as a ZIP.",
            hi: "PDF to images: एक PDF चुनें, PNG या JPG और resolution चुनें (screen के लिए 150 DPI, print के लिए 300 DPI), चाहें तो pages लिखें, और Convert पर क्लिक करें। एक page image बनकर download होता है; ज़्यादा हों तो ZIP में।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "Why does it say my PDF is password-protected?",
            hi: "ये क्यों कहता है कि मेरी PDF password-protected है?",
          },
          a: {
            en: "The file is locked. Open it with its password, save a copy without the password, then use that copy here.",
            hi: "file locked है। उसे password से खोलें, बिना password के एक copy save करें, फिर वो copy यहाँ इस्तेमाल करें।",
          },
        },
        {
          q: { en: "Are my files uploaded anywhere?", hi: "क्या मेरी files कहीं upload होती हैं?" },
          a: {
            en: "No. Everything happens in your browser - the files never leave your computer.",
            hi: "नहीं। सब कुछ आपके browser में होता है - files आपके कंप्यूटर से बाहर नहीं जातीं।",
          },
        },
      ],
    },
  ],
}
