"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Package,
  Store,
  Boxes,
  Mail,
  Activity,
  ImageIcon,
  ChevronDown,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { MODULES } from "../../marketing.constants"
import { SpotlightSection } from "../spotlight-section"
import { BRAND_RED } from "@/features/marketing/marketing.constants"

const m = MODULES.find((x) => x.name === "Client Portal")!

type ViewKey = "products" | "channels" | "inventory" | "campaigns" | "activity"

const NAV: { key: ViewKey; icon: LucideIcon; label: string; title: string; badge: string }[] = [
  {
    key: "products",
    icon: Package,
    label: "Products",
    title: "Product catalog",
    badge: "24 items",
  },
  { key: "channels", icon: Store, label: "Channels", title: "Sales channels", badge: "3 live" },
  { key: "inventory", icon: Boxes, label: "Inventory", title: "Inventory", badge: "2 low" },
  { key: "campaigns", icon: Mail, label: "Campaigns", title: "Email campaigns", badge: "4 sent" },
  { key: "activity", icon: Activity, label: "Activity", title: "Activity", badge: "Live" },
]

const rowBase = "border-border/70 bg-card flex flex-1 items-center gap-2 rounded-sm border p-1.5"
const badge = "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium whitespace-nowrap"

function ProductsView() {
  const rows: [string, string, string, "In stock" | "Low stock"][] = [
    ["Aurora Desk Lamp", "Lighting", "$48", "In stock"],
    ["Nimbus Chair", "Furniture", "$219", "Low stock"],
    ["Vertex Monitor", "Displays", "$329", "In stock"],
    ["Halo Speaker", "Audio", "$89", "Low stock"],
    ["Pulse Keyboard", "Peripherals", "$59", "In stock"],
  ]
  const tone = {
    "In stock": "text-emerald-500 bg-emerald-500/10",
    "Low stock": "text-amber-500 bg-amber-500/10",
  }
  return (
    <>
      {rows.map(([name, cat, price, stock]) => (
        <div key={name} className={rowBase}>
          <span className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-sm">
            <ImageIcon className="text-muted-foreground/50 h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-medium">{name}</div>
            <div className="text-muted-foreground truncate text-[9px]">{cat}</div>
          </div>
          <span className={cn(badge, tone[stock])}>{stock}</span>
          <span className="text-primary shrink-0 text-[11px] font-semibold tabular-nums">
            {price}
          </span>
        </div>
      ))}
    </>
  )
}

function ChannelsView() {
  const rows: [string, string, string, string][] = [
    ["Aurora Desk Lamp", "Amazon", "Synced", "text-emerald-500 bg-emerald-500/10"],
    ["Nimbus Chair", "Flipkart", "Syncing", "text-blue-500 bg-blue-500/10"],
    ["Vertex Monitor", "Amazon", "Synced", "text-emerald-500 bg-emerald-500/10"],
    ["Halo Speaker", "Meesho", "Error", "text-red-500 bg-red-500/10"],
    ["Pulse Keyboard", "Amazon", "Synced", "text-emerald-500 bg-emerald-500/10"],
  ]
  return (
    <>
      {rows.map(([name, channel, status, tone]) => (
        <div key={name} className={rowBase}>
          <span className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-sm">
            <Store className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-medium">{name}</div>
            <div className="text-muted-foreground truncate text-[9px]">{channel}</div>
          </div>
          <span className={cn(badge, tone)}>{status}</span>
        </div>
      ))}
    </>
  )
}

function InventoryView() {
  const rows: [string, number, number, string][] = [
    ["Aurora Desk Lamp", 142, 100, "bg-emerald-500"],
    ["Nimbus Chair", 8, 15, "bg-amber-500"],
    ["Vertex Monitor", 63, 100, "bg-emerald-500"],
    ["Halo Speaker", 3, 15, "bg-amber-500"],
    ["Pulse Keyboard", 0, 100, "bg-red-500"],
  ]
  return (
    <>
      {rows.map(([name, qty, cap, bar]) => (
        <div key={name} className={rowBase}>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-[11px] font-medium">{name}</span>
              <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
                {qty} in stock
              </span>
            </div>
            <div className="bg-muted h-1 overflow-hidden rounded-full">
              <div
                className={cn("h-full rounded-full", bar)}
                style={{ width: `${Math.min(100, Math.round((qty / cap) * 100))}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

function CampaignsView() {
  const rows: [string, string, string][] = [
    ["Summer Sale", "4,200 sent", "38% open"],
    ["New Arrivals", "2,100 sent", "41% open"],
    ["Restock Alert", "900 sent", "52% open"],
    ["Welcome Series", "Automated", "46% open"],
  ]
  return (
    <>
      {rows.map(([name, meta, open]) => (
        <div key={name} className={rowBase}>
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm"
            style={{ backgroundColor: "rgba(239,68,68,0.12)", color: BRAND_RED }}
          >
            <Mail className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-medium">{name}</div>
            <div className="text-muted-foreground truncate text-[9px]">{meta}</div>
          </div>
          <span className={cn(badge, "bg-emerald-500/10 text-emerald-500")}>{open}</span>
        </div>
      ))}
    </>
  )
}

function ActivityView() {
  const rows: [string, string][] = [
    ["Viewed Product catalog", "2m ago"],
    ["Exported inventory CSV", "1h ago"],
    ['Sent "Summer Sale" campaign', "Yesterday"],
    ["Signed in", "Yesterday"],
    ["Changed password", "3d ago"],
  ]
  return (
    <>
      {rows.map(([action, time]) => (
        <div key={action} className={rowBase}>
          <span className="bg-primary/60 h-1.5 w-1.5 shrink-0 rounded-full" />
          <span className="min-w-0 flex-1 truncate text-[11px]">{action}</span>
          <span className="text-muted-foreground shrink-0 text-[9px] whitespace-nowrap">
            {time}
          </span>
        </div>
      ))}
    </>
  )
}

const VIEWS: Record<ViewKey, React.ReactNode> = {
  products: <ProductsView />,
  channels: <ChannelsView />,
  inventory: <InventoryView />,
  campaigns: <CampaignsView />,
  activity: <ActivityView />,
}

/** Bespoke visual: the real client-portal shell - a module sidebar (the client's
 *  granted modules) beside module content. Clicking a module switches the view,
 *  like the hero mockup. */
function ClientPortalVisual() {
  const [view, setView] = useState<ViewKey>("products")
  const current = NAV.find((n) => n.key === view)!

  return (
    <div className="border-border bg-background flex h-full overflow-hidden rounded-sm border shadow-xl">
      {/* sidebar */}
      <div className="border-border/70 bg-card/40 flex w-[116px] shrink-0 flex-col border-r p-2 sm:w-[136px]">
        {/* project switcher */}
        <button className="border-border/70 bg-card mb-3 flex items-center gap-1.5 rounded-sm border px-1.5 py-1.5 text-left">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-[9px] font-bold text-white"
            style={{ backgroundColor: BRAND_RED }}
          >
            A
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[10px] leading-tight font-semibold">Acme Co.</span>
            <span className="text-muted-foreground block text-[8px] leading-tight">Client</span>
          </span>
          <ChevronDown className="text-muted-foreground h-3 w-3 shrink-0" />
        </button>
        {/* modules */}
        <div className="text-muted-foreground mb-1 px-1 text-[8px] font-medium tracking-wide uppercase">
          Modules
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = item.key === view
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setView(item.key)}
                className={cn(
                  "relative flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[10px] transition-colors",
                  active ? "font-medium" : "text-muted-foreground hover:text-foreground",
                )}
                style={
                  active ? { backgroundColor: "rgba(239,68,68,0.1)", color: BRAND_RED } : undefined
                }
              >
                {active && (
                  <span
                    className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full"
                    style={{ backgroundColor: BRAND_RED }}
                  />
                )}
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* content */}
      <div className="flex min-w-0 flex-1 flex-col p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold">{current.title}</span>
          <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[9px] font-medium tabular-nums">
            {current.badge}
          </span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex flex-1 flex-col gap-1.5"
          >
            {VIEWS[view]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

export function SpotlightClientPortal() {
  return (
    <SpotlightSection
      eyebrow={m.name}
      title={m.headline}
      text={m.text}
      points={m.points}
      visual={<ClientPortalVisual />}
      reverse
      tinted={false}
      bareVisual
    />
  )
}
