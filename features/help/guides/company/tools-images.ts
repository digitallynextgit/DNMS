import { ImageDown } from "lucide-react"
import type { HelpGuide } from "../../types"

export const toolsImagesGuide: HelpGuide = {
  slug: "tools-images",
  group: "company",
  icon: ImageDown,
  href: "/tools",
  title: { en: "Tools: images & design", hi: "Tools: images और design" },
  summary: {
    en: "Compress and convert images, resize them for social media, remove backgrounds, make website icons, and work with colours.",
    hi: "images को compress और convert करें, social media के लिए resize करें, background हटाएँ, website icons बनाएँ, और colours के साथ काम करें।",
  },
  keywords: [
    "compress",
    "background",
    "remove background",
    "transparent",
    "convert",
    "heic",
    "resize",
    "instagram",
    "favicon",
    "colour",
    "color",
    "palette",
    "image",
    "फ़ोटो",
  ],
  sections: [
    {
      id: "compressor",
      title: { en: "Image Compressor", hi: "Image Compressor - फ़ोटो छोटी करें" },
      intro: {
        en: "Make photos smaller for email, WhatsApp and websites - many at once. Your files stay on your computer.",
        hi: "ईमेल, WhatsApp और websites के लिए photos छोटी करें - एक साथ कई। आपकी files आपके कंप्यूटर पर ही रहती हैं।",
      },
      steps: [
        {
          text: {
            en: "Open Tools > Image Compressor and drop your images in the box (or click it, or paste with Ctrl+V). Each image shows its old and new size and how much smaller it got.",
            hi: "Tools > Image Compressor खोलें और images को box में drop करें (या उस पर क्लिक करें, या Ctrl+V से paste करें)। हर image का पुराना और नया size, और कितनी छोटी हुई, दिखता है।",
          },
          shot: {
            id: "tools-images-compressor",
            as: "employee",
            path: "/tools/image-compressor",
            actions: [
              { upload: "public/brand-masters/brand-mark.png" },
              { click: { css: "#ic-format" } },
              { click: { role: "option", name: "WebP" } },
              { wait: 3000 },
            ],
          },
        },
        {
          text: {
            en: "Quality 80 is a good balance - lower makes smaller files. To shrink big photos, pick a Max size (1920 px suits most websites and emails). For the smallest files, save as WebP.",
            hi: "Quality 80 अच्छा बैलेंस है - कम करने पर file और छोटी होती है। बड़ी photos छोटी करनी हों तो Max size चुनें (ज़्यादातर websites और emails के लिए 1920 px ठीक है)। सबसे छोटी file के लिए WebP में save करें।",
          },
        },
        {
          text: {
            en: "Click Download next to an image, or Download all (ZIP).",
            hi: "image के पास Download पर क्लिक करें, या Download all (ZIP)।",
          },
        },
      ],
      tips: [
        {
          en: '"Already optimised" means the image couldn\'t get any smaller, so you keep the original.',
          hi: '"Already optimised" का मतलब है image और छोटी नहीं हो सकती, इसलिए original ही रहती है।',
        },
        {
          en: "PNG files only get smaller when you resize them or save them as WebP.",
          hi: "PNG files तभी छोटी होती हैं जब आप उन्हें resize करें या WebP में save करें।",
        },
      ],
    },
    {
      id: "converter",
      title: { en: "Image Converter", hi: "Image Converter - फ़ोटो का format बदलें" },
      intro: {
        en: "Change images between JPG, PNG and WebP, and turn iPhone HEIC photos into JPG.",
        hi: "images को JPG, PNG और WebP में बदलें, और iPhone की HEIC photos को JPG में।",
      },
      steps: [
        {
          text: {
            en: "Drop your images in the box - iPhone HEIC photos work too (they take a few seconds each). Then pick what to Convert to: JPG for photos, PNG for logos and screenshots, WebP for websites.",
            hi: "images को box में drop करें - iPhone की HEIC photos भी चलती हैं (हर एक में कुछ सेकंड लगते हैं)। फिर Convert to चुनें: photos के लिए JPG, logos और screenshots के लिए PNG, websites के लिए WebP।",
          },
          shot: {
            id: "tools-images-converter",
            as: "employee",
            path: "/tools/image-converter",
            actions: [{ upload: "public/brand-mark-104.png" }, { wait: 2500 }],
          },
        },
        {
          text: {
            en: "Converting a logo with a see-through background to JPG? Pick the background colour (white by default). Then Download each image, or Download all (ZIP).",
            hi: "transparent background वाला logo JPG में बदल रहे हैं? background colour चुनें (default सफ़ेद है)। फिर हर image को Download करें, या Download all (ZIP)।",
          },
        },
      ],
    },
    {
      id: "social-resizer",
      title: { en: "Social Media Resizer", hi: "Social Media Resizer - सही size में फ़ोटो" },
      intro: {
        en: "Get the exact size each network wants - Instagram, Facebook, LinkedIn, X, YouTube, WhatsApp and website share images.",
        hi: "हर network का सही size पाएँ - Instagram, Facebook, LinkedIn, X, YouTube, WhatsApp और website share images।",
      },
      steps: [
        {
          text: {
            en: "Drop your image, then pick where you'll post it and the size you need - or choose Custom and type a width and height.",
            hi: "अपनी image drop करें, फिर चुनें कहाँ post करनी है और कौन सा size चाहिए - या Custom चुनकर width और height लिखें।",
          },
          shot: {
            id: "tools-images-social",
            as: "employee",
            path: "/tools/social-image-resizer",
            actions: [{ upload: "public/brand-masters/logo_white_bg.png" }, { wait: 2000 }],
          },
        },
        {
          text: {
            en: "Choose Crop to fill and drag the frame to the part you want to keep (Zoom gets closer), or Fit whole image to keep everything on a blurred or coloured background.",
            hi: "Crop to fill चुनकर frame को उस हिस्से पर खींचें जो रखना है (Zoom से पास जाएँ), या Fit whole image चुनें ताकि पूरी image blurred या रंगीन background पर रहे।",
          },
        },
        {
          text: {
            en: "Pick JPG (works everywhere), check the preview and click Download - or get every size for that network at once as a ZIP.",
            hi: "JPG चुनें (हर जगह चलता है), preview देखें और Download पर क्लिक करें - या उस network के सारे sizes एक साथ ZIP में लें।",
          },
        },
      ],
    },
    {
      id: "background-remover",
      title: { en: "Background Remover", hi: "Background Remover - background हटाएँ" },
      intro: {
        en: "Cut out a person or product from its background in one click. The AI runs on your own computer - your photo is never uploaded.",
        hi: "एक क्लिक में किसी व्यक्ति या product को उसके background से अलग करें। AI आपके अपने कंप्यूटर पर चलता है - आपकी photo कहीं upload नहीं होती।",
      },
      steps: [
        {
          text: {
            en: "Open Tools > Background Remover and drop in a photo (or paste one with Ctrl+V). Click Remove background. The first time, the AI model downloads once - after that it takes a few seconds.",
            hi: "Tools > Background Remover खोलें और कोई photo drop करें (या Ctrl+V से paste करें)। Remove background पर क्लिक करें। पहली बार AI model एक बार download होता है - उसके बाद कुछ ही सेकंड लगते हैं।",
          },
          shot: {
            id: "tools-images-background",
            as: "employee",
            path: "/tools/background-remover",
            actions: [
              { upload: "public/avatars/av-design-01.webp" },
              { click: { role: "button", name: "Remove background" } },
              { waitFor: { text: "Before / after" }, timeout: 600_000 },
            ],
          },
        },
        {
          text: {
            en: "Pick a Background - Transparent, White, a Colour or a Blurred photo. Use Before / after and drag the line to check the edges, and turn on Soften edges for hair and fur.",
            hi: "Background चुनें - Transparent, White, कोई Colour या Blurred photo। Before / after से line खींचकर edges देखें, और बालों व fur के लिए Soften edges चालू करें।",
          },
        },
        {
          text: {
            en: "Click Download PNG (keeps the see-through background), JPG for a smaller file, or Copy to paste it straight into a slide or chat.",
            hi: "Download PNG पर क्लिक करें (see-through background रहता है), छोटी file के लिए JPG, या Copy करके सीधे slide या chat में paste करें।",
          },
        },
      ],
      tips: [
        {
          en: "It works best when the subject stands out clearly from the background. Check the edges before you send it to a client.",
          hi: "ये सबसे अच्छा तब काम करता है जब subject background से साफ़ अलग दिखे। client को भेजने से पहले edges ज़रूर देख लें।",
        },
        {
          en: "In Chrome or Edge it takes about a second. Other browsers use the computer's processor instead, which takes 10-30 seconds per photo.",
          hi: "Chrome या Edge में करीब एक सेकंड लगता है। दूसरे browsers में ये कंप्यूटर के processor पर चलता है, जिसमें हर photo पर 10-30 सेकंड लगते हैं।",
        },
      ],
    },
    {
      id: "favicon",
      title: { en: "Favicon Maker", hi: "Favicon Maker - website के icons" },
      intro: {
        en: "Turn a logo into every icon a website needs: the browser-tab icon, the iPhone and Android home-screen icons.",
        hi: "logo से website के सारे icons बनाएँ: browser tab का icon, iPhone और Android home-screen icons।",
      },
      steps: [
        {
          text: {
            en: "Drop your logo - a square PNG of 512 px or more, or an SVG, works best. Adjust padding, background and corners until the tab and phone previews look right.",
            hi: "अपना logo drop करें - 512 px या उससे बड़ा square PNG, या SVG, सबसे अच्छा रहता है। padding, background और corners तब तक बदलें जब तक tab और phone preview सही न दिखें।",
          },
          shot: {
            id: "tools-images-favicon",
            as: "employee",
            path: "/tools/favicon-maker",
            actions: [{ upload: "public/brand-masters/brand-mark.png" }, { wait: 2500 }],
          },
        },
        {
          text: {
            en: "Click Download all (ZIP), put the files in the website's root folder, and paste the copied code inside the <head> of the pages - or send both to your developer.",
            hi: "Download all (ZIP) पर क्लिक करें, files को website के root folder में रखें, और copy किया code pages के <head> में paste करें - या दोनों अपने developer को भेज दें।",
          },
        },
      ],
    },
    {
      id: "colours",
      title: { en: "Colour Tools", hi: "Colour Tools - रंगों के tools" },
      intro: {
        en: "Three tools in one: convert colour codes, pull a palette out of an image, and check that text is easy to read.",
        hi: "एक में तीन tools: colour codes बदलें, किसी image से palette निकालें, और देखें कि text आसानी से पढ़ा जा सके।",
      },
      steps: [
        {
          text: {
            en: "Picker: type or paste a colour (HEX, RGB or HSL), click the swatch, or use Pick from screen - then copy it in the format you need.",
            hi: "Picker: कोई colour लिखें या paste करें (HEX, RGB या HSL), swatch पर क्लिक करें, या Pick from screen इस्तेमाल करें - फिर जिस format में चाहिए, copy करें।",
          },
          shot: {
            id: "tools-images-colours",
            as: "employee",
            path: "/tools/colour-tools",
          },
        },
        {
          text: {
            en: "Palette: drop an image (like a client's logo or a product photo) and copy its main colours. Contrast: set the text and background colours - aim for Pass under AA for normal text.",
            hi: "Palette: कोई image drop करें (जैसे client का logo या product photo) और उसके मुख्य colours copy करें। Contrast: text और background colours सेट करें - normal text के लिए AA में Pass आना चाहिए।",
          },
        },
      ],
    },
  ],
}
