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
            en: "The folder tiles, like Profile Photos, Employee Documents, Project Files, Photo Gallery, Chat Media and Resumes, filter the list below. Above the list, Search files or owner... finds a file by its name or owner, and the status menu next to it (All, In use or Orphaned) filters by status.",
            hi: "Profile Photos, Employee Documents, Project Files, Photo Gallery, Chat Media और Resumes जैसी फ़ोल्डर टाइल्स नीचे की लिस्ट को फ़िल्टर करती हैं। लिस्ट के ऊपर Search files or owner... से फ़ाइल उसके नाम या मालिक से ढूँढें, और उसके बगल वाले स्टेटस मेन्यू (All, In use या Orphaned) से स्टेटस के हिसाब से फ़िल्टर करें।",
          },
        },
        {
          text: {
            en: "Each file has View, Download and Delete buttons at the end of its row. Click a column heading, like Size, to sort by it. Export, above the list, downloads the file list as a CSV or Excel file.",
            hi: "हर फ़ाइल की लाइन के आखिर में View, Download और Delete बटन होते हैं। किसी कॉलम के नाम पर, जैसे Size, क्लिक करके उसी से sort करें। लिस्ट के ऊपर Export से फ़ाइलों की लिस्ट CSV या Excel file में डाउनलोड होती है।",
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
        {
          en: "The Drive Backups tile holds the nightly copies of Repository files from Google Drive. They count as In use, so Clean up never deletes them.",
          hi: "Drive Backups टाइल में Google Drive से हर रात ली गई Repository फ़ाइलों की कॉपी होती हैं। ये In use गिनी जाती हैं, इसलिए Clean up इन्हें कभी डिलीट नहीं करता।",
        },
      ],
    },
    {
      id: "google-drive",
      title: { en: "Google Drive (Repository files)", hi: "Google Drive (Repository की फ़ाइलें)" },
      intro: {
        en: "Project Repository files can live in the company's Google Drive account instead of Backblaze. Each project gets its own folder there, shared with the project's team on their work email, and a copy of every file goes to Backblaze each night.",
        hi: "प्रोजेक्ट की Repository फ़ाइलें Backblaze की जगह कंपनी के Google Drive अकाउंट में रखी जा सकती हैं। वहाँ हर प्रोजेक्ट का अपना फ़ोल्डर होता है, जो प्रोजेक्ट की टीम के साथ उनकी work email पर शेयर होता है, और हर रात हर फ़ाइल की एक कॉपी Backblaze में जाती है।",
      },
      steps: [
        {
          text: {
            en: "The Google Drive card shows the connected account, its plan (Free · 15 GB or a Google One plan) and how full it is: Drive, Gmail & Photos and Trash. A Repository badge means new Repository uploads go to Drive. The card also shows how many Repository files are in Drive and on Backblaze, and the last backup.",
            hi: "Google Drive कार्ड पर जुड़ा हुआ अकाउंट, उसका प्लान (Free · 15 GB या कोई Google One प्लान) और कितनी जगह भरी है दिखता है: Drive, Gmail & Photos और Trash। Repository बैज का मतलब है कि नई Repository अपलोड Drive में जाती हैं। कार्ड पर ये भी दिखता है कि कितनी Repository फ़ाइलें Drive में हैं और कितनी Backblaze पर, और पिछला बैकअप कब हुआ।",
          },
        },
        {
          text: {
            en: "Warnings appear on the card when space runs low. When usage passes 10 GB on the free plan, it suggests upgrading to Google One 100 GB (₹130 a month). Buy the plan from the Google account itself; the card picks it up on its own.",
            hi: "जगह कम होने पर कार्ड पर चेतावनी दिखती है। फ्री प्लान पर 10 GB से ज़्यादा भरने पर ये Google One 100 GB (₹130 महीना) लेने का सुझाव देता है। प्लान Google अकाउंट से ही खरीदें; कार्ड उसे अपने आप दिखाने लगता है।",
          },
        },
        {
          text: {
            en: "Click the card to open it. Under Repository uploads go to, choose Backblaze or Google Drive and confirm. Files already stored keep opening from wherever they are, so you can switch back at any time.",
            hi: "कार्ड पर क्लिक करके उसे खोलें। Repository uploads go to में Backblaze या Google Drive चुनें और पक्का करें। पहले से रखी फ़ाइलें जहाँ हैं वहीं से खुलती रहती हैं, इसलिए आप कभी भी वापस बदल सकते हैं।",
          },
        },
        {
          text: {
            en: "Files shows the DNMS folder in Drive, with one folder per project. Click a folder to go into it; each file has Open in Drive and Download buttons.",
            hi: "Files में Drive का DNMS फ़ोल्डर दिखता है, जिसमें हर प्रोजेक्ट का एक फ़ोल्डर है। किसी फ़ोल्डर में जाने के लिए उस पर क्लिक करें; हर फ़ाइल पर Open in Drive और Download बटन हैं।",
          },
        },
        {
          text: {
            en: "Move to Drive lists every project with its files still on Backblaze or in the old Shared Drive. Click Move on one project, or Move everything. Each file is copied to its project's Drive folder and checked byte for byte before DNMS switches to it. You can leave the page while it runs.",
            hi: "Move to Drive में हर प्रोजेक्ट की लिस्ट है, साथ में उसकी वो फ़ाइलें जो अभी Backblaze या पुराने Shared Drive में हैं। किसी एक प्रोजेक्ट पर Move पर क्लिक करें, या Move everything पर। हर फ़ाइल उसके प्रोजेक्ट के Drive फ़ोल्डर में कॉपी होती है और DNMS उसे इस्तेमाल करने से पहले बाइट-बाइट मिलान करके जाँचता है। चलते समय आप पेज छोड़ सकते हैं।",
          },
        },
        {
          text: {
            en: "Backup shows the nightly copy to Backblaze: it runs every night at 2 AM IST and copies new and changed files. Google Docs and Sheets are saved as Word and Excel files. Click Back up now to run it straight away.",
            hi: "Backup में Backblaze पर रोज़ रात की कॉपी दिखती है: ये हर रात 2 बजे (IST) चलता है और नई व बदली हुई फ़ाइलें कॉपी करता है। Google Docs और Sheets, Word और Excel फ़ाइलों की तरह सेव होते हैं। तुरंत चलाने के लिए Back up now पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "After a move, the Backblaze copies stay where they are and count as the first backup, so nothing is uploaded twice.",
          hi: "मूव के बाद Backblaze वाली कॉपी वहीं रहती हैं और पहला बैकअप गिनी जाती हैं, इसलिए कुछ भी दो बार अपलोड नहीं होता।",
        },
        {
          en: "A file deleted from the Repository keeps its backup for 30 days, so a mistake can still be recovered.",
          hi: "Repository से डिलीट की गई फ़ाइल का बैकअप 30 दिन तक रहता है, ताकि गलती हो जाए तो फ़ाइल वापस मिल सके।",
        },
        {
          en: "If the card says Reconnect needed, open Admin → Integrations and click Reconnect, signing in as the same Google account.",
          hi: "अगर कार्ड पर Reconnect needed लिखा है, तो Admin → Integrations खोलें और Reconnect पर क्लिक करें, और उसी Google अकाउंट से साइन इन करें।",
        },
      ],
    },
  ],
}
