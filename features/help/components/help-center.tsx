"use client"

import { useMemo, useState } from "react"
import { ChevronRight, SearchX } from "lucide-react"
import { Link } from "@/components/tenant-link"
import { PageHeader } from "@/components/shared/page-header"
import { SearchInput } from "@/components/shared/search-input"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { HELP_GROUPS, HELP_GUIDES } from "../guides"
import { useHelpLang } from "../hooks/use-help-lang"
import { canSeeGuide } from "../lib/visibility"
import { guideMatches, tr } from "../lib/text"
import type { HelpGuide, HelpLang } from "../types"
import { HelpLangSwitch } from "./help-lang-switch"

export function HelpCenter() {
  const [lang] = useHelpLang()
  const [query, setQuery] = useState("")
  const { permissions, roles, isLoading } = usePermissions()

  const visible = useMemo(
    () => HELP_GUIDES.filter((g) => canSeeGuide(g, permissions, roles)),
    [permissions, roles],
  )
  const matches = useMemo(() => visible.filter((g) => guideMatches(g, query)), [visible, query])

  return (
    <div className="space-y-8">
      <PageHeader
        title={lang === "hi" ? "मदद और गाइड" : "Help & Guides"}
        description={
          lang === "hi"
            ? "DNMS के हर हिस्से को आसान भाषा में, स्क्रीनशॉट के साथ, स्टेप-बाय-स्टेप समझें।"
            : "Step-by-step guides with screenshots for every part of DNMS, in plain words."
        }
        actions={<HelpLangSwitch />}
      />

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder={
          lang === "hi"
            ? "खोजें - जैसे leave, payslip, password..."
            : "Search - e.g. apply leave, payslip, password..."
        }
        className="w-full sm:max-w-md"
      />

      {isLoading ? (
        <GuideGridSkeleton />
      ) : matches.length === 0 ? (
        <EmptyState
          icon={SearchX}
          variant="card"
          title={lang === "hi" ? "कोई गाइड नहीं मिली" : "No guides match your search"}
          description={
            lang === "hi"
              ? "दूसरे शब्दों से खोजें, या हिंदी/English में बदलकर देखें।"
              : "Try other words - searching works in English and Hindi."
          }
        />
      ) : (
        HELP_GROUPS.map((group) => {
          const guides = matches.filter((g) => g.group === group.id)
          if (guides.length === 0) return null
          return (
            <section key={group.id} className="space-y-3">
              <div>
                <h2 className="text-base font-semibold">{tr(group.title, lang)}</h2>
                <p className="text-muted-foreground text-sm">{tr(group.blurb, lang)}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {guides.map((g) => (
                  <GuideCard key={g.slug} guide={g} lang={lang} />
                ))}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}

function GuideCard({ guide, lang }: { guide: HelpGuide; lang: HelpLang }) {
  const Icon = guide.icon
  return (
    <Link
      href={`/help/${guide.slug}`}
      className="group bg-card hover:border-foreground/30 flex items-start gap-3 rounded-sm border p-4 transition-colors"
    >
      <span className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-sm">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-sm font-medium">
          {tr(guide.title, lang)}
          <ChevronRight className="text-muted-foreground h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
        <span className="text-muted-foreground mt-0.5 line-clamp-2 block text-xs leading-relaxed">
          {tr(guide.summary, lang)}
        </span>
      </span>
    </Link>
  )
}

function GuideGridSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-40" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[76px] w-full" />
        ))}
      </div>
    </div>
  )
}
