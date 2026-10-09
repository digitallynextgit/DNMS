import { Building2 } from "lucide-react"
import { PERMISSIONS } from "@/lib/constants"
import type { HelpGuide } from "../../types"

// Screens: features/clients/components/* and client-portal's client-contacts-tab.tsx.

const CLIENT = "/projects/clients/sunmeadow-foods-pvt-ltd"
const CONTACTS = `${CLIENT}?tab=contacts`

export const clientsGuide: HelpGuide = {
  slug: "clients",
  group: "projects",
  icon: Building2,
  href: "/projects/clients",
  title: { en: "Clients and portal access", hi: "क्लाइंट्स और पोर्टल एक्सेस (Clients)" },
  summary: {
    en: "Keep a record of the companies you work for, their projects and their people, and decide who at each client can sign in to the client portal and what they see.",
    hi: "जिन कंपनियों के लिए आप काम करते हैं, उनका, उनके प्रोजेक्ट्स और उनके लोगों का रिकॉर्ड रखें, और तय करें कि हर क्लाइंट में से कौन क्लाइंट पोर्टल में साइन इन कर सकता है और उसे क्या दिखेगा।",
  },
  keywords: [
    "clients",
    "client",
    "company",
    "contact",
    "contacts",
    "portal",
    "client portal",
    "login",
    "access",
    "password",
    "grant",
    "sections",
    "क्लाइंट",
    "कंपनी",
    "पोर्टल",
    "लॉगिन",
    "पासवर्ड",
    "एक्सेस",
  ],
  sections: [
    {
      id: "basics",
      title: { en: "Clients and contacts", hi: "क्लाइंट और कॉन्टैक्ट" },
      intro: {
        en: "A Client is the company you do the work for, like Sunmeadow Foods Pvt Ltd. A Contact is a person at that company who can sign in to the client portal and see only the projects and sections you allow.",
        hi: "Client वो कंपनी है जिसके लिए आप काम करते हैं, जैसे Sunmeadow Foods Pvt Ltd। Contact उस कंपनी का एक व्यक्ति है जो क्लाइंट पोर्टल में साइन इन कर सकता है और सिर्फ वही प्रोजेक्ट और सेक्शन देख सकता है जिनकी आप अनुमति दें।",
      },
      steps: [
        {
          text: {
            en: "Click Clients in the sidebar. The numbers at the top show Clients, Active, Client projects and Portal contacts.",
            hi: "साइडबार में Clients पर क्लिक करें। ऊपर के नंबर Clients, Active, Client projects और Portal contacts दिखाते हैं।",
          },
        },
        {
          text: {
            en: "Pick a status in the Status menu (1) - Prospect, Active or Inactive - or search by name, code, email or website (2). Each row shows the Account Manager, how many Projects and Contacts the client has, and the Last portal login. Click a client's name, or the eye icon, to open it. Export, above the table, downloads the clients on the page - or only the ticked ones - as a CSV or Excel file.",
            hi: "Status मेन्यू (1) में स्टेटस चुनें - Prospect, Active या Inactive - या नाम, कोड, ईमेल या वेबसाइट से खोजें (2)। हर लाइन में Account Manager, क्लाइंट के कितने Projects और Contacts हैं, और Last portal login दिखता है। क्लाइंट खोलने के लिए उसके नाम पर, या आँख वाले आइकन पर क्लिक करें। टेबल के ऊपर Export से पेज के क्लाइंट्स - या सिर्फ़ टिक किए हुए - CSV या Excel file में डाउनलोड होते हैं।",
          },
          shot: {
            id: "clients-list",
            as: "admin",
            path: "/projects/clients",
            highlight: [
              { role: "button", name: "Status: All" },
              { placeholder: "Search by name, code, email or website" },
              { role: "button", name: "New Client" },
            ],
          },
        },
      ],
      tips: [
        {
          en: "Clients appears for people who have been given access to it - usually admins. Ask an admin if you need it.",
          hi: "Clients उन्हीं को दिखता है जिन्हें इसकी एक्सेस दी गई है - आमतौर पर एडमिन। ज़रूरत हो तो एडमिन से पूछें।",
        },
      ],
    },
    {
      id: "new-client",
      title: { en: "Add or edit a client", hi: "क्लाइंट जोड़ें या बदलें" },
      permission: PERMISSIONS.CLIENT_WRITE,
      steps: [
        {
          text: {
            en: "Click New Client (3 in the picture above). Type the Company name (1) - a code like CL00001 is made for you. Pick the Status and the Account Manager, the person who owns the relationship.",
            hi: "New Client (ऊपर वाली तस्वीर में 3) पर क्लिक करें। Company name (1) लिखें - CL00001 जैसा कोड अपने आप बनता है। Status चुनें और Account Manager चुनें, यानी वो व्यक्ति जो इस रिश्ते का ज़िम्मेदार है।",
          },
          shot: {
            id: "clients-new",
            as: "admin",
            path: "/projects/clients",
            actions: [{ click: { role: "button", name: "New Client" } }],
            highlight: [{ label: "Company name" }, { role: "button", name: "Create Client" }],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Fill in Industry, Website, Email, Phone, Address, Tax / GST number and Notes as needed. Click Create Client (2).",
            hi: "ज़रूरत के हिसाब से Industry, Website, Email, Phone, Address, Tax / GST number और Notes भरें। Create Client (2) पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "To change a client later, click Edit on its page, or the pencil in the list. To retire a client, set its Status to Inactive. Delete only appears for a client with no projects and no contacts.",
            hi: "बाद में क्लाइंट बदलने के लिए उसके पेज पर Edit, या लिस्ट में पेंसिल पर क्लिक करें। किसी क्लाइंट के साथ काम बंद हो जाए, तो उसका Status Inactive कर दें। Delete सिर्फ उस क्लाइंट पर दिखता है जिसका न कोई प्रोजेक्ट है न कोई कॉन्टैक्ट।",
          },
        },
      ],
    },
    {
      id: "client-page",
      title: { en: "The client's page", hi: "क्लाइंट का पेज" },
      steps: [
        {
          text: {
            en: "Open a client. Overview (1) has the company's details. Projects (2) lists every project filed under this client. Contacts (3) lists the people who can sign in to the portal. Activity (4) shows what those people did in the portal - When, Who, What, Project and Section.",
            hi: "कोई क्लाइंट खोलें। Overview (1) में कंपनी की डिटेल्स हैं। Projects (2) में इस क्लाइंट के सारे प्रोजेक्ट हैं। Contacts (3) में वो लोग हैं जो पोर्टल में साइन इन कर सकते हैं। Activity (4) दिखाता है कि उन लोगों ने पोर्टल में क्या किया - When, Who, What, Project और Section।",
          },
          shot: {
            id: "clients-page",
            as: "admin",
            path: CLIENT,
            highlight: [
              { role: "tab", name: "Overview" },
              { role: "tab", name: "Projects" },
              { role: "tab", name: "Contacts" },
              { role: "tab", name: "Activity" },
            ],
          },
        },
        {
          text: {
            en: "On the Projects tab, New project starts a project with this client already filled in. It is there for people who can create projects.",
            hi: "Projects टैब पर New project से ऐसा प्रोजेक्ट शुरू होता है जिसमें ये क्लाइंट पहले से भरा होता है। ये उन्हीं को दिखता है जो प्रोजेक्ट बना सकते हैं।",
          },
        },
        {
          text: {
            en: "To file an existing project under a client, open the project, click Edit and pick the Client. Portal contacts who could already see that project, and who belong to no other client, then join this client and appear on its Contacts tab.",
            hi: "किसी पुराने प्रोजेक्ट को क्लाइंट के अंदर डालने के लिए प्रोजेक्ट खोलें, Edit पर क्लिक करें और Client चुनें। जो पोर्टल कॉन्टैक्ट पहले से वो प्रोजेक्ट देख सकते थे, और किसी दूसरे क्लाइंट से नहीं जुड़े हैं, वो इस क्लाइंट में आ जाते हैं और इसके Contacts टैब पर दिखने लगते हैं।",
          },
        },
      ],
    },
    {
      id: "add-contact",
      title: { en: "Give someone a portal login", hi: "किसी को पोर्टल लॉगिन दें" },
      permission: PERMISSIONS.CLIENT_WRITE,
      intro: {
        en: "Portal access is managed only here, on the client's Contacts tab. Projects do not have a portal access tab of their own.",
        hi: "पोर्टल एक्सेस सिर्फ यहीं, क्लाइंट के Contacts टैब पर मैनेज होती है। प्रोजेक्ट्स में पोर्टल एक्सेस का अलग टैब नहीं है।",
      },
      steps: [
        {
          text: {
            en: "Open the client, go to the Contacts tab and click Add contact. Type their Full name (1), their Email (2) - this becomes their login - and their Phone.",
            hi: "क्लाइंट खोलें, Contacts टैब पर जाएँ और Add contact पर क्लिक करें। उनका Full name (1), Email (2) - यही उनका लॉगिन बनेगा - और Phone लिखें।",
          },
          shot: {
            id: "clients-add-contact",
            as: "admin",
            path: CONTACTS,
            actions: [{ click: { role: "button", name: "Add contact" } }],
            highlight: [
              { css: "#contact-name" },
              { css: "#contact-email" },
              { text: "No project yet", exact: true },
              { role: "button", name: "Add contact and email password" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Under Give them a project now (optional), pick a project (3) and tick the Sections they can see. You can also skip this and grant projects later.",
            hi: "Give them a project now (optional) में एक प्रोजेक्ट (3) चुनें और Sections they can see पर टिक करें। चाहें तो ये छोड़कर बाद में प्रोजेक्ट दे सकते हैं।",
          },
        },
        {
          text: {
            en: "Keep Force a password change on first sign-in ticked. Click Add contact and email password (4). DNMS emails them a password - it is never shown to you. They sign in on the normal login page.",
            hi: "Force a password change on first sign-in पर टिक रहने दें। Add contact and email password (4) पर क्लिक करें। DNMS उन्हें पासवर्ड ईमेल करता है - वो आपको कभी नहीं दिखता। वो सामान्य लॉगिन पेज से साइन इन करते हैं।",
          },
        },
      ],
      tips: [
        {
          en: "If that email already has a portal login, the person is simply added to this client - no new password is sent.",
          hi: "अगर उस ईमेल का पहले से पोर्टल लॉगिन है, तो वो व्यक्ति बस इस क्लाइंट में जुड़ जाता है - नया पासवर्ड नहीं भेजा जाता।",
        },
        {
          en: "A contact with no projects can sign in but sees an empty portal.",
          hi: "जिस कॉन्टैक्ट के पास कोई प्रोजेक्ट नहीं है, वो साइन इन कर सकता है पर उसे खाली पोर्टल दिखेगा।",
        },
      ],
    },
    {
      id: "access",
      title: { en: "Choose projects and sections", hi: "प्रोजेक्ट और सेक्शन चुनें" },
      permission: PERMISSIONS.CLIENT_WRITE,
      steps: [
        {
          text: {
            en: "Each contact's card lists their Projects. Grant a project (1) gives them another of this client's projects: pick the Project, tick the Sections, and click Grant project.",
            hi: "हर कॉन्टैक्ट के कार्ड में उनके Projects दिखते हैं। Grant a project (1) से उन्हें इस क्लाइंट का कोई और प्रोजेक्ट मिलता है: Project चुनें, Sections पर टिक करें, और Grant project पर क्लिक करें।",
          },
          shot: {
            id: "clients-contacts",
            as: "admin",
            path: CONTACTS,
            // Numbered in screen order along the project row: switch, pencil, bin.
            highlight: [
              { role: "button", name: "Grant a project" },
              { role: "switch", name: "Access to Sunmeadow Organics Launch" },
              { role: "button", name: "Sections for Sunmeadow Organics Launch" },
              { role: "button", name: "Remove Sunmeadow Organics Launch" },
            ],
          },
        },
        {
          text: {
            en: "To pause someone's access to one project, turn off its Access switch (2). Turn it back on to resume. Their login and other projects are not touched.",
            hi: "किसी की एक प्रोजेक्ट की एक्सेस रोकनी हो, तो उसका Access स्विच (2) बंद करें। फिर से शुरू करने के लिए वापस चालू करें। उनका लॉगिन और बाकी प्रोजेक्ट वैसे ही रहते हैं।",
          },
        },
        {
          text: {
            en: "To change which sections they see, click the pencil (3) next to the switch.",
            hi: "वो कौन से सेक्शन देखें, ये बदलने के लिए स्विच के पास वाली पेंसिल (3) पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "The bin icon (4) at the end of the row removes that project from the contact. Click Remove to confirm - they stop seeing it at once. Their login and other projects stay as they are.",
            hi: "लाइन के आखिर में डिब्बे वाला आइकन (4) उस कॉन्टैक्ट से वो प्रोजेक्ट हटाता है। कन्फ़र्म करने के लिए Remove पर क्लिक करें - वो प्रोजेक्ट उन्हें तुरंत दिखना बंद हो जाता है। उनका लॉगिन और बाकी प्रोजेक्ट वैसे ही रहते हैं।",
          },
        },
        {
          text: {
            en: "In the box the pencil opens, tick or untick sections, like Content plan (1) or Email campaigns (2), then click Save sections (3). Anything left unticked stays hidden from them.",
            hi: "पेंसिल से खुलने वाले बॉक्स में सेक्शन पर टिक लगाएँ या हटाएँ, जैसे Content plan (1) या Email campaigns (2), फिर Save sections (3) पर क्लिक करें। जिस पर टिक नहीं है, वो उन्हें नहीं दिखता।",
          },
          shot: {
            id: "clients-sections",
            as: "admin",
            path: CONTACTS,
            actions: [
              { click: { role: "button", name: "Sections for Sunmeadow Organics Launch" } },
            ],
            highlight: [
              { role: "checkbox", name: "Content plan" },
              { role: "checkbox", name: "Email campaigns" },
              { role: "button", name: "Save sections" },
            ],
            crop: { role: "dialog" },
          },
        },
      ],
      tips: [
        {
          en: "The sections are: Content plan, Documents & assets, Calendars, Product catalog, Sales channels, Inventory, Email campaigns and Activity. Each box explains what it shows.",
          hi: "सेक्शन ये हैं: Content plan, Documents & assets, Calendars, Product catalog, Sales channels, Inventory, Email campaigns और Activity। हर बॉक्स में लिखा है कि वो क्या दिखाता है।",
        },
        {
          en: "Some sections let the client make changes: Content plan (add plan items and attach finished work), Documents & assets (upload files), Calendars (fill in shared calendars) and Email campaigns (send real email from the project's account). Tick these with care.",
          hi: "कुछ सेक्शन में क्लाइंट बदलाव कर सकते हैं: Content plan (प्लान आइटम जोड़ना और बना हुआ काम अटैच करना), Documents & assets (फाइलें अपलोड करना), Calendars (शेयर किए गए कैलेंडर भरना) और Email campaigns (प्रोजेक्ट के अकाउंट से असली ईमेल भेजना)। इन पर सोच-समझकर टिक करें।",
        },
        {
          en: "Calendars shows only the calendars you have shared from the project's Calendars tab with the Share button.",
          hi: "Calendars में सिर्फ वही कैलेंडर दिखते हैं जो आपने प्रोजेक्ट के Calendars टैब से Share बटन द्वारा शेयर किए हैं।",
        },
      ],
    },
    {
      id: "login",
      title: {
        en: "Reset a password or switch off a login",
        hi: "पासवर्ड रीसेट करें या लॉगिन बंद करें",
      },
      permission: PERMISSIONS.CLIENT_WRITE,
      steps: [
        {
          text: {
            en: "Click New password on the contact's card. Keep Force a password change on first sign-in ticked (1) and click Generate and email (2). A new password is emailed to them, and the old one stops working at once.",
            hi: "कॉन्टैक्ट के कार्ड पर New password पर क्लिक करें। Force a password change on first sign-in पर टिक (1) रहने दें और Generate and email (2) पर क्लिक करें। नया पासवर्ड उन्हें ईमेल हो जाता है, और पुराना तुरंत बंद हो जाता है।",
          },
          shot: {
            id: "clients-new-password",
            as: "admin",
            path: CONTACTS,
            actions: [{ click: { role: "button", name: "New password" } }],
            highlight: [
              { role: "checkbox", name: "Force a password change on first sign-in" },
              { role: "button", name: "Generate and email" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Click Disable to stop someone signing in at all, for every project. Their card then shows Login disabled. Click Enable to let them back in.",
            hi: "किसी का साइन इन पूरी तरह, हर प्रोजेक्ट के लिए, बंद करने के लिए Disable पर क्लिक करें। फिर उनके कार्ड पर Login disabled दिखता है। वापस अनुमति देने के लिए Enable पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Edit changes their name and phone. The email cannot be changed, because it is their login.",
            hi: "Edit से उनका नाम और फोन बदल सकते हैं। ईमेल नहीं बदल सकता, क्योंकि वही उनका लॉगिन है।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "A contact signs in but sees nothing. Why?",
            hi: "कॉन्टैक्ट साइन इन करता है पर उसे कुछ नहीं दिखता। क्यों?",
          },
          a: {
            en: "They have no projects yet, or their Access switch for the project is off. Grant a project, or turn the switch back on.",
            hi: "उनके पास अभी कोई प्रोजेक्ट नहीं है, या उस प्रोजेक्ट का Access स्विच बंद है। Grant a project करें, या स्विच वापस चालू करें।",
          },
        },
        {
          q: {
            en: "Where did the Portal access tab on projects go?",
            hi: "प्रोजेक्ट्स में Portal access टैब कहाँ गया?",
          },
          a: {
            en: "Portal access is now managed only from Clients, on the client's Contacts tab. When a project is filed under a client, the people who already had portal access to it move to that client's Contacts tab on their own.",
            hi: "पोर्टल एक्सेस अब सिर्फ Clients में, क्लाइंट के Contacts टैब से मैनेज होती है। जब कोई प्रोजेक्ट किसी क्लाइंट में डाला जाता है, तो जिन लोगों के पास पहले से उसकी पोर्टल एक्सेस थी, वो अपने आप उस क्लाइंट के Contacts टैब पर आ जाते हैं।",
          },
        },
      ],
    },
  ],
}
