import { Presentation } from "lucide-react"
import type { HelpGuide } from "../../types"

export const workReportsGuide: HelpGuide = {
  slug: "work-reports",
  group: "projects",
  icon: Presentation,
  href: "/work-reports",
  title: { en: "Work Report", hi: "वर्क रिपोर्ट (Work Report)" },
  summary: {
    en: "Download a month-end report of what was worked on, day by day, with hours per project - for yourself, or for your team.",
    hi: "महीने के आखिर की रिपोर्ट डाउनलोड करें - किस दिन क्या काम हुआ और हर प्रोजेक्ट पर कितने घंटे लगे - अपने लिए, या अपनी टीम के लिए।",
  },
  keywords: [
    "work report",
    "monthly report",
    "report",
    "powerpoint",
    "pptx",
    "pdf",
    "word",
    "docx",
    "hours",
    "timesheet",
    "वर्क रिपोर्ट",
    "मासिक रिपोर्ट",
    "रिपोर्ट",
    "घंटे",
  ],
  sections: [
    {
      id: "own",
      title: { en: "Download your own report", hi: "अपनी रिपोर्ट डाउनलोड करें" },
      intro: {
        en: "The report is built from your DNMS tasks, the time each task spent In Progress, and your attendance. Everyone can download their own.",
        hi: "रिपोर्ट आपके DNMS tasks, हर task के In Progress में लगे समय, और आपकी हाज़िरी से बनती है। हर कोई अपनी रिपोर्ट डाउनलोड कर सकता है।",
      },
      steps: [
        {
          text: {
            en: "Click Work Report in the sidebar. Under Month, it starts on last month. Use the arrows (1) to change the month. On the current month it says Month to date.",
            hi: "साइडबार में Work Report पर क्लिक करें। Month में पिछला महीना पहले से चुना होता है। महीना बदलने के लिए तीर (1) इस्तेमाल करें। चालू महीने पर Month to date लिखा आता है।",
          },
          shot: {
            id: "work-reports-own",
            as: "employee",
            path: "/work-reports",
            highlight: [
              { role: "button", name: "Previous month" },
              { role: "button", name: "PowerPoint" },
              { role: "button", name: "PDF" },
              { role: "button", name: "Word" },
            ],
          },
        },
        {
          text: {
            en: "Under Download as, click PowerPoint (2), PDF (3) or Word (4). The report is built and the file downloads. It can take a few seconds.",
            hi: "Download as में PowerPoint (2), PDF (3) या Word (4) पर क्लिक करें। रिपोर्ट बनती है और फ़ाइल डाउनलोड हो जाती है। इसमें कुछ सेकंड लग सकते हैं।",
          },
        },
      ],
      tips: [
        {
          en: "If you see Polish highlights with AI, leave it ticked to turn rough task titles into plain sentences. It only uses what is in DNMS and adds nothing. If AI isn't available, the report is built without it.",
          hi: "अगर Polish highlights with AI दिख रहा है, तो उसे टिक रहने दें - ये अधूरे-से task टाइटल को साफ़ वाक्यों में बदल देता है। ये सिर्फ़ DNMS में मौजूद जानकारी इस्तेमाल करता है, अपनी तरफ़ से कुछ नहीं जोड़ता। अगर AI उपलब्ध नहीं है, तो रिपोर्ट उसके बिना बनती है।",
        },
      ],
    },
    {
      id: "team",
      title: {
        en: "For managers and HR: report on other people",
        hi: "मैनेजर्स और HR के लिए: दूसरों की रिपोर्ट",
      },
      intro: {
        en: "If people report to you, you can include them - your whole reporting line, including people who report to your reports. HR managers, admins and project admins can pick anyone in the company.",
        hi: "अगर लोग आपको रिपोर्ट करते हैं, तो आप उन्हें भी शामिल कर सकते हैं - आपकी पूरी reporting line, उनको रिपोर्ट करने वाले लोग भी। HR मैनेजर, एडमिन और प्रोजेक्ट एडमिन कंपनी में किसी को भी चुन सकते हैं।",
      },
      steps: [
        {
          text: {
            en: "Under Who, pick Just me (1), My team (2) - you plus everyone who reports to you - or Choose people (3).",
            hi: "Who में Just me (1), My team (2) - आप और आपको रिपोर्ट करने वाले सब लोग - या Choose people (3) चुनें।",
          },
          shot: {
            id: "work-reports-who",
            as: "manager",
            path: "/work-reports",
            actions: [{ click: { role: "tab", name: "Choose people" } }],
            highlight: [
              { role: "tab", name: "Just me" },
              { role: "tab", name: "My team" },
              { role: "tab", name: "Choose people" },
              { role: "button", name: "Nobody selected yet" },
            ],
          },
        },
        {
          text: {
            en: "With Choose people, click the People box (4) and tick everyone you want. Click Clear in the list to start again.",
            hi: "Choose people में People बॉक्स (4) पर क्लिक करें और जिन्हें चाहिए उन पर टिक करें। दोबारा शुरू करने के लिए लिस्ट में Clear पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "The line under the picker says how many people are in the report. With more than one person, the report starts with a team overview, then each person.",
            hi: "picker के नीचे की लाइन बताती है कि रिपोर्ट में कितने लोग हैं। एक से ज़्यादा लोग हों, तो रिपोर्ट पहले पूरी टीम की झलक दिखाती है, फिर हर व्यक्ति की।",
          },
        },
        {
          text: {
            en: "Pick the Month and click PowerPoint, PDF or Word as usual.",
            hi: "Month चुनें और हमेशा की तरह PowerPoint, PDF या Word पर क्लिक करें।",
          },
        },
      ],
    },
    {
      id: "inside",
      title: { en: "What's in the report", hi: "रिपोर्ट में क्या होता है" },
      intro: {
        en: "The report covers the month at a glance, where the hours went, what was delivered, hours by project, what was done each day, and the open items carried into next month. It also shows attendance next to project hours.",
        hi: "रिपोर्ट में महीने की झलक, घंटे कहाँ लगे, क्या डिलीवर हुआ, हर प्रोजेक्ट के घंटे, हर दिन क्या काम हुआ, और अगले महीने में जाने वाले बाकी काम होते हैं। इसमें हाज़िरी भी प्रोजेक्ट के घंटों के साथ दिखती है।",
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
            en: "Only time a task spends In Progress is counted. Move your task to In Progress when you start and out of it when you stop. For meetings and other work with no client, add an ADHOC task in My Tasks.",
            hi: "सिर्फ़ वो समय गिना जाता है जब task In Progress में होता है। काम शुरू करते ही task को In Progress करें और रुकते ही उससे बाहर करें। मीटिंग और बिना क्लाइंट वाले काम के लिए My Tasks में ADHOC task जोड़ें।",
          },
        },
        {
          q: {
            en: "I can't see the Who choice. Why?",
            hi: "मुझे Who वाला विकल्प क्यों नहीं दिख रहा?",
          },
          a: {
            en: "Who only appears if people report to you, or if you are an HR manager, an admin or a project admin. Everyone else gets their own report.",
            hi: "Who सिर्फ़ तब दिखता है जब लोग आपको रिपोर्ट करते हों, या आप HR मैनेजर, एडमिन या प्रोजेक्ट एडमिन हों। बाकी सबको सिर्फ़ अपनी रिपोर्ट मिलती है।",
          },
        },
      ],
    },
  ],
}
