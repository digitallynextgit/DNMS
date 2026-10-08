import { Clapperboard } from "lucide-react"
import type { HelpGuide } from "../../types"

export const toolsVideoGuide: HelpGuide = {
  slug: "tools-video",
  group: "company",
  icon: Clapperboard,
  href: "/tools",
  title: { en: "Tools: Video Toolkit", hi: "Tools: वीडियो के काम (Video Toolkit)" },
  summary: {
    en: "Compress, trim and convert videos, turn a clip into a GIF, or save the sound - all on your own computer.",
    hi: "videos को compress, trim और convert करें, किसी clip से GIF बनाएँ, या उसकी आवाज़ अलग save करें - सब आपके अपने कंप्यूटर पर।",
  },
  keywords: [
    "video",
    "mp4",
    "mov",
    "compress",
    "trim",
    "cut",
    "convert",
    "gif",
    "audio",
    "reel",
    "वीडियो",
  ],
  sections: [
    {
      id: "compress",
      title: { en: "Compress a video", hi: "वीडियो छोटा करें (Compress)" },
      steps: [
        {
          text: {
            en: "Open Tools > Video Toolkit. On the Compress tab, drop a video in or click to choose it - MP4, MOV, WebM and MKV all work.",
            hi: "Tools > Video Toolkit खोलें। Compress tab पर कोई video drop करें या क्लिक करके चुनें - MP4, MOV, WebM और MKV सब चलते हैं।",
          },
          shot: { id: "tools-video-compress", as: "employee", path: "/tools/video-toolkit" },
        },
        {
          text: {
            en: "Pick a Quality - Small file for WhatsApp and email, Balanced for Instagram, YouTube and websites - and, if you like, a smaller Size. You'll see roughly how big it will be.",
            hi: "Quality चुनें - WhatsApp और email के लिए Small file, Instagram, YouTube और websites के लिए Balanced - और चाहें तो छोटा Size। अंदाज़न कितना बड़ा बनेगा, वो दिख जाता है।",
          },
        },
        {
          text: {
            en: "Click Compress video and wait for the bar to finish (Stop cancels it). Watch the result, then click Download compressed video.",
            hi: "Compress video पर क्लिक करें और bar पूरा होने तक रुकें (Stop से रोक सकते हैं)। result देखें, फिर Download compressed video पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "If the new file isn't smaller, the video is already well compressed - keep the original.",
          hi: "अगर नई file छोटी नहीं हुई, तो video पहले से अच्छी तरह compressed है - original ही रखें।",
        },
      ],
    },
    {
      id: "trim",
      title: { en: "Trim a video", hi: "वीडियो काटें (Trim)" },
      steps: [
        {
          text: {
            en: "On the Trim tab, choose a video. Play it and press Set start here and Set end here - or type the times, like 0:12.",
            hi: "Trim tab पर कोई video चुनें। उसे play करें और Set start here व Set end here दबाएँ - या समय लिखें, जैसे 0:12।",
          },
        },
        {
          text: {
            en: "Press Play selection to check it, then click Trim video and Download clip. MP4 and MOV clips keep their full quality.",
            hi: "Play selection दबाकर देख लें, फिर Trim video और Download clip पर क्लिक करें। MP4 और MOV clips की quality पूरी बनी रहती है।",
          },
        },
      ],
    },
    {
      id: "convert",
      title: { en: "Convert to MP4 or WebM", hi: "MP4 या WebM में बदलें (Convert)" },
      steps: [
        {
          text: {
            en: "On the Convert tab, choose a video - for example an iPhone MOV. Pick MP4 (plays everywhere) or WebM (for websites). Turn on Remove the sound for a silent video.",
            hi: "Convert tab पर कोई video चुनें - जैसे iPhone का MOV। MP4 (हर जगह चलता है) या WebM (websites के लिए) चुनें। बिना आवाज़ का video चाहिए तो Remove the sound चालू करें।",
          },
        },
        {
          text: {
            en: "Click Convert video, then Download video.",
            hi: "Convert video पर क्लिक करें, फिर Download video।",
          },
        },
      ],
    },
    {
      id: "gif",
      title: { en: "Turn a clip into a GIF", hi: "Clip से GIF बनाएँ (Video to GIF)" },
      steps: [
        {
          text: {
            en: "On the Video to GIF tab, choose a video and pick the part you want - up to 15 seconds.",
            hi: "Video to GIF tab पर कोई video चुनें और जो हिस्सा चाहिए वो चुनें - ज़्यादा से ज़्यादा 15 सेकंड।",
          },
        },
        {
          text: {
            en: "Choose a Width and Smoothness and check the size guess, then click Make GIF and Download GIF.",
            hi: "Width और Smoothness चुनें और अंदाज़न size देख लें, फिर Make GIF और Download GIF पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "GIFs get big fast - keep them short (2-5 seconds) and small (320 or 480 px wide).",
          hi: "GIFs जल्दी बड़े हो जाते हैं - उन्हें छोटा (2-5 सेकंड) और कम चौड़ा (320 या 480 px) रखें।",
        },
      ],
    },
    {
      id: "audio",
      title: { en: "Save the sound", hi: "आवाज़ अलग करें (Extract audio)" },
      steps: [
        {
          text: {
            en: "On the Extract audio tab, choose a video. Pick M4A (small, for sharing) or WAV (full quality, for editing), click Extract audio, listen to it, then Download.",
            hi: "Extract audio tab पर कोई video चुनें। M4A (छोटी, share करने के लिए) या WAV (पूरी quality, editing के लिए) चुनें, Extract audio पर क्लिक करें, सुनकर देखें, फिर Download करें।",
          },
        },
      ],
      faq: [
        {
          q: {
            en: 'Why does it say "Video tools need Chrome, Edge or a recent Safari"?',
            hi: 'ये "Video tools need Chrome, Edge or a recent Safari" क्यों कहता है?',
          },
          a: {
            en: "These tools use your browser's built-in video engine, which older browsers and Firefox don't have yet. Open DNMS in Chrome or Edge on a computer.",
            hi: "ये tools आपके browser का अपना video engine इस्तेमाल करते हैं, जो पुराने browsers और Firefox में अभी नहीं है। DNMS को कंप्यूटर पर Chrome या Edge में खोलें।",
          },
        },
        {
          q: { en: "Can I save the sound as MP3?", hi: "क्या आवाज़ MP3 में save हो सकती है?" },
          a: {
            en: "No - browsers can't make MP3 files. M4A plays on every phone and computer, and WhatsApp accepts it.",
            hi: "नहीं - browsers MP3 files नहीं बना सकते। M4A हर phone और कंप्यूटर पर चलती है, और WhatsApp भी उसे लेता है।",
          },
        },
        {
          q: {
            en: "Are my videos uploaded anywhere?",
            hi: "क्या मेरे videos कहीं upload होते हैं?",
          },
          a: {
            en: "No. Everything happens in your browser - the videos never leave your computer. Long or 4K videos need a computer with plenty of memory.",
            hi: "नहीं। सब कुछ आपके browser में होता है - videos आपके कंप्यूटर से बाहर नहीं जाते। लंबे या 4K videos के लिए ज़्यादा memory वाला कंप्यूटर चाहिए।",
          },
        },
      ],
    },
  ],
}
