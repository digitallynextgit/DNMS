import { Laptop } from "lucide-react"
import type { HelpAction, HelpGuide } from "../../types"

/**
 * In an open date picker (react-day-picker in a popover): go to next month, so
 * every day is in the future whenever the shots are taken, and click its first
 * day that can be picked - weekends and holidays are greyed out (data-disabled),
 * and columns 2-6 (Mon-Fri, weeks start on Sunday) are kept just in case.
 */
const pickWeekdayNextMonth: HelpAction[] = [
  { click: { role: "button", name: "Go to the Next Month" } },
  {
    click: {
      css: "[role=dialog] [role=gridcell]:not([data-disabled]):not([data-outside]):nth-child(n+2):nth-child(-n+6) button",
    },
  },
]

export const workFromHomeGuide: HelpGuide = {
  slug: "work-from-home",
  group: "self",
  icon: Laptop,
  href: "/wfh",
  title: { en: "Work From Home", hi: "वर्क फ्रॉम होम (Work From Home)" },
  summary: {
    en: "Check how much WFH you can take, request WFH for a day or a few days, follow its status, and cancel it if plans change.",
    hi: "देखें आप कितना WFH ले सकते हैं, एक या कुछ दिनों के WFH की रिक्वेस्ट करें, उसका स्टेटस देखें, और प्लान बदल जाए तो उसे कैंसल करें।",
  },
  keywords: [
    "wfh",
    "work from home",
    "remote",
    "home",
    "emergency",
    "approve wfh",
    "tier",
    "घर से काम",
    "वर्क फ्रॉम होम",
    "डब्ल्यूएफएच",
  ],
  sections: [
    {
      id: "allowance",
      title: { en: "Check how much WFH you can take", hi: "देखें आप कितना WFH ले सकते हैं" },
      intro: {
        en: "The card at the top of Work From Home shows your WFH tier. Your tier depends on how long ago your probation ended.",
        hi: "Work From Home पेज के ऊपर वाला कार्ड आपका WFH tier दिखाता है। आपका tier इस पर निर्भर करता है कि आपका प्रोबेशन कितने समय पहले खत्म हुआ।",
      },
      steps: [
        {
          text: {
            en: "Click Work From Home in the sidebar. The card (1) shows your tier and what it allows. On Tier 3 it also shows how many WFH days you have used this month. Apply WFH (2) is where you start a new request.",
            hi: "साइडबार में Work From Home पर क्लिक करें। कार्ड (1) में आपका tier और उसमें क्या मिलता है, ये दिखता है। Tier 3 में ये भी दिखता है कि इस महीने आपने कितने WFH दिन ले लिए। नई रिक्वेस्ट Apply WFH (2) से शुरू होती है।",
          },
          shot: {
            id: "work-from-home-overview",
            as: "employee",
            path: "/wfh",
            highlight: [
              // One box round the whole tier card - separate boxes on its lines
              // put their number circles over the "TIER 3" text.
              // Last match = the innermost card holding the text.
              { css: "div.bg-card:has-text('used this month')", nth: -1 },
              { role: "link", name: "Apply WFH" },
            ],
          },
        },
      ],
      tips: [
        {
          en: "Tier 1 (on probation) and Tier 2 (within 6 months after your probation ends): WFH only in an emergency, with a detailed reason. The card shows the date from which normal WFH opens up for you.",
          hi: "Tier 1 (प्रोबेशन पर) और Tier 2 (प्रोबेशन खत्म होने के 6 महीने के अंदर): WFH सिर्फ इमरजेंसी में, पूरी वजह लिखकर। कार्ड में वो तारीख भी दिखती है जिससे आपको नॉर्मल WFH मिलने लगेगा।",
        },
        {
          en: "Tier 3: 1 normal WFH day each month. Emergency requests don't use up this day.",
          hi: "Tier 3: हर महीने 1 नॉर्मल WFH दिन। इमरजेंसी वाली रिक्वेस्ट से ये दिन खर्च नहीं होता।",
        },
      ],
    },
    {
      id: "apply",
      title: { en: "Request WFH", hi: "WFH की रिक्वेस्ट करें" },
      steps: [
        {
          text: {
            en: "On the Work From Home page, click Apply WFH at the top right.",
            hi: "Work From Home पेज पर, ऊपर दाईं ओर Apply WFH पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Pick the From Date (1). For more than one day, also pick the To Date (2). Leave To Date empty for a single day.",
            hi: "From Date (1) चुनें। एक से ज़्यादा दिन चाहिए तो To Date (2) भी चुनें। एक दिन के लिए To Date खाली छोड़ दें।",
          },
          shot: {
            id: "work-from-home-apply-form",
            as: "employee",
            path: "/wfh/apply",
            highlight: [
              { role: "button", name: "Pick a date" },
              { role: "button", name: "Same day" },
              { role: "checkbox", name: "Mark as emergency" },
              { label: "Reason" },
            ],
          },
        },
        {
          text: {
            en: "Is it an emergency? Tick Mark as emergency (3). Then write a short Reason (4) - for a normal request it is optional.",
            hi: "इमरजेंसी है? Mark as emergency (3) पर टिक करें। फिर छोटा सा Reason (4) लिखें - नॉर्मल रिक्वेस्ट में ये ज़रूरी नहीं है।",
          },
        },
        {
          text: {
            en: "Next to the form is the email that goes out with your request - to your manager, with HR and you on Cc. Whatever you type in Reason appears in the letter on its own. You can still change the Subject (1) and the letter (2) - what you see is exactly what is sent.",
            hi: "फॉर्म के बगल में वो ईमेल दिखता है जो आपकी रिक्वेस्ट के साथ जाता है - आपके मैनेजर को, और HR व आपको Cc में। Reason में जो भी लिखते हैं, वो अपने आप लेटर में आ जाता है। आप Subject (1) और लेटर (2) बदल भी सकते हैं - जो दिख रहा है, बिल्कुल वही भेजा जाता है।",
          },
          shot: {
            id: "work-from-home-apply-email",
            as: "employee",
            path: "/wfh/apply",
            // A From Date first, so the subject and letter show a real date, not "-".
            actions: [
              { click: { role: "button", name: "Pick a date" } },
              ...pickWeekdayNextMonth,
              {
                fill: { label: "Reason" },
                value: "A plumber is coming to fix a leak at home in the morning.",
              },
            ],
            highlight: [
              { role: "textbox", name: "Email subject" },
              { role: "textbox", name: "Email message" },
            ],
          },
        },
        {
          text: {
            en: "When everything looks right, click Submit WFH Request at the bottom of the form. Your manager and HR are notified, and the request shows on your Work From Home page as Pending.",
            hi: "सब सही लगे तो फॉर्म के नीचे Submit WFH Request पर क्लिक करें। आपके मैनेजर और HR को सूचना चली जाती है, और रिक्वेस्ट आपके Work From Home पेज पर Pending दिखने लगती है।",
          },
        },
      ],
      tips: [
        {
          en: "On Tier 1 or Tier 2 there is no tick box - every request is an emergency, and the Reason must be at least 10 characters.",
          hi: "Tier 1 या Tier 2 में टिक बॉक्स नहीं होता - हर रिक्वेस्ट इमरजेंसी ही होती है, और Reason कम से कम 10 अक्षरों का होना चाहिए।",
        },
        {
          en: "The Submit button stays grey until the dates are valid (and, on Tier 1 or 2, the reason is long enough).",
          hi: "जब तक तारीखें सही न हों (और Tier 1 या 2 में Reason काफी लंबा न हो), Submit बटन ग्रे रहता है।",
        },
        {
          en: "If you change the dates, the reason or the emergency tick after editing the letter, the letter is written again from the form.",
          hi: "लेटर बदलने के बाद अगर आप तारीख, Reason या इमरजेंसी टिक बदलते हैं, तो लेटर फॉर्म के हिसाब से दोबारा बन जाता है।",
        },
        {
          en: "If you see a warning that you have no reporting manager, your request is still saved, but no email goes out - tell HR.",
          hi: "अगर चेतावनी दिखे कि आपका कोई रिपोर्टिंग मैनेजर सेट नहीं है, तो रिक्वेस्ट फिर भी सेव हो जाती है, लेकिन ईमेल नहीं जाता - HR को बताएँ।",
        },
      ],
    },
    {
      id: "dates",
      title: { en: "Which dates you can pick", hi: "कौन सी तारीखें चुन सकते हैं" },
      steps: [
        {
          text: {
            en: "Click a date box to open the calendar. Past days, weekends and company holidays are greyed out - you can't pick them.",
            hi: "कैलेंडर खोलने के लिए तारीख वाले बॉक्स पर क्लिक करें। पिछले दिन, वीकेंड और कंपनी हॉलिडे ग्रे दिखते हैं - उन्हें चुना नहीं जा सकता।",
          },
          shot: {
            id: "work-from-home-date-picker",
            as: "employee",
            path: "/wfh/apply",
            actions: [{ click: { role: "button", name: "Pick a date" } }],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Pick a range and the form tells you how many working days it covers. Weekends and holidays inside the range are skipped and not counted.",
            hi: "तारीखों की रेंज चुनें, फॉर्म बता देगा कि इसमें कितने वर्किंग डे हैं। रेंज के बीच के वीकेंड और हॉलिडे छोड़ दिए जाते हैं, गिने नहीं जाते।",
          },
        },
      ],
      faq: [
        {
          q: { en: "Why can't I submit my dates?", hi: "मेरी तारीखें सबमिट क्यों नहीं हो रहीं?" },
          a: {
            en: "One request can cover at most 14 days - split a longer one. On Tier 3, if the dates need more WFH days than you have left this month, the form tells you. Tick Mark as emergency if it can't wait.",
            hi: "एक रिक्वेस्ट ज़्यादा से ज़्यादा 14 दिनों की हो सकती है - लंबी हो तो उसे बाँट दें। Tier 3 में, अगर तारीखों के लिए इस महीने बचे WFH दिनों से ज़्यादा दिन चाहिए, तो फॉर्म बता देता है। अगर रुका नहीं जा सकता, तो Mark as emergency पर टिक करें।",
          },
        },
        {
          q: {
            en: "Can I take WFH on a day I have applied for leave?",
            hi: "क्या उस दिन WFH ले सकते हैं जिस दिन की छुट्टी अप्लाई की है?",
          },
          a: {
            en: "No. WFH can't be on the same day as a leave request, and you can't have two WFH requests for the same day.",
            hi: "नहीं। WFH और छुट्टी की रिक्वेस्ट एक ही दिन नहीं हो सकती, और एक ही दिन के लिए दो WFH रिक्वेस्ट भी नहीं हो सकतीं।",
          },
        },
      ],
    },
    {
      id: "track",
      title: { en: "Track or cancel a request", hi: "रिक्वेस्ट का स्टेटस देखें या कैंसल करें" },
      steps: [
        {
          text: {
            en: "Your requests are listed under Request History. Status shows Pending, Approved, Rejected or Cancelled, and Type shows Standard or Emergency.",
            hi: "आपकी रिक्वेस्ट Request History में दिखती हैं। Status में Pending, Approved, Rejected या Cancelled दिखता है, और Type में Standard या Emergency।",
          },
        },
        {
          text: {
            en: "To cancel a request that is still Pending, click Cancel (1) on its row.",
            hi: "जो रिक्वेस्ट अभी Pending है, उसे कैंसल करने के लिए उसकी लाइन में Cancel (1) पर क्लिक करें।",
          },
          shot: {
            id: "work-from-home-history",
            as: "employee",
            path: "/wfh",
            highlight: [{ role: "button", name: "Cancel" }],
            crop: { role: "table" },
          },
        },
        {
          text: {
            en: "To cancel several at once, tick their boxes on the left, click Cancel in the bar that appears, and confirm with Cancel requests.",
            hi: "एक साथ कई कैंसल करनी हैं तो बाईं ओर उनके बॉक्स पर टिक करें, ऊपर आने वाली पट्टी में Cancel पर क्लिक करें, और Cancel requests से पक्का करें।",
          },
        },
      ],
      tips: [
        {
          en: "You get a notification and an email when your request is approved or rejected. A rejection comes with the reason.",
          hi: "रिक्वेस्ट approve या reject होने पर आपको नोटिफिकेशन और ईमेल मिलता है। reject होने पर उसकी वजह भी बताई जाती है।",
        },
        {
          en: "Approved WFH days show in yellow on My Attendance.",
          hi: "मंज़ूर हुए WFH दिन My Attendance में पीले रंग में दिखते हैं।",
        },
      ],
      faq: [
        {
          q: {
            en: "Can I cancel WFH that is already approved?",
            hi: "क्या मंज़ूर हो चुका WFH कैंसल कर सकते हैं?",
          },
          a: {
            en: "No - only a Pending request has a Cancel button. If your plans change after approval, tell your manager.",
            hi: "नहीं - Cancel बटन सिर्फ Pending रिक्वेस्ट पर होता है। मंज़ूरी के बाद प्लान बदले, तो अपने मैनेजर को बता दें।",
          },
        },
      ],
    },
    {
      id: "team-requests",
      title: {
        en: "For managers: approve your team's WFH",
        hi: "मैनेजर्स के लिए: अपनी टीम का WFH मंज़ूर करें",
      },
      intro: {
        en: "If people report to you, Work From Home gets two tabs: My WFH for your own requests and WFH Requests for your team's.",
        hi: "अगर लोग आपको रिपोर्ट करते हैं, तो Work From Home में दो टैब दिखते हैं: आपकी अपनी रिक्वेस्ट के लिए My WFH और आपकी टीम की रिक्वेस्ट के लिए WFH Requests।",
      },
      steps: [
        {
          text: {
            en: "Open the WFH Requests tab (1). Each row shows the employee, the dates, the reason, and whether it is Standard or Emergency.",
            hi: "WFH Requests टैब (1) खोलें। हर लाइन में कर्मचारी, तारीखें, वजह, और ये कि रिक्वेस्ट Standard है या Emergency, दिखता है।",
          },
          shot: {
            id: "work-from-home-team-requests",
            as: "manager",
            path: "/wfh?tab=requests",
            highlight: [
              { role: "tab", name: "WFH Requests" },
              { role: "button", name: "Approve" },
              { role: "button", name: "Reject" },
            ],
          },
        },
        {
          text: {
            en: "Click Approve (2) or Reject (3) on a Pending request. The employee gets a notification and an email straight away.",
            hi: "Pending रिक्वेस्ट पर Approve (2) या Reject (3) पर क्लिक करें। कर्मचारी को तुरंत नोटिफिकेशन और ईमेल मिल जाता है।",
          },
        },
        {
          text: {
            en: "Rejecting asks for a Reason for rejection (1). It is required, and the employee will see it. Click Reject (2) to confirm.",
            hi: "Reject करने पर Reason for rejection (1) पूछा जाता है। ये ज़रूरी है, और कर्मचारी इसे देखेगा। पक्का करने के लिए Reject (2) पर क्लिक करें।",
          },
          shot: {
            id: "work-from-home-reject-dialog",
            as: "manager",
            path: "/wfh?tab=requests",
            actions: [{ click: { role: "button", name: "Reject" } }],
            highlight: [
              { label: "Reason for rejection" },
              { role: "button", name: "Reject", nth: -1 },
            ],
            crop: { css: "[role='alertdialog']" },
          },
        },
      ],
      tips: [
        {
          en: "The Manager column shows the decision a manager made on the request.",
          hi: "Manager कॉलम में दिखता है कि मैनेजर ने रिक्वेस्ट पर क्या फैसला लिया।",
        },
        {
          en: "HR sees every employee's WFH requests under Work From Home in the HR part of the sidebar.",
          hi: "HR सभी कर्मचारियों की WFH रिक्वेस्ट साइडबार के HR वाले हिस्से में Work From Home के अंदर देखता है।",
        },
      ],
    },
  ],
}
