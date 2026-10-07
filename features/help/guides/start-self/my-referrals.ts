import { UserPlus } from "lucide-react"
import type { HelpGuide } from "../../types"

export const myReferralsGuide: HelpGuide = {
  slug: "my-referrals",
  group: "self",
  icon: UserPlus,
  href: "/referrals",
  title: { en: "My Referrals", hi: "मेरे रेफ़रल (My Referrals)" },
  summary: {
    en: "Refer people you know for open roles, follow how far they get, and see the reward you earn when they are hired.",
    hi: "अपने जान-पहचान वालों को खुली नौकरियों के लिए रेफ़र करें, देखें वो कहाँ तक पहुँचे, और हायर होने पर मिलने वाला इनाम देखें।",
  },
  keywords: [
    "referral",
    "refer",
    "friend",
    "candidate",
    "job",
    "opening",
    "hiring",
    "reward",
    "bonus",
    "careers",
    "रेफ़रल",
    "रेफ़र",
    "नौकरी",
    "दोस्त",
    "इनाम",
    "बोनस",
  ],
  sections: [
    {
      id: "overview",
      title: { en: "Your referrals at a glance", hi: "आपके रेफ़रल एक नज़र में" },
      steps: [
        {
          text: {
            en: "Click My Referrals in the sidebar. Refer someone (1) is at the top right, and just below it is your employee number (2) - share it with anyone who applies on the company careers site.",
            hi: "साइडबार में My Referrals पर क्लिक करें। ऊपर दाईं ओर Refer someone (1) है, और उसके ठीक नीचे आपका employee number (2) - कंपनी की careers साइट पर अप्लाई करने वाले को यह नंबर दें।",
          },
          shot: {
            id: "my-referrals-overview",
            as: "employee",
            path: "/referrals",
            highlight: [
              { role: "button", name: "Refer someone", nth: 0 },
              { text: "DM004", exact: true },
              { text: "Referred", exact: true },
              { text: "Earned", exact: true },
            ],
          },
        },
        {
          text: {
            en: "The boxes count how many people you have Referred (3), how many were Hired, how many are In progress, and what you have Earned (4).",
            hi: "बॉक्स गिनते हैं कि आपने कितने लोग Referred (3) किए, कितने Hired हुए, कितने In progress हैं, और आपने कितना Earned (4) किया।",
          },
        },
        {
          text: {
            en: "Below, each person you referred has a row with the role, the department, the date you referred them and their stage: Received, In review, Shortlisted, Hired or Not selected.",
            hi: "नीचे, आपके रेफ़र किए हर व्यक्ति की एक लाइन है जिसमें रोल, डिपार्टमेंट, रेफ़र करने की तारीख और उनकी स्टेज दिखती है: Received, In review, Shortlisted, Hired या Not selected।",
          },
        },
      ],
      tips: [
        {
          en: "DNMS sends you a notification each time your referral moves to a new stage.",
          hi: "जब भी आपका रेफ़रल अगली स्टेज पर जाता है, DNMS आपको नोटिफिकेशन भेजता है।",
        },
      ],
    },
    {
      id: "refer",
      title: { en: "Refer someone", hi: "किसी को रेफ़र करें" },
      steps: [
        {
          text: {
            en: "Click Refer someone at the top right.",
            hi: "ऊपर दाईं ओर Refer someone पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Fill in Their name (1) and Email (2), and Phone if you have it. In Role (3), type to search the open roles, then pick one.",
            hi: "Their name (1) और Email (2) भरें, और फ़ोन नंबर हो तो Phone भी। Role (3) में टाइप करके खुले रोल ढूँढें, फिर एक चुनें।",
          },
          shot: {
            id: "my-referrals-form",
            as: "employee",
            path: "/referrals",
            actions: [{ click: { role: "button", name: "Refer someone", nth: 0 } }],
            highlight: [
              { placeholder: "Priya Sharma" },
              { placeholder: "priya@example.com" },
              { role: "combobox" },
              { placeholder: "https://drive.google.com/..." },
              { role: "button", name: "Submit referral" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Paste a link to their CV in CV / resume link (4), for example a Google Drive link that anyone can open. It must start with https://. LinkedIn and Why them? are optional, but a line on why they are good helps HR.",
            hi: "CV / resume link (4) में उनके CV का लिंक पेस्ट करें, जैसे Google Drive का ऐसा लिंक जिसे कोई भी खोल सके। लिंक https:// से शुरू होना चाहिए। LinkedIn और Why them? भरना ज़रूरी नहीं, पर वो क्यों अच्छे हैं इस पर एक लाइन HR की मदद करती है।",
          },
        },
        {
          text: {
            en: "Click Submit referral (5). HR is notified, and the person shows up in your list.",
            hi: "Submit referral (5) पर क्लिक करें। HR को सूचना मिल जाती है, और वो व्यक्ति आपकी लिस्ट में दिखने लगता है।",
          },
        },
      ],
      tips: [
        {
          en: "Your friend can also apply on the company careers site. Ask them to put your employee number, or your work email, in the Referred by box so the referral is credited to you.",
          hi: "आपका दोस्त कंपनी की careers साइट पर खुद भी अप्लाई कर सकता है। उनसे कहें कि Referred by वाले बॉक्स में आपका employee number या ऑफिस ईमेल डालें, ताकि रेफ़रल आपके नाम हो।",
        },
        {
          en: "You can't refer the same person for the same role twice while their application is still open.",
          hi: "जब तक किसी की एप्लिकेशन खुली है, आप उसी व्यक्ति को उसी रोल के लिए दोबारा रेफ़र नहीं कर सकते।",
        },
      ],
    },
    {
      id: "reward",
      title: { en: "Your referral reward", hi: "आपका रेफ़रल इनाम" },
      steps: [
        {
          text: {
            en: "When someone you referred is hired, their row shows the reward (1). You earn it once they complete one year with the company.",
            hi: "जब आपका रेफ़र किया व्यक्ति हायर हो जाता है, तो उसकी लाइन पर इनाम (1) दिखता है। यह आपको तब मिलता है जब वो कंपनी में एक साल पूरा कर लेते हैं।",
          },
          shot: {
            id: "my-referrals-reward",
            as: "employee",
            path: "/referrals",
            // The hired referral's row only: the reward status block, then the amount.
            highlight: [
              { css: "div.text-right:has-text('Reward pending')" },
              { css: "div.text-right:has-text('estimated')" },
            ],
            // Last match = the innermost card holding the name.
            crop: { css: "div.bg-card:has-text('Rahul Das')", nth: -1 },
          },
        },
        {
          text: {
            en: "Reward pending shows the date it becomes due and how many days are left. Reward due means the year is complete and HR will pay it. Reward paid shows when it was paid.",
            hi: "Reward pending में दिखता है कि इनाम किस तारीख को ड्यू होगा और कितने दिन बाकी हैं। Reward due का मतलब है साल पूरा हो गया और HR इसे देगा। Reward paid में दिखता है कि यह कब दिया गया।",
          },
        },
        {
          text: {
            en: "The amount (2) is marked estimated until it is paid. It is a share of the new person's monthly salary, set by the company.",
            hi: "जब तक इनाम दिया नहीं जाता, रकम (2) के नीचे estimated लिखा रहता है। यह नए व्यक्ति की महीने की सैलरी का एक हिस्सा होता है, जो कंपनी तय करती है।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "Why is there no amount next to my reward?",
            hi: "मेरे इनाम के आगे रकम क्यों नहीं दिख रही?",
          },
          a: {
            en: "The amount shows once HR has set up the new person's salary in DNMS. Until then you only see the reward status.",
            hi: "रकम तब दिखती है जब HR नए व्यक्ति की सैलरी DNMS में सेट कर देता है। तब तक सिर्फ़ इनाम का स्टेटस दिखता है।",
          },
        },
        {
          q: {
            en: "My friend applied on the careers site, but they are not in my list.",
            hi: "मेरे दोस्त ने careers साइट पर अप्लाई किया, पर वो मेरी लिस्ट में नहीं है।",
          },
          a: {
            en: "A careers-site application only shows here when the person typed your employee number or work email in Referred by. If they left it empty or typed it wrong, talk to HR.",
            hi: "Careers साइट वाली एप्लिकेशन यहाँ तभी दिखती है जब व्यक्ति ने Referred by में आपका employee number या ऑफिस ईमेल डाला हो। अगर उन्होंने इसे खाली छोड़ा या गलत भरा, तो HR से बात करें।",
          },
        },
      ],
    },
  ],
}
