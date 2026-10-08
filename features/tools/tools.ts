import {
  AppWindow,
  CalendarCheck,
  Calculator,
  Clapperboard,
  Crop,
  Earth,
  Eraser,
  FileStack,
  ImageDown,
  KeyRound,
  LetterText,
  Link2,
  Palette,
  QrCode,
  RefreshCw,
  Search,
  Signature,
  type LucideIcon,
} from "lucide-react"

// To add a tool: an entry here, a component exported from ../index.ts, and a page at
// app/(dashboard)/tools/<slug>/page.tsx. House rule: tools run in the browser; files are never uploaded.

export type ToolCategory = "design" | "video" | "documents" | "marketing" | "office"

export const TOOL_CATEGORIES: { id: ToolCategory; title: string }[] = [
  { id: "design", title: "Images & design" },
  { id: "video", title: "Video" },
  { id: "documents", title: "PDF & documents" },
  { id: "marketing", title: "Marketing & SEO" },
  { id: "office", title: "Everyday work" },
]

export interface ToolDefinition {
  /** URL segment: /tools/<slug>. */
  slug: string
  category: ToolCategory
  title: string
  description: string
  icon: LucideIcon
  keywords?: string[]
  /** Only people holding this permission (PERMISSIONS.*) see the tool. Open to all if unset. */
  permission?: string
}

export const TOOLS: readonly ToolDefinition[] = [
  {
    slug: "image-compressor",
    category: "design",
    title: "Image Compressor",
    description: "Make JPG, PNG and WebP images smaller - many at once - without visible loss.",
    icon: ImageDown,
    keywords: ["compress", "reduce", "size", "kb", "optimize", "shrink"],
  },
  {
    slug: "image-converter",
    category: "design",
    title: "Image Converter",
    description: "Change images between JPG, PNG and WebP - and turn iPhone HEIC photos into JPG.",
    icon: RefreshCw,
    keywords: ["convert", "format", "heic", "iphone", "webp", "png", "jpg", "jpeg"],
  },
  {
    slug: "social-image-resizer",
    category: "design",
    title: "Social Media Resizer",
    description:
      "Crop and resize an image to the exact size for Instagram, LinkedIn, YouTube and more.",
    icon: Crop,
    keywords: [
      "resize",
      "crop",
      "instagram",
      "story",
      "linkedin",
      "youtube",
      "thumbnail",
      "banner",
    ],
  },
  {
    slug: "favicon-maker",
    category: "design",
    title: "Favicon Maker",
    description: "Turn a logo into every website icon size - favicon.ico, Apple and Android icons.",
    icon: AppWindow,
    keywords: ["favicon", "icon", "ico", "website", "apple touch"],
  },
  {
    slug: "colour-tools",
    category: "design",
    title: "Colour Tools",
    description: "Pick colours from an image, convert HEX / RGB / HSL, and check text is readable.",
    icon: Palette,
    keywords: ["color", "colour", "palette", "hex", "rgb", "hsl", "contrast", "picker"],
  },
  {
    slug: "background-remover",
    category: "design",
    title: "Background Remover",
    description:
      "Remove the background from a photo of a person or product, in one click - with AI on your own computer.",
    icon: Eraser,
    keywords: ["background", "remove", "cut out", "transparent", "png", "product photo", "ai"],
  },
  {
    slug: "video-toolkit",
    category: "video",
    title: "Video Toolkit",
    description:
      "Compress, trim and convert videos, turn a clip into a GIF, or pull out the audio.",
    icon: Clapperboard,
    keywords: ["video", "mp4", "mov", "compress", "trim", "cut", "gif", "audio", "convert", "reel"],
  },
  {
    slug: "pdf-toolkit",
    category: "documents",
    title: "PDF Toolkit",
    description: "Merge, split, reorder and compress PDFs, and turn images into a PDF or back.",
    icon: FileStack,
    keywords: ["pdf", "merge", "combine", "split", "compress", "jpg to pdf", "pdf to jpg", "pages"],
  },
  {
    slug: "qr-code",
    category: "marketing",
    title: "QR Code Generator",
    description:
      "Turn a link or text into a QR code - with your own image in the middle if you like.",
    icon: QrCode,
    keywords: ["qr", "barcode", "scan", "logo"],
  },
  {
    slug: "utm-builder",
    category: "marketing",
    title: "UTM Link Builder",
    description: "Build campaign tracking links the same way every time - with a QR code for each.",
    icon: Link2,
    keywords: ["utm", "campaign", "tracking", "analytics", "link", "url"],
  },
  {
    slug: "character-counter",
    category: "marketing",
    title: "Character Counter",
    description:
      "Count words and characters against Instagram, X, LinkedIn and SEO limits as you type.",
    icon: LetterText,
    keywords: ["count", "words", "characters", "caption", "limit", "twitter", "meta"],
  },
  {
    slug: "search-preview",
    category: "marketing",
    title: "Google & Social Preview",
    description:
      "See how a page title and description will look in Google and when shared on social.",
    icon: Search,
    keywords: ["seo", "serp", "google", "meta title", "description", "open graph", "og", "preview"],
  },
  {
    slug: "email-signature",
    category: "office",
    title: "Email Signature",
    description: "Your email signature in the company design, filled in from your DNMS profile.",
    icon: Signature,
    keywords: ["signature", "email", "gmail", "outlook"],
  },
  {
    slug: "working-days",
    category: "office",
    title: "Working Days Calculator",
    description: "Count working days between two dates, skipping weekends and company holidays.",
    icon: CalendarCheck,
    keywords: ["working days", "business days", "deadline", "date", "holidays"],
  },
  {
    slug: "gst-calculator",
    category: "office",
    title: "GST Calculator",
    description: "Add or remove GST from an amount, with the CGST / SGST or IGST split.",
    icon: Calculator,
    keywords: ["gst", "tax", "cgst", "sgst", "igst", "invoice", "inclusive", "exclusive"],
  },
  {
    slug: "time-zones",
    category: "office",
    title: "Time Zone Converter",
    description: "See what time it is for a client abroad, and find a good time for a call.",
    icon: Earth,
    keywords: ["time zone", "timezone", "clock", "meeting", "ist", "est", "gmt", "client call"],
  },
  {
    slug: "password-generator",
    category: "office",
    title: "Password Generator",
    description: "Create strong passwords you can save in a project's Passwords tab.",
    icon: KeyRound,
    keywords: ["password", "secure", "random", "generate"],
  },
]

export function getTool(slug: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.slug === slug)
}
