import { Star } from "lucide-react"
import type { HelpAction, HelpGuide } from "../../types"

/** Employee persona: open the evaluation still waiting for their self-evaluation. */
const openSelfEvaluation: HelpAction[] = [
  { click: { role: "link", name: "Fill self-evaluation" } },
  { waitFor: { role: "button", name: "Submit Self-evaluation" } },
]

/** Manager persona: open the To Review tab, then a report whose self-evaluation is in. */
const openTeamReview: HelpAction[] = [
  { click: { role: "tab", name: "To Review" } },
  { click: { css: "tr:has-text('Ananya Gupta'):has-text('Give rating') a" } },
  { waitFor: { role: "button", name: "Submit Manager review" } },
]

export const myPerformanceGuide: HelpGuide = {
  slug: "my-performance",
  group: "self",
  icon: Star,
  href: "/performance/me",
  title: { en: "My Performance", hi: "मेरा परफॉर्मेंस (My Performance)" },
  summary: {
    en: "Fill your self-evaluation, see your manager's review and your final score, and - if people report to you - rate your team.",
    hi: "अपना self-evaluation भरें, अपने मैनेजर का रिव्यू और फाइनल स्कोर देखें, और अगर लोग आपको रिपोर्ट करते हैं तो अपनी टीम को रेटिंग दें।",
  },
  keywords: [
    "performance",
    "evaluation",
    "self evaluation",
    "appraisal",
    "review",
    "rating",
    "score",
    "scorecard",
    "kpi",
    "increment",
    "promotion",
    "परफॉर्मेंस",
    "मूल्यांकन",
    "रेटिंग",
    "अप्रेज़ल",
    "स्कोर",
  ],
  sections: [
    {
      id: "your-evaluations",
      title: { en: "How evaluations work", hi: "evaluation कैसे काम करता है" },
      intro: {
        en: "For each review period, an evaluation (a scorecard) is opened for you and you get a notification. You rate yourself, and your manager rates you separately. Your final score is your manager's score - your own ratings sit next to it so you can compare.",
        hi: "हर रिव्यू पीरियड के लिए आपका एक evaluation (स्कोरकार्ड) खुलता है और आपको नोटिफिकेशन मिलता है। आप खुद को रेटिंग देते हैं, और आपका मैनेजर अलग से आपको रेटिंग देता है। आपका फाइनल स्कोर मैनेजर का स्कोर होता है - आपकी अपनी रेटिंग तुलना के लिए उसके साथ दिखती है।",
      },
      steps: [
        {
          text: {
            en: "Click My Performance in the sidebar. The My Evaluations tab (1) lists your scorecards, one row per Period.",
            hi: "साइडबार में My Performance पर क्लिक करें। My Evaluations टैब (1) में आपके स्कोरकार्ड दिखते हैं, हर Period की एक लाइन।",
          },
          shot: {
            id: "my-performance-list",
            as: "employee",
            path: "/performance/me",
            highlight: [
              { role: "tab", name: "My Evaluations" },
              { css: "th:text-is('Final score')" },
              // The period filter: a Radix Select trigger (<button role="combobox">,
              // no accessible name) whose value reads "All periods".
              { css: 'button[role="combobox"]:has-text("All periods")' },
              { role: "link", name: "Fill self-evaluation" },
            ],
          },
        },
        {
          text: {
            en: "Self shows whether you have submitted your part. Manager shows your manager's name and whether they have Reviewed it yet. Final score (2) appears once your manager has submitted.",
            hi: "Self बताता है कि आपने अपना हिस्सा सबमिट किया या नहीं। Manager में आपके मैनेजर का नाम और ये दिखता है कि उन्होंने Reviewed किया या नहीं। Final score (2) तब दिखता है जब मैनेजर अपना रिव्यू सबमिट कर दे।",
          },
        },
        {
          text: {
            en: "Status goes from Pending, to Self done or Manager done when one side has submitted, to Completed when both have. To show just one period or one status, use All periods (3) or All statuses next to it. The button at the end of a row (4) opens that evaluation.",
            hi: "Status पहले Pending होता है, फिर किसी एक के सबमिट करने पर Self done या Manager done, और दोनों के सबमिट करने पर Completed। सिर्फ एक पीरियड या एक स्टेटस देखने के लिए All periods (3) या उसके बगल वाला All statuses इस्तेमाल करें। लाइन के आखिर वाला बटन (4) वो evaluation खोलता है।",
          },
        },
      ],
    },
    {
      id: "self-evaluation",
      title: { en: "Fill your self-evaluation", hi: "अपना self-evaluation भरें" },
      steps: [
        {
          text: {
            en: "On My Evaluations, click Fill self-evaluation on the row for the period. After you submit, this button says Open instead.",
            hi: "My Evaluations में, उस पीरियड की लाइन पर Fill self-evaluation पर क्लिक करें। सबमिट करने के बाद इस बटन पर Open लिखा आता है।",
          },
        },
        {
          text: {
            en: "Your scorecard is the Self-Evaluation panel (1). Rate every line from 1 to 5 by clicking a number (2). Hover over a number to see what it means: 1 Unacceptable, 2 Needs Improvement, 3 Meets Expectation, 4 Exceeds Expectation, 5 Outstanding.",
            hi: "आपका स्कोरकार्ड Self-Evaluation पैनल (1) है। हर लाइन को 1 से 5 तक रेटिंग दें - किसी नंबर (2) पर क्लिक करें। नंबर पर माउस ले जाने से उसका मतलब दिखता है: 1 Unacceptable, 2 Needs Improvement, 3 Meets Expectation, 4 Exceeds Expectation, 5 Outstanding।",
          },
          shot: {
            id: "my-performance-self-form",
            as: "employee",
            path: "/performance/me",
            actions: [...openSelfEvaluation, { click: { role: "button", name: "4", exact: true } }],
            // The top of the panel: its heading and the first line's ratings.
            highlight: [
              { text: "Self-Evaluation", exact: true },
              { role: "button", name: "4", exact: true },
            ],
          },
        },
        {
          text: {
            en: "The lines come in two groups: Role Performance (KRA & KPI) counts for 60% of the score, and Workplace Discipline & Execution Effectiveness for 40%. Each line shows its weight, the points you get on it appear on the right, and the panel's Total is out of 100.",
            hi: "लाइनें दो ग्रुप में होती हैं: Role Performance (KRA & KPI) का स्कोर में 60% हिस्सा है, और Workplace Discipline & Execution Effectiveness का 40%। हर लाइन के नीचे उसका वेटेज लिखा होता है, उस पर मिले पॉइंट दाईं ओर दिखते हैं, और पैनल का Total 100 में से होता है।",
          },
        },
        {
          text: {
            en: "Below the panels, if you want to tell your manager something, write it in the comments box (1). This is optional.",
            hi: "पैनल्स के नीचे, अगर मैनेजर को कुछ बताना है, तो कमेंट बॉक्स (1) में लिखें। ये ज़रूरी नहीं है।",
          },
          shot: {
            id: "my-performance-self-submit",
            as: "employee",
            path: "/performance/me",
            actions: [
              ...openSelfEvaluation,
              {
                fill: { role: "textbox", name: "Optional notes" },
                value: "I would like to take on more client work next quarter.",
              },
            ],
            // The bottom of the page: the comments box and the submit button.
            highlight: [
              { role: "textbox", name: "Optional notes" },
              { role: "button", name: "Submit Self-evaluation" },
            ],
          },
        },
        {
          text: {
            en: "When every line has a rating, click Submit Self-evaluation (2). Your manager gets a notification.",
            hi: "जब हर लाइन को रेटिंग मिल जाए, तो Submit Self-evaluation (2) पर क्लिक करें। आपके मैनेजर को नोटिफिकेशन चला जाता है।",
          },
        },
      ],
      tips: [
        {
          en: "The Submit button stays grey until every line has a rating. The note Rate every item to submit means something is still missing.",
          hi: "जब तक हर लाइन को रेटिंग न मिले, Submit बटन ग्रे रहता है। Rate every item to submit लिखा दिखे तो समझिए कोई लाइन छूट गई है।",
        },
        {
          en: "Your ratings are not saved until you submit. If you leave the page before that, you will have to rate again.",
          hi: "सबमिट करने से पहले आपकी रेटिंग सेव नहीं होती। अगर उससे पहले पेज छोड़ दिया, तो दोबारा रेटिंग देनी होगी।",
        },
        {
          en: "Check your ratings before you submit - after that you can't change them.",
          hi: "सबमिट करने से पहले अपनी रेटिंग जाँच लें - उसके बाद उन्हें बदला नहीं जा सकता।",
        },
      ],
    },
    {
      id: "results",
      title: {
        en: "See your manager's review and score",
        hi: "मैनेजर का रिव्यू और अपना स्कोर देखें",
      },
      steps: [
        {
          text: {
            en: "When your manager submits their review, you get a notification. Open the evaluation from My Evaluations by clicking Open.",
            hi: "जब आपका मैनेजर अपना रिव्यू सबमिट करता है, तो आपको नोटिफिकेशन मिलता है। My Evaluations में Open पर क्लिक करके evaluation खोलें।",
          },
        },
        {
          text: {
            en: "Final Score (1) at the top is your score out of 100. The label next to it shows your score band and what it means for you, for example Eligible for Increment only.",
            hi: "ऊपर Final Score (1) आपका 100 में से स्कोर है। उसके बगल का लेबल आपका स्कोर बैंड और उसका नतीजा बताता है, जैसे Eligible for Increment only।",
          },
          shot: {
            id: "my-performance-result",
            as: "employee",
            path: "/performance/me",
            actions: [
              { click: { role: "link", name: "Open", exact: true } },
              { waitFor: { text: "Final Score", exact: true } },
            ],
            highlight: [
              { text: "Final Score", exact: true },
              { text: "Manager Evaluation", exact: true },
              { role: "button", name: "Print / Save PDF" },
            ],
          },
        },
        {
          text: {
            en: "The Manager Evaluation panel (2) shows your manager's rating for each line and their comment. Until they submit, it says Awaiting submission and you can't see their ratings.",
            hi: "Manager Evaluation पैनल (2) में हर लाइन पर मैनेजर की रेटिंग और उनका कमेंट दिखता है। जब तक वो सबमिट न करें, वहाँ Awaiting submission लिखा रहता है और उनकी रेटिंग आपको नहीं दिखती।",
          },
        },
        {
          text: {
            en: "To keep a copy, click Print / Save PDF (3) and pick Save as PDF in the print window.",
            hi: "कॉपी रखनी है तो Print / Save PDF (3) पर क्लिक करें और प्रिंट विंडो में Save as PDF चुनें।",
          },
        },
        {
          text: {
            en: "At the bottom of My Performance, the Performance rating scale (1) lists every score range with its rating and outcome. The band of your latest score is marked You (2).",
            hi: "My Performance पेज के नीचे Performance rating scale (1) में हर स्कोर रेंज, उसकी रेटिंग और उसका नतीजा लिखा है। आपके पिछले स्कोर वाले बैंड पर You (2) लिखा होता है।",
          },
          shot: {
            id: "my-performance-scale",
            as: "employee",
            path: "/performance/me",
            highlight: [{ text: "Performance rating scale" }, { text: "· You" }],
          },
        },
      ],
      faq: [
        {
          q: {
            en: "Can my manager see my self-evaluation?",
            hi: "क्या मेरा मैनेजर मेरा self-evaluation देख सकता है?",
          },
          a: {
            en: "Yes, once you submit it. It shows next to their own scorecard.",
            hi: "हाँ, आपके सबमिट करने के बाद। वो उनके अपने स्कोरकार्ड के बगल में दिखता है।",
          },
        },
        {
          q: {
            en: "Why is my Final Score different from my own Total?",
            hi: "मेरा Final Score मेरे अपने Total से अलग क्यों है?",
          },
          a: {
            en: "The final score is your manager's score only. Your self-score is there so you can both compare.",
            hi: "फाइनल स्कोर सिर्फ मैनेजर का स्कोर होता है। आपका अपना स्कोर तुलना के लिए दिखाया जाता है।",
          },
        },
        {
          q: {
            en: "What is the Project Controller panel?",
            hi: "Project Controller पैनल क्या है?",
          },
          a: {
            en: "Some evaluations also get a review from a project controller. It is shown alongside, but it doesn't change your final score.",
            hi: "कुछ evaluation में एक project controller का रिव्यू भी होता है। वो साथ में दिखता है, लेकिन उससे आपका फाइनल स्कोर नहीं बदलता।",
          },
        },
      ],
    },
    {
      id: "review-team",
      title: { en: "For managers: rate your team", hi: "मैनेजर्स के लिए: अपनी टीम को रेटिंग दें" },
      intro: {
        en: "If people report to you, their evaluations are on the To Review tab. A red number on the tab shows how many still need your rating.",
        hi: "अगर लोग आपको रिपोर्ट करते हैं, तो उनके evaluation To Review टैब में होते हैं। टैब पर लाल नंबर बताता है कि कितनों को अभी आपकी रेटिंग चाहिए।",
      },
      steps: [
        {
          text: {
            en: "Open the To Review tab (1). Each row shows the employee, whether they have done their Self part, and My review - whether you have done yours.",
            hi: "To Review टैब (1) खोलें। हर लाइन में कर्मचारी का नाम, उन्होंने अपना Self हिस्सा किया या नहीं, और My review - यानी आपने अपना रिव्यू किया या नहीं - दिखता है।",
          },
          shot: {
            id: "my-performance-to-review",
            as: "manager",
            path: "/performance/me",
            actions: [{ click: { role: "tab", name: "To Review" } }],
            highlight: [
              { role: "tab", name: "To Review" },
              { role: "link", name: "Give rating" },
            ],
          },
        },
        {
          text: {
            en: "Click Give rating (2) on a row.",
            hi: "किसी लाइन पर Give rating (2) पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Rate every line in the Manager Evaluation panel (1) from 1 to 5 by clicking a number (2). Final Score at the top updates as you rate. If the employee has submitted, their Self-Evaluation (3) is next to yours so you can compare.",
            hi: "Manager Evaluation पैनल (1) में हर लाइन को 1 से 5 तक रेटिंग दें - किसी नंबर (2) पर क्लिक करें। रेटिंग देते-देते ऊपर Final Score अपडेट होता रहता है। अगर कर्मचारी ने सबमिट कर दिया है, तो उनका Self-Evaluation (3) तुलना के लिए आपके पैनल के बगल में दिखता है।",
          },
          shot: {
            id: "my-performance-manager-form",
            as: "manager",
            path: "/performance/me",
            actions: [...openTeamReview, { click: { role: "button", name: "4", exact: true } }],
            // The top of the panels: both headings and the first line's ratings
            // (the first "4" is in the Manager panel, which comes first).
            highlight: [
              { text: "Manager Evaluation", exact: true },
              { role: "button", name: "4", exact: true },
              { text: "Self-Evaluation", exact: true },
            ],
          },
        },
        {
          text: {
            en: "Add a comment if you like (1), then click Submit Manager review (2). The employee gets a notification with their score straight away.",
            hi: "चाहें तो कमेंट (1) लिखें, फिर Submit Manager review (2) पर क्लिक करें। कर्मचारी को उनके स्कोर के साथ तुरंत नोटिफिकेशन मिल जाता है।",
          },
          shot: {
            id: "my-performance-manager-submit",
            as: "manager",
            path: "/performance/me",
            actions: [
              ...openTeamReview,
              {
                fill: { role: "textbox", name: "Optional notes" },
                value: "Good progress this quarter. Let's set clearer goals for the next one.",
              },
            ],
            // The bottom of the page: the comments box and the submit button.
            highlight: [
              { role: "textbox", name: "Optional notes" },
              { role: "button", name: "Submit Manager review" },
            ],
          },
        },
      ],
      tips: [
        {
          en: "You don't have to wait for the self-evaluation - you can submit your review first.",
          hi: "आपको self-evaluation का इंतज़ार नहीं करना पड़ता - आप अपना रिव्यू पहले भी सबमिट कर सकते हैं।",
        },
        {
          en: "Once you submit, your review can't be changed, so check every rating first.",
          hi: "सबमिट करने के बाद रिव्यू बदला नहीं जा सकता, इसलिए पहले हर रेटिंग जाँच लें।",
        },
        {
          en: "HR can also complete a manager review, from Performance > Evaluations in the HR part of the sidebar.",
          hi: "HR भी मैनेजर रिव्यू भर सकता है, साइडबार के HR वाले हिस्से में Performance > Evaluations से।",
        },
      ],
    },
  ],
}
