import { Rocket } from "lucide-react"
import type { HelpGuide } from "../../types"

export const gettingStartedGuide: HelpGuide = {
  slug: "getting-started",
  group: "start",
  icon: Rocket,
  title: { en: "Getting started", hi: "शुरुआत करें (Getting started)" },
  summary: {
    en: "Sign in to DNMS, find your way around the screen, sign out safely, and use DNMS on your phone.",
    hi: "DNMS में साइन इन करें, स्क्रीन पर चीज़ें ढूँढना सीखें, सुरक्षित तरीके से साइन आउट करें, और फ़ोन पर DNMS चलाएँ।",
  },
  keywords: [
    "login",
    "sign in",
    "password",
    "forgot password",
    "reset password",
    "google",
    "sidebar",
    "menu",
    "theme",
    "dark mode",
    "sign out",
    "logout",
    "mobile",
    "phone",
    "install",
    "app",
    "लॉगिन",
    "साइन इन",
    "पासवर्ड",
    "पासवर्ड भूल गए",
    "साइन आउट",
    "लॉगआउट",
    "मोबाइल",
    "फ़ोन",
    "थीम",
  ],
  sections: [
    {
      id: "sign-in",
      title: { en: "Sign in", hi: "साइन इन करें" },
      intro: {
        en: "You need your work email address and your DNMS password. HR gives you a temporary password when your account is created.",
        hi: "आपको अपना ऑफिस ईमेल और DNMS पासवर्ड चाहिए। अकाउंट बनते समय HR आपको एक temporary पासवर्ड देता है।",
      },
      steps: [
        {
          text: {
            en: "Open DNMS in your browser. Type your work email in Email address (1) and your password in Password (2). Click the eye icon in the box to see what you typed.",
            hi: "ब्राउज़र में DNMS खोलें। Email address (1) में अपना ऑफिस ईमेल और Password (2) में अपना पासवर्ड टाइप करें। जो टाइप किया है उसे देखने के लिए बॉक्स में आँख वाले आइकन पर क्लिक करें।",
          },
          shot: {
            id: "getting-started-login",
            as: "employee",
            path: "/login",
            highlight: [
              { placeholder: "username@company.com" },
              { placeholder: "••••••••" },
              { role: "button", name: "Sign in", exact: true },
              { role: "button", name: "Sign in with Google" },
              { role: "link", name: "Forgot password?" },
            ],
          },
        },
        {
          text: {
            en: "Click Sign in (3). Your Dashboard opens.",
            hi: "Sign in (3) पर क्लिक करें। आपका Dashboard खुल जाएगा।",
          },
        },
        {
          text: {
            en: "Is your work email a Google account? You can click Sign in with Google (4) instead and pick your work account - no DNMS password needed.",
            hi: "क्या आपका ऑफिस ईमेल Google अकाउंट है? तो आप Sign in with Google (4) पर क्लिक करके अपना ऑफिस अकाउंट चुन सकते हैं - DNMS पासवर्ड की ज़रूरत नहीं पड़ेगी।",
          },
        },
      ],
      tips: [
        {
          en: "Seeing Invalid email or password? Check Caps Lock and the spelling of your email, then try again. Still stuck? Use Forgot password? (5).",
          hi: "Invalid email or password दिख रहा है? Caps Lock और ईमेल की स्पेलिंग चेक करके फिर से कोशिश करें। फिर भी न हो तो Forgot password? (5) इस्तेमाल करें।",
        },
      ],
      faq: [
        {
          q: {
            en: "Google sign-in says No account exists for this email. What now?",
            hi: "Google से साइन इन करने पर No account exists for this email लिखा आता है। अब क्या करें?",
          },
          a: {
            en: "You picked a Google account that is not your work email. Try again and choose your work account. If it still fails, ask HR to check the email on your DNMS account.",
            hi: "आपने ऐसा Google अकाउंट चुना है जो आपका ऑफिस ईमेल नहीं है। फिर से कोशिश करें और ऑफिस वाला अकाउंट चुनें। फिर भी न हो तो HR से अपने DNMS अकाउंट का ईमेल चेक करवाएँ।",
          },
        },
        {
          q: {
            en: "Who do I contact if I can't sign in at all?",
            hi: "अगर बिल्कुल भी साइन इन नहीं हो रहा, तो किससे बात करें?",
          },
          a: {
            en: "Your HR administrator. If your account has been deactivated, for example after you left the company, only HR can turn it back on.",
            hi: "अपने HR administrator से। अगर आपका अकाउंट बंद (deactivate) हो गया है, जैसे कंपनी छोड़ने के बाद, तो उसे सिर्फ़ HR ही दोबारा चालू कर सकता है।",
          },
        },
      ],
    },
    {
      id: "first-sign-in",
      title: {
        en: "First sign-in: choose your own password",
        hi: "पहली बार साइन इन: अपना पासवर्ड सेट करें",
      },
      intro: {
        en: "If HR gave you a temporary password, DNMS asks you to set your own the first time you sign in.",
        hi: "अगर HR ने आपको temporary पासवर्ड दिया है, तो पहली बार साइन इन करते ही DNMS आपसे अपना पासवर्ड सेट करवाता है।",
      },
      steps: [
        {
          text: {
            en: "After you sign in, the Set a new password page opens. Type a New password of at least 8 characters.",
            hi: "साइन इन करने के बाद Set a new password पेज खुलता है। New password में कम से कम 8 अक्षरों का पासवर्ड टाइप करें।",
          },
        },
        {
          text: {
            en: "Type it again in Confirm password and click Set password & continue. Your Dashboard opens, and from now on you sign in with this password.",
            hi: "Confirm password में वही पासवर्ड दोबारा टाइप करें और Set password & continue पर क्लिक करें। आपका Dashboard खुल जाएगा, और अब से आप इसी पासवर्ड से साइन इन करेंगे।",
          },
        },
      ],
      tips: [
        {
          en: "Opened this by mistake, or not you? Click Sign out at the bottom of that page.",
          hi: "गलती से खुल गया या आप नहीं हैं? उस पेज के नीचे Sign out पर क्लिक करें।",
        },
      ],
    },
    {
      id: "forgot-password",
      title: { en: "Forgot your password?", hi: "पासवर्ड भूल गए?" },
      steps: [
        {
          text: {
            en: "On the sign-in page, click Forgot password?. Type your work email in Email address (1) and click Send code (2).",
            hi: "साइन इन पेज पर Forgot password? पर क्लिक करें। Email address (1) में अपना ऑफिस ईमेल टाइप करें और Send code (2) पर क्लिक करें।",
          },
          shot: {
            id: "getting-started-forgot-password",
            as: "employee",
            path: "/forgot-password",
            highlight: [{ label: "Email address" }, { role: "button", name: "Send code" }],
          },
        },
        {
          text: {
            en: "Check your email for a 6-digit code. Type it in Verification code and click Verify code. The code works for 10 minutes.",
            hi: "अपने ईमेल में 6 अंकों का कोड देखें। उसे Verification code में टाइप करें और Verify code पर क्लिक करें। यह कोड 10 मिनट तक चलता है।",
          },
        },
        {
          text: {
            en: "No email? Look in your spam folder. After a minute you can click Didn't get it? Resend code to get a new one.",
            hi: "ईमेल नहीं आया? Spam फ़ोल्डर देखें। एक मिनट बाद आप Didn't get it? Resend code पर क्लिक करके नया कोड मँगा सकते हैं।",
          },
        },
        {
          text: {
            en: "Type a New password (at least 8 characters) and the same again in Confirm password. Click Update password, then sign in with your new password.",
            hi: "New password (कम से कम 8 अक्षर) टाइप करें और Confirm password में वही दोबारा लिखें। Update password पर क्लिक करें, फिर नए पासवर्ड से साइन इन करें।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "I never get the code. Why?",
            hi: "मुझे कोड आता ही नहीं। क्यों?",
          },
          a: {
            en: "The code is only sent to the work email of an active DNMS account. Check the spelling of your email. If it still doesn't come, ask HR.",
            hi: "कोड सिर्फ़ किसी चालू DNMS अकाउंट के ऑफिस ईमेल पर भेजा जाता है। अपने ईमेल की स्पेलिंग चेक करें। फिर भी न आए तो HR से बात करें।",
          },
        },
      ],
    },
    {
      id: "layout",
      title: { en: "Find your way around", hi: "ऐप में रास्ता ढूँढें" },
      intro: {
        en: "Every page has the same frame: the sidebar on the left, a top bar, and the page itself in the middle.",
        hi: "हर पेज का ढाँचा एक जैसा होता है: बाईं ओर साइडबार, ऊपर एक बार, और बीच में असली पेज।",
      },
      steps: [
        {
          text: {
            en: "The sidebar lists everything you can open, in sections. Employee (1) has your own pages, like My Leave and My Payslips. Project (2) has your projects and tasks. Company (3) has Chat, Announcements, Documents and Help & Guides.",
            hi: "साइडबार में वो सब है जो आप खोल सकते हैं, अलग-अलग हिस्सों में। Employee (1) में आपके अपने पेज हैं, जैसे My Leave और My Payslips। Project (2) में आपके प्रोजेक्ट्स और टास्क हैं। Company (3) में Chat, Announcements, Documents और Help & Guides हैं।",
          },
          shot: {
            id: "getting-started-sidebar",
            as: "employee",
            path: "/dashboard",
            highlight: [
              { text: "Employee", exact: true },
              { text: "Project", exact: true },
              { text: "Company", exact: true },
              { role: "button", name: "Collapse sidebar" },
            ],
          },
        },
        {
          text: {
            en: "HR and admin staff also see HRMS and Admin sections with the tools for their job. Everyone only sees what their role allows, so a colleague's sidebar may look different from yours.",
            hi: "HR और एडमिन को HRMS और Admin वाले हिस्से भी दिखते हैं, जिनमें उनके काम के टूल्स होते हैं। हर किसी को सिर्फ़ वही दिखता है जिसकी उसके role में इजाज़त है, इसलिए किसी साथी का साइडबार आपसे अलग दिख सकता है।",
          },
        },
        {
          text: {
            en: "A red number next to an item, like Notifications or Chat, tells you how many new things are waiting there.",
            hi: "किसी आइटम के आगे लाल नंबर, जैसे Notifications या Chat पर, बताता है कि वहाँ कितनी नई चीज़ें आपका इंतज़ार कर रही हैं।",
          },
        },
        {
          text: {
            en: "Need more room? Click Collapse sidebar (4) at the top left, or press Ctrl + B. The sidebar shrinks to icons - point at an icon to see its name. Click the same button again to open it.",
            hi: "ज़्यादा जगह चाहिए? ऊपर बाईं ओर Collapse sidebar (4) पर क्लिक करें, या Ctrl + B दबाएँ। साइडबार सिर्फ़ आइकन में बदल जाएगा - किसी आइकन पर माउस ले जाएँ तो उसका नाम दिखेगा। वापस खोलने के लिए उसी बटन पर फिर क्लिक करें।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "Why can't I see a page my colleague can see?",
            hi: "मेरे साथी को जो पेज दिखता है, वो मुझे क्यों नहीं दिखता?",
          },
          a: {
            en: "The sidebar only shows pages your role allows. If you need access for your work, ask HR or your admin.",
            hi: "साइडबार में सिर्फ़ वही पेज दिखते हैं जिनकी आपके role में इजाज़त है। काम के लिए एक्सेस चाहिए तो HR या एडमिन से कहें।",
          },
        },
      ],
    },
    {
      id: "top-bar",
      title: { en: "The top bar", hi: "ऊपर वाला बार" },
      steps: [
        {
          text: {
            en: "On the right of the top bar you find Ask DNMS (1), the theme picker (2), the Notifications bell (3) and your name (4).",
            hi: "ऊपर वाले बार में दाईं ओर Ask DNMS (1), थीम चुनने का बटन (2), Notifications की घंटी (3) और आपका नाम (4) है।",
          },
          shot: {
            id: "getting-started-top-bar",
            as: "employee",
            path: "/dashboard",
            highlight: [
              { role: "button", name: "Ask DNMS" },
              { role: "button", name: "Choose theme" },
              { role: "link", name: "Notifications", exact: true, nth: -1 },
              { role: "button", name: "Priya Sharma" },
            ],
          },
        },
        {
          text: {
            en: "Ask DNMS opens a small chat box. Type a question in plain English (2), or click a ready question like What's overdue right now? (1). It answers from DNMS data, sees only what you are allowed to see, and never shows salaries or personal details.",
            hi: "Ask DNMS एक छोटा चैट बॉक्स खोलता है। सीधी भाषा में सवाल टाइप करें (2), या What's overdue right now? (1) जैसा तैयार सवाल चुनें। यह DNMS के डेटा से जवाब देता है, सिर्फ़ वही देखता है जो आप देख सकते हैं, और सैलरी या निजी जानकारी कभी नहीं दिखाता।",
          },
          shot: {
            id: "getting-started-ask-dnms",
            as: "employee",
            path: "/dashboard",
            actions: [{ click: { role: "button", name: "Ask DNMS" } }],
            highlight: [
              { role: "button", name: "What's overdue right now?" },
              { role: "textbox", name: "Ask anything" },
            ],
          },
        },
        {
          text: {
            en: "The bell opens your Notifications. The red number on it is how many you haven't read yet.",
            hi: "घंटी से आपके Notifications खुलते हैं। उस पर लाल नंबर बताता है कि कितने अभी तक नहीं पढ़े।",
          },
        },
        {
          text: {
            en: "The palette button changes DNMS colours. Pick a theme card such as Royal Purple (1), or use Default Light (2), Default Dark (3) or System (4) - System follows your computer's light or dark setting. Reset to default (5) removes the theme card you picked.",
            hi: "पैलेट वाला बटन DNMS के रंग बदलता है। Royal Purple (1) जैसा कोई थीम कार्ड चुनें, या Default Light (2), Default Dark (3) या System (4) इस्तेमाल करें - System आपके कंप्यूटर की light या dark सेटिंग के हिसाब से चलता है। Reset to default (5) चुना हुआ थीम कार्ड हटा देता है।",
          },
          shot: {
            id: "getting-started-theme",
            as: "employee",
            path: "/dashboard",
            actions: [{ click: { role: "button", name: "Choose theme" } }],
            highlight: [
              { role: "button", name: "Royal Purple" },
              { role: "button", name: "Default Light" },
              { role: "button", name: "Default Dark" },
              { role: "button", name: "System", exact: true },
              { role: "button", name: "Reset to default" },
            ],
            crop: { role: "dialog" },
          },
        },
      ],
      tips: [
        {
          en: "Your theme is kept on this browser only, and goes back to the default when you sign out.",
          hi: "आपकी थीम सिर्फ़ इसी ब्राउज़र में रहती है, और साइन आउट करने पर default पर लौट आती है।",
        },
      ],
    },
    {
      id: "sign-out",
      title: { en: "Your profile menu and signing out", hi: "प्रोफाइल मेन्यू और साइन आउट" },
      steps: [
        {
          text: {
            en: "Click your name at the top right. The menu shows your email, My Profile (1) for your details, and Sign out (2).",
            hi: "ऊपर दाईं ओर अपने नाम पर क्लिक करें। मेन्यू में आपका ईमेल, आपकी जानकारी के लिए My Profile (1), और Sign out (2) दिखेगा।",
          },
          shot: {
            id: "getting-started-profile-menu",
            as: "employee",
            path: "/dashboard",
            actions: [{ click: { role: "button", name: "Priya Sharma" } }],
            highlight: [
              { role: "menuitem", name: "My Profile" },
              { role: "menuitem", name: "Sign out" },
            ],
            crop: { css: "[role='menu']" },
          },
        },
        {
          text: {
            en: "Click Sign out (2) to leave DNMS. You go back to the sign-in page.",
            hi: "DNMS से बाहर निकलने के लिए Sign out (2) पर क्लिक करें। आप वापस साइन इन पेज पर पहुँच जाएँगे।",
          },
        },
      ],
      tips: [
        {
          en: "Always sign out on a shared or office computer. Signing out also stops DNMS notifications on that browser.",
          hi: "शेयर किए गए या ऑफिस के कॉमन कंप्यूटर पर हमेशा साइन आउट करें। साइन आउट करने से उस ब्राउज़र पर DNMS के नोटिफिकेशन भी बंद हो जाते हैं।",
        },
      ],
    },
    {
      id: "phone",
      title: { en: "Use DNMS on your phone", hi: "फ़ोन पर DNMS चलाएँ" },
      intro: {
        en: "DNMS works in your phone's browser. You don't need to download anything from an app store.",
        hi: "DNMS आपके फ़ोन के ब्राउज़र में चलता है। App store से कुछ डाउनलोड करने की ज़रूरत नहीं है।",
      },
      steps: [
        {
          text: {
            en: "Open DNMS in your phone browser and sign in. The bar at the bottom of the screen takes you to Home (1), Attendance, Tasks and Chat.",
            hi: "फ़ोन के ब्राउज़र में DNMS खोलें और साइन इन करें। स्क्रीन के नीचे वाला बार आपको Home (1), Attendance, Tasks और Chat पर ले जाता है।",
          },
          shot: {
            id: "getting-started-phone-tabs",
            as: "employee",
            path: "/dashboard",
            device: "mobile",
            // The Home icon, not the whole bar: the bar is as wide as the screen,
            // so its number circle was cut off at the left edge.
            highlight: [{ css: "nav[aria-label='Primary'] a:first-child > span.relative" }],
          },
        },
        {
          text: {
            en: "Tap More (1) for everything else. It has the same sections as the desktop sidebar, starting with Me (2) for your own pages. Tap your name card at the top to open My Profile.",
            hi: "बाकी सब के लिए More (1) पर टैप करें। इसमें डेस्कटॉप साइडबार वाले ही हिस्से हैं, शुरुआत Me (2) से होती है जिसमें आपके अपने पेज हैं। My Profile खोलने के लिए ऊपर अपने नाम वाले कार्ड पर टैप करें।",
          },
          shot: {
            id: "getting-started-phone-more",
            as: "employee",
            path: "/more",
            device: "mobile",
            highlight: [
              { role: "link", name: "More", exact: true },
              { role: "heading", name: "Me", exact: true },
            ],
          },
        },
        {
          text: {
            en: "To sign out on your phone, scroll to the bottom of More and tap Sign out under Account.",
            hi: "फ़ोन पर साइन आउट करने के लिए More में सबसे नीचे जाएँ और Account के नीचे Sign out पर टैप करें।",
          },
        },
        {
          text: {
            en: "Want DNMS on your home screen like an app? In Chrome on Android, open the browser menu and tap Install app or Add to Home screen. On an iPhone, open DNMS in Safari, tap Share, then Add to Home Screen.",
            hi: "DNMS को ऐप की तरह होम स्क्रीन पर रखना है? Android पर Chrome में ब्राउज़र मेन्यू खोलें और Install app या Add to Home screen पर टैप करें। iPhone पर Safari में DNMS खोलें, Share पर टैप करें, फिर Add to Home Screen चुनें।",
          },
        },
      ],
      tips: [
        {
          en: "When your phone asks whether DNMS may send notifications, tap Allow, so new updates can pop up on your phone.",
          hi: "जब फ़ोन पूछे कि क्या DNMS नोटिफिकेशन भेज सकता है, तो Allow पर टैप करें, ताकि नए अपडेट फ़ोन पर दिख सकें।",
        },
        {
          en: "Looking for step-by-step help? Open Help & Guides in the Company section of the sidebar, or under More on a phone.",
          hi: "स्टेप-बाय-स्टेप मदद चाहिए? साइडबार के Company हिस्से में, या फ़ोन पर More में, Help & Guides खोलें।",
        },
      ],
    },
  ],
}
