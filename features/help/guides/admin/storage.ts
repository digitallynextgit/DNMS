import { HardDrive } from "lucide-react"
import type { HelpGuide } from "../../types"

// One screenshot only: storage accounts are platform-wide, so they don't load in the demo workspace.

export const storageGuide: HelpGuide = {
  slug: "storage",
  group: "admin",
  icon: HardDrive,
  href: "/admin/storage",
  title: { en: "Storage", hi: "स्टोरेज (Storage)" },
  summary: {
    en: "See where DNMS keeps uploaded files, connect a new storage bucket, check how much space is used, and clean up files nothing uses any more.",
    hi: "देखें DNMS अपलोड की गई फ़ाइलें कहाँ रखता है, नया स्टोरेज bucket जोड़ें, देखें कितनी जगह भरी है, और वो फ़ाइलें साफ़ करें जो अब किसी काम की नहीं।",
  },
  keywords: [
    "storage",
    "bucket",
    "backblaze",
    "b2",
    "files",
    "space",
    "orphan",
    "upload",
    "स्टोरेज",
    "फ़ाइल",
    "जगह",
    "बकेट",
  ],
  sections: [
    {
      id: "overview",
      title: { en: "What Storage is", hi: "Storage क्या है" },
      intro: {
        en: "Every file people upload to DNMS - profile photos, documents, project files, gallery photos, chat files and CVs - is kept in a bucket: a folder in the cloud at Backblaze B2 or a similar service. This page shows the buckets connected to DNMS and what is inside them.",
        hi: "DNMS में जो भी फ़ाइल अपलोड होती है - प्रोफाइल फोटो, डॉक्युमेंट्स, प्रोजेक्ट फ़ाइलें, गैलरी की फोटो, चैट की फ़ाइलें और CV - वो एक bucket में रखी जाती है: Backblaze B2 या ऐसी ही किसी सर्विस पर क्लाउड में एक फ़ोल्डर। इस पेज पर DNMS से जुड़े bucket और उनके अंदर की फ़ाइलें दिखती हैं।",
      },
      steps: [
        {
          text: {
            en: "Click Storage in the sidebar. Each bucket shows as a card with its name, the bucket's own name, and how much space it uses out of the 10 GB free allowance.",
            hi: "साइडबार में Storage पर क्लिक करें। हर bucket एक कार्ड की तरह दिखता है - उसका नाम, bucket का अपना नाम, और 10 GB की फ्री लिमिट में से कितनी जगह भरी है।",
          },
        },
        {
          text: {
            en: "The badges on a card tell you its state: Default means new uploads go here. Off means it is switched off. Verified with a date means the last connection test passed, Test failed means it didn't (the error shows on the card), and Not tested means it hasn't been checked yet.",
            hi: "कार्ड पर लगे बैज उसकी हालत बताते हैं: Default मतलब नई अपलोड यहीं जाती हैं। Off मतलब ये बंद है। तारीख के साथ Verified मतलब पिछली कनेक्शन जाँच पास हुई, Test failed मतलब फेल हुई (गलती कार्ड पर लिखी होती है), और Not tested मतलब अभी जाँच नहीं हुई।",
          },
        },
        {
          text: {
            en: "Use the two small buttons next to Add storage to switch between Card view and Table view.",
            hi: "Add storage के पास वाले दो छोटे बटन से Card view और Table view के बीच बदलें।",
          },
        },
      ],
      tips: [
        {
          en: "Only people whose role has the settings:write permission see this page - by default, only Admin.",
          hi: "ये पेज सिर्फ़ उन्हें दिखता है जिनके रोल में settings:write परमिशन है - शुरुआत में सिर्फ़ Admin के पास।",
        },
        {
          en: "Storage is shared by the whole DNMS system, so buckets can only be seen and changed from the main DNMS company workspace. In any other workspace the page shows No storage connected.",
          hi: "Storage पूरे DNMS सिस्टम का है, इसलिए bucket सिर्फ़ DNMS की मुख्य कंपनी वाले वर्कस्पेस से देखे और बदले जा सकते हैं। किसी दूसरे वर्कस्पेस में पेज पर No storage connected दिखता है।",
        },
      ],
    },
    {
      id: "add",
      title: { en: "Connect a new bucket", hi: "नया bucket जोड़ें" },
      steps: [
        {
          text: {
            en: "Click Add storage at the top right.",
            hi: "ऊपर दाईं ओर Add storage पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Type a Name (1) you'll recognise it by. Then fill in the Endpoint, Region, Bucket and Key ID (2) from your Backblaze account. Endpoint and Region come filled with Backblaze's usual values - change them to match your bucket.",
            hi: "एक Name (1) टाइप करें जिससे आप इसे पहचान सकें। फिर अपने Backblaze अकाउंट से Endpoint, Region, Bucket और Key ID (2) भरें। Endpoint और Region में Backblaze की आम वैल्यू पहले से भरी होती है - अपने bucket के हिसाब से बदल लें।",
          },
          shot: {
            id: "storage-add-dialog",
            as: "admin",
            path: "/admin/storage",
            actions: [{ click: { role: "button", name: "Add storage" } }],
            highlight: [
              { placeholder: "Backblaze B2 · main" },
              { text: "Key ID" },
              { text: "Application key" },
              { role: "button", name: "Connect", exact: true },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Paste the Application key (3) - the secret that goes with the Key ID. It is stored encrypted and never shown again.",
            hi: "Application key (3) पेस्ट करें - ये Key ID के साथ वाला सीक्रेट है। ये encrypted (सुरक्षित तरीके से) सेव होता है और फिर कभी दिखाया नहीं जाता।",
          },
        },
        {
          text: {
            en: "Leave the switch on Available for use and click Connect (4). Then run Test connection on the new card (see below) to make sure it works.",
            hi: "स्विच को Available for use पर रहने दें और Connect (4) पर क्लिक करें। फिर नए कार्ड पर Test connection चलाएँ (नीचे देखें) ताकि पक्का हो जाए कि ये काम कर रहा है।",
          },
        },
      ],
      tips: [
        {
          en: "The very first bucket you connect becomes the Default on its own.",
          hi: "सबसे पहला जोड़ा गया bucket अपने आप Default बन जाता है।",
        },
        {
          en: "Connect stays grey until every field with a red star is filled.",
          hi: "जब तक लाल स्टार वाले सारे फ़ील्ड न भरें, Connect बटन ग्रे रहता है।",
        },
      ],
    },
    {
      id: "manage",
      title: {
        en: "Test, make default, edit or remove a bucket",
        hi: "bucket जाँचें, Default बनाएँ, बदलें या हटाएँ",
      },
      steps: [
        {
          text: {
            en: "On a card, click the ... button (More actions) to see Browse files, Test connection, Make default, Edit and Remove. In Table view, the same actions are small buttons at the end of each row.",
            hi: "कार्ड पर ... बटन (More actions) पर क्लिक करें - इसमें Browse files, Test connection, Make default, Edit और Remove मिलते हैं। Table view में यही काम हर लाइन के आखिर में छोटे बटनों से होते हैं।",
          },
        },
        {
          text: {
            en: "Test connection checks that DNMS can open the bucket with the saved key. A message says it is reachable, or shows the error, and the card's badge changes to Verified or Test failed.",
            hi: "Test connection जाँचता है कि DNMS सेव की गई key से bucket खोल पा रहा है या नहीं। मैसेज में लिखा आता है कि bucket reachable है, या गलती दिखती है, और कार्ड का बैज Verified या Test failed हो जाता है।",
          },
        },
        {
          text: {
            en: "Make default sends all new uploads to this bucket. Files already stored stay where they are. Only a bucket that is switched on can be the default.",
            hi: "Make default से सारी नई अपलोड इस bucket में जाने लगती हैं। पहले से रखी फ़ाइलें जहाँ हैं वहीं रहती हैं। सिर्फ़ चालू (on) bucket ही Default बन सकता है।",
          },
        },
        {
          text: {
            en: "Edit opens the same form as Add storage. Leave Application key blank to keep the saved key.",
            hi: "Edit से वही फ़ॉर्म खुलता है जो Add storage में है। सेव की हुई key रखनी है तो Application key खाली छोड़ दें।",
          },
        },
        {
          text: {
            en: "Remove disconnects the bucket from DNMS. Only the saved login details are removed - the bucket and its files are not touched.",
            hi: "Remove से bucket DNMS से अलग हो जाता है। सिर्फ़ सेव की हुई लॉगिन जानकारी हटती है - bucket और उसकी फ़ाइलों को कुछ नहीं होता।",
          },
        },
      ],
      tips: [
        {
          en: "You can't remove the Default bucket. Make another bucket the default first.",
          hi: "Default bucket को हटाया नहीं जा सकता। पहले किसी दूसरे bucket को Default बनाएँ।",
        },
        {
          en: "Changes to buckets are written to the Audit Log under the Admin module. The application key itself is never logged.",
          hi: "bucket में किए गए बदलाव Audit Log में Admin मॉड्यूल के अंदर दर्ज होते हैं। Application key खुद कभी लॉग नहीं होती।",
        },
      ],
    },
    {
      id: "browse",
      title: { en: "Browse files and free up space", hi: "फ़ाइलें देखें और जगह खाली करें" },
      steps: [
        {
          text: {
            en: "Click a card (or Browse files) to open the bucket. At the top you see Storage used, then three boxes: Total Files, Storage Used and Orphaned.",
            hi: "bucket खोलने के लिए कार्ड पर (या Browse files पर) क्लिक करें। सबसे ऊपर Storage used दिखता है, फिर तीन बॉक्स: Total Files, Storage Used और Orphaned।",
          },
        },
        {
          text: {
            en: "The folder tiles, like Profile Photos, Employee Documents, Project Files, Photo Gallery, Chat Media and Resumes, filter the list below. Search files or owner... finds a file by its name or owner, and All, In use and Orphaned filter by status.",
            hi: "Profile Photos, Employee Documents, Project Files, Photo Gallery, Chat Media और Resumes जैसी फ़ोल्डर टाइल्स नीचे की लिस्ट को फ़िल्टर करती हैं। Search files or owner... से फ़ाइल उसके नाम या मालिक से ढूँढें, और All, In use और Orphaned से स्टेटस के हिसाब से फ़िल्टर करें।",
          },
        },
        {
          text: {
            en: "Each file has View, Download and Delete buttons at the end of its row.",
            hi: "हर फ़ाइल की लाइन के आखिर में View, Download और Delete बटन होते हैं।",
          },
        },
        {
          text: {
            en: "Orphaned means no record in DNMS points to the file any more - it is only taking up space. To delete all of them at once, click Clean up ... orphans at the top (it shows how many) and confirm with Delete orphans. Files that are In use are not touched.",
            hi: "Orphaned का मतलब है कि DNMS का कोई भी रिकॉर्ड अब उस फ़ाइल से जुड़ा नहीं है - वो बस जगह घेर रही है। सबको एक साथ डिलीट करने के लिए ऊपर Clean up ... orphans पर क्लिक करें (इसमें गिनती लिखी होती है) और Delete orphans से पक्का करें। In use वाली फ़ाइलों को कुछ नहीं होता।",
          },
        },
        {
          text: {
            en: "Click All storage at the top to go back to the list of buckets.",
            hi: "bucket की लिस्ट पर वापस जाने के लिए ऊपर All storage पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "For now, View, Download, Delete and Clean up always act on the Default bucket, even when another bucket is open. Use them only inside the Default bucket.",
          hi: "अभी के लिए View, Download, Delete और Clean up हमेशा Default bucket पर काम करते हैं, चाहे कोई दूसरा bucket खुला हो। इन्हें सिर्फ़ Default bucket के अंदर इस्तेमाल करें।",
        },
        {
          en: "Deleting a file that is In use also removes it from where it was used - for example, a document from someone's profile. Deleting can't be undone.",
          hi: "In use वाली फ़ाइल डिलीट करने पर वो उस जगह से भी हट जाती है जहाँ इस्तेमाल हो रही थी - जैसे किसी की प्रोफाइल से डॉक्युमेंट। डिलीट को वापस नहीं किया जा सकता।",
        },
      ],
    },
  ],
}
