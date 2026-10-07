import { Megaphone } from "lucide-react"
import { PERMISSIONS } from "@/lib/constants"
import type { HelpGuide } from "../../types"

export const announcementsGuide: HelpGuide = {
  slug: "announcements",
  group: "company",
  icon: Megaphone,
  href: "/announcements",
  title: { en: "Announcements", hi: "घोषणाएँ (Announcements)" },
  summary: {
    en: "Read company news, holiday notices and policy updates - and, for HR, post and manage them.",
    hi: "कंपनी की खबरें, छुट्टियों की सूचना और पॉलिसी अपडेट पढ़ें - और HR के लिए, उन्हें पोस्ट और मैनेज करें।",
  },
  keywords: [
    "announcement",
    "notice",
    "noticeboard",
    "news",
    "circular",
    "update",
    "policy",
    "important",
    "draft",
    "घोषणा",
    "सूचना",
    "नोटिस",
    "नोटिस बोर्ड",
    "खबर",
  ],
  sections: [
    {
      id: "read",
      title: { en: "Read the noticeboard", hi: "नोटिस बोर्ड पढ़ें" },
      intro: {
        en: "Announcements is the company noticeboard. HR posts news, holidays and policy changes here, and everyone can read them.",
        hi: "Announcements कंपनी का नोटिस बोर्ड है। HR यहाँ खबरें, छुट्टियाँ और पॉलिसी में बदलाव पोस्ट करता है, और इन्हें सब पढ़ सकते हैं।",
      },
      steps: [
        {
          text: {
            en: "Click Announcements in the sidebar. The numbers at the top show how many notices there are in total, how many came in this week, how many are Important, and how many categories are in use.",
            hi: "साइडबार में Announcements पर क्लिक करें। ऊपर के नंबर बताते हैं कि कुल कितनी सूचनाएँ हैं, इस हफ्ते कितनी आईं, कितनी Important हैं, और कितनी कैटेगरी इस्तेमाल हो रही हैं।",
          },
        },
        {
          text: {
            en: "Each notice shows its title (1), a label for how urgent it is (2), its category, the date and who posted it. Important notices always stay at the top, so newer ones can't push them down.",
            hi: "हर सूचना में उसका टाइटल (1), वो कितनी ज़रूरी है उसका लेबल (2), कैटेगरी, तारीख और किसने पोस्ट की, ये दिखता है। Important सूचनाएँ हमेशा सबसे ऊपर रहती हैं, ताकि नई सूचनाएँ उन्हें नीचे न धकेल दें।",
          },
          shot: {
            id: "announcements-board",
            as: "employee",
            path: "/announcements",
            highlight: [
              { role: "heading", name: "Office closed for Diwali" },
              { text: "Important", exact: true, nth: 1 },
            ],
          },
        },
        {
          text: {
            en: "The labels mean: Important - please read now; Notice - a normal update; FYI - just for your information.",
            hi: "लेबल का मतलब: Important - अभी पढ़ें; Notice - आम अपडेट; FYI - बस आपकी जानकारी के लिए।",
          },
        },
      ],
      tips: [
        {
          en: "The latest announcements also appear in Recent Announcements on your Dashboard. Click View all there to come to this page.",
          hi: "सबसे नई घोषणाएँ आपके Dashboard पर Recent Announcements में भी दिखती हैं। वहाँ View all पर क्लिक करके इस पेज पर आ सकते हैं।",
        },
      ],
      faq: [
        {
          q: {
            en: "An announcement I saw earlier has gone. Why?",
            hi: "जो घोषणा मैंने पहले देखी थी, वो अब नहीं दिख रही। क्यों?",
          },
          a: {
            en: "Some notices are set to be removed on a certain date. Once that date comes, they leave the board on their own. HR may also have deleted it.",
            hi: "कुछ सूचनाएँ एक तय तारीख पर हटने के लिए सेट होती हैं। वो तारीख आते ही वो बोर्ड से अपने आप हट जाती हैं। हो सकता है HR ने उसे डिलीट भी कर दिया हो।",
          },
        },
        {
          q: {
            en: "Will I get a notification for a new announcement?",
            hi: "क्या नई घोषणा आने पर मुझे नोटिफिकेशन मिलेगा?",
          },
          a: {
            en: "No. Check this page or the Recent Announcements card on your Dashboard from time to time.",
            hi: "नहीं। समय-समय पर ये पेज या अपने Dashboard पर Recent Announcements कार्ड देखते रहें।",
          },
        },
      ],
    },
    {
      id: "filter",
      title: { en: "Find an older announcement", hi: "पुरानी घोषणा ढूँढें" },
      steps: [
        {
          text: {
            en: "Use All months (1) to see only the notices posted in one month of this year.",
            hi: "All months (1) से इस साल के किसी एक महीने में पोस्ट हुई सूचनाएँ ही देखें।",
          },
          shot: {
            id: "announcements-filter",
            as: "employee",
            path: "/announcements",
            actions: [{ click: { text: "All categories" } }],
            highlight: [{ text: "All months" }, { role: "option", name: "Policy Update" }],
          },
        },
        {
          text: {
            en: "Use All categories to see one kind of notice only, like Policy Update (2) or Holiday Notification.",
            hi: "All categories से सिर्फ एक तरह की सूचनाएँ देखें, जैसे Policy Update (2) या Holiday Notification।",
          },
        },
        {
          text: {
            en: "Click Clear to go back to every announcement.",
            hi: "सारी घोषणाएँ फिर से देखने के लिए Clear पर क्लिक करें।",
          },
        },
      ],
    },
    {
      id: "post",
      title: { en: "For HR: post an announcement", hi: "HR के लिए: घोषणा पोस्ट करें" },
      permission: PERMISSIONS.ANNOUNCEMENT_WRITE,
      intro: {
        en: "If you can post announcements (usually HR and admins), you see a New announcement button at the top right of the page.",
        hi: "अगर आप घोषणाएँ पोस्ट कर सकते हैं (आमतौर पर HR और एडमिन), तो आपको पेज के ऊपर दाईं ओर New announcement बटन दिखेगा।",
      },
      steps: [
        {
          text: {
            en: "Click New announcement. Everyone signed in to DNMS can read what you post.",
            hi: "New announcement पर क्लिक करें। आप जो पोस्ट करेंगे, DNMS में साइन इन करने वाला हर व्यक्ति उसे पढ़ सकता है।",
          },
        },
        {
          text: {
            en: "Type a short Title (1) and the full Message (2). Line breaks you type are kept.",
            hi: "छोटा सा Title (1) और पूरा Message (2) लिखें। आप जो लाइनें अलग-अलग लिखेंगे, वो वैसी ही दिखेंगी।",
          },
          shot: {
            id: "announcements-new",
            as: "hr",
            path: "/announcements",
            actions: [{ click: { role: "button", name: "New announcement" } }],
            highlight: [
              { role: "textbox", name: "Office closed on 15 August" },
              { role: "textbox", name: "Write the announcement" },
              { role: "combobox", nth: 0 },
              { role: "combobox", nth: 1 },
              { role: "button", name: "Never" },
              { role: "switch" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Pick a Category (3), like Holiday Notification, Policy Update or Celebration, and a Priority (4): FYI, Notice or Important.",
            hi: "Category (3) चुनें, जैसे Holiday Notification, Policy Update या Celebration, और Priority (4) चुनें: FYI, Notice या Important।",
          },
        },
        {
          text: {
            en: "Want it to go away on its own? Pick a date in Remove after (5) - it leaves the board on that date. Leave it on Never to keep it up until you delete it.",
            hi: "चाहते हैं कि सूचना अपने आप हट जाए? Remove after (5) में तारीख चुनें - उस तारीख को वो बोर्ड से हट जाएगी। अगर Never रहने दें, तो वो तब तक रहेगी जब तक आप उसे डिलीट न करें।",
          },
        },
        {
          text: {
            en: "Leave the switch (6) on Visible to everyone and click Post. To finish it later instead, turn the switch off - the button changes to Save draft, and employees won't see it.",
            hi: "स्विच (6) को Visible to everyone पर रहने दें और Post पर क्लिक करें। बाद में पूरा करना हो, तो स्विच बंद कर दें - बटन Save draft बन जाएगा, और कर्मचारियों को ये नहीं दिखेगी।",
          },
        },
      ],
      tips: [
        {
          en: "Posting does not send a notification or email. People see it on this page and in Recent Announcements on their Dashboard.",
          hi: "पोस्ट करने पर कोई नोटिफिकेशन या ईमेल नहीं जाता। लोग इसे इसी पेज पर और अपने Dashboard पर Recent Announcements में देखते हैं।",
        },
        {
          en: "The Post button stays grey until the title and the message each have at least 3 characters.",
          hi: "जब तक Title और Message दोनों में कम से कम 3 अक्षर न हों, Post बटन ग्रे रहता है।",
        },
      ],
    },
    {
      id: "manage",
      title: {
        en: "For HR: edit, hide or delete an announcement",
        hi: "HR के लिए: घोषणा एडिट करें, छुपाएँ या डिलीट करें",
      },
      permission: PERMISSIONS.ANNOUNCEMENT_WRITE,
      steps: [
        {
          text: {
            en: "Each notice has a pencil (1) and a bin (2) on the right. Only people who can post announcements see them.",
            hi: "हर सूचना के दाईं ओर एक पेंसिल (1) और एक डस्टबिन (2) होता है। ये सिर्फ उन लोगों को दिखते हैं जो घोषणाएँ पोस्ट कर सकते हैं।",
          },
          shot: {
            id: "announcements-manage",
            as: "hr",
            path: "/announcements",
            highlight: [
              { role: "button", name: "Edit Office closed for Diwali" },
              { role: "button", name: "Delete Office closed for Diwali" },
              { text: "Draft", exact: true },
            ],
          },
        },
        {
          text: {
            en: "Click the pencil to change anything, then click Save changes. To take a notice down without deleting it, turn the switch off - it becomes a Draft (3) that only people who can post see.",
            hi: "कुछ भी बदलने के लिए पेंसिल पर क्लिक करें, फिर Save changes पर क्लिक करें। सूचना को डिलीट किए बिना हटाना हो, तो स्विच बंद कर दें - वो Draft (3) बन जाएगी, जो सिर्फ पोस्ट करने वालों को दिखती है।",
          },
        },
        {
          text: {
            en: "Click the bin to delete, then confirm with Delete. It is removed for everyone and can't be brought back.",
            hi: "डिलीट करने के लिए डस्टबिन पर क्लिक करें, फिर Delete दबाकर पक्का करें। ये सबके लिए हट जाती है और वापस नहीं आ सकती।",
          },
        },
      ],
      tips: [
        {
          en: "You also see notices that employees can't: drafts, and Expired ones that are past their Remove after date. To put an expired notice back up, edit it and pick a later date.",
          hi: "आपको वो सूचनाएँ भी दिखती हैं जो कर्मचारियों को नहीं दिखतीं: Draft, और Expired वाली जिनकी Remove after तारीख निकल चुकी है। Expired सूचना को फिर से दिखाना हो, तो उसे एडिट करके आगे की तारीख चुनें।",
        },
      ],
      faq: [
        {
          q: {
            en: "If I edit an old announcement, does it move to the top?",
            hi: "अगर मैं पुरानी घोषणा एडिट करूँ, तो क्या वो सबसे ऊपर आ जाएगी?",
          },
          a: {
            en: "No. It keeps the date it was first posted. To bring something to the top, set its Priority to Important, or post it again as a new announcement.",
            hi: "नहीं। उस पर वही तारीख रहती है जब वो पहली बार पोस्ट हुई थी। किसी सूचना को ऊपर लाना हो, तो उसकी Priority को Important कर दें, या उसे नई घोषणा के रूप में फिर से पोस्ट करें।",
          },
        },
      ],
    },
  ],
}
