import { Wrench } from "lucide-react"
import type { HelpGuide } from "../../types"

const QR = "/tools/qr-code"
const LINK = "https://www.digitallynext.com"

export const toolsGuide: HelpGuide = {
  slug: "tools",
  group: "company",
  icon: Wrench,
  href: "/tools",
  title: { en: "Tools", hi: "टूल्स (Tools)" },
  summary: {
    en: "Handy utilities for everyday work, starting with a QR code generator that can put your own image in the middle.",
    hi: "रोज़ के काम के लिए काम के छोटे टूल्स - शुरुआत QR code generator से, जिसमें बीच में अपनी image भी लगा सकते हैं।",
  },
  keywords: ["tools", "qr", "qr code", "barcode", "logo", "generator", "टूल", "क्यूआर", "कोड"],
  sections: [
    {
      id: "open",
      title: { en: "Open the Tools page", hi: "Tools पेज खोलें" },
      steps: [
        {
          text: {
            en: "Click Tools in the sidebar, under Company. Each card is one tool - click QR Code Generator (1) to open it. New tools will appear here as they are added.",
            hi: "साइडबार में Company के नीचे Tools पर क्लिक करें। हर कार्ड एक टूल है - QR Code Generator (1) पर क्लिक करके उसे खोलें। नए टूल्स जुड़ते ही यहीं दिखेंगे।",
          },
          shot: {
            id: "tools-hub",
            as: "employee",
            path: "/tools",
            highlight: [{ role: "link", name: "QR Code Generator" }],
          },
        },
      ],
    },
    {
      id: "qr",
      title: { en: "Make a QR code", hi: "QR code बनाएँ" },
      steps: [
        {
          text: {
            en: "Type or paste a link or some text into Link or text (1). The QR code appears on the right straight away (2).",
            hi: "Link or text (1) में कोई लिंक या टेक्स्ट टाइप या पेस्ट करें। QR code तुरंत दाईं ओर दिख जाता है (2)।",
          },
          shot: {
            id: "tools-qr-basic",
            as: "employee",
            path: QR,
            actions: [{ fill: { label: "Link or text" }, value: LINK }],
            highlight: [
              { label: "Link or text" },
              { role: "img", name: "QR code preview" },
              { role: "button", name: "Download PNG" },
              { role: "button", name: "Download SVG" },
            ],
          },
        },
        {
          text: {
            en: "Click Download PNG (3) for chats, emails and slides, or Download SVG (4) for print and designers - an SVG stays sharp at any size. Copy image puts it on your clipboard so you can paste it straight into a chat.",
            hi: "चैट, ईमेल और स्लाइड्स के लिए Download PNG (3) पर क्लिक करें, या प्रिंट और डिज़ाइनर्स के लिए Download SVG (4) - SVG किसी भी साइज़ पर साफ़ दिखता है। Copy image से code कॉपी हो जाता है, जिसे सीधे चैट में पेस्ट कर सकते हैं।",
          },
        },
        {
          text: {
            en: "Want a different colour? Change QR colour and Background, and pick a Download size - Large is best for printing.",
            hi: "दूसरा रंग चाहिए? QR colour और Background बदलें, और Download size चुनें - प्रिंट के लिए Large सबसे अच्छा है।",
          },
        },
      ],
      tips: [
        {
          en: "Keep the QR colour darker than the background. If the colours won't scan well, the page warns you.",
          hi: "QR colour को background से गहरा रखें। अगर रंग ठीक से scan नहीं होंगे, तो पेज आपको बता देता है।",
        },
        {
          en: "Shorter text makes a simpler code that scans faster. For long content, put it on a web page and make a QR code of the link.",
          hi: "छोटा टेक्स्ट आसान code बनाता है जो जल्दी scan होता है। लंबी जानकारी हो तो उसे किसी वेब पेज पर डालें और उसके लिंक का QR code बनाएँ।",
        },
      ],
    },
    {
      id: "image",
      title: {
        en: "Add your own image in the middle (optional)",
        hi: "बीच में अपनी image लगाएँ (optional)",
      },
      steps: [
        {
          text: {
            en: "Click Upload image and pick your logo or photo (PNG, JPG, WebP, SVG or GIF, up to 5 MB). It shows in the middle of the code (1).",
            hi: "Upload image पर क्लिक करें और अपना logo या photo चुनें (PNG, JPG, WebP, SVG या GIF, 5 MB तक)। ये code के बीच में दिखती है (1)।",
          },
          shot: {
            id: "tools-qr-image",
            as: "employee",
            path: QR,
            actions: [
              { fill: { label: "Link or text" }, value: LINK },
              { upload: "public/brand-mark-104.png" },
              { waitFor: { role: "button", name: "Remove image" } },
            ],
            highlight: [
              { role: "img", name: "QR code preview" },
              { css: "input#qr-image-size" },
              { label: "Plain background behind the image" },
              { role: "button", name: "Remove image" },
            ],
          },
        },
        {
          text: {
            en: "Use Image size (2) to make it bigger or smaller, and Plain background behind the image (3) to keep the dots around it clear. To take it out again, click the bin (4).",
            hi: "Image size (2) से उसे बड़ा या छोटा करें, और Plain background behind the image (3) से उसके आसपास के dots साफ़ रखें। हटाना हो तो डिब्बे वाले आइकन (4) पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Scan the code with your phone camera before you print or share it, especially with a big image.",
            hi: "प्रिंट या शेयर करने से पहले code को अपने फ़ोन के कैमरे से scan करके देख लें, खासकर जब image बड़ी हो।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "Is my image uploaded or saved anywhere?",
            hi: "क्या मेरी image कहीं upload या save होती है?",
          },
          a: {
            en: "No. Everything happens in your browser. The image never leaves your computer, and nothing is stored in DNMS.",
            hi: "नहीं। सब कुछ आपके browser में ही होता है। image आपके कंप्यूटर से बाहर नहीं जाती, और DNMS में कुछ भी save नहीं होता।",
          },
        },
        {
          q: {
            en: "Will the code still scan with an image on top?",
            hi: "ऊपर image होने पर भी code scan होगा?",
          },
          a: {
            en: "Yes - when you add an image, DNMS makes a stronger code that still scans with part of it covered. Keep the image at 30% or less, and test it with your phone.",
            hi: "हाँ - image लगाने पर DNMS ज़्यादा मज़बूत code बनाता है, जो थोड़ा ढका होने पर भी scan हो जाता है। image 30% या उससे कम रखें, और फ़ोन से टेस्ट कर लें।",
          },
        },
      ],
    },
  ],
}
