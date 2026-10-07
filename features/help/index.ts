// Public API for the "help" feature (CLAUDE.md §1, rule #2): the in-app Help &
// Guides pages. Guide content lives in ./guides as plain data, so the screenshot
// script (scripts/help-screenshots.ts) reads the same files.
export { HelpCenter } from "./components/help-center"
export { GuideView } from "./components/guide-view"
export { HELP_GUIDES, HELP_GROUPS, getGuide } from "./guides"
export type { HelpGuide, HelpShot, HelpLang, L10n } from "./types"
