import { ClipboardCheck } from "lucide-react"
import type { HelpGuide } from "../../types"

export const waitingOnYouGuide: HelpGuide = {
  slug: "waiting-on-you",
  group: "self",
  icon: ClipboardCheck,
  href: "/clearances",
  title: { en: "Waiting on you", hi: "आपके ज़िम्मे के काम (Waiting on you)" },
  summary: {
    en: "Sign off exit clearances and finish the joining or exit checklist tasks that HR has given to you.",
    hi: "Exit clearance पर साइन ऑफ करें, और HR ने जॉइनिंग या एग्ज़िट चेकलिस्ट के जो काम आपको दिए हैं उन्हें पूरा करें।",
  },
  keywords: [
    "clearance",
    "exit",
    "sign off",
    "no dues",
    "handover",
    "onboarding",
    "checklist",
    "relieving",
    "resignation",
    "क्लीयरेंस",
    "एग्ज़िट",
    "साइन ऑफ",
    "हैंडओवर",
    "ऑनबोर्डिंग",
    "चेकलिस्ट",
  ],
  sections: [
    {
      id: "what",
      title: { en: "What is waiting on you", hi: "आपके पास क्या पेंडिंग है" },
      intro: {
        en: "When someone joins or leaves, HR runs a checklist for them. Some items on it are given to you - for example as the person's manager, or as the Finance or IT head who confirms nothing is pending. All such items wait for you here.",
        hi: "जब कोई जॉइन करता है या कंपनी छोड़ता है, तो HR उसके लिए एक चेकलिस्ट चलाता है। उसके कुछ आइटम आपको दिए जाते हैं - जैसे उस व्यक्ति के मैनेजर होने के नाते, या Finance या IT हेड के तौर पर जो कन्फ़र्म करते हैं कि कुछ बाकी नहीं है। ऐसे सारे आइटम यहाँ आपका इंतज़ार करते हैं।",
      },
      steps: [
        {
          text: {
            en: "Click Waiting on you in the sidebar. The red number next to it is how many items are still open for you.",
            hi: "साइडबार में Waiting on you पर क्लिक करें। उसके आगे का लाल नंबर बताता है कि आपके कितने आइटम अभी खुले हैं।",
          },
        },
        {
          text: {
            en: "Clearance sign-offs (1) come first. They are for people who are leaving - their relieving letter can't be issued until every one is signed. Tasks (2) are the other checklist items, like training a new joiner.",
            hi: "Clearance sign-offs (1) सबसे ऊपर आते हैं। ये कंपनी छोड़ने वाले लोगों के लिए हैं - जब तक हर एक पर साइन न हो, उनका relieving letter जारी नहीं हो सकता। Tasks (2) चेकलिस्ट के बाकी काम हैं, जैसे किसी नए व्यक्ति को ट्रेनिंग देना।",
          },
          shot: {
            id: "waiting-on-you-list",
            as: "manager",
            path: "/clearances",
            highlight: [
              { role: "heading", name: "Clearance sign-offs" },
              { role: "heading", name: "Tasks" },
            ],
          },
        },
        {
          text: {
            en: "Each row shows what to do, who it is for, whether it is an Exit clearance or Onboarding, and the due date. A grey line under some items explains what to check.",
            hi: "हर लाइन में दिखता है कि क्या करना है, किसके लिए है, वो Exit clearance है या Onboarding, और ड्यू डेट। कुछ आइटम के नीचे एक हल्की लाइन बताती है कि क्या चेक करना है।",
          },
        },
      ],
      tips: [
        {
          en: "If you are the one leaving, your own handover tasks, like Prepare handover document, show up here too.",
          hi: "अगर कंपनी आप छोड़ रहे हैं, तो आपके अपने हैंडओवर वाले काम, जैसे Prepare handover document, भी यहीं दिखते हैं।",
        },
        {
          en: "HR staff can click the person's name on a row to open their full checklist.",
          hi: "HR वाले किसी लाइन पर व्यक्ति के नाम पर क्लिक करके उसकी पूरी चेकलिस्ट खोल सकते हैं।",
        },
      ],
    },
    {
      id: "sign-off",
      title: { en: "Sign off a clearance", hi: "क्लीयरेंस पर साइन ऑफ करें" },
      steps: [
        {
          text: {
            en: "First check that nothing is pending from your side for that person - for example, the laptop is returned, dues are settled, or the handover is done.",
            hi: "पहले चेक करें कि उस व्यक्ति का आपकी तरफ़ से कुछ बाकी नहीं है - जैसे लैपटॉप वापस आ गया, बकाया पैसे निपट गए, या हैंडओवर हो गया।",
          },
        },
        {
          text: {
            en: "Click Sign off on the row. In the Sign this clearance box, add a Note (1) if there is something worth recording, like an asset tag or a settled amount - it is optional. Then click Sign off (2).",
            hi: "उस लाइन पर Sign off पर क्लिक करें। Sign this clearance बॉक्स में, अगर कुछ लिखकर रखना ज़रूरी हो तो Note (1) में लिखें, जैसे asset tag या निपटाई गई रकम - यह ज़रूरी नहीं है। फिर Sign off (2) पर क्लिक करें।",
          },
          shot: {
            id: "waiting-on-you-sign-off",
            as: "manager",
            path: "/clearances",
            actions: [{ click: { role: "button", name: "Sign off", nth: 0 } }],
            highlight: [{ label: "Note (optional)" }, { role: "button", name: "Sign off" }],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "The item leaves your list, and HR sees it as signed.",
            hi: "आइटम आपकी लिस्ट से हट जाता है, और HR को वो साइन हुआ दिखता है।",
          },
        },
      ],
    },
    {
      id: "tasks",
      title: { en: "Finish a task", hi: "कोई काम पूरा करें" },
      steps: [
        {
          text: {
            en: "When you have done a task, click Mark done (1). It is ticked off straight away and leaves your list.",
            hi: "काम पूरा होने पर Mark done (1) पर क्लिक करें। वो तुरंत पूरा मान लिया जाता है और आपकी लिस्ट से हट जाता है।",
          },
          shot: {
            id: "waiting-on-you-mark-done",
            as: "manager",
            path: "/clearances",
            highlight: [{ role: "button", name: "Mark done" }],
          },
        },
      ],
      faq: [
        {
          q: {
            en: "I marked something done by mistake. Can I undo it?",
            hi: "गलती से कुछ Mark done हो गया। क्या वापस कर सकते हैं?",
          },
          a: {
            en: "Not from this page. Ask HR - they can untick it on the person's checklist.",
            hi: "इस पेज से नहीं। HR से कहें - वो उस व्यक्ति की चेकलिस्ट में उसे फिर से खोल सकते हैं।",
          },
        },
        {
          q: {
            en: "The page says Nothing is waiting on you. Is that right?",
            hi: "पेज पर Nothing is waiting on you लिखा है। क्या यह ठीक है?",
          },
          a: {
            en: "Yes. Items only appear when HR starts a joining or exit checklist that has something for you. Most days this page is empty.",
            hi: "हाँ। आइटम तभी आते हैं जब HR कोई जॉइनिंग या एग्ज़िट चेकलिस्ट शुरू करता है जिसमें आपके लिए कोई काम हो। ज़्यादातर दिनों में यह पेज खाली रहता है।",
          },
        },
        {
          q: {
            en: "Why was this item given to me?",
            hi: "यह आइटम मुझे ही क्यों दिया गया?",
          },
          a: {
            en: "HR's checklist decides it. Manager items go to the person's reporting manager, and department items go to that department's head. If it should be someone else, tell HR - they can reassign it.",
            hi: "यह HR की चेकलिस्ट तय करती है। मैनेजर वाले आइटम उस व्यक्ति के रिपोर्टिंग मैनेजर को जाते हैं, और डिपार्टमेंट वाले आइटम उस डिपार्टमेंट के हेड को। अगर यह किसी और का काम है, तो HR को बताएँ - वो इसे किसी और को दे सकते हैं।",
          },
        },
      ],
    },
  ],
}
