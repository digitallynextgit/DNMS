import { CalendarCheck } from "lucide-react"
import { PERMISSIONS } from "@/lib/constants"
import type { HelpGuide } from "../../types"

export const leaveAdminGuide: HelpGuide = {
  slug: "leave-admin",
  group: "hr",
  icon: CalendarCheck,
  href: "/leave/leave-directory",
  title: { en: "Leave Directory & Policy", hi: "छुट्टी का मैनेजमेंट (Leave Directory & Policy)" },
  summary: {
    en: "Approve or reject everyone's leave, see who is on leave and how much leave each person has left, and set up leave types and the yearly leave policy.",
    hi: "सबकी छुट्टी की रिक्वेस्ट approve या reject करें, देखें कौन छुट्टी पर है और किसकी कितनी छुट्टी बची है, और leave types व सालाना leave policy सेट करें।",
  },
  keywords: [
    "leave directory",
    "leave approval",
    "approve leave",
    "reject leave",
    "leave balance",
    "leave types",
    "leave policy",
    "carry forward",
    "sandwich rule",
    "short leave",
    "earned leave",
    "probation",
    "sync balances",
    "छुट्टी मंज़ूर",
    "छुट्टी बैलेंस",
    "छुट्टी के नियम",
    "अवकाश",
    "पॉलिसी",
  ],
  sections: [
    {
      id: "directory",
      title: { en: "Find your way around", hi: "Leave Directory को समझें" },
      intro: {
        en: "In the sidebar, under HRMS, open Leave and click Leave Directory. The page has three tabs at the top right.",
        hi: "साइडबार में HRMS के नीचे Leave खोलें और Leave Directory पर क्लिक करें। पेज के ऊपर दाईं ओर तीन टैब होते हैं।",
      },
      steps: [
        {
          text: {
            en: "Requests (1) lists every leave request in the company, newest first. On Leave (2) shows only approved leave. Balances (3) shows how many days each person has left.",
            hi: "Requests (1) में कंपनी की हर छुट्टी की रिक्वेस्ट दिखती है, सबसे नई सबसे ऊपर। On Leave (2) में सिर्फ़ मंज़ूर हुई छुट्टियाँ दिखती हैं। Balances (3) में दिखता है कि हर व्यक्ति के पास कितने दिन बचे हैं।",
          },
          shot: {
            id: "leave-admin-directory",
            as: "hr",
            path: "/leave/leave-directory",
            highlight: [
              { role: "tab", name: "Requests" },
              { role: "tab", name: "On Leave" },
              { role: "tab", name: "Balances" },
              { placeholder: "Search employee..." },
              { css: "button[role=combobox]:has-text('All types')" },
              { role: "button", name: "Status: All" },
            ],
          },
        },
        {
          text: {
            en: "The filters sit at the top of the table. Type a name or employee number in Search employee... (4), pick a leave type (5) or a status in the All menu (6), or pick From and To dates. The dates match the day the leave starts. Click Clear to remove all filters.",
            hi: "फ़िल्टर टेबल के ऊपर होते हैं। Search employee... (4) में नाम या employee number टाइप करें, leave type (5) चुनें या All मेन्यू (6) में status चुनें, या From और To तारीख चुनें। तारीखें छुट्टी शुरू होने वाले दिन से मिलाई जाती हैं। सारे फ़िल्टर हटाने के लिए Clear पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "The name search only looks at the requests on the page you are on. To find an older request, also pick a status, a leave type or dates.",
          hi: "नाम वाला सर्च सिर्फ़ उसी पेज की रिक्वेस्ट में ढूँढता है जिस पर आप हैं। पुरानी रिक्वेस्ट ढूँढनी हो तो साथ में status, leave type या तारीख भी चुनें।",
        },
      ],
    },
    {
      id: "approve",
      title: {
        en: "Approve or reject a leave request",
        hi: "छुट्टी की रिक्वेस्ट approve या reject करें",
      },
      intro: {
        en: "Leave from employees comes to HR for the decision. The employee's own manager can also decide it - whoever acts first settles the request.",
        hi: "कर्मचारियों की छुट्टी की रिक्वेस्ट फैसले के लिए HR के पास आती है। कर्मचारी का अपना मैनेजर भी फैसला कर सकता है - जो पहले फैसला करे, वही आखिरी होता है।",
      },
      steps: [
        {
          text: {
            en: "On the Requests tab, open the All menu at the top of the table and pick Pending to see only the requests that are waiting. In the Actions column, the tick (1) approves and the cross (2) rejects.",
            hi: "Requests टैब पर टेबल के ऊपर वाला All मेन्यू खोलें और Pending चुनें, ताकि सिर्फ़ इंतज़ार कर रही रिक्वेस्ट दिखें। Actions कॉलम में टिक (1) से approve होता है और क्रॉस (2) से reject।",
          },
          shot: {
            id: "leave-admin-actions",
            as: "hr",
            path: "/leave/leave-directory",
            // Status menu -> Pending, as the step says. The rows' badges also say "Pending", hence css.
            actions: [
              { click: { role: "button", name: "Status: All" } },
              { click: { css: "[role=menuitemradio]:has-text('Pending')" } },
            ],
            highlight: [
              { role: "button", name: "Approve" },
              { role: "button", name: "Reject" },
            ],
            crop: { role: "table" },
          },
        },
        {
          text: {
            en: "Clicking the tick opens a reply letter that is emailed to the employee. You can edit the text in the box (1), or click Improve with AI (2) for better wording. Then click Approve & Send (3).",
            hi: "टिक पर क्लिक करते ही एक जवाबी लेटर खुलता है, जो कर्मचारी को ईमेल होता है। बॉक्स (1) में आप लेटर बदल सकते हैं, या बेहतर शब्दों के लिए Improve with AI (2) पर क्लिक करें। फिर Approve & Send (3) पर क्लिक करें।",
          },
          shot: {
            id: "leave-admin-approve-dialog",
            as: "hr",
            path: "/leave/leave-directory",
            actions: [
              { click: { role: "button", name: "Approve" } },
              { waitFor: { css: "[role=alertdialog]" } },
            ],
            highlight: [
              { role: "textbox", name: "Reply message" },
              { role: "button", name: "Improve with AI" },
              { role: "button", name: "Approve & Send" },
            ],
            crop: { css: "[role=alertdialog]" },
          },
        },
        {
          text: {
            en: "To turn a request down, click the cross. Type the Rejection Reason - it is required and goes into the letter. Then click Reject & Send.",
            hi: "रिक्वेस्ट मना करनी हो तो क्रॉस पर क्लिक करें। Rejection Reason लिखें - यह ज़रूरी है और लेटर में भी जाता है। फिर Reject & Send पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "The employee gets your email and a notification. Their balance updates on its own.",
            hi: "कर्मचारी को आपका ईमेल और नोटिफिकेशन मिल जाता है। उनका बैलेंस अपने आप अपडेट हो जाता है।",
          },
        },
      ],
      tips: [
        {
          en: "HR is copied on every reply you send from here.",
          hi: "यहाँ से भेजे गए हर जवाब में HR को कॉपी (CC) में रखा जाता है।",
        },
        {
          en: "The Manager column shows Approved or Rejected when it was the employee's manager who decided.",
          hi: "जब फैसला कर्मचारी के मैनेजर ने किया हो, तब Manager कॉलम में Approved या Rejected दिखता है।",
        },
        {
          en: "Leave applied by HR staff goes to the Admin, so you won't see the tick and cross on a colleague's request - or on your own.",
          hi: "HR स्टाफ़ की छुट्टी Admin के पास जाती है, इसलिए किसी HR साथी की रिक्वेस्ट पर - और अपनी रिक्वेस्ट पर - आपको टिक और क्रॉस नहीं दिखेंगे।",
        },
      ],
      faq: [
        {
          q: {
            en: "A request has no tick or cross. Why?",
            hi: "किसी रिक्वेस्ट पर टिक या क्रॉस नहीं दिख रहा। क्यों?",
          },
          a: {
            en: "It is already decided, it is your own request, or it is from HR staff and is waiting for the Admin.",
            hi: "या तो उसका फैसला हो चुका है, या वो आपकी अपनी रिक्वेस्ट है, या वो किसी HR स्टाफ़ की है और Admin के फैसले का इंतज़ार कर रही है।",
          },
        },
        {
          q: {
            en: "Can I change my decision later?",
            hi: "क्या बाद में अपना फैसला बदल सकते हैं?",
          },
          a: {
            en: "No. Only Pending requests can be decided, and there is no undo. Check the dates and the reason before you click.",
            hi: "नहीं। फैसला सिर्फ़ Pending रिक्वेस्ट पर होता है और उसे वापस नहीं लिया जा सकता। क्लिक करने से पहले तारीखें और वजह ध्यान से देख लें।",
          },
        },
      ],
    },
    {
      id: "on-leave-and-balances",
      title: {
        en: "See who is on leave and how much leave people have",
        hi: "देखें कौन छुट्टी पर है और किसकी कितनी छुट्टी बची है",
      },
      steps: [
        {
          text: {
            en: "Open the On Leave tab to see approved leave. Pick From and To dates to see who is off in a particular week or month.",
            hi: "मंज़ूर हुई छुट्टियाँ देखने के लिए On Leave टैब खोलें। किसी खास हफ़्ते या महीने में कौन छुट्टी पर है, यह देखने के लिए From और To तारीख चुनें।",
          },
        },
        {
          text: {
            en: "Open the Balances tab. Each row is one person and each column is one leave type. The big number is what they can take now. Under it you see the total for the year, the days used, and any days still pending. Total left (1) adds up all their leave types.",
            hi: "Balances टैब खोलें। हर लाइन एक व्यक्ति है और हर कॉलम एक leave type। बड़ा नंबर बताता है कि वो अभी कितने दिन ले सकते हैं। उसके नीचे साल का कुल, इस्तेमाल हुए दिन, और pending दिन दिखते हैं। Total left (1) में उनके सारे leave types जोड़कर दिखते हैं।",
          },
          shot: {
            id: "leave-admin-balances",
            as: "hr",
            path: "/leave/leave-directory?tab=balances",
            highlight: [{ css: "th:has-text('Total left')" }],
            crop: { role: "table" },
          },
        },
        {
          text: {
            en: "To look at another year, pick it in the year box next to the search.",
            hi: "किसी दूसरे साल का बैलेंस देखना हो, तो सर्च के बगल वाले year बॉक्स में वो साल चुनें।",
          },
        },
      ],
      tips: [
        {
          en: "Admins don't take leave in DNMS, so they have no balances and don't show here.",
          hi: "Admins DNMS में छुट्टी नहीं लेते, इसलिए उनका कोई बैलेंस नहीं होता और वो यहाँ नहीं दिखते।",
        },
        {
          en: "Paid leave shows only after a person finishes probation. Until then they can only take Leave Without Pay.",
          hi: "पेड छुट्टी प्रोबेशन खत्म होने के बाद ही दिखती है। तब तक व्यक्ति सिर्फ़ Leave Without Pay ले सकता है।",
        },
      ],
      faq: [
        {
          q: {
            en: "Can I change someone's balance by hand?",
            hi: "क्या किसी का बैलेंस हाथ से बदल सकते हैं?",
          },
          a: {
            en: "Not on this page. Balances come from the leave policy. An HR Manager or Admin can change the policy and then click Sync balances (see below).",
            hi: "इस पेज पर नहीं। बैलेंस leave policy से बनते हैं। HR Manager या Admin पॉलिसी बदलकर Sync balances पर क्लिक कर सकते हैं (नीचे देखें)।",
          },
        },
      ],
    },
    {
      id: "leave-types",
      title: { en: "Add or change leave types", hi: "Leave types जोड़ें या बदलें" },
      permission: PERMISSIONS.LEAVE_POLICY,
      intro: {
        en: "Leave types are the kinds of leave people can apply for, like Casual Leave or Sick Leave. In the sidebar, under Leave, click Leave Types & Policy. The Types tab lists them.",
        hi: "Leave types वो तरह-तरह की छुट्टियाँ हैं जिनके लिए लोग अप्लाई करते हैं, जैसे Casual Leave या Sick Leave। साइडबार में Leave के नीचे Leave Types & Policy पर क्लिक करें। Types टैब में इनकी लिस्ट होती है।",
      },
      steps: [
        {
          text: {
            en: "Click New Leave Type. Type a Name (1) and a short Code (2), like CL.",
            hi: "New Leave Type पर क्लिक करें। Name (1) और एक छोटा Code (2) लिखें, जैसे CL।",
          },
          shot: {
            id: "leave-admin-type-form",
            as: "hr",
            path: "/leave/types",
            actions: [
              { click: { role: "button", name: "New Leave Type" } },
              { waitFor: { role: "dialog" } },
            ],
            highlight: [
              { label: "Name" },
              { label: "Code" },
              { label: "Max Days / Year" },
              { label: "Paid Leave" },
              { label: "Allow Carry Forward" },
              { role: "button", name: "Create Leave Type" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Max Days / Year (3) is how many days a person gets in a year. Put 0 for no limit. The Policy tab can give different numbers to different employment types.",
            hi: "Max Days / Year (3) में लिखें कि एक साल में कितने दिन मिलेंगे। कोई लिमिट नहीं चाहिए तो 0 लिखें। Policy टैब में अलग-अलग employment type को अलग दिन दिए जा सकते हैं।",
          },
        },
        {
          text: {
            en: "Turn on Paid Leave (4) if people are paid for these days. Turn on Allow Carry Forward (5) if unused days should move to next year, then fill Max Days to Carry Forward - the most days that can move.",
            hi: "अगर इन दिनों की सैलरी मिलती है तो Paid Leave (4) ऑन करें। अगर बचे हुए दिन अगले साल में जुड़ने चाहिए तो Allow Carry Forward (5) ऑन करें, फिर Max Days to Carry Forward भरें - यानी ज़्यादा से ज़्यादा कितने दिन आगे जा सकते हैं।",
          },
        },
        {
          text: {
            en: "Keep Requires Approval on, and click Create Leave Type (6).",
            hi: "Requires Approval को ऑन ही रहने दें, और Create Leave Type (6) पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "In the list, the pencil edits a type, the switch icon deactivates or activates it, and the bin deletes it. A deactivated type is hidden from employees, but its history stays.",
            hi: "लिस्ट में पेंसिल से type बदलें, स्विच वाले आइकन से उसे Deactivate या Activate करें, और डस्टबिन से डिलीट करें। Deactivate किया गया type कर्मचारियों से छिप जाता है, पर उसका पुराना रिकॉर्ड बना रहता है।",
          },
        },
      ],
      tips: [
        {
          en: "When you delete, leave the box unticked to just deactivate. Tick Delete permanently only if the type and all its balances and requests should go for good. Only HR Managers and Admins can delete permanently.",
          hi: "डिलीट करते समय बॉक्स बिना टिक किए छोड़ेंगे तो type सिर्फ़ Deactivate होगा। Delete permanently तभी टिक करें जब type और उसके सारे बैलेंस और रिक्वेस्ट हमेशा के लिए हटाने हों। हमेशा के लिए डिलीट सिर्फ़ HR Manager और Admin कर सकते हैं।",
        },
        {
          en: "Several company rules follow the code. Keep the codes CL, SL, EL, LWP, SHORT and ML as they are - see Leave rules below.",
          hi: "कंपनी के कई नियम code से जुड़े हैं। CL, SL, EL, LWP, SHORT और ML जैसे codes को मत बदलें - नीचे Leave rules देखें।",
        },
        {
          en: "To deactivate several types together, tick them and click Deactivate at the top of the table, next to the number selected.",
          hi: "कई types एक साथ Deactivate करने हों, तो उन्हें टिक करें और टेबल के ऊपर, चुने गए types की गिनती के बगल में Deactivate पर क्लिक करें।",
        },
      ],
    },
    {
      id: "policy",
      title: { en: "Set the yearly leave policy", hi: "सालाना leave policy सेट करें" },
      permission: PERMISSIONS.LEAVE_POLICY,
      intro: {
        en: "The policy decides how many days of each leave type a person gets in a year, based on their employment type.",
        hi: "पॉलिसी तय करती है कि किसी व्यक्ति को उसके employment type के हिसाब से हर leave type के साल में कितने दिन मिलेंगे।",
      },
      steps: [
        {
          text: {
            en: "On Leave Types & Policy, open the Policy tab (1). Each row is a leave type and each column is an employment type: Full Time, Part Time, Contract and Intern.",
            hi: "Leave Types & Policy पर Policy टैब (1) खोलें। हर लाइन एक leave type है और हर कॉलम एक employment type: Full Time, Part Time, Contract और Intern।",
          },
          shot: {
            id: "leave-admin-policy",
            as: "hr",
            path: "/leave/types?tab=policy",
            highlight: [
              { role: "tab", name: "Policy" },
              { role: "button", name: "Sync balances" },
              { role: "button", name: "Save policy" },
            ],
          },
        },
        {
          text: {
            en: "Type the days per year in each box. Leave a box empty to use the leave type's Max Days / Year, shown in grey.",
            hi: "हर बॉक्स में साल के दिन लिखें। कोई बॉक्स खाली छोड़ेंगे तो उस leave type का Max Days / Year लगेगा, जो हल्के रंग में दिखता है।",
          },
        },
        {
          text: {
            en: "The small tag under each leave type shows how the days are given: Monthly adds a share every month, Upfront gives all the days at once.",
            hi: "हर leave type के नीचे छोटा टैग बताता है कि दिन कैसे मिलते हैं: Monthly में हर महीने थोड़े-थोड़े दिन जुड़ते हैं, Upfront में सारे दिन एक साथ मिल जाते हैं।",
          },
        },
        {
          text: {
            en: "Click Save policy (3). Then click Sync balances (2) and confirm with Sync, so everyone's balance for this year follows the new policy.",
            hi: "Save policy (3) पर क्लिक करें। फिर Sync balances (2) पर क्लिक करें और Sync से कन्फ़र्म करें, ताकि इस साल सबका बैलेंस नई पॉलिसी के हिसाब से हो जाए।",
          },
        },
      ],
      tips: [
        {
          en: "Sync balances keeps the days people have already used or applied for. It only resets their yearly entitlement.",
          hi: "Sync balances में लोगों के इस्तेमाल किए हुए और अप्लाई किए हुए दिन वैसे ही रहते हैं। सिर्फ़ उनके साल भर के हक़ के दिन दोबारा सेट होते हैं।",
        },
        {
          en: "Paid leave starts after probation. Contract staff get paid leave after 6 months of service.",
          hi: "पेड छुट्टी प्रोबेशन के बाद शुरू होती है। Contract वाले स्टाफ़ को 6 महीने की नौकरी के बाद पेड छुट्टी मिलती है।",
        },
        {
          en: "Someone who becomes eligible in the middle of the year gets a share for the months left - for example 7/12 of the days if it is from June.",
          hi: "जो साल के बीच में हक़दार बनता है, उसे बचे हुए महीनों के हिसाब से दिन मिलते हैं - जैसे जून से हो तो दिनों का 7/12 हिस्सा।",
        },
      ],
      faq: [
        {
          q: {
            en: "I saved the policy but balances did not change.",
            hi: "पॉलिसी सेव कर दी, पर बैलेंस नहीं बदले।",
          },
          a: {
            en: "Saving only changes the policy. Click Sync balances to apply it to this year's balances.",
            hi: "सेव करने से सिर्फ़ पॉलिसी बदलती है। इस साल के बैलेंस पर लागू करने के लिए Sync balances पर क्लिक करें।",
          },
        },
      ],
    },
    {
      id: "rules",
      title: {
        en: "Leave rules DNMS checks for you",
        hi: "छुट्टी के नियम जो DNMS खुद चेक करता है",
      },
      intro: {
        en: "When an employee applies, DNMS checks these rules and stops the request with a message if one is broken. Most of them follow the leave type's code.",
        hi: "जब कोई कर्मचारी अप्लाई करता है, तो DNMS ये नियम चेक करता है और कोई नियम टूटे तो मैसेज दिखाकर रिक्वेस्ट रोक देता है। ज़्यादातर नियम leave type के code से जुड़े हैं।",
      },
      tips: [
        {
          en: "Sandwich rule: weekends that fall between leave days are counted as leave too.",
          hi: "Sandwich rule: छुट्टी के दिनों के बीच आने वाले वीकेंड भी छुट्टी में गिने जाते हैं।",
        },
        {
          en: "Casual Leave (CL): apply at least 2 days before, and at most 2 days in a month.",
          hi: "Casual Leave (CL): कम से कम 2 दिन पहले अप्लाई करें, और एक महीने में ज़्यादा से ज़्यादा 2 दिन।",
        },
        {
          en: "Short Leave (SHORT): counts as half a day, and 2 are allowed in a month. For a third one, the employee applies for half a day of Leave Without Pay instead.",
          hi: "Short Leave (SHORT): आधा दिन गिना जाता है, और महीने में 2 ही मिलती हैं। तीसरी बार के लिए कर्मचारी को आधे दिन की Leave Without Pay लेनी होती है।",
        },
        {
          en: "Earned Leave (EL): apply at least 60 days before, 3 to 7 days at a time, and at most 7 days in January-June and 7 in July-December. It opens only 6 months after probation ends.",
          hi: "Earned Leave (EL): कम से कम 60 दिन पहले अप्लाई करें, एक बार में 3 से 7 दिन, और जनवरी-जून में ज़्यादा से ज़्यादा 7 दिन व जुलाई-दिसंबर में 7 दिन। यह प्रोबेशन खत्म होने के 6 महीने बाद ही मिलती है।",
        },
        {
          en: "Casual or Sick Leave can't be taken right before or after Earned Leave.",
          hi: "Casual या Sick Leave को Earned Leave के ठीक पहले या बाद में नहीं जोड़ा जा सकता।",
        },
        {
          en: "Leave Without Pay (LWP): apply at least 2 days before.",
          hi: "Leave Without Pay (LWP): कम से कम 2 दिन पहले अप्लाई करें।",
        },
        {
          en: "Maternity Leave (ML): for women only, after 2 years of service.",
          hi: "Maternity Leave (ML): सिर्फ़ महिलाओं के लिए, 2 साल की नौकरी के बाद।",
        },
        {
          en: "Half day is offered only on leave types with the code CL, SL or PL, and only for a single day.",
          hi: "Half day का ऑप्शन सिर्फ़ CL, SL या PL code वाले leave types में मिलता है, और सिर्फ़ एक दिन के लिए।",
        },
        {
          en: "No leave can be applied during the notice period once a resignation is accepted.",
          hi: "इस्तीफ़ा मंज़ूर होने के बाद नोटिस पीरियड में छुट्टी के लिए अप्लाई नहीं किया जा सकता।",
        },
        {
          en: "When a new year starts, unused days of a carry-forward type move to the new year, up to its Max Days to Carry Forward.",
          hi: "नया साल शुरू होने पर carry forward वाले type के बचे हुए दिन नए साल में जुड़ जाते हैं, उसके Max Days to Carry Forward तक।",
        },
      ],
      faq: [
        {
          q: {
            en: "An employee says the form won't let them apply. What do I check?",
            hi: "कर्मचारी कह रहा है कि फॉर्म अप्लाई नहीं करने दे रहा। क्या चेक करें?",
          },
          a: {
            en: "Ask for the message the form shows - it names the rule, such as the notice days, a monthly limit, not enough balance or probation.",
            hi: "फॉर्म पर दिखने वाला मैसेज पूछें - उसमें नियम का नाम होता है, जैसे पहले से बताने के दिन, महीने की लिमिट, कम बैलेंस या प्रोबेशन।",
          },
        },
      ],
    },
  ],
}
