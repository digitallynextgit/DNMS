import { Images } from "lucide-react"
import { PERMISSIONS } from "@/lib/constants"
import type { HelpGuide } from "../../types"

export const photoGalleryGuide: HelpGuide = {
  slug: "photo-gallery",
  group: "company",
  icon: Images,
  href: "/gallery",
  title: { en: "Photo Gallery", hi: "फोटो गैलरी (Photo Gallery)" },
  summary: {
    en: "See photos and videos from team events, download the ones you like, and add your own.",
    hi: "टीम इवेंट्स की फोटो और वीडियो देखें, पसंद की फोटो डाउनलोड करें, और अपनी फोटो भी जोड़ें।",
  },
  keywords: [
    "gallery",
    "photo",
    "picture",
    "video",
    "album",
    "event",
    "celebration",
    "upload",
    "download",
    "फोटो",
    "तस्वीर",
    "वीडियो",
    "एल्बम",
    "गैलरी",
  ],
  sections: [
    {
      id: "browse",
      title: { en: "Browse the albums", hi: "एल्बम देखें" },
      intro: {
        en: "Photos and videos are kept in albums, one for each event - an outing, a festival, a launch party.",
        hi: "फोटो और वीडियो एल्बम में रखे जाते हैं, हर इवेंट का एक एल्बम - जैसे कोई आउटिंग, त्योहार या लॉन्च पार्टी।",
      },
      steps: [
        {
          text: {
            en: "Click Photo Gallery in the sidebar. The numbers at the top show how many albums, photos and videos there are, and how many files were added this week.",
            hi: "साइडबार में Photo Gallery पर क्लिक करें। ऊपर के नंबर बताते हैं कि कितने एल्बम, फोटो और वीडियो हैं, और इस हफ्ते कितनी फाइलें जोड़ी गईं।",
          },
        },
        {
          text: {
            en: "Looking for an event? Type its name in Search albums (1). You can also show only albums With photos or With videos, and change the order - for example Newest first or Name (A-Z).",
            hi: "कोई इवेंट ढूँढ रहे हैं? Search albums (1) में उसका नाम टाइप करें। आप सिर्फ With photos या With videos वाले एल्बम भी देख सकते हैं, और क्रम बदल सकते हैं - जैसे Newest first या Name (A-Z)।",
          },
          shot: {
            id: "photo-gallery-albums",
            as: "employee",
            path: "/gallery",
            highlight: [
              { placeholder: "Search albums" },
              { text: "Team Outing - Lonavala", exact: true },
            ],
          },
        },
        {
          text: {
            en: "Click an album's picture or name (2) to open it. Under the name you see the event date and how many photos and videos it has.",
            hi: "एल्बम खोलने के लिए उसकी फोटो या नाम (2) पर क्लिक करें। नाम के नीचे इवेंट की तारीख और उसमें कितनी फोटो और वीडियो हैं, ये दिखता है।",
          },
        },
      ],
      tips: [
        {
          en: "A few recent albums also appear in the Photo Gallery card on your Dashboard.",
          hi: "कुछ हाल के एल्बम आपके Dashboard पर Photo Gallery कार्ड में भी दिखते हैं।",
        },
      ],
    },
    {
      id: "view",
      title: { en: "View and download photos", hi: "फोटो देखें और डाउनलोड करें" },
      steps: [
        {
          text: {
            en: "Inside an album, click any photo to see it full screen. A video has a small play sign in its corner - click it and it plays full screen.",
            hi: "एल्बम के अंदर किसी भी फोटो पर क्लिक करें, वो पूरी स्क्रीन पर खुल जाएगी। वीडियो के कोने में छोटा सा play का निशान होता है - उस पर क्लिक करें, वीडियो पूरी स्क्रीन पर चलने लगेगा।",
          },
        },
        {
          text: {
            en: "To save a photo or video, point your mouse at it and click the download button (1) in its corner. In the full-screen view, the download button is at the top right, next to the close button.",
            hi: "फोटो या वीडियो सेव करने के लिए उस पर माउस ले जाएँ और कोने में डाउनलोड बटन (1) पर क्लिक करें। पूरी स्क्रीन वाले व्यू में, डाउनलोड बटन ऊपर दाईं ओर, बंद करने वाले बटन के पास होता है।",
          },
          shot: {
            id: "photo-gallery-download",
            as: "employee",
            path: "/gallery/team-outing-lonavala",
            actions: [{ hover: { role: "link", name: "Download", nth: 0 } }],
            highlight: [{ role: "link", name: "Download", nth: 0 }],
          },
        },
        {
          text: {
            en: "To close the full-screen view, click the close button at the top right, or click anywhere outside the picture.",
            hi: "पूरी स्क्रीन वाला व्यू बंद करने के लिए ऊपर दाईं ओर बंद करने वाले बटन पर क्लिक करें, या फोटो के बाहर कहीं भी क्लिक करें।",
          },
        },
      ],
    },
    {
      id: "upload",
      title: { en: "Add your photos and videos", hi: "अपनी फोटो और वीडियो जोड़ें" },
      intro: {
        en: "Anyone can add photos to any album - the people at the event usually have the best pictures.",
        hi: "कोई भी किसी भी एल्बम में फोटो जोड़ सकता है - इवेंट में मौजूद लोगों के पास ही अक्सर सबसे अच्छी फोटो होती हैं।",
      },
      steps: [
        {
          text: {
            en: "Open the album and click Add photos or videos (1) at the top right.",
            hi: "एल्बम खोलें और ऊपर दाईं ओर Add photos or videos (1) पर क्लिक करें।",
          },
          shot: {
            id: "photo-gallery-upload",
            as: "employee",
            path: "/gallery/team-outing-lonavala",
            highlight: [{ role: "button", name: "Add photos or videos" }],
          },
        },
        {
          text: {
            en: "Pick the files on your computer or phone. You can select many at once. When they are in, a message tells you how many files were added.",
            hi: "अपने कंप्यूटर या फोन से फाइलें चुनें। एक साथ कई फाइलें चुन सकते हैं। अपलोड होने के बाद एक मैसेज बताता है कि कितनी फाइलें जुड़ीं।",
          },
        },
      ],
      tips: [
        {
          en: "Photos can be JPG, PNG, WEBP or GIF, up to 15 MB each. Videos can be MP4, WEBM or MOV, up to 200 MB each. Big photos are resized for you.",
          hi: "फोटो JPG, PNG, WEBP या GIF हो सकती हैं, हर फोटो ज़्यादा से ज़्यादा 15 MB की। वीडियो MP4, WEBM या MOV हो सकते हैं, हर वीडियो ज़्यादा से ज़्यादा 200 MB का। बड़ी फोटो अपने आप छोटी कर दी जाती हैं।",
        },
        {
          en: "If a file is skipped, a red message names it and says why - for example, it is too big or not a photo or video.",
          hi: "अगर कोई फाइल छूट जाती है, तो लाल मैसेज में उसका नाम और वजह दिखती है - जैसे फाइल बहुत बड़ी है या वो फोटो/वीडियो नहीं है।",
        },
      ],
    },
    {
      id: "new-album",
      title: { en: "Create a new album", hi: "नया एल्बम बनाएँ" },
      intro: {
        en: "No album for your event yet? Anyone can create one.",
        hi: "आपके इवेंट का एल्बम अभी नहीं है? कोई भी नया एल्बम बना सकता है।",
      },
      steps: [
        {
          text: {
            en: "On the Photo Gallery page, click New album at the top right.",
            hi: "Photo Gallery पेज पर, ऊपर दाईं ओर New album पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Type a Name (1) for the event. If you like, pick the Event date (2) and add a short Description (3). Then click Create (4).",
            hi: "इवेंट का Name (1) लिखें। चाहें तो Event date (2) चुनें और छोटा सा Description (3) लिखें। फिर Create (4) पर क्लिक करें।",
          },
          shot: {
            id: "photo-gallery-new-album",
            as: "employee",
            path: "/gallery",
            actions: [{ click: { role: "button", name: "New album" } }],
            highlight: [
              { role: "textbox", name: "Diwali 2026" },
              { role: "button", name: "Pick a date" },
              { text: "Description", exact: true },
              { role: "button", name: "Create", exact: true },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "The new album is empty. Open it and use Add photos or videos to fill it.",
            hi: "नया एल्बम खाली होता है। उसे खोलें और Add photos or videos से फोटो जोड़ें।",
          },
        },
      ],
      tips: [
        {
          en: "Albums are sorted by their event date, so pick the real date of the event - not today's date - if they are old photos.",
          hi: "एल्बम इवेंट की तारीख के हिसाब से लगते हैं, इसलिए पुरानी फोटो हों तो आज की नहीं, इवेंट की असली तारीख चुनें।",
        },
      ],
    },
    {
      id: "delete-own",
      title: { en: "Remove a photo you added", hi: "अपनी जोड़ी हुई फोटो हटाएँ" },
      steps: [
        {
          text: {
            en: "Open the album and point your mouse at your photo. Click the red bin (1) next to the download button.",
            hi: "एल्बम खोलें और अपनी फोटो पर माउस ले जाएँ। डाउनलोड बटन के पास लाल डस्टबिन (1) पर क्लिक करें।",
          },
          shot: {
            id: "photo-gallery-delete-own",
            as: "employee",
            path: "/gallery/team-outing-lonavala",
            actions: [{ hover: { role: "button", name: "Delete", nth: 0 } }],
            highlight: [{ role: "button", name: "Delete", nth: 0 }],
          },
        },
        {
          text: {
            en: "Click Delete to confirm. The file is removed for good and can't be brought back.",
            hi: "पक्का करने के लिए Delete पर क्लिक करें। फाइल हमेशा के लिए हट जाती है और वापस नहीं आ सकती।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "Why is there no bin on some photos?",
            hi: "कुछ फोटो पर डस्टबिन क्यों नहीं दिखता?",
          },
          a: {
            en: "You can only remove photos you added yourself. To remove someone else's photo, ask HR.",
            hi: "आप सिर्फ अपनी जोड़ी हुई फोटो हटा सकते हैं। किसी और की फोटो हटवानी हो, तो HR से कहें।",
          },
        },
      ],
    },
    {
      id: "manage",
      title: {
        en: "For HR: remove any photo or a whole album",
        hi: "HR के लिए: कोई भी फोटो या पूरा एल्बम हटाएँ",
      },
      permission: PERMISSIONS.GALLERY_WRITE,
      steps: [
        {
          text: {
            en: "You can remove anyone's photo the same way - open the album, point at the photo and click the red bin.",
            hi: "आप इसी तरह किसी की भी फोटो हटा सकते हैं - एल्बम खोलें, फोटो पर माउस ले जाएँ और लाल डस्टबिन पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "To delete a whole album, click the bin (1) next to its name on the Photo Gallery page, then click Delete album. Every photo and video in it is deleted for good.",
            hi: "पूरा एल्बम डिलीट करने के लिए Photo Gallery पेज पर उसके नाम के पास डस्टबिन (1) पर क्लिक करें, फिर Delete album पर। उसकी सारी फोटो और वीडियो हमेशा के लिए डिलीट हो जाती हैं।",
          },
          shot: {
            id: "photo-gallery-delete-album",
            as: "hr",
            path: "/gallery",
            highlight: [{ role: "button", name: "Delete Team Outing - Lonavala" }],
          },
        },
      ],
    },
  ],
}
