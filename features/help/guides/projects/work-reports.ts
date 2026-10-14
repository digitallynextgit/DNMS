import { Presentation } from "lucide-react"
import type { HelpGuide } from "../../types"

export const workReportsGuide: HelpGuide = {
  slug: "work-reports",
  group: "projects",
  icon: Presentation,
  href: "/projects/progress",
  title: { en: "Progress Report", hi: "प्रोग्रेस रिपोर्ट (Progress Report)" },
  summary: {
    en: "Download a report of what was worked on, day by day, with hours per project - for any range on Progress, for yourself or your team.",
    hi: "किस दिन क्या काम हुआ और हर प्रोजेक्ट पर कितने घंटे लगे, इसकी रिपोर्ट डाउनलोड करें - Progress पर चुनी गई किसी भी अवधि के लिए, अपने लिए या अपनी टीम के लिए।",
  },
  keywords: [
    "progress report",
    "work report",
    "monthly report",
    "weekly report",
    "report",
    "powerpoint",
    "pptx",
    "pdf",
    "word",
    "docx",
    "hours",
    "timesheet",
    "प्रोग्रेस रिपोर्ट",
    "वर्क रिपोर्ट",
    "मासिक रिपोर्ट",
    "रिपोर्ट",
    "घंटे",
  ],
  sections: [
    {
      id: "own",
      title: { en: "Download a progress report", hi: "प्रोग्रेस रिपोर्ट डाउनलोड करें" },
      intro: {
        en: "The progress report is a button on Progress. It covers exactly what the page shows: the dates in the range box, the project, and the team or person picked below it. It is built from DNMS tasks, the time each task spent In Progress, and attendance.",
        hi: "प्रोग्रेस रिपोर्ट Progress पेज पर एक बटन है। इसमें वही आता है जो पेज दिखा रहा है: रेंज बॉक्स की तारीखें, प्रोजेक्ट, और नीचे चुनी गई टीम या व्यक्ति। ये DNMS tasks, हर task के In Progress में लगे समय, और हाज़िरी से बनती है।",
      },
      steps: [
        {
          text: {
            en: "Open Progress. Pick the dates (1) - This week, or a custom range of up to 92 days - and, if you see them, the project and the team member below.",
            hi: "Progress खोलें। तारीखें (1) चुनें - This week, या 92 दिन तक की कोई भी रेंज - और अगर दिखें, तो नीचे प्रोजेक्ट और टीम मेंबर चुनें।",
          },
          shot: {
            id: "work-reports-own",
            as: "manager",
            path: "/projects/progress",
            actions: [{ click: { role: "button", name: "Progress report" } }],
            highlight: [
              // By css: while the menu is open, Radix hides the rest of the page from role lookups.
              { css: 'button:has-text("This week")' },
              { role: "menuitem", name: "PowerPoint" },
              { role: "menuitem", name: "PDF" },
              { role: "menuitem", name: "Word" },
            ],
          },
        },
        {
          text: {
            en: "Click Progress report, between the dates and Export, then pick PowerPoint (2), PDF (3) or Word (4). The top of the menu says which dates and how many people the report covers. The file downloads after a few seconds.",
            hi: "तारीखों और Export के बीच Progress report पर क्लिक करें, फिर PowerPoint (2), PDF (3) या Word (4) चुनें। मेन्यू के ऊपर लिखा होता है कि रिपोर्ट किन तारीखों और कितने लोगों की है। फ़ाइल कुछ सेकंड में डाउनलोड हो जाती है।",
          },
        },
      ],
      tips: [
        {
          en: "Leave Polish highlights with AI ticked (at the bottom of the menu) to turn rough task titles into plain sentences. It only uses what is in DNMS and adds nothing. If AI isn't available, the report is built without it.",
          hi: "मेन्यू में नीचे Polish highlights with AI पर टिक रहने दें - ये अधूरे-से task टाइटल को साफ़ वाक्यों में बदल देता है। ये सिर्फ़ DNMS में मौजूद जानकारी इस्तेमाल करता है, अपनी तरफ़ से कुछ नहीं जोड़ता। अगर AI उपलब्ध नहीं है, तो रिपोर्ट उसके बिना बनती है।",
        },
        {
          en: "With a project picked, the report only counts that project's tasks and deliverables, and its title names the project.",
          hi: "कोई प्रोजेक्ट चुना हो, तो रिपोर्ट में सिर्फ़ उसी प्रोजेक्ट के tasks और deliverables गिने जाते हैं, और रिपोर्ट के टाइटल में प्रोजेक्ट का नाम होता है।",
        },
      ],
    },
    {
      id: "team",
      title: {
        en: "For managers and HR: report on your team",
        hi: "मैनेजर्स और HR के लिए: टीम की रिपोर्ट",
      },
      intro: {
        en: "With Whole team picked on Progress, the report covers everyone in it; pick one person for just them. With more than one person, the report starts with a team overview, then each person.",
        hi: "Progress पर Whole team चुना हो, तो रिपोर्ट में उसके सब लोग आते हैं; किसी एक व्यक्ति को चुनें, तो सिर्फ़ उसकी। एक से ज़्यादा लोग हों, तो रिपोर्ट पहले पूरी टीम की झलक दिखाती है, फिर हर व्यक्ति की।",
      },
      tips: [
        {
          en: "A progress report includes attendance, so it only covers your reporting line - the people who report to you, and theirs. HR managers, admins and project admins can include anyone. Anyone else Progress shows you is left out, and the menu says how many.",
          hi: "प्रोग्रेस रिपोर्ट में हाज़िरी भी होती है, इसलिए इसमें सिर्फ़ आपकी reporting line आती है - आपको रिपोर्ट करने वाले लोग, और उनको रिपोर्ट करने वाले। HR मैनेजर, एडमिन और प्रोजेक्ट एडमिन किसी को भी शामिल कर सकते हैं। Progress पर दिखने वाले बाकी लोग छोड़ दिए जाते हैं, और मेन्यू बताता है कितने।",
        },
      ],
    },
    {
      id: "inside",
      title: { en: "What's in the report", hi: "रिपोर्ट में क्या होता है" },
      intro: {
        en: "The cover says Weekly progress report for a 7-day range such as This week, and Monthly progress report for a whole month. The report covers the period at a glance, where the hours went, what was delivered, hours by project, what was done each day, and the items still open at the end. It also shows attendance next to project hours.",
        hi: "7 दिन की रेंज (जैसे This week) की रिपोर्ट के कवर पर Weekly progress report और पूरे महीने की रिपोर्ट पर Monthly progress report लिखा होता है। रिपोर्ट में पूरी अवधि की झलक, घंटे कहाँ लगे, क्या डिलीवर हुआ, हर प्रोजेक्ट के घंटे, हर दिन क्या काम हुआ, और आखिर में बाकी रह गए काम होते हैं। इसमें हाज़िरी भी प्रोजेक्ट के घंटों के साथ दिखती है।",
      },
      tips: [
        {
          en: "Hours come from each task's In Progress time, counted within office hours only.",
          hi: "घंटे हर task के In Progress समय से आते हैं, और सिर्फ़ ऑफ़िस के समय में गिने जाते हैं।",
        },
        {
          en: "Weekends, holidays and full-day leave are left out.",
          hi: "वीकेंड, हॉलिडे और पूरे दिन की छुट्टी नहीं गिनी जाती।",
        },
        {
          en: "A task left In Progress overnight counts on the day it started, up to its estimate. Two tasks running at once share the time.",
          hi: "अगर task रात भर In Progress में छूट गया, तो वो उसी दिन गिना जाता है जिस दिन शुरू हुआ, और उसके estimate तक ही। एक साथ चल रहे दो tasks समय आपस में बाँट लेते हैं।",
        },
      ],
      faq: [
        {
          q: {
            en: "My hours look too low. Why?",
            hi: "मेरे घंटे बहुत कम दिख रहे हैं। क्यों?",
          },
          a: {
            en: "Only time a task spends In Progress is counted. Move your task to In Progress when you start and out of it when you stop. For meetings and other work with no client, add an ADHOC task in My Work.",
            hi: "सिर्फ़ वो समय गिना जाता है जब task In Progress में होता है। काम शुरू करते ही task को In Progress करें और रुकते ही उससे बाहर करें। मीटिंग और बिना क्लाइंट वाले काम के लिए My Work में ADHOC task जोड़ें।",
          },
        },
        {
          q: {
            en: "The menu says the range can't be used. Why?",
            hi: "मेन्यू कहता है कि ये रेंज नहीं चलेगी। क्यों?",
          },
          a: {
            en: "A report needs a start and end date, at most 92 days apart, that has already begun. Pick This week, a month, or a shorter custom range.",
            hi: "रिपोर्ट के लिए शुरू और खत्म की तारीख चाहिए, ज़्यादा से ज़्यादा 92 दिन की, और वो अवधि शुरू हो चुकी हो। This week, कोई महीना, या छोटी custom रेंज चुनें।",
          },
        },
      ],
    },
  ],
}
