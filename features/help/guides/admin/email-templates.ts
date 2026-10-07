import { Mail } from "lucide-react"
import { PERMISSIONS } from "@/lib/constants"
import type { HelpGuide } from "../../types"

export const emailTemplatesGuide: HelpGuide = {
  slug: "email-templates",
  group: "admin",
  icon: Mail,
  href: "/admin/email-templates",
  title: { en: "Email Templates", hi: "ईमेल टेम्पलेट (Email Templates)" },
  summary: {
    en: "Keep ready-made emails - a subject and a message with blanks like {{first_name}} - and edit, add or switch them off.",
    hi: "पहले से तैयार ईमेल रखें - एक subject और मैसेज जिसमें {{first_name}} जैसी खाली जगहें होती हैं - और उन्हें बदलें, नए जोड़ें या बंद करें।",
  },
  keywords: [
    "email",
    "template",
    "templates",
    "mail",
    "merge field",
    "placeholder",
    "subject",
    "ईमेल",
    "टेम्पलेट",
    "मेल",
    "मैसेज",
  ],
  sections: [
    {
      id: "overview",
      title: { en: "What's on this page", hi: "इस पेज पर क्या है" },
      intro: {
        en: "A template is a saved email: a subject line and a message with blanks that are filled in for each person.",
        hi: "टेम्पलेट एक सेव किया हुआ ईमेल है: एक subject लाइन और एक मैसेज, जिसकी खाली जगहें हर व्यक्ति के हिसाब से भरी जाती हैं।",
      },
      steps: [
        {
          text: {
            en: "Click Email Templates in the sidebar. Each row shows the template's Name, its Slug (a short unique code), the Subject, the Trigger (the event it is meant for), whether it is Active, and when it was Last Updated.",
            hi: "साइडबार में Email Templates पर क्लिक करें। हर लाइन में टेम्पलेट का Name, उसका Slug (एक छोटा, अलग कोड), Subject, Trigger (किस मौके के लिए है), Active है या नहीं, और Last Updated (आखिरी बार कब बदला) दिखता है।",
          },
          shot: {
            id: "email-templates-list",
            as: "admin",
            path: "/admin/email-templates",
            highlight: [
              { role: "button", name: "Create Template" },
              { role: "switch", name: "Toggle Welcome Email" },
              { role: "button", name: "Edit Welcome Email" },
            ],
          },
        },
        {
          text: {
            en: "Create Template (1) adds a new one. The Active switch (2) turns a template on or off. The pencil button (3) opens it for editing.",
            hi: "Create Template (1) से नया टेम्पलेट बनता है। Active स्विच (2) से टेम्पलेट चालू या बंद होता है। पेंसिल बटन (3) से टेम्पलेट बदलने के लिए खुलता है।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "Will editing a template change the emails DNMS sends on its own?",
            hi: "क्या टेम्पलेट बदलने से DNMS के अपने आप जाने वाले ईमेल बदल जाएँगे?",
          },
          a: {
            en: "Not at the moment. The emails DNMS sends by itself - like password reset codes, leave emails and birthday wishes - use their own built-in design and don't read these templates. Check with your DNMS team before relying on a template here.",
            hi: "अभी नहीं। DNMS जो ईमेल अपने आप भेजता है - जैसे पासवर्ड रीसेट कोड, छुट्टी वाले ईमेल और जन्मदिन की बधाई - उनका अपना बना-बनाया डिज़ाइन है और वो ये टेम्पलेट नहीं पढ़ते। यहाँ के किसी टेम्पलेट पर भरोसा करने से पहले अपनी DNMS टीम से पूछ लें।",
          },
        },
        {
          q: { en: "Who can change templates?", hi: "टेम्पलेट कौन बदल सकता है?" },
          a: {
            en: "Anyone whose role has email_template:write - by default, Admin and HR Manager. With only email_template:read you can look but not change anything.",
            hi: "जिसके रोल में email_template:write हो - शुरुआत में Admin और HR Manager के पास होती है। सिर्फ़ email_template:read हो, तो आप देख सकते हैं पर कुछ बदल नहीं सकते।",
          },
        },
      ],
    },
    {
      id: "merge-fields",
      title: {
        en: "Merge fields: the blanks that get filled in",
        hi: "Merge fields: वो खाली जगहें जो अपने आप भरती हैं",
      },
      permission: PERMISSIONS.EMAIL_TEMPLATE_WRITE,
      intro: {
        en: 'A merge field is a word inside double curly brackets, like {{first_name}}. When an email is made from the template, each one is swapped for the real value - so "Hi {{first_name}}" becomes "Hi Priya".',
        hi: 'Merge field डबल कर्ली ब्रैकेट में लिखा एक शब्द होता है, जैसे {{first_name}}। जब टेम्पलेट से ईमेल बनता है, तो हर merge field की जगह असली वैल्यू आ जाती है - यानी "Hi {{first_name}}" बन जाता है "Hi Priya"।',
      },
      steps: [
        {
          text: {
            en: "Open a template with its pencil button and scroll to Merge Fields. The fields this template uses show as chips (1). To add one, type its name in the box (2) and press Enter. Click the small x on a chip to remove it.",
            hi: "पेंसिल बटन से टेम्पलेट खोलें और नीचे Merge Fields तक स्क्रॉल करें। इस टेम्पलेट में इस्तेमाल होने वाले फ़ील्ड छोटे चिप्स (1) की तरह दिखते हैं। नया जोड़ने के लिए बॉक्स (2) में उसका नाम टाइप करें और Enter दबाएँ। हटाने के लिए चिप पर छोटे x पर क्लिक करें।",
          },
          shot: {
            id: "email-templates-merge-fields",
            as: "admin",
            path: "/admin/email-templates",
            actions: [
              { click: { role: "button", name: "Edit Welcome Email" } },
              { hover: { placeholder: "field_name (press Enter to add)" } },
            ],
            highlight: [
              { text: "{{first_name}}", exact: true },
              { placeholder: "field_name (press Enter to add)" },
            ],
            crop: { role: "dialog" },
          },
        },
      ],
      tips: [
        {
          en: "The Merge Fields list is a reminder of which blanks the template uses. Write each blank in the Subject or Body HTML exactly as listed, with both pairs of curly brackets.",
          hi: "Merge Fields की लिस्ट एक याद दिलाने के लिए है कि टेम्पलेट में कौन सी खाली जगहें हैं। Subject या Body HTML में हर खाली जगह बिल्कुल वैसे ही लिखें जैसे लिस्ट में है, दोनों तरफ़ डबल कर्ली ब्रैकेट के साथ।",
        },
        {
          en: "Spaces in a field name turn into underscores, so first name becomes first_name.",
          hi: "फ़ील्ड के नाम में स्पेस अपने आप underscore बन जाता है, यानी first name बन जाता है first_name।",
        },
      ],
    },
    {
      id: "edit",
      title: { en: "Edit a template", hi: "टेम्पलेट बदलें" },
      permission: PERMISSIONS.EMAIL_TEMPLATE_WRITE,
      steps: [
        {
          text: {
            en: "Click the pencil button on the template's row. The Edit Template panel opens on the right.",
            hi: "टेम्पलेट की लाइन में पेंसिल बटन पर क्लिक करें। दाईं ओर Edit Template पैनल खुलता है।",
          },
        },
        {
          text: {
            en: "Change the Subject (1) and the Body HTML (2) - the message itself, written in HTML (the code web pages are made of). Put merge fields like {{first_name}} where the person's details should go.",
            hi: "Subject (1) और Body HTML (2) बदलें - Body HTML ही असली मैसेज है, जो HTML (वेब पेज बनाने वाला कोड) में लिखा होता है। जहाँ व्यक्ति की जानकारी आनी है, वहाँ {{first_name}} जैसे merge field लगाएँ।",
          },
          shot: {
            id: "email-templates-edit",
            as: "admin",
            path: "/admin/email-templates",
            actions: [{ click: { role: "button", name: "Edit Welcome Email" } }],
            highlight: [{ label: "Subject" }, { label: "Body HTML" }],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Plain Text Body is optional: a simple text-only copy of the message for email apps that can't show HTML.",
            hi: "Plain Text Body भरना ज़रूरी नहीं है: ये मैसेज की सिर्फ़ टेक्स्ट वाली कॉपी है, उन ईमेल ऐप्स के लिए जो HTML नहीं दिखा पाते।",
          },
        },
        {
          text: {
            en: "Scroll down and click Save Changes. You'll see Template updated.",
            hi: "नीचे स्क्रॉल करें और Save Changes पर क्लिक करें। Template updated का मैसेज दिखेगा।",
          },
        },
      ],
      tips: [
        {
          en: "Not comfortable with HTML? Change only the words between the tags and leave everything inside < > as it is.",
          hi: "HTML नहीं आता? सिर्फ़ टैग्स के बीच के शब्द बदलें और < > के अंदर लिखी चीज़ें जैसी हैं वैसी ही रहने दें।",
        },
        {
          en: "There is no preview or test send on this page, so read the Body HTML carefully before you save.",
          hi: "इस पेज पर preview या टेस्ट ईमेल भेजने का ऑप्शन नहीं है, इसलिए सेव करने से पहले Body HTML ध्यान से पढ़ लें।",
        },
        {
          en: "Leave the Slug as it is unless you have a reason to change it. Two templates can't share a slug.",
          hi: "जब तक कोई खास वजह न हो, Slug मत बदलें। दो टेम्पलेट का एक ही slug नहीं हो सकता।",
        },
      ],
    },
    {
      id: "create",
      title: { en: "Create a new template", hi: "नया टेम्पलेट बनाएँ" },
      permission: PERMISSIONS.EMAIL_TEMPLATE_WRITE,
      steps: [
        {
          text: {
            en: "Click Create Template at the top right of the page.",
            hi: "पेज पर ऊपर दाईं ओर Create Template पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Type a Name (1), like Work Anniversary. The Slug (2) fills itself in from the name, and you can change it if you like. Fields with a red star must be filled: Name, Slug, Subject and Body HTML.",
            hi: "Name (1) टाइप करें, जैसे Work Anniversary। Slug (2) नाम से अपने आप भर जाता है, चाहें तो बदल सकते हैं। लाल स्टार वाले फ़ील्ड भरना ज़रूरी है: Name, Slug, Subject और Body HTML।",
          },
          shot: {
            id: "email-templates-create",
            as: "admin",
            path: "/admin/email-templates",
            actions: [
              { click: { role: "button", name: "Create Template" } },
              { fill: { placeholder: "e.g. Welcome Email" }, value: "Work Anniversary" },
            ],
            highlight: [
              { placeholder: "e.g. Welcome Email" },
              { placeholder: "e.g. welcome-email" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Add the merge fields you used. If you like, type a Trigger - a short event name such as employee.created - as a note of which event the template is for. Keep Active switched on.",
            hi: "जो merge fields इस्तेमाल किए हैं, उन्हें जोड़ें। चाहें तो Trigger भी लिखें - employee.created जैसा छोटा सा नाम - ये नोट करने के लिए कि टेम्पलेट किस मौके के लिए है। Active को चालू रहने दें।",
          },
        },
        {
          text: {
            en: "Click Create Template at the bottom of the panel. The new template appears at the top of the list.",
            hi: "पैनल के नीचे Create Template पर क्लिक करें। नया टेम्पलेट लिस्ट में सबसे ऊपर दिखने लगता है।",
          },
        },
      ],
      tips: [
        {
          en: "The Create Template button at the bottom stays grey until Name, Slug, Subject and Body HTML are all filled.",
          hi: "जब तक Name, Slug, Subject और Body HTML चारों न भरें, नीचे वाला Create Template बटन ग्रे रहता है।",
        },
      ],
    },
  ],
}
