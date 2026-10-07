import { Bot } from "lucide-react"
import { PERMISSIONS } from "@/lib/constants"
import type { HelpGuide } from "../../types"

export const aiConnectionsGuide: HelpGuide = {
  slug: "ai-connections",
  group: "self",
  icon: Bot,
  href: "/ai-connections",
  title: { en: "AI Connections", hi: "AI कनेक्शन (AI Connections)" },
  summary: {
    en: "Connect Claude or ChatGPT to DNMS, so you can ask questions and get work done by chatting - with exactly your own permissions.",
    hi: "Claude या ChatGPT को DNMS से जोड़ें, ताकि आप चैट करके सवाल पूछ सकें और काम करवा सकें - बिल्कुल आपकी अपनी permissions के साथ।",
  },
  keywords: [
    "ai",
    "claude",
    "chatgpt",
    "connector",
    "mcp",
    "assistant",
    "connect",
    "disconnect",
    "claude code",
    "एआई",
    "कनेक्ट",
    "डिस्कनेक्ट",
    "चैटजीपीटी",
    "क्लॉड",
  ],
  sections: [
    {
      id: "what",
      title: { en: "What an AI connection does", hi: "AI कनेक्शन क्या करता है" },
      intro: {
        en: "Once connected, you can ask Claude or ChatGPT things in plain English - like What is my leave balance? or Which of my tasks are due this week? - and it looks the answer up in DNMS for you. It can also do things for you, like apply for leave or update a task.",
        hi: "कनेक्ट होने के बाद आप Claude या ChatGPT से सीधी भाषा में पूछ सकते हैं - जैसे What is my leave balance? या Which of my tasks are due this week? - और वो DNMS में जवाब ढूँढकर बताता है। वो आपके लिए काम भी कर सकता है, जैसे छुट्टी अप्लाई करना या टास्क अपडेट करना।",
      },
      steps: [
        {
          text: {
            en: "Click AI Connections in the sidebar. At the top you see the DNMS connector URL (1) - the web address an AI app uses to reach DNMS - with a Copy button (2) next to it.",
            hi: "साइडबार में AI Connections पर क्लिक करें। ऊपर DNMS connector URL (1) दिखता है - वो वेब एड्रेस जिससे AI ऐप DNMS तक पहुँचता है - और उसके बगल में Copy बटन (2) है।",
          },
          shot: {
            id: "ai-connections-url",
            as: "employee",
            path: "/ai-connections",
            highlight: [
              // The URL itself (a <code> box), not its label.
              { css: "section code" },
              { role: "button", name: "Copy", exact: true },
            ],
          },
        },
      ],
      tips: [
        {
          en: "The AI works as you. It sees only what you can see in DNMS, and can only do what your own role allows.",
          hi: "AI आपकी तरह काम करता है। वो DNMS में सिर्फ़ वही देखता है जो आप देख सकते हैं, और सिर्फ़ वही कर सकता है जिसकी आपके role में इजाज़त है।",
        },
        {
          en: "Before it changes anything, the AI tells you what it is about to do and asks you to confirm.",
          hi: "कुछ भी बदलने से पहले AI बताता है कि वो क्या करने वाला है और आपसे कन्फ़र्म करवाता है।",
        },
        {
          en: "Platform settings and stored passwords are never shared with the AI. What you type is processed by the AI company (Anthropic for Claude, OpenAI for ChatGPT).",
          hi: "Platform settings और सेव किए गए पासवर्ड AI के साथ कभी शेयर नहीं होते। आप जो टाइप करते हैं वो AI कंपनी (Claude के लिए Anthropic, ChatGPT के लिए OpenAI) प्रोसेस करती है।",
        },
      ],
      faq: [
        {
          q: {
            en: "Do I need this to use AI in DNMS?",
            hi: "क्या DNMS में AI इस्तेमाल करने के लिए यह ज़रूरी है?",
          },
          a: {
            en: "No. Ask DNMS in the top bar answers questions with no setup at all. AI Connections is for using DNMS from inside Claude or ChatGPT.",
            hi: "नहीं। ऊपर वाले बार में Ask DNMS बिना किसी सेटअप के सवालों के जवाब देता है। AI Connections उनके लिए है जो Claude या ChatGPT के अंदर से DNMS इस्तेमाल करना चाहते हैं।",
          },
        },
        {
          q: {
            en: "Can the AI see other people's salaries?",
            hi: "क्या AI दूसरों की सैलरी देख सकता है?",
          },
          a: {
            en: "Only if you can see them in DNMS yourself. The AI gets exactly your permissions, nothing more.",
            hi: "तभी, जब आप खुद DNMS में उन्हें देख सकते हों। AI को बिल्कुल आपकी permissions मिलती हैं, उससे ज़्यादा कुछ नहीं।",
          },
        },
      ],
    },
    {
      id: "connect-claude",
      title: { en: "Connect Claude", hi: "Claude कनेक्ट करें" },
      steps: [
        {
          text: {
            en: "On the AI Connections page, click Copy next to the connector URL. The page also lists the steps for Claude (web or desktop) (1), ChatGPT (Business / Enterprise) (2) and Claude Code (3).",
            hi: "AI Connections पेज पर connector URL के बगल में Copy पर क्लिक करें। इसी पेज पर Claude (web or desktop) (1), ChatGPT (Business / Enterprise) (2) और Claude Code (3) के स्टेप्स भी लिखे हैं।",
          },
          shot: {
            id: "ai-connections-steps",
            as: "employee",
            path: "/ai-connections",
            highlight: [
              { text: "Claude (web or desktop)" },
              { text: "ChatGPT (Business / Enterprise)" },
              { text: "Claude Code", exact: true },
            ],
          },
        },
        {
          text: {
            en: "In Claude, on the web or in the desktop app, go to Customize, then Connectors. Click +, then Add custom connector.",
            hi: "Claude में, वेब पर या डेस्कटॉप ऐप में, Customize पर जाएँ, फिर Connectors पर। + पर क्लिक करें, फिर Add custom connector चुनें।",
          },
        },
        {
          text: {
            en: "Paste the URL and click Connect. On a Claude Team or Enterprise plan, an Owner of your Claude account adds it once under Organization settings, then Connectors.",
            hi: "URL पेस्ट करें और Connect पर क्लिक करें। Claude के Team या Enterprise प्लान में, आपके Claude अकाउंट का Owner इसे एक बार Organization settings में Connectors के अंदर जोड़ता है।",
          },
        },
        {
          text: {
            en: "A DNMS page opens. Sign in if asked. It says which app wants to access DNMS as you, and what it will be able to do. Click Allow.",
            hi: "एक DNMS पेज खुलता है। माँगे तो साइन इन करें। उसमें लिखा होता है कि कौन सा ऐप आपकी तरह DNMS एक्सेस करना चाहता है, और वो क्या-क्या कर पाएगा। Allow पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Back in Claude, ask something like What is my leave balance? to check that it works.",
            hi: "वापस Claude में, जाँचने के लिए What is my leave balance? जैसा कुछ पूछें।",
          },
        },
      ],
      tips: [
        {
          en: "If the Allow page says DNMS has not verified this app, only click Allow if you started the connection yourself and trust the app. Otherwise click Deny.",
          hi: "अगर Allow वाले पेज पर लिखा हो कि DNMS has not verified this app, तो Allow तभी करें जब कनेक्शन आपने खुद शुरू किया हो और आपको ऐप पर भरोसा हो। वरना Deny पर क्लिक करें।",
        },
        {
          en: "Use Claude Code? Run the command shown on the page, type /mcp in Claude Code, choose dnms, then sign in to DNMS in the browser and click Allow.",
          hi: "Claude Code इस्तेमाल करते हैं? पेज पर दी गई कमांड चलाएँ, Claude Code में /mcp टाइप करें, dnms चुनें, फिर ब्राउज़र में DNMS में साइन इन करके Allow पर क्लिक करें।",
        },
      ],
    },
    {
      id: "connect-chatgpt",
      title: { en: "Connect ChatGPT", hi: "ChatGPT कनेक्ट करें" },
      intro: {
        en: "ChatGPT needs a Business or Enterprise workspace, and your ChatGPT admin sets DNMS up once for everyone.",
        hi: "ChatGPT के लिए Business या Enterprise workspace चाहिए, और आपका ChatGPT एडमिन सबके लिए DNMS को एक बार सेट करता है।",
      },
      steps: [
        {
          text: {
            en: "Your ChatGPT admin turns on Developer mode, then goes to Workspace settings, Apps, Create.",
            hi: "आपका ChatGPT एडमिन Developer mode चालू करता है, फिर Workspace settings में Apps पर जाकर Create चुनता है।",
          },
        },
        {
          text: {
            en: "They paste the DNMS connector URL, choose OAuth, click Scan Tools, sign in to DNMS and click Allow. Then they publish it to the workspace.",
            hi: "वो DNMS connector URL पेस्ट करते हैं, OAuth चुनते हैं, Scan Tools पर क्लिक करते हैं, DNMS में साइन इन करके Allow करते हैं। फिर इसे workspace में publish करते हैं।",
          },
        },
        {
          text: {
            en: "You then connect it in ChatGPT under Settings, then Apps, and click Allow on the DNMS page that opens.",
            hi: "फिर आप ChatGPT में Settings के अंदर Apps में जाकर इसे कनेक्ट करते हैं, और खुलने वाले DNMS पेज पर Allow पर क्लिक करते हैं।",
          },
        },
      ],
    },
    {
      id: "manage",
      title: { en: "See and disconnect your AI apps", hi: "अपने AI ऐप देखें और डिस्कनेक्ट करें" },
      steps: [
        {
          text: {
            en: "Your connections (1) lists every AI app you have connected: its Access (Read only, or Read & change), when it was Connected, when it was Last used, and its Status.",
            hi: "Your connections (1) में आपके कनेक्ट किए हर AI ऐप की लिस्ट है: उसका Access (Read only या Read & change), कब Connected हुआ, आखिरी बार कब इस्तेमाल हुआ (Last used), और उसका Status।",
          },
          shot: {
            id: "ai-connections-yours",
            as: "employee",
            path: "/ai-connections",
            highlight: [
              { role: "heading", name: "Your connections" },
              { role: "button", name: "Disconnect" },
            ],
          },
        },
        {
          text: {
            en: "To stop an app, click Disconnect (2) and confirm. It loses access to DNMS straight away. To use it again, connect it again and click Allow.",
            hi: "किसी ऐप को रोकने के लिए Disconnect (2) पर क्लिक करें और कन्फ़र्म करें। उसका DNMS एक्सेस तुरंत बंद हो जाता है। फिर से इस्तेमाल करने के लिए उसे दोबारा कनेक्ट करें और Allow करें।",
          },
        },
      ],
      tips: [
        {
          en: "Changing your DNMS password disconnects all your AI apps. Connect them again after the change.",
          hi: "DNMS पासवर्ड बदलने से आपके सारे AI ऐप डिस्कनेक्ट हो जाते हैं। पासवर्ड बदलने के बाद उन्हें फिर से कनेक्ट करें।",
        },
        {
          en: "An app you don't use for 30 days may ask you to connect again.",
          hi: "जिस ऐप को आप 30 दिन तक इस्तेमाल नहीं करते, वो आपसे फिर से कनेक्ट करने को कह सकता है।",
        },
      ],
    },
    {
      id: "everyone",
      title: { en: "For admins: everyone's connections", hi: "एडमिन के लिए: सबके कनेक्शन" },
      permission: PERMISSIONS.ROLE_WRITE,
      steps: [
        {
          text: {
            en: "Admins also see Everyone in this workspace (1): every AI app anyone has connected, with the Person it belongs to.",
            hi: "एडमिन को Everyone in this workspace (1) भी दिखता है: किसी ने भी जो AI ऐप कनेक्ट किया है, उसके Person (व्यक्ति) के नाम के साथ।",
          },
          shot: {
            id: "ai-connections-everyone",
            as: "admin",
            path: "/ai-connections",
            highlight: [{ role: "heading", name: "Everyone in this workspace" }],
            // The section (heading + table) - it sits at the very bottom of the page.
            crop: { css: "section:has-text('Everyone in this workspace')" },
          },
        },
        {
          text: {
            en: "Click Disconnect on any row to cut that app off straight away - for example when someone leaves or loses a device. Its Status then says Disconnected by admin.",
            hi: "किसी भी लाइन पर Disconnect पर क्लिक करके उस ऐप को तुरंत रोक सकते हैं - जैसे जब कोई कंपनी छोड़े या उसका डिवाइस खो जाए। तब उसके Status में Disconnected by admin लिखा आता है।",
          },
        },
      ],
    },
  ],
}
