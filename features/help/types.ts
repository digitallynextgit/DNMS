import type { LucideIcon } from "lucide-react"

// =============================================================================
// Help & Guides content model.
//
// A guide is plain data (features/help/guides/*.ts), so the same file feeds the
// Help pages AND the screenshot script (scripts/help-screenshots.ts). Every
// sentence is written twice - English and Hindi. In the Hindi text, the words
// that appear ON SCREEN (button names, tab names, field labels) stay in English,
// exactly as spelled in the app, so a reader can find what the guide points at.
// =============================================================================

export type HelpLang = "en" | "hi"

/** One piece of guide text in both languages. */
export interface L10n {
  en: string
  hi: string
}

/**
 * Which demo account a screenshot is taken as (see features/help/demo/dataset.ts):
 * a plain employee, a team manager, HR, or the company admin.
 */
export type DemoPersona = "employee" | "manager" | "hr" | "admin"

/**
 * How the screenshot script finds an element - Playwright locators, written as
 * data. Prefer `role` + `name` (what the user reads on the button), then
 * `label` (form fields), then `text`. `css` is the last resort.
 */
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

/** Something to do on the page before the picture is taken. */
export type HelpAction =
  | { click: HelpTarget }
  | { fill: HelpTarget; value: string }
  | { hover: HelpTarget }
  | { press: string }
  | { waitFor: HelpTarget }
  /** Milliseconds - only for animations that have no element to wait on. */
  | { wait: number }

/** A screenshot, described so `pnpm help:shots` can take it. */
export interface HelpShot {
  /** Stable, unique, kebab-case. Becomes public/help/shots/<id>.webp. */
  id: string
  as: DemoPersona
  /** App path WITHOUT the company prefix, e.g. "/leave" or "/leave/apply". */
  path: string
  actions?: HelpAction[]
  /** Numbered boxes drawn on the picture, in order: 1, 2, 3... */
  highlight?: HelpTarget[]
  /** Crop to this element (plus a margin) instead of the whole window. */
  crop?: HelpTarget
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
  /** Short "good to know" notes, shown after the steps. */
  tips?: L10n[]
  /** Common questions about this part of the module. */
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
  /**
   * The page this guide explains. Who can SEE the guide follows who can see that
   * page in the sidebar (lib/nav.ts), so nobody reads about a screen they lack.
   */
  href?: string
  /** Overrides the sidebar-derived permission (or gates a guide with no href). */
  permission?: string
  /** Extra search words (English and Hindi) beyond the title and summary. */
  keywords?: string[]
  sections: HelpSection[]
}

/** What the screenshot script recorded for one shot (features/help/shots.generated.ts). */
export interface HelpShotFile {
  src: string
  width: number
  height: number
  /**
   * Highlight boxes as fractions (0-1) of the image, in highlight order. `null`
   * marks one the script couldn't find, so the numbers after it don't shift.
   */
  boxes: ({ x: number; y: number; w: number; h: number } | null)[]
}
