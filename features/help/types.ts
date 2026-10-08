import type { LucideIcon } from "lucide-react"

// Guides are plain data feeding both the Help pages and scripts/help-screenshots.ts. In Hindi
// text, on-screen words (buttons, tabs, field labels) stay in English, spelled as in the app.

export type HelpLang = "en" | "hi"

export interface L10n {
  en: string
  hi: string
}

export type DemoPersona = "employee" | "manager" | "hr" | "admin"

/** Playwright locators as data. Prefer role + name, then label, then text; css is the last resort. */
export type HelpTarget = (
  | {
      role:
        | "button"
        | "link"
        | "tab"
        | "menuitem"
        | "textbox"
        | "combobox"
        | "checkbox"
        | "switch"
        | "heading"
        | "dialog"
        | "alertdialog"
        | "menu"
        | "img"
        | "tablist"
        | "tabpanel"
        | "list"
        | "listitem"
        | "region"
        | "row"
        | "cell"
        | "option"
        | "table"
        | "navigation"
      name?: string
      exact?: boolean
    }
  | { label: string; exact?: boolean }
  | { text: string; exact?: boolean }
  | { placeholder: string }
  | { css: string }
) & {
  /** Which match to use when several do (0 = first, -1 = last). Default 0. */
  nth?: number
}

export type HelpAction =
  | { click: HelpTarget }
  | { fill: HelpTarget; value: string }
  | { hover: HelpTarget }
  | { press: string }
  /** `timeout` in ms (default 20 s) - raise it for slow work like a first AI-model download. */
  | { waitFor: HelpTarget; timeout?: number }
  /** Put a file (repo path, e.g. "public/brand-mark-104.png") into the page's first file input. */
  | { upload: string }
  /** Milliseconds - only for animations that have no element to wait on. */
  | { wait: number }

export interface HelpShot {
  /** Stable, unique, kebab-case. */
  id: string
  as: DemoPersona
  /** App path WITHOUT the company prefix, e.g. "/leave" or "/leave/apply". */
  path: string
  actions?: HelpAction[]
  /** Numbered boxes drawn on the picture, in order: 1, 2, 3... */
  highlight?: HelpTarget[]
  /** Crop to this element (plus a margin) instead of the whole window. */
  crop?: HelpTarget
  /** Elements to leave out of the picture (e.g. a warning that only shows on a dev machine). */
  hide?: HelpTarget[]
  /** "mobile" takes it in a phone-sized window. Default "desktop". */
  device?: "desktop" | "mobile"
}

export interface HelpStep {
  text: L10n
  /** A picture for this step. Its numbered boxes can be referred to as (1), (2)... */
  shot?: HelpShot
}

export interface HelpSection {
  /** Anchor id, kebab-case, unique within the guide. */
  id: string
  title: L10n
  /** Shown only to people holding this permission (PERMISSIONS.* from lib/constants). */
  permission?: string
  intro?: L10n
  steps?: HelpStep[]
  tips?: L10n[]
  faq?: { q: L10n; a: L10n }[]
}

/** Where a guide is listed on the Help home page - mirrors the sidebar groups. */
export type HelpGroup = "start" | "self" | "company" | "projects" | "hr" | "admin"

export interface HelpGuide {
  /** URL segment: /help/<slug>. */
  slug: string
  group: HelpGroup
  icon: LucideIcon
  title: L10n
  /** One sentence: what this module is for. */
  summary: L10n
  /** Who can SEE the guide follows who can see this page in the sidebar (lib/nav.ts). */
  href?: string
  /** Overrides the sidebar-derived permission (or gates a guide with no href). */
  permission?: string
  /** Extra search words (English and Hindi) beyond the title and summary. */
  keywords?: string[]
  sections: HelpSection[]
}

export interface HelpShotFile {
  src: string
  width: number
  height: number
  /** Fractions (0-1) of the image; null marks a box not found, so later numbers don't shift. */
  boxes: ({ x: number; y: number; w: number; h: number } | null)[]
}
