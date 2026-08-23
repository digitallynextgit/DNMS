import { MarketingHeader, MarketingFooter } from "@/features/marketing"

/**
 * Public marketing shell for the landing page and any future public pages.
 *
 * globals.css pins `html, body { height: 100%; overflow: hidden }` for the app
 * shell, so marketing pages get their OWN scroll container here (h-dvh +
 * overflow-y-auto). `no-scrollbar` hides the bar while keeping scroll;
 * scroll-smooth makes the in-page anchor nav glide.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background text-foreground no-scrollbar relative h-dvh overflow-x-hidden overflow-y-auto scroll-smooth">
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  )
}
