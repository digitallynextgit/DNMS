import { Calculator } from "lucide-react"
import type { HelpGuide } from "../../types"

export const toolsOfficeGuide: HelpGuide = {
  slug: "tools-office",
  group: "company",
  icon: Calculator,
  href: "/tools",
  title: { en: "Tools: everyday work", hi: "Tools: रोज़ का काम" },
  summary: {
    en: "Your email signature, working days and deadlines, GST, client time zones and strong passwords.",
    hi: "आपका email signature, working days और deadlines, GST, client के time zones और मज़बूत passwords।",
  },
  keywords: [
    "signature",
    "gmail",
    "working days",
    "deadline",
    "gst",
    "tax",
    "time zone",
    "meeting",
    "password",
    "हस्ताक्षर",
  ],
  sections: [
    {
      id: "signature",
      title: { en: "Email Signature", hi: "Email Signature - ईमेल हस्ताक्षर" },
      intro: {
        en: "Your email signature in the company design, filled in from your DNMS profile.",
        hi: "company design में आपका email signature, आपकी DNMS profile से भरा हुआ।",
      },
      steps: [
        {
          text: {
            en: 'Open Tools > Email Signature - your name, job title, email and phone come from your profile. If you like, hide your phone, add another number or your LinkedIn, or a short line like "Book a call". These changes are for this copy only.',
            hi: 'Tools > Email Signature खोलें - आपका नाम, job title, email और phone आपकी profile से आते हैं। चाहें तो phone छुपाएँ, दूसरा नंबर या LinkedIn जोड़ें, या "Book a call" जैसी छोटी line। ये बदलाव सिर्फ़ इस copy के लिए हैं।',
          },
          shot: {
            id: "tools-office-signature",
            as: "employee",
            path: "/tools/email-signature",
            // Only shows on a dev machine (images served from localhost).
            hide: [{ css: 'p:has-text("which people outside can")' }],
          },
        },
        {
          text: {
            en: "Click Copy signature. In Gmail go to Settings > See all settings > Signature > Create new; in Outlook, Settings > Accounts > Signatures. Paste it, set it as default and save.",
            hi: "Copy signature पर क्लिक करें। Gmail में Settings > See all settings > Signature > Create new पर जाएँ; Outlook में Settings > Accounts > Signatures। paste करें, default बनाएँ और save करें।",
          },
        },
      ],
      tips: [
        {
          en: "Wrong name, title or phone? Fix it in your DNMS profile (or ask HR), then open the tool again.",
          hi: "नाम, title या phone गलत है? अपनी DNMS profile में ठीक करें (या HR से कहें), फिर tool दोबारा खोलें।",
        },
      ],
    },
    {
      id: "working-days",
      title: { en: "Working Days Calculator", hi: "Working Days Calculator - कामकाजी दिन गिनें" },
      intro: {
        en: "Count working days between two dates, or find a deadline - weekends and company holidays are skipped for you.",
        hi: "दो तारीखों के बीच working days गिनें, या deadline निकालें - weekends और company holidays अपने आप छूट जाते हैं।",
      },
      steps: [
        {
          text: {
            en: "To count days, choose Between two dates and pick a start and end date. To find a deadline, choose Add working days, pick a start date and type how many working days.",
            hi: "दिन गिनने हों तो Between two dates चुनें और start व end date चुनें। deadline निकालनी हो तो Add working days चुनें, start date चुनें और कितने working days, वो लिखें।",
          },
          shot: { id: "tools-office-working-days", as: "employee", path: "/tools/working-days" },
        },
        {
          text: {
            en: "Read the answer, and open the list to see which days were skipped. Turn on Also skip floating holidays to skip those too.",
            hi: "जवाब देखें, और list खोलकर देखें कौन से दिन छोड़े गए। floating holidays भी छोड़ने हों तो Also skip floating holidays चालू करें।",
          },
        },
      ],
    },
    {
      id: "gst",
      title: { en: "GST Calculator", hi: "GST Calculator - GST जोड़ें या निकालें" },
      intro: {
        en: "Add GST to a price, or take it out of a price that already includes it - with the CGST / SGST or IGST split and the amount in words.",
        hi: "price में GST जोड़ें, या GST वाले price से उसे निकालें - CGST / SGST या IGST के बँटवारे और शब्दों में amount के साथ।",
      },
      steps: [
        {
          text: {
            en: "Choose Add GST (price without tax) or Remove GST (price already includes tax), type the amount, and pick the rate.",
            hi: "Add GST (बिना tax वाला price) या Remove GST (tax वाला price) चुनें, amount लिखें, और rate चुनें।",
          },
          shot: {
            id: "tools-office-gst",
            as: "employee",
            path: "/tools/gst-calculator",
            actions: [{ fill: { css: "#gst-amount" }, value: "25000" }],
          },
        },
        {
          text: {
            en: "Choose Within state (CGST + SGST) or Other state (IGST), then click Copy summary.",
            hi: "Within state (CGST + SGST) या Other state (IGST) चुनें, फिर Copy summary पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "Rates change - always confirm the HSN/SAC rate before you put it on an invoice.",
          hi: "rates बदलते रहते हैं - invoice पर लगाने से पहले HSN/SAC rate ज़रूर confirm करें।",
        },
      ],
    },
    {
      id: "time-zones",
      title: { en: "Time Zone Converter", hi: "Time Zone Converter - दूसरे देशों का समय" },
      intro: {
        en: "See the time for clients abroad and find an hour that works for everyone.",
        hi: "विदेश के clients का समय देखें और ऐसा समय ढूँढें जो सबके लिए ठीक हो।",
      },
      steps: [
        {
          text: {
            en: "Your own time is at the top. Use Add a city to add a client's city, and the X to remove one.",
            hi: "आपका अपना समय सबसे ऊपर है। client का शहर जोड़ने के लिए Add a city, और हटाने के लिए X इस्तेमाल करें।",
          },
          shot: { id: "tools-office-time-zones", as: "employee", path: "/tools/time-zones" },
        },
        {
          text: {
            en: "Pick a city, date and time to see it everywhere else. In the Meeting planner, highlighted hours suit everyone - tap one, then Copy times for your invite.",
            hi: "कोई शहर, तारीख और समय चुनें ताकि बाकी जगहों का समय दिखे। Meeting planner में highlight किए घंटे सबके लिए ठीक हैं - एक पर tap करें, फिर invite के लिए Copy times।",
          },
        },
      ],
    },
    {
      id: "password",
      title: { en: "Password Generator", hi: "Password Generator - मज़बूत password बनाएँ" },
      intro: {
        en: "Create strong, random passwords. Nothing is saved or sent.",
        hi: "मज़बूत, random passwords बनाएँ। कुछ भी save या send नहीं होता।",
      },
      steps: [
        {
          text: {
            en: "Choose Password or Passphrase, set the length and options, and aim for Strong or Very strong on the bar. Click Copy, or Generate again for another.",
            hi: "Password या Passphrase चुनें, length और options सेट करें, और bar पर Strong या Very strong लाएँ। Copy पर क्लिक करें, या दूसरे के लिए Generate again।",
          },
          shot: { id: "tools-office-password", as: "employee", path: "/tools/password-generator" },
        },
        {
          text: {
            en: "Save project passwords in the project's Passwords tab - this page doesn't keep them.",
            hi: "project के passwords project के Passwords tab में save करें - ये पेज उन्हें नहीं रखता।",
          },
        },
      ],
    },
  ],
}
