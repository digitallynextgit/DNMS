import { MessageSquare } from "lucide-react"
import type { HelpGuide } from "../../types"

export const projectChatsGuide: HelpGuide = {
  slug: "project-chats",
  group: "projects",
  icon: MessageSquare,
  href: "/projects/my-projects",
  title: { en: "A project's Chats tab", hi: "प्रोजेक्ट का Chats टैब" },
  summary: {
    en: "Talk with everyone on a project, one conversation per subject - start a chat, reply, share files and find old messages.",
    hi: "प्रोजेक्ट के सब लोगों से बात करें, हर विषय की अलग बातचीत - चैट शुरू करें, जवाब दें, फ़ाइलें भेजें और पुराने मैसेज ढूँढें।",
  },
  keywords: [
    "chat",
    "chats",
    "messages",
    "project chat",
    "mention",
    "reply",
    "attachment",
    "pin",
    "चैट",
    "मैसेज",
    "बातचीत",
    "जवाब",
  ],
  sections: [
    {
      id: "list",
      title: { en: "Find your way around", hi: "Chats टैब को समझें" },
      intro: {
        en: "Every subject is its own chat, like a WhatsApp group per topic. Everyone on the project can read and post. The Chats tab shows how many messages you haven't read.",
        hi: "हर विषय की अपनी अलग चैट होती है, जैसे हर टॉपिक का एक WhatsApp ग्रुप। प्रोजेक्ट पर हर कोई इसे पढ़ और लिख सकता है। Chats टैब पर दिखता है कि आपके कितने मैसेज बिना पढ़े हैं।",
      },
      steps: [
        {
          text: {
            en: "Open the project and click the Chats tab. The chats are listed on the left with their latest message. Click one to open it on the right.",
            hi: "प्रोजेक्ट खोलें और Chats टैब पर क्लिक करें। बाईं ओर चैट्स की लिस्ट है, हर एक के आखिरी मैसेज के साथ। किसी पर क्लिक करें तो वो दाईं ओर खुल जाती है।",
          },
          shot: {
            id: "project-chats-list",
            as: "employee",
            path: "/projects/sunmeadow-organics-launch?tab=messages",
            highlight: [{ placeholder: "Search chats" }, { role: "button", name: "New chat" }],
          },
        },
        {
          text: {
            en: "Type in Search chats (1) to search every chat in the project at once. Each match is listed on its own - click it to jump straight to that message. The + button (2) starts a new chat.",
            hi: "Search chats (1) में लिखकर प्रोजेक्ट की सारी चैट्स में एक साथ खोजें। हर मिलान अलग से दिखता है - उस पर क्लिक करें और सीधे उसी मैसेज पर पहुँच जाएँ। + बटन (2) से नई चैट शुरू होती है।",
          },
        },
      ],
      tips: [
        {
          en: "A pinned chat shows a pin icon and stays easy to find.",
          hi: "पिन की हुई चैट पर पिन का आइकन होता है, ताकि वो आसानी से मिले।",
        },
      ],
    },
    {
      id: "start",
      title: { en: "Start a new chat", hi: "नई चैट शुरू करें" },
      steps: [
        {
          text: {
            en: "Click the + button (New chat) next to the search box.",
            hi: "सर्च बॉक्स के पास + बटन (New chat) पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Type a Subject (1), like Weekly status, and the First message (2). Type @ to mention a teammate - they get a notification. Then click Start chat (3).",
            hi: "Subject (1) लिखें, जैसे Weekly status, और First message (2)। किसी साथी को mention करने के लिए @ टाइप करें - उन्हें नोटिफिकेशन जाएगा। फिर Start chat (3) पर क्लिक करें।",
          },
          shot: {
            id: "project-chats-new",
            as: "employee",
            path: "/projects/sunmeadow-organics-launch?tab=messages",
            actions: [{ click: { role: "button", name: "New chat" } }],
            highlight: [
              { placeholder: "e.g. Weekly status, Launch plan" },
              { placeholder: "Write the opening message" },
              { role: "button", name: "Start chat" },
            ],
            crop: { role: "dialog" },
          },
        },
      ],
      tips: [
        {
          en: "Started it by mistake? Click Undo on the message that pops up - you have one minute.",
          hi: "गलती से शुरू हो गई? जो मैसेज ऊपर आता है उसमें Undo पर क्लिक करें - आपके पास एक मिनट है।",
        },
      ],
    },
    {
      id: "reply",
      title: { en: "Reply and share files", hi: "जवाब दें और फ़ाइलें भेजें" },
      steps: [
        {
          text: {
            en: "Open a chat. Type in the Type a message box (1) at the bottom and press Enter, or click the send arrow that appears. Shift+Enter starts a new line. Type @ to mention someone.",
            hi: "कोई चैट खोलें। नीचे Type a message बॉक्स (1) में लिखें और Enter दबाएँ, या जो send तीर दिखता है उस पर क्लिक करें। नई लाइन के लिए Shift+Enter दबाएँ। किसी को mention करने के लिए @ टाइप करें।",
          },
          shot: {
            id: "project-chats-thread",
            as: "employee",
            path: "/projects/sunmeadow-organics-launch?tab=messages",
            actions: [
              { click: { role: "button", name: "Launch plan" } },
              // The replies load after the opening message. This one is not the
              // latest, so it isn't also in the chat list's preview line.
              { waitFor: { text: "Banner draft by tomorrow noon" } },
            ],
            highlight: [
              { placeholder: "Type a message" },
              { role: "button", name: "Record voice message" },
              { role: "button", name: "Attach" },
              { role: "button", name: "Search in chat" },
            ],
          },
        },
        {
          text: {
            en: "When the box is empty, the microphone button (2) is there instead of the send arrow. Click it to record a voice message.",
            hi: "जब बॉक्स खाली होता है, तो send तीर की जगह माइक्रोफ़ोन बटन (2) होता है। वॉइस मैसेज रिकॉर्ड करने के लिए उस पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Click the + button (3) to the left of the box to send a Document, Photos & videos, a Camera picture, Audio, a Contact, a Poll, an Event or a New sticker. Files are shown to you for a check before they are sent.",
            hi: "बॉक्स के बाईं ओर वाले + बटन (3) पर क्लिक करके Document, Photos & videos, Camera से फ़ोटो, Audio, Contact, Poll, Event या New sticker भेजें। भेजने से पहले फ़ाइलें आपको एक बार दिखाई जाती हैं ताकि आप चेक कर सकें।",
          },
        },
        {
          text: {
            en: "The magnifier (4) at the top searches inside this chat only.",
            hi: "ऊपर का मैग्निफ़ायर (4) सिर्फ़ इसी चैट के अंदर खोजता है।",
          },
        },
      ],
    },
    {
      id: "message-options",
      title: { en: "React, reply, forward, edit", hi: "React, reply, forward, edit करें" },
      steps: [
        {
          text: {
            en: "Point at a message. Use the React button to add an emoji, or the three-dot Message options button for Reply (1), Copy (2) and Forward (3).",
            hi: "किसी मैसेज पर माउस ले जाएँ। इमोजी लगाने के लिए React बटन, या Reply (1), Copy (2) और Forward (3) के लिए तीन-डॉट वाला Message options बटन इस्तेमाल करें।",
          },
          shot: {
            id: "project-chats-message-options",
            as: "employee",
            path: "/projects/sunmeadow-organics-launch?tab=messages",
            actions: [
              { click: { role: "button", name: "Launch plan" } },
              // Replies first, so "last" is the latest reply, not the opening message.
              { waitFor: { text: "Banner draft by tomorrow noon" } },
              { click: { role: "button", name: "Message options", nth: -1 } },
            ],
            highlight: [
              { role: "menuitem", name: "Reply" },
              { role: "menuitem", name: "Copy" },
              { role: "menuitem", name: "Forward" },
            ],
          },
        },
        {
          text: {
            en: "On your own messages the same menu also has Message info, which shows who has seen it. For 15 minutes after sending, it also has Edit and Delete.",
            hi: "आपके अपने मैसेज पर उसी मेन्यू में Message info भी होता है, जो बताता है किसने देख लिया। भेजने के 15 मिनट तक उसमें Edit और Delete भी होते हैं।",
          },
        },
        {
          text: {
            en: "The ticks on your messages: one tick means nobody has opened it yet, two ticks means some people have, and two blue ticks means everyone has.",
            hi: "आपके मैसेज पर टिक: एक टिक मतलब अभी किसी ने नहीं खोला, दो टिक मतलब कुछ लोगों ने देख लिया, और दो नीले टिक मतलब सबने देख लिया।",
          },
        },
      ],
      tips: [
        {
          en: "Whoever started a chat can change its subject and opening message (Edit chat) or delete the whole chat (Delete chat) within 15 minutes. After that the chat stays as a record.",
          hi: "जिसने चैट शुरू की, वो 15 मिनट के अंदर उसका subject और पहला मैसेज बदल (Edit chat) या पूरी चैट डिलीट (Delete chat) कर सकता है। उसके बाद चैट रिकॉर्ड के तौर पर बनी रहती है।",
        },
        {
          en: "The person who started a chat, the Account Manager and project admins can Pin chat or Unpin chat from the pin button at the top.",
          hi: "चैट शुरू करने वाला, Account Manager और प्रोजेक्ट एडमिन ऊपर के पिन बटन से Pin chat या Unpin chat कर सकते हैं।",
        },
      ],
      faq: [
        {
          q: {
            en: "Can an admin edit or delete my message after 15 minutes?",
            hi: "क्या एडमिन 15 मिनट बाद मेरा मैसेज बदल या डिलीट कर सकता है?",
          },
          a: {
            en: "No. Project chat is a record of what was decided, so after 15 minutes nobody can change or delete a message - not even an admin.",
            hi: "नहीं। प्रोजेक्ट चैट इस बात का रिकॉर्ड है कि क्या तय हुआ, इसलिए 15 मिनट बाद कोई भी मैसेज बदल या डिलीट नहीं कर सकता - एडमिन भी नहीं।",
          },
        },
      ],
    },
  ],
}
