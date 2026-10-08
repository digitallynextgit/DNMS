import { BarChart3 } from "lucide-react"
import type { HelpGuide, HelpTarget } from "../../types"

// Screens: insights-tab.tsx, integration-tab.tsx (Connections) and features/seo/components/*.

const INSIGHTS = "/projects/sunmeadow-organics-launch?tab=insights"
const SEO = "/projects/urbannest-website-seo?tab=seo"

/** The SEO site picker (a Radix Select trigger) while it shows All sites. */
const SITE_PICKER: HelpTarget = { css: 'button[role=combobox]:has-text("All sites (")' }

export const projectInsightsSeoGuide: HelpGuide = {
  slug: "project-insights-seo",
  group: "projects",
  icon: BarChart3,
  href: "/projects/my-projects",
  title: { en: "Insights and SEO", hi: "इनसाइट्स और SEO (Insights, SEO)" },
  summary: {
    en: "See how the client's Meta ads are doing on the Insights tab, and how their websites do in Google search on the SEO tab.",
    hi: "Insights टैब पर देखें कि क्लाइंट के Meta ads कैसा कर रहे हैं, और SEO टैब पर देखें कि उनकी वेबसाइटें Google सर्च में कैसा कर रही हैं।",
  },
  keywords: [
    "insights",
    "meta",
    "facebook",
    "instagram",
    "ads",
    "spend",
    "roas",
    "seo",
    "search console",
    "google",
    "keywords",
    "clicks",
    "impressions",
    "ranking",
    "विज्ञापन",
    "एड्स",
    "गूगल",
    "रैंकिंग",
    "कीवर्ड",
  ],
  sections: [
    {
      id: "insights",
      title: { en: "See ad results (Insights tab)", hi: "एड के नतीजे देखें (Insights टैब)" },
      steps: [
        {
          text: {
            en: "Open the project from My Projects and click the Insights tab. Meta Ads shows the client's Facebook and Instagram ad results: Spend, Impressions, Clicks, Reach, Purchases, Purchase value, ROAS and Avg CPC.",
            hi: "My Projects से प्रोजेक्ट खोलें और Insights टैब पर क्लिक करें। Meta Ads में क्लाइंट के Facebook और Instagram एड के नतीजे दिखते हैं: Spend, Impressions, Clicks, Reach, Purchases, Purchase value, ROAS और Avg CPC।",
          },
        },
        {
          text: {
            en: "Pick how far back to look: 7d, 14d, 30d (1) - the default - or All, or click Custom (2) to pick your own start and end dates. The chart compares spend with purchase value day by day.",
            hi: "कितना पीछे तक देखना है चुनें: 7d, 14d, 30d (1) - जो पहले से चुना होता है - या All, या अपनी शुरुआत और आखिरी तारीख चुनने के लिए Custom (2) पर क्लिक करें। चार्ट हर दिन का खर्च और खरीदारी की वैल्यू साथ में दिखाता है।",
          },
          shot: {
            id: "project-insights-seo-meta",
            as: "manager",
            path: INSIGHTS,
            highlight: [
              { role: "tab", name: "30d" },
              { role: "button", name: "Custom" },
              { role: "button", name: "Sync now" },
            ],
          },
        },
        {
          text: {
            en: "Below the chart, search campaigns, filter them by status (Active, Paused or Completed), and sort by Spend, ROAS, Purchases, Impressions or Clicks. Sync now (3) pulls the latest numbers from Meta.",
            hi: "चार्ट के नीचे कैंपेन खोजें, स्टेटस (Active, Paused या Completed) से फिल्टर करें, और Spend, ROAS, Purchases, Impressions या Clicks से सॉर्ट करें। Sync now (3) Meta से ताज़ा नंबर लाता है।",
          },
        },
      ],
      tips: [
        {
          en: "Everyone on the project can see Insights. Sync now and the connection settings are for the Account Manager or a project admin.",
          hi: "प्रोजेक्ट का हर व्यक्ति Insights देख सकता है। Sync now और कनेक्शन की सेटिंग्स Account Manager या प्रोजेक्ट एडमिन के लिए हैं।",
        },
        {
          en: "ROAS is purchase value divided by spend. Above 1x means the ads earned more than they cost.",
          hi: "ROAS मतलब खरीदारी की वैल्यू भाग खर्च। 1x से ऊपर मतलब एड ने अपनी लागत से ज़्यादा कमाया।",
        },
      ],
    },
    {
      id: "connect",
      title: {
        en: "For Account Managers: connect Meta Ads",
        hi: "Account Managers के लिए: Meta Ads जोड़ें",
      },
      steps: [
        {
          text: {
            en: "On the Insights tab, click Connections. On the Meta Ads card, click Connect (1). If Meta Ads is already connected, as here, the same button says Edit.",
            hi: "Insights टैब में Connections पर क्लिक करें। Meta Ads कार्ड पर Connect (1) पर क्लिक करें। अगर Meta Ads पहले से जुड़ा है, जैसा यहाँ है, तो इसी बटन पर Edit लिखा होता है।",
          },
          shot: {
            id: "project-insights-seo-connections",
            as: "manager",
            path: INSIGHTS,
            actions: [{ click: { role: "button", name: "Connections" } }],
            highlight: [
              // "Connect" before Meta Ads is connected, "Edit" after.
              {
                css: '[role=dialog] button:has-text("Edit"), [role=dialog] button:has-text("Connect")',
              },
              { role: "button", name: "Disconnect" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Fill in the Ad Account ID and the Access Token from the client's Meta account, plus the App ID and App Secret if you have them. Click Connect. The first sync starts on its own.",
            hi: "क्लाइंट के Meta अकाउंट से Ad Account ID और Access Token भरें, और अगर हों तो App ID और App Secret भी। Connect पर क्लिक करें। पहला सिंक अपने आप शुरू हो जाता है।",
          },
        },
        {
          text: {
            en: "Later, Edit (1) opens the saved details so you can change them; click Save when done. The bin icon (2) asks first, then disconnects Meta Ads and deletes the saved details and all the synced data for this project. You can connect again any time.",
            hi: "बाद में Edit (1) सेव की हुई डिटेल्स खोलता है ताकि आप उन्हें बदल सकें; हो जाने पर Save पर क्लिक करें। डिब्बे वाला आइकन (2) पहले पूछता है, फिर Meta Ads को हटा देता है और इस प्रोजेक्ट की सेव डिटेल्स और सारा सिंक हुआ डेटा मिटा देता है। आप कभी भी दोबारा जोड़ सकते हैं।",
          },
        },
      ],
    },
    {
      id: "seo-sites",
      title: { en: "Track a website (SEO tab)", hi: "वेबसाइट ट्रैक करें (SEO टैब)" },
      intro: {
        en: "The SEO tab shows the client's Google Search Console results. A project can track several sites, like a main site and a blog.",
        hi: "SEO टैब क्लाइंट के Google Search Console के नतीजे दिखाता है। एक प्रोजेक्ट कई साइट्स ट्रैक कर सकता है, जैसे मेन साइट और ब्लॉग।",
      },
      steps: [
        {
          text: {
            en: "Click the SEO tab. The site picker (1) starts on All sites - every site added together, week over week. The Sites table below lists each one; click a site there for its full report.",
            hi: "SEO टैब पर क्लिक करें। साइट चुनने वाला बॉक्स (1) All sites से शुरू होता है - सारी साइट्स मिलाकर, हफ्ते-दर-हफ्ते। नीचे Sites टेबल में हर साइट दिखती है; पूरी रिपोर्ट के लिए वहाँ किसी साइट पर क्लिक करें।",
          },
          shot: {
            id: "project-insights-seo-sites",
            as: "manager",
            path: SEO,
            highlight: [
              SITE_PICKER,
              { role: "button", name: "Add site" },
              { role: "button", name: "Sync all" },
            ],
          },
        },
        {
          text: {
            en: "Sync all (3) pulls fresh Search Console data for every site that is not paused. Data comes in one week at a time. To track a new site, click Add site (2).",
            hi: "Sync all (3) हर उस साइट का ताज़ा Search Console डेटा लाता है जो paused नहीं है। डेटा एक-एक हफ्ते के हिसाब से आता है। नई साइट ट्रैक करने के लिए Add site (2) पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Type a Name (1), the Domain (2) - just the host, like blog.example.com - and, only if needed, the Search Console property (3). Left blank, it uses the domain property. Click Add site.",
            hi: "Name (1), Domain (2) - सिर्फ होस्ट, जैसे blog.example.com - और ज़रूरत हो तभी Search Console property (3) लिखें। खाली छोड़ने पर domain property इस्तेमाल होती है। Add site पर क्लिक करें।",
          },
          shot: {
            id: "project-insights-seo-add-site",
            as: "manager",
            path: SEO,
            actions: [{ click: { role: "button", name: "Add site" } }],
            highlight: [
              { css: "#new-site-label" },
              { css: "#new-site-domain" },
              { css: "#new-site-gsc" },
            ],
            crop: { role: "dialog" },
          },
        },
      ],
      tips: [
        {
          en: "Everyone on the project can read the SEO reports. Adding, editing, syncing and removing sites is for the Account Manager or a project admin.",
          hi: "प्रोजेक्ट का हर व्यक्ति SEO रिपोर्ट पढ़ सकता है। साइट जोड़ना, बदलना, सिंक करना और हटाना Account Manager या प्रोजेक्ट एडमिन का काम है।",
        },
        {
          en: "Before anything can sync, the client must add DNMS as a user in their Search Console (Settings, then Users and permissions - read access is enough). While a project has no sites yet, the SEO tab shows the exact account to add.",
          hi: "कुछ भी सिंक होने से पहले क्लाइंट को अपने Search Console में DNMS को user के रूप में जोड़ना होता है (Settings, फिर Users and permissions - read एक्सेस काफी है)। जब तक प्रोजेक्ट में कोई साइट नहीं होती, SEO टैब वही अकाउंट दिखाता है जिसे जोड़ना है।",
        },
      ],
    },
    {
      id: "seo-report",
      title: { en: "Read a site's report", hi: "किसी साइट की रिपोर्ट पढ़ें" },
      steps: [
        {
          text: {
            en: "Pick a site in the site picker, or click it in the Sites table. At the top right, Backfill 8 weeks (1) pulls eight weeks of history at once, so a new site has a trend line straight away. Sync (2) pulls the newest week.",
            hi: "साइट चुनने वाले बॉक्स से कोई साइट चुनें, या Sites टेबल में उस पर क्लिक करें। ऊपर दाईं ओर Backfill 8 weeks (1) एक साथ आठ हफ्तों का पुराना डेटा लाता है, ताकि नई साइट का ट्रेंड तुरंत दिखे। Sync (2) सबसे नया हफ्ता लाता है।",
          },
          shot: {
            id: "project-insights-seo-report",
            as: "manager",
            path: SEO,
            actions: [
              { click: SITE_PICKER },
              // Option 0 is "All sites"; option 1 is the first real site.
              { click: { role: "option", nth: 1 } },
              { waitFor: { role: "tab", name: "Performance" } },
            ],
            highlight: [
              { role: "button", name: "Backfill 8 weeks" },
              { role: "button", name: "Sync", exact: true },
              { role: "tab", name: "Start here" },
              { role: "tab", name: "Performance" },
            ],
          },
        },
        {
          text: {
            en: "Edit opens the site's settings, such as its name, Search Console property and money keywords. The bin icon stops tracking the site and deletes its stored history. To stop syncing but keep the history, click Edit, then Options, and turn off Include in weekly sync - the site then shows as paused.",
            hi: "Edit से साइट की सेटिंग्स खुलती हैं, जैसे उसका नाम, Search Console property और money keywords। डिब्बे वाला आइकन साइट की ट्रैकिंग बंद करता है और उसका सेव किया हुआ पुराना डेटा मिटा देता है। अगर सिंक रोकना है पर पुराना डेटा रखना है, तो Edit, फिर Options पर क्लिक करें और Include in weekly sync बंद करें - फिर साइट paused दिखती है।",
          },
        },
        {
          text: {
            en: "The report has seven tabs: Start here (3), Performance (4), Keywords, Content, Health, Links and Work. Start here is a checklist that sets the site up. Work through the steps in order - the highlighted one is next - and click a step's button to do it.",
            hi: "रिपोर्ट में सात टैब हैं: Start here (3), Performance (4), Keywords, Content, Health, Links और Work। Start here एक चेकलिस्ट है जो साइट को सेट करती है। स्टेप्स को क्रम से पूरा करें - हाइलाइट किया हुआ स्टेप अगला है - और कोई स्टेप करने के लिए उसके बटन पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Performance shows Clicks, Impressions, CTR and Avg position, compared with the week before, plus the top pages. Click Explain with AI for a plain-language summary, and Export to download a CSV. On the right of the tabs, the Latest week button picks another week, and the 1 week box next to it adds several weeks together. Every tab uses the period you pick.",
            hi: "Performance में Clicks, Impressions, CTR और Avg position दिखते हैं, पिछले हफ्ते से तुलना के साथ, और साथ में टॉप पेज भी। आसान भाषा में समझने के लिए Explain with AI पर क्लिक करें, और CSV डाउनलोड करने के लिए Export पर। टैब्स की दाईं ओर Latest week बटन से कोई दूसरा हफ्ता चुनें, और उसके बगल वाले 1 week बॉक्स से कई हफ्ते एक साथ जोड़ें। आपका चुना हुआ समय हर टैब पर लागू होता है।",
          },
        },
        {
          text: {
            en: "Work lists the tasks tagged to this site. To add one, create a task on the project's Tasks tab and set its Site field.",
            hi: "Work में इस साइट से जुड़े टास्क दिखते हैं। नया जोड़ने के लिए प्रोजेक्ट के Tasks टैब में टास्क बनाएँ और उसका Site फील्ड सेट करें।",
          },
        },
      ],
      tips: [
        {
          en: "Explain with AI is written from the stored data, and only the Account Manager or a project admin can run it. Check it before you send it to a client.",
          hi: "Explain with AI सेव किए गए डेटा से लिखा जाता है, और इसे सिर्फ Account Manager या प्रोजेक्ट एडमिन चला सकते हैं। क्लाइंट को भेजने से पहले उसे जाँच लें।",
        },
      ],
    },
  ],
}
