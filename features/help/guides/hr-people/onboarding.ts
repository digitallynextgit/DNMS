import { ClipboardCheck } from "lucide-react"
import type { HelpAction, HelpGuide } from "../../types"

// Rahul Das (DM013) - the demo new joinee with an onboarding checklist and a
// 15-day scorecard in progress.
const RAHUL_PROFILE = "/employees/DM013-rahul-das"
/** From /onboarding: open Rahul's checklist (its id is not known ahead of time). */
const OPEN_RAHUL_CHECKLIST: HelpAction[] = [
  { click: { role: "button", name: "Rahul Das" } },
  { waitFor: { role: "button", name: "Complete", exact: true } },
]
/** On Rahul's profile: open the 15-Day Scorecard tab. */
const OPEN_RAHUL_SCORECARD: HelpAction[] = [
  { click: { role: "tab", name: "15-Day Scorecard" } },
  { waitFor: { text: "15-Day New Joinee Scorecard" } },
]

export const onboardingGuide: HelpGuide = {
  slug: "onboarding",
  group: "hr",
  icon: ClipboardCheck,
  href: "/onboarding",
  title: { en: "Onboarding", hi: "ऑनबोर्डिंग (Onboarding)" },
  summary: {
    en: "Follow every new joiner's checklist from the week before they start to their first-month review, and score their first 15 working days.",
    hi: "हर नए joiner की checklist को जॉइनिंग से पहले वाले हफ्ते से लेकर पहले महीने के review तक फॉलो करें, और उनके पहले 15 वर्किंग डेज़ को स्कोर करें।",
  },
  keywords: [
    "onboarding",
    "new joinee",
    "joiner",
    "checklist",
    "induction",
    "scorecard",
    "15 day",
    "review",
    "ऑनबोर्डिंग",
    "नया कर्मचारी",
    "चेकलिस्ट",
    "स्कोरकार्ड",
  ],
  sections: [
    {
      id: "list",
      title: { en: "See everyone who is onboarding", hi: "देखें कौन-कौन ऑनबोर्ड हो रहा है" },
      intro: {
        en: "You don't have to start a checklist yourself. One is created automatically the moment an employee is added in DNMS.",
        hi: "Checklist आपको खुद शुरू नहीं करनी पड़ती। DNMS में employee जोड़ते ही उसकी checklist अपने आप बन जाती है।",
      },
      steps: [
        {
          text: {
            en: "Click Onboarding in the sidebar. The In progress tab (1) lists every open checklist with its progress bar and the joining date. Completed and All show the finished ones too.",
            hi: "साइडबार में Onboarding पर क्लिक करें। In progress टैब (1) में हर खुली checklist, उसकी progress bar और जॉइनिंग की तारीख के साथ दिखती है। Completed और All में पूरी हो चुकी checklists भी दिखती हैं।",
          },
          shot: {
            id: "onboarding-list",
            as: "hr",
            path: "/onboarding",
            highlight: [
              { role: "tab", name: "In progress" },
              { placeholder: "Search name or number" },
              { role: "button", name: "Rahul Das" },
            ],
          },
        },
        {
          text: {
            en: "Search by name or employee number (2), then click a person (3) to open their checklist.",
            hi: "नाम या employee number से सर्च करें (2), फिर किसी व्यक्ति (3) पर क्लिक करके उनकी checklist खोलें।",
          },
        },
      ],
    },
    {
      id: "checklist",
      title: { en: "Work through a checklist", hi: "Checklist पूरी करें" },
      steps: [
        {
          text: {
            en: "The checklist is split into the steps of the company's onboarding process (1), from To-do Before Joining to Step 6. First Month Milestones.",
            hi: "Checklist कंपनी के onboarding process के स्टेप्स (1) में बँटी होती है, To-do Before Joining से लेकर Step 6. First Month Milestones तक।",
          },
          shot: {
            id: "onboarding-checklist",
            as: "hr",
            path: "/onboarding",
            actions: OPEN_RAHUL_CHECKLIST,
            highlight: [
              { role: "heading", name: "Step 1. Documentation" },
              { role: "checkbox", name: "Collect personal documents" },
            ],
          },
        },
        {
          text: {
            en: "Under each item you can see who owns it - HR, or a person's name such as the manager - and when it is due. The tag on the right says Pending, Overdue or Done.",
            hi: "हर आइटम के नीचे दिखता है कि वो किसका काम है - HR, या किसी व्यक्ति का नाम जैसे मैनेजर - और वो कब तक करना है। दाईं ओर का टैग Pending, Overdue या Done बताता है।",
          },
        },
        {
          text: {
            en: "Tick the box next to an item (2) once it is done. DNMS notes who ticked it and when. Ticked the wrong one? Just untick it.",
            hi: "कोई आइटम हो जाए तो उसके बगल वाला बॉक्स (2) टिक करें। DNMS नोट करता है कि किसने और कब टिक किया। गलत आइटम टिक हो गया? बस टिक हटा दें।",
          },
        },
        {
          text: {
            en: "Items owned by the manager also show on the manager's own Waiting on you page, so they can tick them from there.",
            hi: "मैनेजर वाले आइटम मैनेजर के अपने Waiting on you पेज पर भी दिखते हैं, ताकि वो वहीं से टिक कर सकें।",
          },
        },
      ],
      tips: [
        {
          en: "Due dates are counted from the joining date, so the To-do Before Joining items fall due a few days before day one.",
          hi: "Due dates जॉइनिंग की तारीख से गिनी जाती हैं, इसलिए To-do Before Joining वाले आइटम पहले दिन से कुछ दिन पहले due होते हैं।",
        },
        {
          en: "Items marked optional don't have to be ticked.",
          hi: "जिन आइटम पर optional लिखा है, उन्हें टिक करना ज़रूरी नहीं।",
        },
      ],
    },
    {
      id: "complete",
      title: { en: "Complete or cancel the onboarding", hi: "Onboarding पूरी करें या कैंसल करें" },
      steps: [
        {
          text: {
            en: "When the first month is over, click Complete (1) at the top, then Complete again to confirm. If some items are still open you can complete anyway - they stay unticked on the record.",
            hi: "पहला महीना पूरा होने पर ऊपर Complete (1) पर क्लिक करें, फिर कन्फर्म करने के लिए दोबारा Complete पर। अगर कुछ आइटम अभी भी बाकी हैं तो भी complete कर सकते हैं - वो रिकॉर्ड पर बिना टिक के रहेंगे।",
          },
          shot: {
            id: "onboarding-complete",
            as: "hr",
            path: "/onboarding",
            actions: OPEN_RAHUL_CHECKLIST,
            highlight: [
              { role: "button", name: "Complete", exact: true },
              { role: "button", name: "Cancel", exact: true },
            ],
          },
        },
        {
          text: {
            en: "If the person never actually joined, click Cancel (2), then Cancel checklist. The record is kept and marked Cancelled.",
            hi: "अगर व्यक्ति ने असल में जॉइन ही नहीं किया, तो Cancel (2) पर क्लिक करें, फिर Cancel checklist पर। रिकॉर्ड रहता है और Cancelled मार्क हो जाता है।",
          },
        },
      ],
      tips: [
        {
          en: "A completed or cancelled checklist is closed - its boxes can't be ticked any more.",
          hi: "Complete या cancel हुई checklist बंद हो जाती है - उसके बॉक्स फिर टिक नहीं हो सकते।",
        },
      ],
    },
    {
      id: "scorecard",
      title: { en: "The 15-day joinee scorecard", hi: "नए joinee का 15-day scorecard" },
      intro: {
        en: "Every new joiner gets a scorecard for their first 15 working days. You'll find it at the bottom of their onboarding page, and on the 15-Day Scorecard tab of their profile.",
        hi: "हर नए joiner का पहले 15 वर्किंग डेज़ के लिए एक scorecard होता है। ये उनके onboarding पेज में सबसे नीचे, और उनकी प्रोफाइल के 15-Day Scorecard टैब पर मिलता है।",
      },
      steps: [
        {
          text: {
            en: "Each row is one working day. The Manager columns (1) score understanding of the job role, communication and learning. The HR columns (2) score discipline and attendance, culture and adaptability. DNMS works out the Average columns for you.",
            hi: "हर लाइन एक वर्किंग डे है। Manager वाले कॉलम (1) में job role की समझ, communication और learning के नंबर होते हैं। HR वाले कॉलम (2) में discipline और attendance, culture और adaptability के नंबर होते हैं। Average वाले कॉलम DNMS खुद निकालता है।",
          },
          shot: {
            id: "onboarding-scorecard",
            as: "hr",
            path: RAHUL_PROFILE,
            actions: OPEN_RAHUL_SCORECARD,
            highlight: [
              { role: "button", name: "Day 1 - Manager: Understanding of Job Role" },
              { role: "button", name: "Day 1 - HR: Discipline & Attendance" },
            ],
          },
        },
        {
          text: {
            en: "To give a score, click a box and pick a number (1) from 1 (Unsatisfactory) to 5 (Excellent). To change it, click the box again; Clear score empties it.",
            hi: "नंबर देने के लिए किसी बॉक्स पर क्लिक करें और 1 (Unsatisfactory) से 5 (Excellent) तक कोई नंबर (1) चुनें। बदलना हो तो बॉक्स पर दोबारा क्लिक करें; Clear score से वो खाली हो जाता है।",
          },
          shot: {
            id: "onboarding-scorecard-pick",
            as: "hr",
            path: RAHUL_PROFILE,
            actions: [
              ...OPEN_RAHUL_SCORECARD,
              { click: { role: "button", name: "Day 2 - HR: Culture & Collaboration" } },
            ],
            highlight: [{ role: "dialog" }],
          },
        },
        {
          text: {
            en: "Below the grid, the 15-day summary shows the manager average, the HR average, the overall score and the rating. Then write the Manager - key observations and HR - key observations, and click Save under each box.",
            hi: "ग्रिड के नीचे 15-day summary में manager average, HR average, overall score और rating दिखते हैं। फिर Manager - key observations और HR - key observations लिखें, और हर बॉक्स के नीचे Save पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "At the end, pick the 15-day HR recommendation: Continue as planned, Continue with specific improvement areas, or Review required.",
            hi: "आखिर में 15-day HR recommendation चुनें: Continue as planned, Continue with specific improvement areas, या Review required।",
          },
        },
        {
          text: {
            en: "To choose the HR person looking after this joiner, click the pencil next to HR SPOC at the top, pick them and save.",
            hi: "इस joiner को देखने वाले HR व्यक्ति को चुनने के लिए ऊपर HR SPOC के बगल में पेंसिल पर क्लिक करें, उन्हें चुनें और सेव करें।",
          },
        },
      ],
      tips: [
        {
          en: "Only people who can manage onboarding - HR managers and admins - can fill in the scorecard. That includes the manager's columns, so HR enters the manager's scores too.",
          hi: "Scorecard सिर्फ वही भर सकते हैं जो onboarding मैनेज कर सकते हैं - HR managers और admins। इसमें manager वाले कॉलम भी शामिल हैं, इसलिए manager के नंबर भी HR ही डालता है।",
        },
        {
          en: "The employee can see their own scorecard on the 15-Day Scorecard tab of My Profile, but can't change it.",
          hi: "Employee अपना scorecard My Profile के 15-Day Scorecard टैब पर देख सकता है, लेकिन बदल नहीं सकता।",
        },
        {
          en: "No scorecard yet, for example for someone added before scorecards existed? Open their profile's 15-Day Scorecard tab and click Start scorecard.",
          hi: "Scorecard नहीं बना है, जैसे किसी ऐसे व्यक्ति का जो scorecard आने से पहले जोड़ा गया था? उनकी प्रोफाइल का 15-Day Scorecard टैब खोलें और Start scorecard पर क्लिक करें।",
        },
      ],
      faq: [
        {
          q: {
            en: "Can I start a scorecard again from scratch?",
            hi: "क्या scorecard को फिर से शुरू से बना सकते हैं?",
          },
          a: {
            en: "Yes. Click the three-dot button at the top of the scorecard and pick Delete scorecard. This deletes every score and note, and you can then click Start scorecard.",
            hi: "हाँ। Scorecard के ऊपर तीन डॉट वाले बटन पर क्लिक करें और Delete scorecard चुनें। इससे सारे नंबर और नोट्स delete हो जाते हैं, फिर आप Start scorecard पर क्लिक कर सकते हैं।",
          },
        },
      ],
    },
  ],
}
