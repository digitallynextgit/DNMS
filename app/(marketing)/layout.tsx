import { MarketingHeader, MarketingFooter } from "@/features/marketing"

/**
 * globals.css pins html/body to height 100% with overflow hidden for the app shell, so marketing
 * pages get their own scroll container here.
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
