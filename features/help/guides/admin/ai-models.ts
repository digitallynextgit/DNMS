import { Sparkles } from "lucide-react"
import type { HelpGuide } from "../../types"

// No screenshots: AI providers are platform-wide, so the page doesn't load in the demo workspace.

export const aiModelsGuide: HelpGuide = {
  slug: "ai-models",
  group: "admin",
  icon: Sparkles,
  href: "/admin/ai-models",
  title: { en: "AI Models", hi: "AI मॉडल (AI Models)" },
  summary: {
    en: "Choose which AI services DNMS uses - Gemini, Claude or others - add their API keys, and set the order DNMS tries them in when one fails.",
    hi: "चुनें कि DNMS कौन-सी AI सर्विस इस्तेमाल करे - Gemini, Claude या कोई और - उनकी API key जोड़ें, और तय करें कि एक के फेल होने पर DNMS किस क्रम में बाकी आज़माए।",
  },
  keywords: [
    "ai",
    "models",
    "gemini",
    "claude",
    "openai",
    "mistral",
    "cloudflare",
    "workers ai",
    "api key",
    "key",
    "provider",
    "fallback",
    "एआई",
    "मॉडल",
    "की",
  ],
  sections: [
    {
      id: "overview",
      title: { en: "How AI tasks pick a key", hi: "AI टास्क कौन-सी key चुनते हैं" },
      intro: {
        en: "Writing help, report summaries, brand and SEO analysis, job descriptions and the AI assistant all use the services on this page. Each service is a provider; each provider has one or more API keys.",
        hi: "लिखने में मदद, रिपोर्ट की समरी, ब्रांड और SEO एनालिसिस, जॉब डिस्क्रिप्शन और AI असिस्टेंट - ये सब इसी पेज की सर्विसेज़ इस्तेमाल करते हैं। हर सर्विस एक provider है; हर provider की एक या ज़्यादा API key होती हैं।",
      },
      steps: [
        {
          text: {
            en: "Click AI Models in the sidebar, under Admin. Providers are listed in the order they're tried: the Default one (number 1) first, then the rest from top to bottom.",
            hi: "साइडबार में Admin के नीचे AI Models पर क्लिक करें। providers उसी क्रम में दिखते हैं जिसमें आज़माए जाते हैं: पहले Default (नंबर 1), फिर बाकी ऊपर से नीचे।",
          },
        },
        {
          text: {
            en: "Every AI task tries the default provider's keys first, in order. If a key is wrong, busy or out of quota, DNMS moves to the next key, and when a provider's keys are all used up, to the next provider. Nobody has to do anything - the task just takes a moment longer.",
            hi: "हर AI टास्क पहले default provider की keys क्रम से आज़माता है। अगर कोई key गलत है, व्यस्त है या उसका quota खत्म है, तो DNMS अगली key पर जाता है, और जब किसी provider की सारी keys खत्म हो जाएँ तो अगले provider पर। किसी को कुछ नहीं करना पड़ता - टास्क बस थोड़ा ज़्यादा समय लेता है।",
          },
        },
        {
          text: {
            en: "Each provider has a model for quick tasks (like polishing a leave reason) and one for bigger tasks (reports, the assistant). Backup models separated by commas are tried in order too.",
            hi: "हर provider में छोटे टास्क (जैसे छुट्टी की वजह सुधारना) के लिए एक मॉडल होता है और बड़े टास्क (रिपोर्ट, असिस्टेंट) के लिए एक। कॉमा से अलग किए गए बैकअप मॉडल भी क्रम से आज़माए जाते हैं।",
          },
        },
      ],
      tips: [
        {
          en: "Only people whose role has the settings:write permission see this page - by default, only Admin.",
          hi: "ये पेज सिर्फ़ उन्हें दिखता है जिनके रोल में settings:write परमिशन है - शुरुआत में सिर्फ़ Admin के पास।",
        },
        {
          en: "On a free plan, some AI services may use what you send them to improve their products. For HR, salary and client data, use a paid key.",
          hi: "फ्री प्लान पर कुछ AI सर्विसेज़ आपका भेजा हुआ डेटा अपने प्रोडक्ट सुधारने में इस्तेमाल कर सकती हैं। HR, सैलरी और क्लाइंट डेटा के लिए पेड key इस्तेमाल करें।",
        },
      ],
    },
    {
      id: "add",
      title: { en: "Add a provider or a key", hi: "provider या key जोड़ें" },
      steps: [
        {
          text: {
            en: "Click Add provider. Pick the Service - Google Gemini, Anthropic Claude, OpenAI, Mistral, Groq, OpenRouter, Cerebras, Cloudflare Workers AI, or Other for any OpenAI-compatible service. The name and suggested models fill in for you. Cloudflare also asks for your Account ID.",
            hi: "Add provider पर क्लिक करें। Service चुनें - Google Gemini, Anthropic Claude, OpenAI, Mistral, Groq, OpenRouter, Cerebras, Cloudflare Workers AI, या किसी भी OpenAI-compatible सर्विस के लिए Other। नाम और सुझाए गए मॉडल अपने आप भर जाते हैं। Cloudflare आपका Account ID भी माँगता है।",
          },
        },
        {
          text: {
            en: "Paste the API key. Get a key opens the service's key page in a new tab. Click Add provider. The first provider you add becomes the default.",
            hi: "API key पेस्ट करें। Get a key से उस सर्विस का key वाला पेज नए टैब में खुलता है। Add provider पर क्लिक करें। जो पहला provider जोड़ा जाता है वो default बन जाता है।",
          },
        },
        {
          text: {
            en: "To give a provider more keys, click Add key on its card. A key from a different account brings its own free allowance, so AI keeps working when the first one runs out.",
            hi: "किसी provider में और keys जोड़ने के लिए उसके कार्ड पर Add key पर क्लिक करें। दूसरे अकाउंट की key अपनी अलग फ्री लिमिट लाती है, जिससे पहली खत्म होने पर भी AI चलता रहता है।",
          },
        },
      ],
      tips: [
        {
          en: "Keys are stored encrypted and never shown again - only their last 4 characters, so you can tell them apart.",
          hi: "keys encrypted (सुरक्षित तरीके से) सेव होती हैं और फिर कभी नहीं दिखतीं - सिर्फ़ आखिरी 4 अक्षर, ताकि आप उन्हें पहचान सकें।",
        },
      ],
    },
    {
      id: "manage",
      title: { en: "Test, reorder and switch off", hi: "जाँचें, क्रम बदलें और बंद करें" },
      steps: [
        {
          text: {
            en: "Click Test next to a key to send it one short request. It shows Works with the model and how long it took, or the service's own error - for example a wrong key or a used-up quota.",
            hi: "किसी key के बगल में Test पर क्लिक करके उसे एक छोटा सा request भेजें। ये Works के साथ मॉडल और लगा समय दिखाता है, या सर्विस की अपनी गलती - जैसे गलत key या खत्म हुआ quota।",
          },
        },
        {
          text: {
            en: "Under each key you also see when it last worked, or when it last failed and why - from real AI tasks, not just tests.",
            hi: "हर key के नीचे ये भी दिखता है कि वो आखिरी बार कब चली, या आखिरी बार कब और क्यों फेल हुई - असली AI टास्क से, सिर्फ़ टेस्ट से नहीं।",
          },
        },
        {
          text: {
            en: "Make default puts a provider first. The up and down arrows change the order of the others, and of the keys inside a provider. The switch turns a provider or a key off without deleting it.",
            hi: "Make default किसी provider को सबसे पहले कर देता है। ऊपर-नीचे वाले तीर बाकी providers का, और किसी provider के अंदर keys का क्रम बदलते हैं। स्विच किसी provider या key को डिलीट किए बिना बंद कर देता है।",
          },
        },
        {
          text: {
            en: "The ... menu on a provider has Edit name and models, Get a key, and Remove provider. Removing the default makes the next provider the default.",
            hi: "provider के ... मेन्यू में Edit name and models, Get a key और Remove provider हैं। default को हटाने पर अगला provider default बन जाता है।",
          },
        },
      ],
      tips: [
        {
          en: "The default provider can't be switched off - make another one the default first.",
          hi: "default provider बंद नहीं किया जा सकता - पहले किसी दूसरे को default बनाएँ।",
        },
        {
          en: "Removing a key only stops DNMS using it. To cancel it for good, delete it in the service's own account too.",
          hi: "key हटाने से सिर्फ़ DNMS उसका इस्तेमाल बंद करता है। उसे हमेशा के लिए रद्द करने के लिए सर्विस के अपने अकाउंट में भी डिलीट करें।",
        },
      ],
    },
  ],
}
