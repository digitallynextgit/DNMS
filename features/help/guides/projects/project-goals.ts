import { Target } from "lucide-react"
import type { HelpGuide } from "../../types"

export const projectGoalsGuide: HelpGuide = {
  slug: "project-goals",
  group: "projects",
  icon: Target,
  href: "/projects/my-projects",
  title: { en: "A project's Goals tab", hi: "प्रोजेक्ट का Goals टैब" },
  summary: {
    en: "See what a project is meant to achieve and how far along it is, and - if you run the project - set goals, sub-goals and targets and link the work to them.",
    hi: "देखें कि प्रोजेक्ट से क्या हासिल करना है और काम कितना आगे बढ़ा, और अगर आप प्रोजेक्ट चलाते हैं तो goals, sub-goals और targets बनाएँ और काम को उनसे जोड़ें।",
  },
  keywords: [
    "goals",
    "goal",
    "sub-goal",
    "target",
    "milestone",
    "at risk",
    "slipping",
    "progress",
    "लक्ष्य",
    "गोल",
    "टारगेट",
    "प्रगति",
  ],
  sections: [
    {
      id: "read",
      title: { en: "Read the Goals board", hi: "Goals बोर्ड को समझें" },
      intro: {
        en: "Goals say what the project is for, like launching the brand online. A goal can be broken into sub-goals, and work (tasks) and promised output (targets) can hang under it. Everyone on the project can read this tab.",
        hi: "Goals बताते हैं कि प्रोजेक्ट किसलिए है, जैसे ब्रांड को ऑनलाइन लॉन्च करना। एक goal को sub-goals में बाँटा जा सकता है, और उसके नीचे काम (tasks) और वादा किया गया आउटपुट (targets) जोड़े जा सकते हैं। प्रोजेक्ट पर हर कोई ये टैब देख सकता है।",
      },
      steps: [
        {
          text: {
            en: "Open the project and click the Goals tab (or Open goals on the Overview). The Project goals card (1) at the top shows the Overall percentage, how many goals are Done, how many are Overdue, how many are Slipping (only when some are), and the Next target date.",
            hi: "प्रोजेक्ट खोलें और Goals टैब पर क्लिक करें (या Overview पर Open goals)। ऊपर Project goals कार्ड (1) में Overall प्रतिशत, कितने goals Done हैं, कितने Overdue हैं, कितने Slipping हैं (सिर्फ़ तब जब कोई हो), और अगली Next target तारीख दिखती है।",
          },
          shot: {
            id: "project-goals-board",
            as: "manager",
            path: "/projects/sunmeadow-organics-launch?tab=goals",
            highlight: [
              // The whole summary card, not just its heading.
              { css: 'div:has(> div > div > div > h3:text-is("Project goals"))' },
              { role: "button", name: "Expand all" },
              { role: "button", name: "Add goal" },
            ],
          },
        },
        {
          text: {
            en: "Goals are listed below, numbered 1, 2, 3 (sub-goals are 1.1, 1.2). They start folded. Click a goal's title to open it, or click Expand all (2) to open every goal.",
            hi: "नीचे goals की लिस्ट है, 1, 2, 3 नंबर के साथ (sub-goals 1.1, 1.2)। शुरू में सब बंद होते हैं। किसी goal को खोलने के लिए उसके टाइटल पर क्लिक करें, या सब खोलने के लिए Expand all (2) पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Each goal has a status: Not started, In progress, At risk, Done or Discarded. Past target means its date has gone by; Slipping means it is behind where the calendar says it should be.",
            hi: "हर goal का एक status होता है: Not started, In progress, At risk, Done या Discarded। Past target का मतलब उसकी तारीख निकल गई; Slipping का मतलब वो कैलेंडर के हिसाब से पीछे चल रहा है।",
          },
        },
        {
          text: {
            en: "Nobody types progress in. A goal with sub-goals, tasks or targets under it works out its own status and percentage from them. When it has targets, the bar shows how much has been Delivered.",
            hi: "प्रगति कोई टाइप नहीं करता। जिस goal के नीचे sub-goals, tasks या targets हैं, उसका status और प्रतिशत उन्हीं से अपने आप निकलता है। अगर उसमें targets हैं, तो बार दिखाता है कि कितना Delivered हुआ।",
          },
        },
      ],
      tips: [
        {
          en: "Use the date button (All time) and the tags button (All tags) above the goals to show only goals with a target date in a period, or with certain tags. Click Clear to show everything again.",
          hi: "goals के ऊपर तारीख वाला बटन (All time) और tags वाला बटन (All tags) इस्तेमाल करके सिर्फ़ किसी समय की target date वाले, या किसी tag वाले goals देखें। सब दोबारा देखने के लिए Clear पर क्लिक करें।",
        },
        {
          en: "The three-dot button on any goal has History - every status change and edit, with the reason given at the time.",
          hi: "किसी भी goal के तीन-डॉट बटन में History है - status का हर बदलाव और edit, उस समय दिए गए कारण के साथ।",
        },
      ],
    },
    {
      id: "add",
      title: { en: "Add goals, sub-goals and targets", hi: "Goals, sub-goals और targets जोड़ें" },
      intro: {
        en: "Only the project's Account Manager and project admins can add and change goals.",
        hi: "Goals सिर्फ़ प्रोजेक्ट का Account Manager और प्रोजेक्ट एडमिन जोड़ और बदल सकते हैं।",
      },
      steps: [
        {
          text: {
            en: "Click Add goal. Type the Goal (1), pick a Target date (2) if there is one, and add Tags to find it later. Click Add goal (3).",
            hi: "Add goal पर क्लिक करें। Goal (1) लिखें, अगर तारीख तय है तो Target date (2) चुनें, और बाद में ढूँढने के लिए Tags जोड़ें। Add goal (3) पर क्लिक करें।",
          },
          shot: {
            id: "project-goals-add",
            as: "manager",
            path: "/projects/sunmeadow-organics-launch?tab=goals",
            actions: [{ click: { role: "button", name: "Add goal" } }],
            highlight: [
              { placeholder: "e.g. Launch the new storefront" },
              { role: "button", name: "Target date" },
              { role: "button", name: "Add goal", nth: -1 },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Open the goal. Its bottom row has Sub-goal (1), Task (2), Link tasks (3) and Target (4). Click Sub-goal to break the goal into steps, each with its own date.",
            hi: "goal खोलें। उसकी नीचे वाली लाइन में Sub-goal (1), Task (2), Link tasks (3) और Target (4) हैं। goal को स्टेप्स में बाँटने के लिए Sub-goal पर क्लिक करें, हर स्टेप की अपनी तारीख होती है।",
          },
          shot: {
            id: "project-goals-footer",
            as: "manager",
            path: "/projects/sunmeadow-organics-launch?tab=goals",
            actions: [{ click: { role: "button", name: "Expand all" } }],
            // Goal 1's footer row (it comes first on the board), cropped to goal 1.
            highlight: [
              { role: "button", name: "Sub-goal" },
              { role: "button", name: "Task", exact: true },
              { role: "button", name: "Link tasks" },
              { role: "button", name: "Target", exact: true },
            ],
            crop: {
              css: 'div:has(> div > div > div > h4:text-is("Launch the millet range online"))',
            },
          },
        },
        {
          text: {
            en: "Click Target to say what the goal promises in countable output - the Type (like Reel or Blog post), How many, and an optional From and To date. Click Add. Progress then counts what was actually delivered.",
            hi: "goal में गिनने लायक आउटपुट का वादा लिखने के लिए Target पर क्लिक करें - Type (जैसे Reel या Blog post), How many, और चाहें तो From और To तारीख। Add पर क्लिक करें। इसके बाद प्रगति असल में डिलीवर हुए काम से गिनी जाती है।",
          },
        },
      ],
    },
    {
      id: "status",
      title: { en: "Set a goal's status", hi: "Goal का status बदलें" },
      steps: [
        {
          text: {
            en: "For the Account Manager and project admins, a goal with nothing under it has a status box (1) on the right. Pick the new status there. Everyone else sees the status as a label.",
            hi: "Account Manager और प्रोजेक्ट एडमिन के लिए, जिस goal के नीचे कुछ नहीं है उसके दाईं ओर status बॉक्स (1) होता है। वहाँ नया status चुनें। बाकी सबको status सिर्फ़ एक लेबल की तरह दिखता है।",
          },
          shot: {
            id: "project-goals-status",
            as: "manager",
            path: "/projects/sunmeadow-organics-launch?tab=goals",
            // Both boxes on the same goal: the first one with nothing under it,
            // so it has a status box. The board stays folded, one row per goal.
            highlight: [
              { role: "combobox", name: "Status for Grow Instagram to 25k followers" },
              { role: "button", name: "Actions for Grow Instagram to 25k followers" },
            ],
          },
        },
        {
          text: {
            en: "At risk and Discarded ask for a reason first. Write it and click Flag at risk or Discard goal. The reason shows under the goal and in its History.",
            hi: "At risk और Discarded के लिए पहले कारण पूछा जाता है। कारण लिखें और Flag at risk या Discard goal पर क्लिक करें। कारण goal के नीचे और उसकी History में दिखता है।",
          },
        },
        {
          text: {
            en: "The three-dot button (2) holds Edit goal (title, Target date, Owner, Tags), Add target, Add task, Link tasks, History and Remove.",
            hi: "तीन-डॉट बटन (2) में Edit goal (टाइटल, Target date, Owner, Tags), Add target, Add task, Link tasks, History और Remove हैं।",
          },
        },
      ],
      tips: [
        {
          en: "Discarded goals stay on the board with their reason but stop counting towards progress, so dropping something doesn't read as failing it.",
          hi: "Discarded goals अपने कारण के साथ बोर्ड पर बने रहते हैं, पर प्रगति में नहीं गिने जाते, ताकि कुछ छोड़ देना 'फेल' जैसा न दिखे।",
        },
      ],
    },
    {
      id: "work",
      title: { en: "Tie work to a goal", hi: "काम को goal से जोड़ें" },
      intro: {
        en: "Team managers on the project can do this too, not just the Account Manager and project admins.",
        hi: "ये प्रोजेक्ट के टीम मैनेजर भी कर सकते हैं, सिर्फ़ Account Manager और प्रोजेक्ट एडमिन नहीं।",
      },
      steps: [
        {
          text: {
            en: "Open a goal and click Task, or pick Add task from the goal's three-dot button (team managers use the three-dot button). Type what needs doing, pick who it is for and the team, and click Add. The task is linked to the goal from the start.",
            hi: "goal खोलें और Task पर क्लिक करें, या goal के तीन-डॉट बटन से Add task चुनें (टीम मैनेजर तीन-डॉट बटन इस्तेमाल करते हैं)। लिखें क्या करना है, किसे देना है और कौन सी टीम, फिर Add पर क्लिक करें। Task शुरू से ही goal से जुड़ा रहता है।",
          },
        },
        {
          text: {
            en: "To attach work that already exists, click Link tasks (also in the three-dot button). Tick the open tasks that belong to this goal and click the Link button - it says how many you picked.",
            hi: "पहले से बने काम को जोड़ने के लिए Link tasks पर क्लिक करें (ये तीन-डॉट बटन में भी है)। इस goal से जुड़े खुले tasks पर टिक करें और Link बटन पर क्लिक करें - उस पर लिखा होता है आपने कितने चुने।",
          },
        },
      ],
      tips: [
        {
          en: "When some open tasks on the project serve no goal, the Account Manager and project admins see a note saying how many, so they can be linked.",
          hi: "जब प्रोजेक्ट के कुछ खुले tasks किसी goal से नहीं जुड़े होते, तो Account Manager और प्रोजेक्ट एडमिन को एक नोट दिखता है कि कितने हैं, ताकि उन्हें जोड़ा जा सके।",
        },
        {
          en: "You can also pick a Goal when you create a task with New Task.",
          hi: "New Task से task बनाते समय भी आप Goal चुन सकते हैं।",
        },
      ],
    },
    {
      id: "remove",
      title: { en: "Remove or bring back a goal", hi: "Goal हटाएँ या वापस लाएँ" },
      steps: [
        {
          text: {
            en: "Click a goal's three-dot button and pick Remove. By default this only deactivates it: it leaves the board and stops counting, and its sub-goals go with it. Click Deactivate.",
            hi: "goal के तीन-डॉट बटन पर क्लिक करें और Remove चुनें। आम तौर पर ये सिर्फ़ उसे deactivate करता है: वो बोर्ड से हट जाता है और गिना नहीं जाता, और उसके sub-goals भी साथ जाते हैं। Deactivate पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "To bring it back, click Show deactivated in the Project goals card, open the goal's three-dot button and pick Restore.",
            hi: "वापस लाने के लिए Project goals कार्ड में Show deactivated पर क्लिक करें, goal का तीन-डॉट बटन खोलें और Restore चुनें।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: "Can a goal be deleted for good?",
            hi: "क्या goal को हमेशा के लिए डिलीट कर सकते हैं?",
          },
          a: {
            en: "Yes, but only on purpose: in the Remove box, tick Delete permanently. That destroys the goal, its sub-goals and all its history, and can't be undone.",
            hi: "हाँ, पर सोच-समझकर: Remove वाले बॉक्स में Delete permanently पर टिक करें। इससे goal, उसके sub-goals और पूरी history मिट जाती है, और ये वापस नहीं होता।",
          },
        },
        {
          q: {
            en: "Why is there no status box on some goals?",
            hi: "कुछ goals पर status बॉक्स क्यों नहीं है?",
          },
          a: {
            en: "Those goals have sub-goals, tasks or targets under them, so their status is worked out from that work. Change the work, not the goal.",
            hi: "उन goals के नीचे sub-goals, tasks या targets हैं, इसलिए उनका status उसी काम से अपने आप निकलता है। goal की जगह काम को अपडेट करें।",
          },
        },
      ],
    },
  ],
}
