import { HelpCircle } from "lucide-react"
import type { HelpGuide } from "../../types"

export const projectRequirementsGuide: HelpGuide = {
  slug: "project-requirements",
  group: "projects",
  icon: HelpCircle,
  href: "/projects/my-projects",
  title: { en: "A project's Requirements tab", hi: "प्रोजेक्ट का Requirements टैब" },
  summary: {
    en: "Ask someone for what your team is waiting on - a document, a login, an approval - and track it until it arrives.",
    hi: "आपकी टीम जिस चीज़ का इंतज़ार कर रही है - कोई डॉक्युमेंट, लॉगिन या approval - वो किसी से माँगें, और मिलने तक उस पर नज़र रखें।",
  },
  keywords: [
    "requirement",
    "requirements",
    "blocked",
    "waiting",
    "client documents",
    "credentials",
    "approval",
    "raise requirement",
    "ज़रूरत",
    "इंतज़ार",
    "अटका काम",
    "डॉक्युमेंट",
  ],
  sections: [
    {
      id: "overview",
      title: { en: "What's outstanding", hi: "क्या-क्या बाकी है" },
      intro: {
        en: "A requirement is something a team needs from someone else before work can continue - usually from the client, through the Account Manager. The Requirements tab shows a count of the ones still open.",
        hi: "Requirement वो चीज़ है जो टीम को काम आगे बढ़ाने से पहले किसी और से चाहिए - ज़्यादातर क्लाइंट से, Account Manager के ज़रिए। Requirements टैब पर अभी खुली requirements की गिनती दिखती है।",
      },
      steps: [
        {
          text: {
            en: "Open the project and click the Requirements tab. The strip at the top counts what is Open (1), Overdue, Waiting on you (2) and Resolved.",
            hi: "प्रोजेक्ट खोलें और Requirements टैब पर क्लिक करें। ऊपर की पट्टी में गिनती होती है - Open (1), Overdue, Waiting on you (2) और Resolved।",
          },
          shot: {
            id: "project-requirements-list",
            as: "manager",
            path: "/projects/sunmeadow-organics-launch?tab=requirements",
            // The stat tiles (caption and number) - a bare "Waiting on you" also
            // matches the sidebar link of the same name.
            highlight: [
              { css: 'div:has(> div > p:text-is("Open"))' },
              { css: 'div:has(> div > p:text-is("Waiting on you"))' },
              { role: "button", name: "Raise requirement" },
            ],
          },
        },
        {
          text: {
            en: "Each card shows what is needed, when it is needed by (red Overdue if the date has passed), its type and team, who raised it and who it is Waiting on, and any tasks it is blocking. Raise requirement (3) asks for something new.",
            hi: "हर कार्ड पर दिखता है कि क्या चाहिए, कब तक चाहिए (तारीख निकल गई तो लाल Overdue), उसका type और टीम, किसने माँगा और किसका Waiting on है, और कौन से tasks इसकी वजह से रुके हैं। नई चीज़ माँगने के लिए Raise requirement (3) है।",
          },
        },
      ],
    },
    {
      id: "raise",
      title: { en: "Raise a requirement", hi: "Requirement बनाएँ" },
      intro: {
        en: "Anyone on the project can raise one - from the Requirements tab, or from the Tasks tab while looking at the week.",
        hi: "प्रोजेक्ट पर कोई भी requirement बना सकता है - Requirements टैब से, या हफ़्ता देखते हुए Tasks टैब से।",
      },
      steps: [
        {
          text: {
            en: "Click Raise requirement.",
            hi: "Raise requirement पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Pick the Type - Document, Credential, Access, Content, Design, Approval, Payment or Other - and the Needed by date. Type What do you need (1) and add Details: exactly what is needed and what it unblocks.",
            hi: "Type चुनें - Document, Credential, Access, Content, Design, Approval, Payment या Other - और Needed by तारीख। What do you need (1) में लिखें और Details में बताएँ: ठीक-ठीक क्या चाहिए और इससे कौन सा काम आगे बढ़ेगा।",
          },
          shot: {
            id: "project-requirements-raise",
            as: "employee",
            path: "/projects/sunmeadow-organics-launch?tab=requirements",
            actions: [{ click: { role: "button", name: "Raise requirement" } }],
            // The fields themselves, not their captions (which aren't tied to the
            // fields, so a label lookup can't be used).
            highlight: [
              { placeholder: "e.g. Razorpay verification documents" },
              {
                css: '[role=dialog] div:has(> label:text-is("Requested from")) > button[role=combobox]',
              },
              {
                css: '[role=dialog] div:has(> label:text-is("Blocking which tasks?")) > div.overflow-y-auto',
              },
              { role: "button", name: "Raise requirement", nth: -1 },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Requested from (2) starts on the Account Manager, who handles the client. Pick a teammate instead if it is theirs to provide.",
            hi: "Requested from (2) में पहले से Account Manager होता है, क्योंकि क्लाइंट से बात वही करते हैं। अगर ये किसी साथी को देना है, तो उन्हें चुनें।",
          },
        },
        {
          text: {
            en: "Under Blocking which tasks? (3), tick the tasks that can't move until this arrives. They show as Blocked until it is provided, then unblock on their own.",
            hi: "Blocking which tasks? (3) में उन tasks पर टिक करें जो इसके आने तक आगे नहीं बढ़ सकते। जब तक ये नहीं मिलता, वो Blocked दिखते हैं, और मिलते ही अपने आप खुल जाते हैं।",
          },
        },
        {
          text: {
            en: "Click Raise requirement (4). The person it is requested from is notified straight away.",
            hi: "Raise requirement (4) पर क्लिक करें। जिससे माँगा गया है, उसे तुरंत सूचना मिल जाती है।",
          },
        },
      ],
    },
    {
      id: "respond",
      title: { en: "Answer a requirement", hi: "Requirement का जवाब दें" },
      intro: {
        en: "The person it is requested from answers it. The Account Manager and project admins can too.",
        hi: "जिससे requirement माँगी गई है, वो जवाब देता है। Account Manager और प्रोजेक्ट एडमिन भी दे सकते हैं।",
      },
      steps: [
        {
          text: {
            en: "Click Working on it (1) to show you have started.",
            hi: "काम शुरू कर दिया है, ये बताने के लिए Working on it (1) पर क्लिक करें।",
          },
          shot: {
            id: "project-requirements-respond",
            as: "manager",
            path: "/projects/sunmeadow-organics-launch?tab=requirements",
            highlight: [
              { role: "button", name: "Working on it" },
              { role: "button", name: "Mark provided" },
              { role: "button", name: "Can't provide" },
            ],
          },
        },
        {
          text: {
            en: "When you have it, click Mark provided (2). Any blocked tasks are freed.",
            hi: "जब चीज़ मिल जाए, तो Mark provided (2) पर क्लिक करें। रुके हुए tasks खुल जाते हैं।",
          },
        },
        {
          text: {
            en: "If it can't be done, click Can't provide (3), write the Reason so the team can plan around it, and click Send.",
            hi: "अगर ये नहीं हो सकता, तो Can't provide (3) पर क्लिक करें, Reason लिखें ताकि टीम उसके हिसाब से प्लान कर सके, और Send पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "Closed by mistake? Click Reopen on the card.",
          hi: "गलती से बंद हो गई? कार्ड पर Reopen पर क्लिक करें।",
        },
        {
          en: "Whoever raised it, the Account Manager and project admins can delete a requirement with the bin icon. You confirm first, and it can't be undone.",
          hi: "जिसने requirement बनाई, Account Manager और प्रोजेक्ट एडमिन उसे bin आइकन से डिलीट कर सकते हैं। पहले कन्फ़र्म करना होता है, और ये वापस नहीं होता।",
        },
      ],
      faq: [
        {
          q: {
            en: "Where do I see requirements waiting on me?",
            hi: "मुझसे माँगी गई requirements कहाँ दिखेंगी?",
          },
          a: {
            en: "On each project's Requirements tab, the Waiting on you number counts them. You also get a notification when one is raised for you.",
            hi: "हर प्रोजेक्ट के Requirements टैब पर Waiting on you में उनकी गिनती होती है। जब कोई आपसे requirement माँगता है, तो आपको नोटिफिकेशन भी मिलता है।",
          },
        },
      ],
    },
  ],
}
