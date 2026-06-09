"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Rocket, Users, Clock, CalendarDays, DollarSign, FileText, Shield } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { SearchInput } from "@/components/shared/search-input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RoleFilter = "all" | "employee" | "manager" | "hr" | "admin"

interface ModuleCard {
  slug: string
  title: string
  description: string
  icon: React.ElementType
  tags: string[]
}

// ---------------------------------------------------------------------------
// Module data
// ---------------------------------------------------------------------------

const MODULE_CARDS: ModuleCard[] = [
  {
    slug: "getting-started",
    title: "Getting Started",
    description: "Login, navigation, and your first steps in DNMS",
    icon: Rocket,
    tags: ["employee", "manager", "hr", "admin"],
  },
  {
    slug: "employees",
    title: "Employee Management",
    description: "Add, edit, view employee profiles and org chart",
    icon: Users,
    tags: ["hr", "admin"],
  },
  {
    slug: "attendance",
    title: "Attendance",
    description: "Track check-in/out, view your attendance history",
    icon: Clock,
    tags: ["employee", "manager", "hr"],
  },
  {
    slug: "leave",
    title: "Leave Management",
    description: "Apply for leave, check balances, approve team requests",
    icon: CalendarDays,
    tags: ["employee", "manager", "hr"],
  },
  {
    slug: "payroll",
    title: "Payroll & Payslips",
    description: "View your payslips, understand deductions, process payroll",
    icon: DollarSign,
    tags: ["employee", "hr", "admin"],
  },
  {
    slug: "documents",
    title: "Documents",
    description: "Upload, download, and manage company and employee files",
    icon: FileText,
    tags: ["employee", "hr"],
  },
  {
    slug: "admin",
    title: "Admin & Settings",
    description: "Roles, permissions, audit log, email templates",
    icon: Shield,
    tags: ["admin"],
  },
]

const ROLE_TABS: { label: string; value: RoleFilter }[] = [
  { label: "All", value: "all" },
  { label: "Employee", value: "employee" },
  { label: "Manager", value: "manager" },
  { label: "HR", value: "hr" },
  { label: "Admin", value: "admin" },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DocsPage() {
  const router = useRouter()
  const [search, setSearch] = React.useState("")
  const [activeRole, setActiveRole] = React.useState<RoleFilter>("all")

  const filtered = React.useMemo(() => {
    const query = search.toLowerCase().trim()
    return MODULE_CARDS.filter((card) => {
      const matchesRole = activeRole === "all" || card.tags.includes(activeRole)
      const matchesSearch =
        !query ||
        card.title.toLowerCase().includes(query) ||
        card.description.toLowerCase().includes(query) ||
        card.tags.some((t) => t.includes(query))
      return matchesRole && matchesSearch
    })
  }, [search, activeRole])

  return (
    <div className="space-y-6">
      <PageHeader title="Help & Guide" description="Everything you need to know about using DNMS" />

      {/* Search + filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search guides..."
          className="w-full sm:max-w-xs"
        />
        <Tabs value={activeRole} onValueChange={(v) => setActiveRole(v as RoleFilter)}>
          <TabsList>
            {ROLE_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <p className="text-base font-medium text-slate-700">No guides found</p>
          <p className="text-muted-foreground text-sm">
            Try a different search term or role filter.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("")
              setActiveRole("all")
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((card) => (
            <ModuleCardItem
              key={card.slug}
              card={card}
              onRead={() => router.push(`/docs/${card.slug}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Module card
// ---------------------------------------------------------------------------

function ModuleCardItem({ card, onRead }: { card: ModuleCard; onRead: () => void }) {
  const Icon = card.icon

  return (
    <Card className="flex flex-col transition-shadow hover:shadow-md">
      <CardContent className="flex flex-1 flex-col gap-4 p-6">
        {/* Icon */}
        <div className="bg-primary/10 flex h-11 w-11 items-center justify-center rounded">
          <Icon className="text-primary h-5 w-5" />
        </div>

        {/* Text */}
        <div className="flex-1 space-y-1">
          <h3 className="text-foreground font-semibold">{card.title}</h3>
          <p className="text-muted-foreground text-sm leading-snug">{card.description}</p>
        </div>

        {/* Tags + action */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-1">
            {card.tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                  tag === "employee" && "bg-blue-100 text-blue-700",
                  tag === "manager" && "bg-purple-100 text-purple-700",
                  tag === "hr" && "bg-green-100 text-green-700",
                  tag === "admin" && "bg-red-100 text-red-700",
                )}
              >
                {tag}
              </span>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={onRead} className="shrink-0">
            Read Guide
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
