import { UserCircle } from "lucide-react"
import type { HelpGuide } from "../../types"

export const myProfileGuide: HelpGuide = {
  slug: "my-profile",
  group: "start",
  icon: UserCircle,
  title: { en: "My Profile", hi: "मेरी प्रोफाइल (My Profile)" },
  summary: {
    en: "See your personal and job details, change your photo and password, keep your documents, and apply for resignation.",
    hi: "अपनी निजी और नौकरी से जुड़ी जानकारी देखें, फ़ोटो और पासवर्ड बदलें, अपने डॉक्युमेंट्स रखें, और ज़रूरत हो तो इस्तीफ़ा दें।",
  },
  keywords: [
    "profile",
    "my details",
    "photo",
    "picture",
    "avatar",
    "password",
    "change password",
    "documents",
    "upload",
    "gmail",
    "app password",
    "resign",
    "resignation",
    "notice period",
    "scorecard",
    "probation",
    "प्रोफाइल",
    "फ़ोटो",
    "पासवर्ड बदलें",
    "डॉक्युमेंट",
    "इस्तीफ़ा",
    "रिज़ाइन",
    "नोटिस पीरियड",
  ],
  sections: [
    {
      id: "details",
      title: {
        en: "Open your profile and check your details",
        hi: "प्रोफाइल खोलें और अपनी जानकारी देखें",
      },
      steps: [
        {
          text: {
            en: "Click your name at the top right and pick My Profile. On a phone, tap More, then your name card at the top.",
            hi: "ऊपर दाईं ओर अपने नाम पर क्लिक करें और My Profile चुनें। फ़ोन पर More पर टैप करें, फिर ऊपर अपने नाम वाले कार्ड पर।",
          },
        },
        {
          text: {
            en: "The top card (1) shows your photo, designation, department, employee number and status. The Info tab (2) lists your Personal Information, Employment Details (3) such as your manager and joining date, and your Address and Emergency Contact.",
            hi: "ऊपर वाले कार्ड (1) में आपकी फ़ोटो, पद (designation), डिपार्टमेंट, employee number और स्टेटस दिखता है। Info टैब (2) में आपकी Personal Information, Employment Details (3) जैसे आपके मैनेजर और joining date, और आपका Address और Emergency Contact है।",
          },
          shot: {
            id: "my-profile-overview",
            as: "employee",
            path: "/profile",
            highlight: [
              // The whole top card (photo, name, badges, contact), not just the name.
              // Last match = the innermost card holding the name.
              { css: "div.bg-card:has(h2:text-is('Priya Sharma'))", nth: -1 },
              { role: "tab", name: "Info", exact: true },
              { text: "Employment Details" },
            ],
          },
        },
        {
          text: {
            en: "Still on probation? An On Probation badge in the top card shows the date it ends.",
            hi: "अभी probation पर हैं? ऊपर वाले कार्ड में On Probation बैज दिखता है, जिसमें probation खत्म होने की तारीख होती है।",
          },
        },
        {
          text: {
            en: "The Roles tab shows your DNMS role, like Employee or HR Manager. Your role decides which pages you can open. The Notifications tab holds your task time reminders - see the Notifications guide.",
            hi: "Roles टैब में आपका DNMS role दिखता है, जैसे Employee या HR Manager। आपका role तय करता है कि आप कौन से पेज खोल सकते हैं। Notifications टैब में आपके task time reminders हैं - इसके लिए Notifications गाइड देखें।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "How do I change my phone number, address or other details?",
            hi: "अपना फ़ोन नंबर, पता या बाकी जानकारी कैसे बदलूँ?",
          },
          a: {
            en: "You can't edit these yourself. Ask HR to update them - the change then shows on your profile.",
            hi: "ये आप खुद नहीं बदल सकते। HR से अपडेट करने को कहें - बदलाव फिर आपकी प्रोफाइल पर दिखने लगेगा।",
          },
        },
      ],
    },
    {
      id: "photo",
      title: { en: "Change your photo", hi: "अपनी फ़ोटो बदलें" },
      steps: [
        {
          text: {
            en: "Click Edit Profile Photo at the top right. Pick Upload new photo (1) to choose a picture from your computer or phone (it says Upload photo if you have none yet), or Choose an avatar (2) to pick a ready-made picture. If you already have a photo, you also see Remove photo.",
            hi: "ऊपर दाईं ओर Edit Profile Photo पर क्लिक करें। कंप्यूटर या फ़ोन से तस्वीर चुनने के लिए Upload new photo (1) चुनें (अभी कोई फ़ोटो नहीं है तो इस पर Upload photo लिखा होता है), या तैयार तस्वीर के लिए Choose an avatar (2)। अगर पहले से फ़ोटो लगी है, तो Remove photo भी दिखेगा।",
          },
          shot: {
            id: "my-profile-photo-menu",
            as: "employee",
            path: "/profile",
            actions: [{ click: { role: "button", name: "Edit Profile Photo" } }],
            highlight: [
              { role: "menuitem", name: "Upload" },
              { role: "menuitem", name: "Choose an avatar" },
            ],
          },
        },
        {
          text: {
            en: "In Choose an avatar, click a picture, then Use this avatar (2). Can't decide? Surprise me (1) picks one for you.",
            hi: "Choose an avatar में कोई तस्वीर चुनें, फिर Use this avatar (2) पर क्लिक करें। तय नहीं कर पा रहे? Surprise me (1) आपके लिए एक चुन देगा।",
          },
          shot: {
            id: "my-profile-avatar",
            as: "employee",
            path: "/profile",
            actions: [
              { click: { role: "button", name: "Edit Profile Photo" } },
              { click: { role: "menuitem", name: "Choose an avatar" } },
            ],
            highlight: [
              { role: "button", name: "Surprise me" },
              { role: "button", name: "Use this avatar" },
            ],
            crop: { role: "dialog" },
          },
        },
      ],
      tips: [
        {
          en: "Your photo shows everywhere your name appears in DNMS - in the top bar, in chat and on tasks.",
          hi: "आपकी फ़ोटो DNMS में हर उस जगह दिखती है जहाँ आपका नाम आता है - ऊपर वाले बार में, चैट में और टास्क पर।",
        },
      ],
    },
    {
      id: "documents",
      title: { en: "Your documents", hi: "आपके डॉक्युमेंट्स" },
      steps: [
        {
          text: {
            en: "Open the Documents tab (1). It lists the documents saved on your record, like ID proofs and certificates. Use the buttons on a document to view or download it.",
            hi: "Documents टैब (1) खोलें। इसमें आपके रिकॉर्ड में रखे डॉक्युमेंट्स दिखते हैं, जैसे ID proof और सर्टिफिकेट। किसी डॉक्युमेंट को देखने या डाउनलोड करने के लिए उसके बटन इस्तेमाल करें।",
          },
          shot: {
            id: "my-profile-documents",
            as: "employee",
            path: "/profile",
            actions: [{ click: { role: "tab", name: "Documents" } }],
            highlight: [
              { role: "tab", name: "Documents" },
              { role: "button", name: "Upload Document", nth: 0 },
            ],
          },
        },
        {
          text: {
            en: "To add a document, click Upload Document (2).",
            hi: "नया डॉक्युमेंट जोड़ने के लिए Upload Document (2) पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Drag your file into the box, or click it to browse (1). PDF, Word and image files up to 20 MB are allowed. Type a Title (2), pick a Category (3) if you like, then click Upload (4).",
            hi: "अपनी फ़ाइल बॉक्स में खींचकर डालें, या बॉक्स पर क्लिक करके चुनें (1)। PDF, Word और फ़ोटो फ़ाइलें 20 MB तक चलती हैं। Title (2) टाइप करें, चाहें तो Category (3) चुनें, फिर Upload (4) पर क्लिक करें।",
          },
          shot: {
            id: "my-profile-upload-document",
            as: "employee",
            path: "/profile",
            actions: [
              { click: { role: "tab", name: "Documents" } },
              { click: { role: "button", name: "Upload Document", nth: 0 } },
            ],
            highlight: [
              { role: "button", name: "Drag and drop" },
              { label: "Title" },
              { label: "Category" },
              { role: "button", name: "Upload", exact: true },
            ],
            crop: { role: "dialog" },
          },
        },
      ],
      tips: [
        {
          en: "You can't delete a document yourself. If you uploaded the wrong file, ask HR to remove it.",
          hi: "डॉक्युमेंट आप खुद डिलीट नहीं कर सकते। गलत फ़ाइल अपलोड हो गई हो तो HR से हटाने को कहें।",
        },
      ],
    },
    {
      id: "password",
      title: { en: "Change your password", hi: "अपना पासवर्ड बदलें" },
      steps: [
        {
          text: {
            en: "Open the Security tab. Under Change Password, type your Current Password (1), then your New Password (2) - at least 8 characters - and the same again in Confirm New Password (3). The eye icon shows what you typed.",
            hi: "Security टैब खोलें। Change Password के नीचे Current Password (1) में अपना अभी वाला पासवर्ड, फिर New Password (2) में नया पासवर्ड - कम से कम 8 अक्षर - और Confirm New Password (3) में वही दोबारा टाइप करें। आँख वाला आइकन दिखाता है कि आपने क्या टाइप किया।",
          },
          shot: {
            id: "my-profile-password",
            as: "employee",
            path: "/profile",
            actions: [{ click: { role: "tab", name: "Security" } }],
            highlight: [
              { label: "Current Password" },
              { label: "New Password", nth: 0 },
              { label: "Confirm New Password" },
              { role: "button", name: "Change Password" },
            ],
          },
        },
        {
          text: {
            en: "Click Change Password (4). Soon after, DNMS signs you out on every device, this one too - just sign in again with your new password.",
            hi: "Change Password (4) पर क्लिक करें। थोड़ी देर में DNMS आपको हर डिवाइस से साइन आउट कर देगा, इस वाले से भी - बस नए पासवर्ड से फिर साइन इन करें।",
          },
        },
      ],
      tips: [
        {
          en: "Changing your password also disconnects any AI app (Claude or ChatGPT) you connected to DNMS. Connect it again from AI Connections.",
          hi: "पासवर्ड बदलने से DNMS से जुड़े AI ऐप (Claude या ChatGPT) भी डिस्कनेक्ट हो जाते हैं। उन्हें AI Connections से फिर से कनेक्ट करें।",
        },
        {
          en: "Forgot your current password? Sign out and use Forgot password? on the sign-in page.",
          hi: "अभी वाला पासवर्ड ही भूल गए? साइन आउट करें और साइन इन पेज पर Forgot password? इस्तेमाल करें।",
        },
      ],
    },
    {
      id: "gmail",
      title: {
        en: "Send DNMS emails from your own Gmail (optional)",
        hi: "DNMS के ईमेल अपने Gmail से भेजें (ज़रूरी नहीं)",
      },
      intro: {
        en: "When you apply for leave, WFH or resignation, DNMS emails your approvers. With a Gmail App Password saved, that email goes out from your own work email address. Without one, DNMS sends it from its own address, so this is optional.",
        hi: "जब आप leave, WFH या इस्तीफ़े के लिए अप्लाई करते हैं, तो DNMS आपके approvers को ईमेल भेजता है। Gmail App Password सेव हो तो वो ईमेल आपके अपने ऑफिस ईमेल से जाता है। न हो तो DNMS अपने पते से भेज देता है, इसलिए यह ज़रूरी नहीं है।",
      },
      steps: [
        {
          text: {
            en: "Create an App Password in your Google account: go to myaccount.google.com, then Security, then App Passwords. Your Google account needs 2-Step Verification turned on.",
            hi: "अपने Google अकाउंट में App Password बनाएँ: myaccount.google.com पर जाएँ, फिर Security, फिर App Passwords। इसके लिए आपके Google अकाउंट में 2-Step Verification चालू होना चाहिए।",
          },
        },
        {
          text: {
            en: "In the Security tab, find Gmail App Password (1). Paste the 16-letter password into the box (2) and click Save App Password (3).",
            hi: "Security टैब में Gmail App Password (1) ढूँढें। 16 अक्षरों वाला पासवर्ड बॉक्स (2) में पेस्ट करें और Save App Password (3) पर क्लिक करें।",
          },
          shot: {
            id: "my-profile-gmail",
            as: "employee",
            path: "/profile",
            actions: [{ click: { role: "tab", name: "Security" } }],
            highlight: [
              { text: "Gmail App Password", exact: true },
              { placeholder: "abcd efgh ijkl mnop" },
              { role: "button", name: "Save App Password" },
            ],
          },
        },
        {
          text: {
            en: "Once saved, the card says App Password is set. Use Change to put in a new one, or Delete to remove it.",
            hi: "सेव होने के बाद कार्ड में App Password is set लिखा आता है। नया डालने के लिए Change, और हटाने के लिए Delete इस्तेमाल करें।",
          },
        },
      ],
    },
    {
      id: "scorecard",
      title: {
        en: "Your 15-day scorecard (new joiners)",
        hi: "आपका 15-दिन का स्कोरकार्ड (नए लोगों के लिए)",
      },
      intro: {
        en: "When you join, HR may start a 15-day scorecard for you. Once they do, a 15-Day Scorecard tab appears on your profile. There is no tab until then.",
        hi: "जॉइन करने पर HR आपके लिए 15-दिन का स्कोरकार्ड शुरू कर सकता है। शुरू होते ही आपकी प्रोफाइल पर 15-Day Scorecard टैब दिखने लगता है। उससे पहले यह टैब नहीं होता।",
      },
      steps: [
        {
          text: {
            en: "Open the 15-Day Scorecard tab. For each of your first 15 working days, your reporting manager and HR give you scores from 1 to 5.",
            hi: "15-Day Scorecard टैब खोलें। आपके पहले 15 वर्किंग डेज़ में से हर दिन के लिए आपके रिपोर्टिंग मैनेजर और HR आपको 1 से 5 तक स्कोर देते हैं।",
          },
        },
        {
          text: {
            en: "The 15-day summary shows your Manager average, HR average and Overall score. The Scoring guide explains what each score means - 1 is Unsatisfactory and 5 is Excellent.",
            hi: "15-day summary में आपका Manager average, HR average और Overall score दिखता है। Scoring guide बताता है कि हर स्कोर का क्या मतलब है - 1 यानी Unsatisfactory और 5 यानी Excellent।",
          },
        },
        {
          text: {
            en: "Your manager and HR also write key observations, and HR adds a 15-day HR recommendation at the end. You can read everything here, but you can't change it.",
            hi: "आपके मैनेजर और HR मुख्य बातें (key observations) भी लिखते हैं, और आखिर में HR एक 15-day HR recommendation जोड़ता है। आप यहाँ सब पढ़ सकते हैं, पर बदल नहीं सकते।",
          },
        },
      ],
    },
    {
      id: "resign",
      title: { en: "Apply for resignation", hi: "इस्तीफ़े के लिए अप्लाई करें" },
      intro: {
        en: "If you decide to leave the company, you send your resignation from your profile.",
        hi: "अगर आप कंपनी छोड़ने का फैसला करते हैं, तो इस्तीफ़ा अपनी प्रोफाइल से भेजते हैं।",
      },
      steps: [
        {
          text: {
            en: "Click Apply Resignation at the top right of My Profile.",
            hi: "My Profile में ऊपर दाईं ओर Apply Resignation पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Write your Reason (1) and pick your Requested Last Working Day (2). Click Submit Request (3). Your manager and HR are notified.",
            hi: "अपना Reason (1) लिखें और Requested Last Working Day (2) चुनें। Submit Request (3) पर क्लिक करें। आपके मैनेजर और HR को सूचना मिल जाती है।",
          },
          shot: {
            id: "my-profile-resign",
            as: "employee",
            path: "/profile",
            actions: [{ click: { role: "button", name: "Apply Resignation" } }],
            highlight: [
              { label: "Reason" },
              // The date field's button (the label isn't tied to it).
              { role: "button", name: "Pick a date" },
              { role: "button", name: "Submit Request" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "While it waits for a decision, your profile shows Resignation Pending. Changed your mind? Click Withdraw.",
            hi: "जब तक फैसला नहीं होता, आपकी प्रोफाइल पर Resignation Pending दिखता है। मन बदल गया? Withdraw पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Once your manager or HR accepts it, you serve your notice period and keep using DNMS as normal until your last working day. HR starts your exit clearance, and you get a notification.",
            hi: "मैनेजर या HR के मंज़ूर करते ही आपका notice period शुरू हो जाता है, और आखिरी वर्किंग डे तक आप DNMS पहले की तरह चलाते रहते हैं। HR आपका exit clearance शुरू करता है, और आपको नोटिफिकेशन मिलता है।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "Can I withdraw my resignation after it is accepted?",
            hi: "क्या मंज़ूर होने के बाद इस्तीफ़ा वापस ले सकते हैं?",
          },
          a: {
            en: "Not from your profile - Withdraw only shows while it is still pending. Talk to your manager or HR.",
            hi: "प्रोफाइल से नहीं - Withdraw सिर्फ़ तब दिखता है जब इस्तीफ़ा pending हो। अपने मैनेजर या HR से बात करें।",
          },
        },
      ],
    },
  ],
}
