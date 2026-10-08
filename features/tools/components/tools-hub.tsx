"use client"

import { useMemo, useState } from "react"
import { ChevronRight, SearchX, Sparkles } from "lucide-react"
import { Link } from "@/components/tenant-link"
import { PageHeader } from "@/components/shared/page-header"
import { SearchInput } from "@/components/shared/search-input"
import { EmptyState } from "@/components/shared/empty-state"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { canAccess } from "@/lib/nav"
import { TOOLS, TOOL_CATEGORIES, type ToolDefinition } from "../tools"

export function ToolsHub() {
  const { permissions, roles } = usePermissions()
  const [query, setQuery] = useState("")

  const tools = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return TOOLS.filter((t) => canAccess(t, permissions, roles)).filter((t) => {
      if (words.length === 0) return true
      const text = [t.title, t.description, ...(t.keywords ?? [])].join(" ").toLowerCase()
      return words.every((w) => text.includes(w))
    })
  }, [permissions, roles, query])

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tools"
        description="Handy utilities for everyday work. Your files stay on your computer - nothing is uploaded."
      />

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search tools - e.g. compress, pdf, gst"
        className="w-full sm:max-w-md"
      />

      {tools.length === 0 ? (
        <EmptyState
          icon={SearchX}
          variant="card"
          title="No tools match your search"
          description="Try another word, like image, pdf or link."
        />
      ) : (
        TOOL_CATEGORIES.map((cat) => {
          const inCat = tools.filter((t) => t.category === cat.id)
          if (inCat.length === 0) return null
          return (
            <section key={cat.id} className="space-y-3">
              <h2 className="text-base font-semibold">{cat.title}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {inCat.map((tool) => (
                  <ToolCard key={tool.slug} tool={tool} />
                ))}
              </div>
            </section>
          )
        })
      )}

      {!query && (
        <div className="text-muted-foreground flex items-center gap-3 rounded-sm border border-dashed p-4">
          <Sparkles className="h-5 w-5 shrink-0" />
          <span className="text-xs leading-relaxed">
            Need a tool that would save you time? Tell your admin - new tools are added here.
          </span>
        </div>
      )}
    </div>
  )
}

function ToolCard({ tool }: { tool: ToolDefinition }) {
  const Icon = tool.icon
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="group bg-card hover:border-foreground/30 flex items-start gap-3 rounded-sm border p-4 transition-colors"
    >
      <span className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-sm">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-sm font-medium">
          {tool.title}
          <ChevronRight className="text-muted-foreground h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
        <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
          {tool.description}
        </span>
      </span>
    </Link>
  )
}
