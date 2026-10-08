import { Link2 } from "lucide-react"
import type { HelpGuide } from "../../types"

export const toolsMarketingGuide: HelpGuide = {
  slug: "tools-marketing",
  group: "company",
  icon: Link2,
  href: "/tools",
  title: { en: "Tools: marketing & SEO", hi: "Tools: marketing और SEO" },
  summary: {
    en: "Build campaign links, count characters against each platform's limit, and preview pages in Google and on social media.",
    hi: "campaign links बनाएँ, हर platform की limit के हिसाब से characters गिनें, और Google व social media पर pages का preview देखें।",
  },
  keywords: [
    "utm",
    "campaign",
    "link",
    "caption",
    "count",
    "seo",
    "meta",
    "google",
    "preview",
    "og",
  ],
  sections: [
    {
      id: "utm",
      title: { en: "UTM Link Builder", hi: "UTM Link Builder - campaign links बनाएँ" },
      intro: {
        en: "Campaign links tell Google Analytics exactly where each visit came from. Building them here keeps every link in the same style.",
        hi: "campaign links से Google Analytics को पता चलता है कि हर visit कहाँ से आई। यहाँ बनाने से हर link एक ही style में रहता है।",
      },
      steps: [
        {
          text: {
            en: "Paste the page link into Website URL (you can leave out https://). Pick or type a Source - where the visit comes from, like instagram - and a Medium - the type of traffic, like paid_social.",
            hi: "page का link Website URL में paste करें (https:// छोड़ सकते हैं)। Source चुनें या लिखें - visit कहाँ से आएगी, जैसे instagram - और Medium - traffic का तरीका, जैसे paid_social।",
          },
          shot: {
            id: "tools-marketing-utm",
            as: "employee",
            path: "/tools/utm-builder",
            actions: [
              { fill: { css: "#utm-website" }, value: "www.digitallynext.com/offers" },
              { fill: { label: "Source" }, value: "instagram" },
              { fill: { label: "Medium" }, value: "paid_social" },
              { fill: { label: "Campaign" }, value: "diwali-sale-2026" },
            ],
          },
        },
        {
          text: {
            en: "Type the Campaign name - use the same name in every link for that campaign. Add Term or Content only if you need them (Content tells two ads apart).",
            hi: "Campaign का नाम लिखें - उस campaign के हर link में वही नाम रखें। Term या Content तभी डालें जब ज़रूरत हो (Content से दो ads में फ़र्क पता चलता है)।",
          },
        },
        {
          text: {
            en: "Click Copy link, or download the QR code for print. The link is also saved under Recent links in this browser, so you can reuse it.",
            hi: "Copy link पर क्लिक करें, या print के लिए QR code download करें। link इस browser में Recent links में भी save होता है, ताकि दोबारा इस्तेमाल कर सकें।",
          },
        },
      ],
      tips: [
        {
          en: 'Keep everything lowercase - analytics counts "Facebook" and "facebook" as two different sources. Clean up values does this for you.',
          hi: 'सब कुछ lowercase रखें - analytics "Facebook" और "facebook" को दो अलग sources मानता है। Clean up values ये अपने आप कर देता है।',
        },
      ],
    },
    {
      id: "counter",
      title: { en: "Character Counter", hi: "Character Counter - अक्षर गिनें" },
      intro: {
        en: "Check a caption, post or title against every platform's limit while you write it.",
        hi: "लिखते-लिखते caption, post या title को हर platform की limit से मिलाएँ।",
      },
      steps: [
        {
          text: {
            en: "Type or paste your text into the box. The counts update as you type, and each platform's bar turns amber near the limit and red when it's too long.",
            hi: "अपना text box में लिखें या paste करें। counts लिखते ही बदलते हैं, और हर platform की bar limit के पास पीली और ज़्यादा होने पर लाल हो जाती है।",
          },
          shot: {
            id: "tools-marketing-counter",
            as: "employee",
            path: "/tools/character-counter",
            actions: [
              {
                fill: { css: "#cc-text" },
                value:
                  "Diwali offers are live! Up to 40% off on our festive hampers - order before 30 Oct. Link in bio. #Diwali2026 #FestiveOffers #ShopLocal",
              },
            ],
          },
        },
        {
          text: {
            en: "Use Change case or Tidy up to fix the text (Undo is in the pop-up), then click Copy.",
            hi: "text ठीक करने के लिए Change case या Tidy up इस्तेमाल करें (pop-up में Undo है), फिर Copy पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: 'Instagram now allows at most 5 hashtags per post, and shows only about the first 125 characters before "more".',
          hi: 'Instagram अब हर post में ज़्यादा से ज़्यादा 5 hashtags देता है, और "more" से पहले सिर्फ़ करीब 125 characters दिखाता है।',
        },
        {
          en: "Hindi or emoji in an SMS cut each message from 160 characters to 70 - the SMS line shows how many messages it will take.",
          hi: "SMS में हिंदी या emoji होने पर हर message 160 की जगह 70 characters का रह जाता है - SMS वाली line बताती है कितने messages लगेंगे।",
        },
      ],
    },
    {
      id: "preview",
      title: { en: "Google & Social Preview", hi: "Google & Social Preview - page कैसा दिखेगा" },
      intro: {
        en: "See how a page will look in Google search and when its link is shared on Facebook, LinkedIn, WhatsApp and X.",
        hi: "देखें कि कोई page Google search में और Facebook, LinkedIn, WhatsApp व X पर link share होने पर कैसा दिखेगा।",
      },
      steps: [
        {
          text: {
            en: 'Type the Page title and Meta description - aim for the green "good length" chip under each. Paste the Page URL and, if you like, the Site name.',
            hi: 'Page title और Meta description लिखें - दोनों के नीचे हरी "good length" chip आनी चाहिए। Page URL paste करें और चाहें तो Site name भी।',
          },
          shot: {
            id: "tools-marketing-preview",
            as: "employee",
            path: "/tools/search-preview",
            actions: [
              {
                fill: { css: "#sp-title" },
                value: "Festive Hampers - Diwali Gift Boxes | Sunmeadow Foods",
              },
              {
                fill: { css: "#sp-desc" },
                value:
                  "Handpicked millet snacks and sweets in ready-to-gift boxes. Free delivery across India on orders above Rs 999 - order before 30 October.",
              },
              { fill: { css: "#sp-url" }, value: "www.sunmeadowfoods.example/diwali-hampers" },
              { fill: { css: "#sp-site" }, value: "Sunmeadow Foods" },
            ],
          },
        },
        {
          text: {
            en: 'If the title ends in "..." in the Google preview, it\'s too long - shorten it. Optionally drop in the share image (1200 x 630 px is best) to see the social cards.',
            hi: 'अगर Google preview में title "..." पर खत्म हो, तो वो लंबा है - छोटा करें। चाहें तो share image drop करें (1200 x 630 px सबसे अच्छा) ताकि social cards दिखें।',
          },
        },
        {
          text: {
            en: "Click Copy meta tags and send them to the developer. Replace the image link in them once the image is on the website.",
            hi: "Copy meta tags पर क्लिक करें और developer को भेजें। image website पर आ जाने के बाद उसमें image का link बदल दें।",
          },
        },
      ],
    },
  ],
}
