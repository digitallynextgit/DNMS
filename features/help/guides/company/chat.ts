import { MessageSquare } from "lucide-react"
import type { HelpGuide } from "../../types"

export const chatGuide: HelpGuide = {
  slug: "chat",
  group: "company",
  icon: MessageSquare,
  href: "/chat",
  title: { en: "Chat", hi: "चैट (Chat)" },
  summary: {
    en: "Send private one-to-one messages, files, photos and voice notes to any colleague.",
    hi: "किसी भी साथी को प्राइवेट वन-टू-वन मैसेज, फाइलें, फोटो और वॉइस नोट भेजें।",
  },
  keywords: [
    "chat",
    "message",
    "direct message",
    "dm",
    "voice note",
    "attachment",
    "file",
    "photo",
    "reaction",
    "reply",
    "forward",
    "poll",
    "unread",
    "चैट",
    "मैसेज",
    "संदेश",
    "बातचीत",
    "वॉइस नोट",
    "फाइल भेजें",
  ],
  sections: [
    {
      id: "overview",
      title: { en: "Your chats at a glance", hi: "आपकी चैट्स एक नज़र में" },
      intro: {
        en: "Chat is for private messages between you and one colleague. Only the two of you can read a conversation.",
        hi: "Chat आपके और किसी एक साथी के बीच प्राइवेट मैसेज के लिए है। एक बातचीत सिर्फ आप दोनों ही पढ़ सकते हैं।",
      },
      steps: [
        {
          text: {
            en: "Click Chat in the sidebar (1). A red number next to it tells you how many messages you have not read yet.",
            hi: "साइडबार में Chat (1) पर क्लिक करें। इसके पास दिखने वाला लाल नंबर बताता है कि कितने मैसेज आपने अभी तक नहीं पढ़े।",
          },
          shot: {
            id: "chat-overview",
            as: "employee",
            path: "/chat",
            highlight: [
              { role: "link", name: "Chat" },
              { role: "button", name: "Ananya Gupta" },
              { role: "button", name: "New chat" },
            ],
          },
        },
        {
          text: {
            en: "Your conversations are listed on the left, newest first. Each row shows the person, their last message and the time. A row with a coloured number, like (2), has new messages waiting - the number is how many.",
            hi: "बाईं ओर आपकी सारी बातचीत की लिस्ट है, सबसे नई सबसे ऊपर। हर लाइन में व्यक्ति का नाम, आखिरी मैसेज और समय दिखता है। जिस लाइन पर रंगीन नंबर हो, जैसे (2), उसमें नए मैसेज आपका इंतज़ार कर रहे हैं - नंबर बताता है कितने।",
          },
        },
        {
          text: {
            en: "Click a row to open that chat on the right. To talk to someone new, click New chat (3).",
            hi: "किसी लाइन पर क्लिक करें, वो चैट दाईं ओर खुल जाएगी। किसी नए व्यक्ति से बात करनी हो तो New chat (3) पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "When a message arrives in a chat you don't have open, a small pop-up shows who sent it. You also get a notification in the bell - click it to jump straight to that chat.",
          hi: "जब किसी ऐसी चैट में मैसेज आता है जो अभी खुली नहीं है, तो एक छोटा पॉप-अप बताता है कि किसने भेजा। बेल में भी नोटिफिकेशन आता है - उस पर क्लिक करते ही वही चैट खुल जाती है।",
        },
      ],
    },
    {
      id: "start",
      title: { en: "Start a new chat", hi: "नई चैट शुरू करें" },
      steps: [
        {
          text: {
            en: "Click New chat at the top right. A list of your colleagues opens.",
            hi: "ऊपर दाईं ओर New chat पर क्लिक करें। आपके साथियों की लिस्ट खुल जाएगी।",
          },
        },
        {
          text: {
            en: "Type a name in Search colleagues (1) and click the person. The chat opens straight away. If you have talked to them before, your old messages are still there.",
            hi: "Search colleagues (1) में नाम टाइप करें और उस व्यक्ति पर क्लिक करें। चैट तुरंत खुल जाएगी। अगर आपने उनसे पहले बात की है, तो पुराने मैसेज भी वहीं मिलेंगे।",
          },
          shot: {
            id: "chat-new-chat",
            as: "employee",
            path: "/chat",
            actions: [{ click: { role: "button", name: "New chat" } }],
            highlight: [{ placeholder: "Search colleagues" }],
            crop: { role: "dialog" },
          },
        },
      ],
      faq: [
        {
          q: { en: "Can I make a group chat?", hi: "क्या मैं ग्रुप चैट बना सकता हूँ?" },
          a: {
            en: "Not here - Chat is always between two people. To discuss a project with the whole team, use the Chats tab inside that project.",
            hi: "यहाँ नहीं - Chat हमेशा दो लोगों के बीच होती है। पूरी टीम के साथ किसी प्रोजेक्ट पर बात करनी हो, तो उस प्रोजेक्ट के अंदर Chats टैब इस्तेमाल करें।",
          },
        },
        {
          q: { en: "Who can I chat with?", hi: "मैं किससे चैट कर सकता हूँ?" },
          a: {
            en: "Any active employee in your company. If someone is missing from the list, they may no longer be active - check with HR.",
            hi: "आपकी कंपनी के किसी भी एक्टिव कर्मचारी से। अगर कोई लिस्ट में नहीं दिख रहा, तो शायद वो अब एक्टिव नहीं है - HR से पूछ लें।",
          },
        },
      ],
    },
    {
      id: "send",
      title: { en: "Send a message", hi: "मैसेज भेजें" },
      steps: [
        {
          text: {
            en: "Open a chat from the list. Your messages appear on the right and the other person's on the left, with the newest at the bottom.",
            hi: "लिस्ट से कोई चैट खोलें। आपके मैसेज दाईं ओर और सामने वाले के मैसेज बाईं ओर दिखते हैं, सबसे नया मैसेज सबसे नीचे।",
          },
        },
        {
          text: {
            en: "Type in the message box (1) at the bottom, then press Enter or click Send (2). Need a new line? Press Shift + Enter.",
            hi: "नीचे मैसेज बॉक्स (1) में टाइप करें, फिर Enter दबाएँ या Send (2) पर क्लिक करें। नई लाइन चाहिए? Shift + Enter दबाएँ।",
          },
          shot: {
            id: "chat-send",
            as: "employee",
            path: "/chat",
            actions: [
              { click: { role: "button", name: "Rohan Verma" } },
              {
                fill: { placeholder: "Type a message" },
                value: "Sure, I will share the final banners by 5 pm.",
              },
            ],
            highlight: [
              { placeholder: "Type a message" },
              { role: "button", name: "Send", exact: true },
              { role: "button", name: "Insert emoji" },
            ],
          },
        },
        {
          text: {
            en: "Click the smiley (3) to add an emoji. You can scroll through the groups or search for one by name.",
            hi: "इमोजी जोड़ने के लिए स्माइली (3) पर क्लिक करें। आप ग्रुप्स में स्क्रॉल कर सकते हैं या नाम से इमोजी सर्च कर सकते हैं।",
          },
        },
        {
          text: {
            en: "Small ticks under your message show how far it got: one grey tick means sent, two grey ticks mean it reached them, and two blue ticks mean they have opened the chat. Click the ticks to see Message info.",
            hi: "आपके मैसेज के नीचे छोटे टिक बताते हैं कि मैसेज कहाँ तक पहुँचा: एक ग्रे टिक मतलब भेज दिया गया, दो ग्रे टिक मतलब उन तक पहुँच गया, और दो नीले टिक मतलब उन्होंने चैट खोलकर देख ली। टिक पर क्लिक करके Message info देख सकते हैं।",
          },
        },
      ],
      tips: [
        {
          en: "If a message fails to send, DNMS puts your text back in the box so you can try again.",
          hi: "अगर कोई मैसेज नहीं जा पाता, तो DNMS आपका लिखा हुआ वापस बॉक्स में डाल देता है, ताकि आप दोबारा भेज सकें।",
        },
      ],
    },
    {
      id: "attach",
      title: {
        en: "Share files, photos, voice notes and polls",
        hi: "फाइल, फोटो, वॉइस नोट और पोल भेजें",
      },
      steps: [
        {
          text: {
            en: "In an open chat, click + (Attach) next to the message box. Pick Document (1) for PDF, Word, Excel and other files, or Photos & videos (2) for pictures and clips. Camera takes a photo with your webcam or phone camera, and Audio sends a sound file.",
            hi: "खुली हुई चैट में, मैसेज बॉक्स के पास + (Attach) पर क्लिक करें। PDF, Word, Excel जैसी फाइलों के लिए Document (1) चुनें, या फोटो और वीडियो के लिए Photos & videos (2)। Camera से वेबकैम या फोन कैमरा से फोटो खींच सकते हैं, और Audio से कोई ऑडियो फाइल भेज सकते हैं।",
          },
          shot: {
            id: "chat-attach-menu",
            as: "employee",
            path: "/chat",
            actions: [
              { click: { role: "button", name: "Rohan Verma" } },
              { click: { role: "button", name: "Attach" } },
            ],
            highlight: [
              { role: "menuitem", name: "Document" },
              { role: "menuitem", name: "Photos & videos" },
              { role: "menuitem", name: "Poll" },
            ],
          },
        },
        {
          text: {
            en: "After you pick files, a review screen opens. Check them, type a caption if you like, click + (Add more files) to add more, or the pencil (Edit image) to crop, add a filter or draw on a photo. Then click Send. Nothing is sent until you do.",
            hi: "फाइलें चुनने के बाद एक रिव्यू स्क्रीन खुलती है। उन्हें चेक करें, चाहें तो कैप्शन लिखें, और फाइलें जोड़ने के लिए + (Add more files) पर क्लिक करें, या फोटो को क्रॉप करने, फिल्टर लगाने या उस पर ड्रॉ करने के लिए पेंसिल (Edit image) पर। फिर Send पर क्लिक करें। जब तक आप Send नहीं करते, कुछ नहीं जाता।",
          },
        },
        {
          text: {
            en: "Poll (3) asks a question with options the other person can vote on. Event shares a date and time, with an optional place, and Contact shares a colleague's details. Fill in the small form and click Send poll or Send event; for Contact, just click the colleague.",
            hi: "Poll (3) से आप एक सवाल और कुछ ऑप्शन भेज सकते हैं, जिन पर सामने वाला वोट कर सकता है। Event से कोई तारीख और समय (चाहें तो जगह भी) शेयर होता है, और Contact से किसी साथी की डिटेल्स। छोटा सा फॉर्म भरें और Send poll या Send event पर क्लिक करें; Contact में बस उस साथी पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "To send a voice note, leave the message box empty - the Send button turns into a microphone (1). Click it and start talking. While recording you can pause, click the bin to throw it away, or click the send arrow to send it.",
            hi: "वॉइस नोट भेजने के लिए मैसेज बॉक्स खाली छोड़ें - Send बटन माइक्रोफोन (1) बन जाता है। उस पर क्लिक करें और बोलना शुरू करें। रिकॉर्डिंग के दौरान आप pause कर सकते हैं, हटाने के लिए डस्टबिन पर क्लिक कर सकते हैं, या भेजने के लिए send वाले तीर पर क्लिक करें।",
          },
          shot: {
            id: "chat-voice",
            as: "employee",
            path: "/chat",
            actions: [{ click: { role: "button", name: "Rohan Verma" } }],
            highlight: [{ role: "button", name: "Record voice message" }],
          },
        },
      ],
      tips: [
        {
          en: "Each file can be up to 25 MB.",
          hi: "हर फाइल ज़्यादा से ज़्यादा 25 MB की हो सकती है।",
        },
        {
          en: "The first time you use the microphone or camera, your browser asks for permission - click Allow.",
          hi: "पहली बार माइक्रोफोन या कैमरा इस्तेमाल करने पर ब्राउज़र परमिशन माँगता है - Allow पर क्लिक करें।",
        },
        {
          en: "Click a photo in a chat to see it full screen. Use the arrows to move between photos, and the download button to save one. Click a document in a chat to download it.",
          hi: "चैट में किसी फोटो पर क्लिक करें तो वो पूरी स्क्रीन पर खुलती है। तीरों से अगली-पिछली फोटो देखें, और सेव करने के लिए डाउनलोड बटन दबाएँ। चैट में किसी डॉक्युमेंट पर क्लिक करें तो वो डाउनलोड हो जाता है।",
        },
      ],
    },
    {
      id: "message-options",
      title: { en: "React, reply, forward and more", hi: "रिएक्ट, रिप्लाई, फॉरवर्ड और बाकी ऑप्शन" },
      steps: [
        {
          text: {
            en: "Point your mouse at a message. A smiley (1) and a three-dot button appear beside it. Click the smiley and pick a reaction, like a thumbs up (2). To take your reaction back, click it under the message.",
            hi: "किसी मैसेज पर माउस ले जाएँ। उसके पास एक स्माइली (1) और तीन-डॉट वाला बटन दिखेगा। स्माइली पर क्लिक करें और कोई रिएक्शन चुनें, जैसे thumbs up (2)। अपना रिएक्शन हटाना हो, तो मैसेज के नीचे उसी रिएक्शन पर क्लिक करें।",
          },
          shot: {
            id: "chat-react",
            as: "employee",
            path: "/chat",
            actions: [
              { click: { role: "button", name: "Rohan Verma" } },
              { click: { role: "button", name: "React", exact: true, nth: -1 } },
            ],
            highlight: [
              { role: "button", name: "React", exact: true, nth: -1 },
              { role: "button", name: "React 👍" },
            ],
          },
        },
        {
          text: {
            en: "Click the three dots (Message options) for more: Reply (1) quotes the message in your answer, Copy copies the text, Forward (2) sends the text to another colleague, and Pin (3) keeps the message in a strip at the top of the chat for both of you.",
            hi: "और ऑप्शन के लिए तीन डॉट (Message options) पर क्लिक करें: Reply (1) से उस मैसेज को कोट करके जवाब देते हैं, Copy से टेक्स्ट कॉपी होता है, Forward (2) से टेक्स्ट किसी और साथी को भेजते हैं, और Pin (3) से मैसेज चैट के ऊपर एक पट्टी में आप दोनों के लिए टिका रहता है।",
          },
          shot: {
            id: "chat-message-options",
            as: "employee",
            path: "/chat",
            actions: [
              { click: { role: "button", name: "Rohan Verma" } },
              { click: { role: "button", name: "Message options", nth: -1 } },
            ],
            highlight: [
              { role: "menuitem", name: "Reply" },
              { role: "menuitem", name: "Forward" },
              { role: "menuitem", name: "Pin" },
              { role: "menuitem", name: "Delete for me" },
            ],
          },
        },
        {
          text: {
            en: "Delete for me (4) hides a message from your screen only. On your own messages you also get Edit and Delete for everyone, but only for 15 minutes after sending - the menu shows how much time is left.",
            hi: "Delete for me (4) से मैसेज सिर्फ आपकी स्क्रीन से हटता है। अपने खुद के मैसेज पर आपको Edit और Delete for everyone भी मिलते हैं, लेकिन भेजने के सिर्फ 15 मिनट तक - मेन्यू में दिखता है कि कितना समय बचा है।",
          },
        },
        {
          text: {
            en: "To edit, change the text in the box that opens and press Enter, or click the tick. Press Esc to cancel. The other person sees a small edited label on the message.",
            hi: "Edit करने के लिए, खुले हुए बॉक्स में टेक्स्ट बदलें और Enter दबाएँ, या टिक पर क्लिक करें। कैंसल करने के लिए Esc दबाएँ। सामने वाले को मैसेज पर छोटा सा edited लिखा दिखता है।",
          },
        },
      ],
      tips: [
        {
          en: "Forward sends only the text. Files and voice notes are not carried over.",
          hi: "Forward सिर्फ टेक्स्ट भेजता है। फाइलें और वॉइस नोट साथ नहीं जाते।",
        },
        {
          en: "A message deleted for everyone shows as Message deleted for both of you.",
          hi: "Delete for everyone किया गया मैसेज आप दोनों को Message deleted के रूप में दिखता है।",
        },
      ],
      faq: [
        {
          q: {
            en: "Why can't I edit my message or delete it for everyone?",
            hi: "मैं अपना मैसेज Edit या Delete for everyone क्यों नहीं कर पा रहा?",
          },
          a: {
            en: "Those options disappear 15 minutes after you send a message. After that you can only use Delete for me. Edit also works only on text messages, not on photos, files or voice notes.",
            hi: "मैसेज भेजने के 15 मिनट बाद ये ऑप्शन गायब हो जाते हैं। उसके बाद सिर्फ Delete for me बचता है। Edit भी सिर्फ टेक्स्ट मैसेज पर चलता है, फोटो, फाइल या वॉइस नोट पर नहीं।",
          },
        },
      ],
    },
    {
      id: "find-and-pin",
      title: { en: "Find old messages and pin chats", hi: "पुराने मैसेज ढूँढें और चैट पिन करें" },
      steps: [
        {
          text: {
            en: "Type at least two letters in Search chats and messages (1) above your list. It finds people by name and also the words inside your messages. Click a result to jump straight to that message.",
            hi: "लिस्ट के ऊपर Search chats and messages (1) में कम से कम दो अक्षर टाइप करें। ये नाम से लोगों को और आपके मैसेज के अंदर लिखे शब्दों को भी ढूँढता है। किसी रिज़ल्ट पर क्लिक करें, आप सीधे उसी मैसेज पर पहुँच जाएँगे।",
          },
          shot: {
            id: "chat-search",
            as: "employee",
            path: "/chat",
            actions: [{ fill: { placeholder: "Search chats and messages" }, value: "banner" }],
            highlight: [{ placeholder: "Search chats and messages" }],
          },
        },
        {
          text: {
            en: "In an open chat, click the pin (1) to keep that chat at the top of your list - only you see that it is pinned. Click the search icon (2) to look for something inside just this chat.",
            hi: "खुली हुई चैट में, पिन (1) पर क्लिक करें ताकि वो चैट आपकी लिस्ट में सबसे ऊपर रहे - पिन सिर्फ आपको दिखता है। सिर्फ इसी चैट में कुछ ढूँढना हो, तो सर्च आइकन (2) पर क्लिक करें।",
          },
          shot: {
            id: "chat-thread-tools",
            as: "employee",
            path: "/chat",
            actions: [{ click: { role: "button", name: "Rohan Verma" } }],
            highlight: [
              { role: "button", name: "Pin conversation" },
              { role: "button", name: "Search in conversation" },
            ],
          },
        },
        {
          text: {
            en: "Click the person's name at the top of the chat to see their Profile - work email, phone, team and who they report to.",
            hi: "चैट के ऊपर व्यक्ति के नाम पर क्लिक करें तो उनकी Profile दिखती है - ऑफिस ईमेल, फोन, टीम और वो किसे रिपोर्ट करते हैं।",
          },
        },
      ],
      tips: [
        {
          en: "Pinned messages sit in a strip at the top of the chat. Click one to jump to it.",
          hi: "पिन किए गए मैसेज चैट के ऊपर एक पट्टी में दिखते हैं। किसी पर क्लिक करें, आप सीधे उस मैसेज पर पहुँच जाएँगे।",
        },
      ],
    },
  ],
}
