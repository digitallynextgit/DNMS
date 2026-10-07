import { Mail } from "lucide-react"
import type { HelpGuide } from "../../types"

// Screens: features/project-mailer/components/project-mailer-tab.tsx (Campaigns,
// Templates, Recipients, Accounts and their dialogs), body-composer.tsx and
// recipient-import-dialog.tsx.

const MAILER = "/projects/sunmeadow-organics-launch?tab=mailer"

export const projectMailerGuide: HelpGuide = {
  slug: "project-mailer",
  group: "projects",
  icon: Mail,
  href: "/projects/my-projects",
  title: { en: "Mailer (email campaigns)", hi: "मेलर - ईमेल कैंपेन (Mailer)" },
  summary: {
    en: "Send email campaigns for the client from the client's own email account, to a list of recipients you keep on the project.",
    hi: "क्लाइंट के अपने ईमेल अकाउंट से, प्रोजेक्ट में रखी रिसिपिएंट लिस्ट को, क्लाइंट के लिए ईमेल कैंपेन भेजें।",
  },
  keywords: [
    "mailer",
    "email",
    "campaign",
    "newsletter",
    "template",
    "recipients",
    "subscribers",
    "smtp",
    "send",
    "ईमेल",
    "कैंपेन",
    "न्यूज़लेटर",
    "मेल भेजें",
  ],
  sections: [
    {
      id: "about",
      title: { en: "How the Mailer works", hi: "Mailer कैसे काम करता है" },
      intro: {
        en: "The Mailer tab has four tabs. Set them up in this order: Accounts (the email account to send from), Recipients (who gets it), Templates (optional, reusable emails), then Campaigns (the actual sends).",
        hi: "Mailer टैब के अंदर चार टैब हैं। इन्हें इसी क्रम में सेट करें: Accounts (जिस ईमेल अकाउंट से भेजना है), Recipients (किसे भेजना है), Templates (चाहें तो, बार-बार काम आने वाले ईमेल), फिर Campaigns (असल में भेजना)।",
      },
      steps: [
        {
          text: {
            en: "Open the project from My Projects and click the Mailer tab. Campaigns (1), Templates (2), Recipients (3) and Accounts (4) are along the top.",
            hi: "My Projects से प्रोजेक्ट खोलें और Mailer टैब पर क्लिक करें। ऊपर Campaigns (1), Templates (2), Recipients (3) और Accounts (4) हैं।",
          },
          shot: {
            id: "project-mailer-tabs",
            as: "employee",
            path: MAILER,
            highlight: [
              { role: "tab", name: "Campaigns" },
              { role: "tab", name: "Templates" },
              { role: "tab", name: "Recipients" },
              { role: "tab", name: "Accounts" },
            ],
          },
        },
      ],
      tips: [
        {
          en: "Everyone on the project team can use the Mailer, including its account settings. A campaign sends real email to real people, so check before you send.",
          hi: "प्रोजेक्ट टीम का हर व्यक्ति Mailer इस्तेमाल कर सकता है, उसकी अकाउंट सेटिंग्स भी। कैंपेन असली लोगों को असली ईमेल भेजता है, इसलिए भेजने से पहले जाँच लें।",
        },
      ],
    },
    {
      id: "account",
      title: { en: "Add a sending account", hi: "भेजने वाला अकाउंट जोड़ें" },
      steps: [
        {
          text: {
            en: "Open Accounts and click Add account. Type an Account name (1), like Newsletter, and the Sender name and Sender email the recipients will see.",
            hi: "Accounts खोलें और Add account पर क्लिक करें। Account name (1) लिखें, जैसे Newsletter, और Sender name व Sender email लिखें जो पाने वालों को दिखेंगे।",
          },
          shot: {
            id: "project-mailer-account",
            as: "employee",
            path: MAILER,
            actions: [
              { click: { role: "tab", name: "Accounts" } },
              { click: { role: "button", name: "Add account" } },
            ],
            highlight: [
              { placeholder: "Newsletter" },
              { placeholder: "smtp.gmail.com" },
              { role: "button", name: "Add account", nth: -1 },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "From the client's email provider, fill in the SMTP host (2), Port, Username and Password. Port 587 goes with SSL off; port 465 with SSL on. Click Add account (3).",
            hi: "क्लाइंट के ईमेल प्रोवाइडर से SMTP host (2), Port, Username और Password भरें। Port 587 के साथ SSL बंद रखें; port 465 के साथ SSL चालू। Add account (3) पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Click Test on the account, type your own email under Send to, and click Send test. When it works, the account shows Verified. Failing means a detail is wrong - read the Last error line.",
            hi: "अकाउंट पर Test पर क्लिक करें, Send to में अपना ईमेल लिखें, और Send test पर क्लिक करें। सही चलने पर अकाउंट पर Verified दिखता है। Failing का मतलब कोई डिटेल गलत है - Last error वाली लाइन पढ़ें।",
          },
        },
      ],
      tips: [
        {
          en: "A project can have several accounts, for example one for newsletters and one for offers. Turn Active off and campaigns can no longer be sent from that account.",
          hi: "एक प्रोजेक्ट में कई अकाउंट हो सकते हैं, जैसे एक न्यूज़लेटर के लिए और एक ऑफर्स के लिए। Active बंद करने पर उस अकाउंट से कैंपेन नहीं भेजे जा सकते।",
        },
        {
          en: "The Sender email must belong to the SMTP account's domain. The password is stored encrypted.",
          hi: "Sender email उसी डोमेन का होना चाहिए जिसका SMTP अकाउंट है। पासवर्ड एन्क्रिप्ट करके सेव होता है।",
        },
      ],
    },
    {
      id: "recipients",
      title: { en: "Build the recipient list", hi: "रिसिपिएंट लिस्ट बनाएँ" },
      steps: [
        {
          text: {
            en: "Open Recipients and click Add recipients. Under Addresses (1), paste one address per line - Name <email> or Name, email work too. Add Tags (2), comma-separated, like newsletter, vip. Click Add to list (3). Addresses already on the list are skipped.",
            hi: "Recipients खोलें और Add recipients पर क्लिक करें। Addresses (1) में हर लाइन में एक ईमेल पेस्ट करें - Name <email> या Name, email भी चलता है। Tags (2) डालें, कॉमा लगाकर, जैसे newsletter, vip। Add to list (3) पर क्लिक करें। जो ईमेल पहले से लिस्ट में हैं, वो छोड़ दिए जाते हैं।",
          },
          shot: {
            id: "project-mailer-recipients",
            as: "employee",
            path: MAILER,
            actions: [
              { click: { role: "tab", name: "Recipients" } },
              { click: { role: "button", name: "Add recipients" } },
            ],
            highlight: [
              // The only text box in this dialog.
              { css: "[role=dialog] textarea" },
              { placeholder: "newsletter, vip" },
              { role: "button", name: "Add to list" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Have a spreadsheet? Click Upload sheet and pick an .xlsx, .xls or .csv file. Choose which column holds the email address, check the preview, and confirm. Extra columns are kept as merge variables.",
            hi: "स्प्रेडशीट है? Upload sheet पर क्लिक करें और .xlsx, .xls या .csv फाइल चुनें। चुनें कि ईमेल किस कॉलम में है, प्रीव्यू देखें, और कन्फर्म करें। बाकी कॉलम merge variables के रूप में रखे जाते हैं।",
          },
        },
        {
          text: {
            en: "The tag buttons at the top show each group and how many people are in it - click one to see only them. Turn off someone's Subscribed switch to stop sending to them without deleting them.",
            hi: "ऊपर के टैग बटन हर ग्रुप और उसमें कितने लोग हैं, ये दिखाते हैं - सिर्फ उन्हें देखने के लिए किसी पर क्लिक करें। किसी को डिलीट किए बिना मेल भेजना बंद करना हो, तो उसका Subscribed स्विच बंद कर दें।",
          },
        },
      ],
    },
    {
      id: "templates",
      title: { en: "Save a template", hi: "टेम्पलेट सेव करें" },
      steps: [
        {
          text: {
            en: "Open Templates and click New template. Give it a Name (only your team sees it), a Subject and a Body. Write in the Editor, or switch to HTML. The preview updates as you type. Click Create.",
            hi: "Templates खोलें और New template पर क्लिक करें। उसे Name दें (ये सिर्फ आपकी टीम को दिखता है), Subject और Body लिखें। Editor में लिखें, या HTML पर स्विच करें। आपके टाइप करते ही प्रीव्यू बदलता है। Create पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Use variables to make each email personal. For example {{name|there}} puts in the person's name, or the word there when the name is missing.",
            hi: "हर ईमेल को पर्सनल बनाने के लिए variables इस्तेमाल करें। जैसे {{name|there}} व्यक्ति का नाम डालता है, और नाम न हो तो there शब्द।",
          },
        },
      ],
      tips: [
        {
          en: "Images you insert are uploaded and hosted for you. Many email apps hide images until the reader allows them, so never put important words only inside an image.",
          hi: "जो इमेज आप डालते हैं वो अपलोड होकर होस्ट हो जाती हैं। कई ईमेल ऐप्स इमेज तब तक छिपाते हैं जब तक पढ़ने वाला अनुमति न दे, इसलिए ज़रूरी बात सिर्फ इमेज के अंदर कभी न लिखें।",
        },
      ],
    },
    {
      id: "campaign",
      title: { en: "Send a campaign", hi: "कैंपेन भेजें" },
      steps: [
        {
          text: {
            en: "Open Campaigns and click New campaign. It works once there is an active account and at least one subscribed recipient - if not, a note says what is missing.",
            hi: "Campaigns खोलें और New campaign पर क्लिक करें। ये तभी चलता है जब कम से कम एक active अकाउंट और एक subscribed रिसिपिएंट हो - नहीं तो एक नोट बताता है कि क्या कमी है।",
          },
        },
        {
          text: {
            en: "Pick the account under Send from (1) and type a Campaign name. To reuse a template, pick it under Start from a template (2) - its Subject and Body are copied in, and the preview on the right shows the email. Check the Subject and Body.",
            hi: "Send from (1) में अकाउंट चुनें और Campaign name लिखें। टेम्पलेट इस्तेमाल करना हो तो Start from a template (2) में चुनें - उसका Subject और Body अपने आप भर जाते हैं, और दाईं ओर के प्रीव्यू में ईमेल दिखता है। Subject और Body जाँचें।",
          },
          shot: {
            id: "project-mailer-compose",
            as: "employee",
            path: MAILER,
            actions: [
              { click: { role: "button", name: "New campaign" } },
              // Pick a template, so Subject, Body and the preview are filled in.
              {
                click: {
                  css: '[role=dialog] div:has(> label:text-is("Start from a template")) > button[role=combobox]',
                },
              },
              { click: { role: "option", nth: 0 } },
            ],
            // The dropdowns themselves - their captions aren't tied to them.
            highlight: [
              {
                css: '[role=dialog] div:has(> label:has-text("Send from")) > button[role=combobox]',
              },
              {
                css: '[role=dialog] div:has(> label:text-is("Start from a template")) > button[role=combobox]',
              },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Scroll down to Send to (1) and tick tags to send to some groups only - no tag ticked means everyone subscribed. The line under it says how many people it will go to. Click Queue for (number) (2).",
            hi: "नीचे Send to (1) तक स्क्रॉल करें और सिर्फ कुछ ग्रुप्स को भेजने के लिए टैग पर टिक करें - कोई टैग न चुनने का मतलब सभी subscribed लोग। उसके नीचे की लाइन बताती है कि ईमेल कितने लोगों को जाएगा। Queue for (संख्या) (2) पर क्लिक करें।",
          },
          shot: {
            id: "project-mailer-send-to",
            as: "employee",
            path: MAILER,
            actions: [
              { click: { role: "button", name: "New campaign" } },
              // Send to sits below the body editor; pointing at it scrolls the
              // dialog down to it. (Send from then scrolls out of view - that is
              // why this is a picture of its own.)
              { hover: { text: "Send to", exact: true } },
            ],
            highlight: [
              { css: '[role=dialog] div:has(> label:text-is("Send to"))' },
              { role: "button", name: "Queue for" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Sending starts within 30 seconds and runs in the background, so you can close the tab. Each person gets their own separate email - nobody sees anyone else's address.",
            hi: "भेजना 30 सेकंड के अंदर शुरू होता है और बैकग्राउंड में चलता है, इसलिए आप टैब बंद कर सकते हैं। हर व्यक्ति को अलग ईमेल जाता है - कोई किसी और का पता नहीं देख सकता।",
          },
        },
        {
          text: {
            en: "Each campaign card shows how many were sent and failed. Click the card to see who received it. Cancel stops a campaign that is still sending - emails already sent cannot be called back.",
            hi: "हर कैंपेन कार्ड दिखाता है कि कितने भेजे गए और कितने फेल हुए। किसे मिला, ये देखने के लिए कार्ड पर क्लिक करें। Cancel अभी भेजे जा रहे कैंपेन को रोक देता है - जो ईमेल जा चुके हैं वो वापस नहीं आते।",
          },
        },
      ],
      tips: [
        {
          en: "Picking a template copies its content into the campaign. Changing the template later does not change campaigns already sent.",
          hi: "टेम्पलेट चुनने पर उसका कंटेंट कैंपेन में कॉपी हो जाता है। बाद में टेम्पलेट बदलने से पहले भेजे गए कैंपेन नहीं बदलते।",
        },
        {
          en: "If the client's portal has the Email campaigns section, they can send campaigns too. Those cards show the client's name.",
          hi: "अगर क्लाइंट के पोर्टल में Email campaigns सेक्शन है, तो वो भी कैंपेन भेज सकते हैं। ऐसे कार्ड पर क्लाइंट का नाम दिखता है।",
        },
      ],
    },
  ],
}
