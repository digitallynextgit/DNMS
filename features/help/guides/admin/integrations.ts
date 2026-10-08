import { Plug } from "lucide-react"
import type { HelpGuide } from "../../types"

// No screenshots: Integrations reads platform-wide settings, so it doesn't open in the demo workspace.

export const integrationsGuide: HelpGuide = {
  slug: "integrations",
  group: "admin",
  icon: Plug,
  href: "/admin/integrations",
  title: { en: "Integrations", hi: "इंटीग्रेशन (Integrations)" },
  summary: {
    en: "Set up the mail accounts DNMS sends email from, the Google connections, and the company details used in emails.",
    hi: "वो मेल अकाउंट सेट करें जिनसे DNMS ईमेल भेजता है, Google के कनेक्शन, और ईमेल में इस्तेमाल होने वाली कंपनी की जानकारी।",
  },
  keywords: [
    "integrations",
    "settings",
    "smtp",
    "mail server",
    "mailer",
    "email settings",
    "google drive",
    "search console",
    "hr inbox",
    "referral reward",
    "इंटीग्रेशन",
    "सेटिंग्स",
    "मेल सर्वर",
    "ईमेल सेटिंग",
  ],
  sections: [
    {
      id: "overview",
      title: { en: "What this page is for", hi: "ये पेज किस लिए है" },
      intro: {
        en: "Integrations holds the details DNMS needs to work with other services: the mail accounts that send its emails, Google Drive and Google's SEO tools, and a few company details that appear in emails. Saved values are used straight away.",
        hi: "Integrations में वो जानकारी रहती है जो DNMS को दूसरी सर्विसेज़ के साथ काम करने के लिए चाहिए: ईमेल भेजने वाले मेल अकाउंट, Google Drive और Google के SEO टूल्स, और कंपनी की कुछ जानकारी जो ईमेल में दिखती है। सेव की गई वैल्यू तुरंत इस्तेमाल होने लगती है।",
      },
      steps: [
        {
          text: {
            en: "Click Integrations in the sidebar. The page is a list of cards: Company, General, HR, Default mailer, Notifications mailer, HR mailer, Google Drive, Google Search Console and Referrals.",
            hi: "साइडबार में Integrations पर क्लिक करें। पेज पर कार्ड्स की लिस्ट है: Company, General, HR, Default mailer, Notifications mailer, HR mailer, Google Drive, Google Search Console और Referrals।",
          },
        },
        {
          text: {
            en: "A green tick next to a card's name means all its fields are filled. A red cross means something is missing. Point at the small i icon next to the name to read what that card affects.",
            hi: "कार्ड के नाम के पास हरा टिक मतलब उसके सारे फ़ील्ड भरे हैं। लाल क्रॉस मतलब कुछ बाकी है। नाम के पास छोटे i आइकन पर माउस ले जाएँ तो पता चलता है कि वो कार्ड किस चीज़ पर असर डालता है।",
          },
        },
      ],
      tips: [
        {
          en: "Only people whose role has the settings:write permission see this page - by default, only Admin.",
          hi: "ये पेज सिर्फ़ उन्हें दिखता है जिनके रोल में settings:write परमिशन है - शुरुआत में सिर्फ़ Admin के पास।",
        },
        {
          en: "These settings are shared by the whole DNMS system, not just one company workspace. That is why they can only be opened from the main DNMS company workspace - in any other workspace this page won't load.",
          hi: "ये सेटिंग्स पूरे DNMS सिस्टम की हैं, किसी एक कंपनी वर्कस्पेस की नहीं। इसीलिए ये सिर्फ़ DNMS की मुख्य कंपनी वाले वर्कस्पेस से खुलती हैं - किसी दूसरे वर्कस्पेस में ये पेज लोड नहीं होगा।",
        },
      ],
    },
    {
      id: "edit",
      title: { en: "Change a setting", hi: "कोई सेटिंग बदलें" },
      steps: [
        {
          text: {
            en: "Find the card and click Edit on it. A box asks, for example, Edit Default mailer settings? and explains what the card affects. Click Yes, edit.",
            hi: "कार्ड ढूँढें और उस पर Edit पर क्लिक करें। एक बॉक्स पूछता है, जैसे Edit Default mailer settings?, और बताता है कि ये कार्ड किस पर असर डालता है। Yes, edit पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Change the fields you need. The small grey line under some fields explains what goes in them.",
            hi: "जो फ़ील्ड बदलने हैं, बदलें। कुछ फ़ील्ड के नीचे छोटी ग्रे लाइन में लिखा होता है कि उसमें क्या भरना है।",
          },
        },
        {
          text: {
            en: "Passwords and keys are never shown - a saved one shows as dots. Leave it blank to keep the saved one, or type a new one to replace it.",
            hi: "पासवर्ड और keys कभी दिखाए नहीं जाते - सेव किया हुआ बिंदुओं (dots) की तरह दिखता है। पुराना रखना है तो खाली छोड़ दें, बदलना है तो नया टाइप करें।",
          },
        },
        {
          text: {
            en: "Click the Save button on the card - it is named after the card, like Save Default mailer. Click Cancel to throw away your changes.",
            hi: "कार्ड पर Save बटन पर क्लिक करें - इसका नाम कार्ड के नाम पर होता है, जैसे Save Default mailer। बदलाव छोड़ने हैं तो Cancel पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "A card that has never been filled in opens straight in edit mode, with no Edit button.",
          hi: "जो कार्ड कभी भरा ही नहीं गया, वो सीधे बदलने वाले मोड में खुला रहता है, उसमें Edit बटन नहीं होता।",
        },
        {
          en: "If you empty a normal (non-password) field and save, DNMS goes back to the value set up on the server, if there is one.",
          hi: "अगर आप कोई नॉर्मल (पासवर्ड के अलावा) फ़ील्ड खाली करके सेव करते हैं, तो DNMS सर्वर पर सेट की गई वैल्यू पर लौट जाता है, अगर ऐसी कोई वैल्यू हो।",
        },
        {
          en: "Every save is written to the Audit Log under the Admin module - only the names of the changed fields, never the values.",
          hi: "हर सेव Audit Log में Admin मॉड्यूल के अंदर दर्ज होता है - सिर्फ़ बदले गए फ़ील्ड के नाम, वैल्यू कभी नहीं।",
        },
      ],
    },
    {
      id: "mailers",
      title: { en: "Email accounts (SMTP mailers)", hi: "ईमेल अकाउंट (SMTP mailers)" },
      intro: {
        en: "SMTP is simply the standard way a program hands an email to a mail server to deliver. Each mailer card holds the login of one mail account, which you get from your email provider, such as Google Workspace or Brevo.",
        hi: "SMTP बस वो आम तरीका है जिससे कोई प्रोग्राम ईमेल को मेल सर्वर तक पहुँचाता है ताकि वो आगे डिलीवर हो। हर mailer कार्ड में एक मेल अकाउंट का लॉगिन होता है, जो आपको अपने ईमेल प्रोवाइडर से मिलता है, जैसे Google Workspace या Brevo।",
      },
      steps: [
        {
          text: {
            en: "Notifications mailer is marked Required. It is DNMS's safety-net mail account: emails like password reset codes and leave emails go through it, and it is also used whenever the Default or HR mailer is not set up. All its fields must stay filled.",
            hi: "Notifications mailer पर Required लिखा है। ये DNMS का भरोसेमंद बैकअप मेल अकाउंट है: पासवर्ड रीसेट कोड और छुट्टी वाले ईमेल इसी से जाते हैं, और जब Default या HR mailer सेट न हो तब भी यही इस्तेमाल होता है। इसके सारे फ़ील्ड हमेशा भरे रहने चाहिए।",
          },
        },
        {
          text: {
            en: "Default mailer sends other system emails, like birthday wishes. If it is empty, DNMS uses the Notifications mailer instead. HR mailer sends some HR emails, like a leave decision made by someone in HR. If it is empty, DNMS tries the Default mailer, then the Notifications mailer.",
            hi: "Default mailer बाकी सिस्टम ईमेल भेजता है, जैसे जन्मदिन की बधाई। अगर ये खाली है, तो DNMS इसकी जगह Notifications mailer इस्तेमाल करता है। HR mailer कुछ HR ईमेल भेजता है, जैसे HR के किसी व्यक्ति का छुट्टी पर लिया गया फैसला। अगर ये खाली है, तो DNMS पहले Default mailer, फिर Notifications mailer आज़माता है।",
          },
        },
        {
          text: {
            en: "In each mailer: From is the name and address people see, like DNMS <no-reply@yourcompany.com>. Host and Port are the mail server's address and port number from your provider - often 587. Username and Password are the mail account's login.",
            hi: "हर mailer में: From वो नाम और पता है जो लोगों को दिखता है, जैसे DNMS <no-reply@yourcompany.com>। Host और Port मेल सर्वर का पता और पोर्ट नंबर हैं जो आपका प्रोवाइडर देता है - अक्सर 587। Username और Password मेल अकाउंट का लॉगिन है।",
          },
        },
        {
          text: {
            en: "Turn on Use TLS (SSL) only when the port is 465. For port 587, leave it off - the connection is still secured.",
            hi: "Use TLS (SSL) सिर्फ़ तब चालू करें जब पोर्ट 465 हो। पोर्ट 587 के लिए इसे बंद रहने दें - कनेक्शन तब भी सुरक्षित रहता है।",
          },
        },
      ],
      tips: [
        {
          en: "For a Gmail or Google Workspace account, use an App Password from the Google account's security settings, not the normal sign-in password.",
          hi: "Gmail या Google Workspace अकाउंट के लिए, Google अकाउंट की security settings से बना App Password डालें, नॉर्मल लॉगिन पासवर्ड नहीं।",
        },
        {
          en: "There is no test button on this page. To check the Notifications mailer after a change, open the sign-in page in a private window, click Forgot password? and enter your own work email. If the code arrives, mail is working.",
          hi: "इस पेज पर टेस्ट का बटन नहीं है। बदलाव के बाद Notifications mailer जाँचने के लिए, sign-in पेज को private window में खोलें, Forgot password? पर क्लिक करें और अपना ऑफिस ईमेल डालें। अगर कोड आ जाए, तो मेल ठीक चल रहा है।",
        },
      ],
      faq: [
        {
          q: {
            en: "What happens if a mailer's details are wrong?",
            hi: "अगर किसी mailer की जानकारी गलत हो तो क्या होगा?",
          },
          a: {
            en: "Emails sent through it fail and never arrive. Fix the details and save - the next email uses the new values.",
            hi: "उससे भेजे गए ईमेल फेल हो जाते हैं और पहुँचते नहीं। जानकारी ठीक करके सेव करें - अगला ईमेल नई वैल्यू से जाएगा।",
          },
        },
      ],
    },
    {
      id: "company-details",
      title: {
        en: "Company, General, HR and Referrals",
        hi: "Company, General, HR और Referrals",
      },
      steps: [
        {
          text: {
            en: "Company: the Website, Office address and social links (LinkedIn URL, Instagram URL, YouTube URL) shown in the signature at the bottom of emails people send from DNMS. A blank social link is simply left out.",
            hi: "Company: Website, Office address और सोशल लिंक (LinkedIn URL, Instagram URL, YouTube URL), जो DNMS से लोगों के भेजे गए ईमेल के नीचे signature में दिखते हैं। कोई सोशल लिंक खाली हो तो वो बस नहीं दिखता।",
          },
        },
        {
          text: {
            en: "General: the App name, the App URL (the web address used for links in emails) and the Email logo URL - a public PNG or WEBP picture shown at the top of every email.",
            hi: "General: App name, App URL (ईमेल के लिंक्स में इस्तेमाल होने वाला वेब एड्रेस) और Email logo URL - एक पब्लिक PNG या WEBP तस्वीर जो हर ईमेल के ऊपर दिखती है।",
          },
        },
        {
          text: {
            en: "HR: the HR inbox, your shared HR email address. Resignation requests are sent here, and it gets a copy of leave request emails.",
            hi: "HR: HR inbox, यानी HR का कॉमन ईमेल एड्रेस। इस्तीफ़े की रिक्वेस्ट यहीं आती हैं, और छुट्टी की रिक्वेस्ट वाले ईमेल की कॉपी भी यहाँ आती है।",
          },
        },
        {
          text: {
            en: "Referrals: Referral reward (% of monthly salary) is paid to the person who referred someone, once that new joiner completes one year. Leave it blank or 0 to turn the reward off - referrals are still tracked.",
            hi: "Referrals: Referral reward (% of monthly salary) उस व्यक्ति को मिलता है जिसने किसी को रेफ़र किया, जब वो नया व्यक्ति एक साल पूरा कर ले। इनाम बंद करना है तो खाली छोड़ें या 0 लिखें - रेफ़रल फिर भी ट्रैक होते रहेंगे।",
          },
        },
      ],
      tips: [
        {
          en: "A wrong HR inbox means HR won't get resignation emails, so double-check the address after you change it.",
          hi: "HR inbox गलत होने पर HR को इस्तीफ़े वाले ईमेल नहीं मिलेंगे, इसलिए बदलने के बाद एड्रेस दोबारा जाँच लें।",
        },
      ],
    },
    {
      id: "google",
      title: {
        en: "Google Drive and Google Search Console",
        hi: "Google Drive और Google Search Console",
      },
      intro: {
        en: "These cards connect DNMS to Google using a service account - a special robot Google account that DNMS signs in as. Setting them up needs someone with access to your company's Google Cloud account.",
        hi: "ये कार्ड DNMS को Google से एक service account के ज़रिए जोड़ते हैं - ये एक खास रोबोट Google अकाउंट होता है जिससे DNMS साइन इन करता है। इन्हें सेट करने के लिए किसी ऐसे व्यक्ति की ज़रूरत होगी जिसके पास कंपनी के Google Cloud अकाउंट का एक्सेस हो।",
      },
      steps: [
        {
          text: {
            en: "Google Drive: Shared Drive ID is the ID of the company Shared Drive that holds project files (you'll find it in the Drive's web address). Service account JSON is the service account's key file - paste the whole file on one line. It is stored encrypted.",
            hi: "Google Drive: Shared Drive ID कंपनी की उस Shared Drive की ID है जिसमें प्रोजेक्ट फ़ाइलें रहती हैं (ये Drive के वेब एड्रेस में मिलती है)। Service account JSON उस service account की key फ़ाइल है - पूरी फ़ाइल एक ही लाइन में पेस्ट करें। ये encrypted (सुरक्षित तरीके से) सेव होती है।",
          },
        },
        {
          text: {
            en: "Google Search Console powers the SEO reports. Search Console service account JSON and GA4 service account JSON are optional - leave them blank to reuse the Google Drive account. PageSpeed Insights API key is needed for the Core Web Vitals (page speed) checks. IndexNow key is optional and asks search engines like Bing to re-check pages quickly.",
            hi: "Google Search Console से SEO रिपोर्ट्स चलती हैं। Search Console service account JSON और GA4 service account JSON भरना ज़रूरी नहीं - खाली छोड़ेंगे तो Google Drive वाला अकाउंट ही इस्तेमाल होगा। Core Web Vitals (पेज स्पीड) की जाँच के लिए PageSpeed Insights API key चाहिए। IndexNow key ज़रूरी नहीं है - ये Bing जैसे सर्च इंजन से पेज जल्दी दोबारा चेक करवाने के लिए है।",
          },
        },
      ],
      tips: [
        {
          en: "When you click Edit, the grey text under each Google field explains exactly where to get that value.",
          hi: "Edit पर क्लिक करने के बाद, हर Google फ़ील्ड के नीचे की ग्रे लाइन में साफ़ लिखा है कि वो वैल्यू कहाँ से मिलेगी।",
        },
      ],
    },
  ],
}
