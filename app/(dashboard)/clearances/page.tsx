"use client"

import * as React from "react"
import { CheckCircle2, ShieldCheck } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Link } from "@/components/tenant-link"
import { formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"
import {
  SignClearanceDialog,
  useMyClearances,
  useSetItemDone,
  type MyChecklistItem,
} from "@/features/hr-checklists"

/**
 * "Waiting on you" - every checklist item assigned to the signed-in user.
 *
 * Deliberately open to everyone: the people who use it most - a Finance head,
 * an IT lead, a reporting manager - hold no HR permission at all. Gating this
 * page would lock out exactly the population the exit process depends on.
 */
export default function ClearancesPage() {
  const { data: items, isLoading } = useMyClearances()
  const setDone = useSetItemDone()
  const [signing, setSigning] = React.useState<MyChecklistItem | null>(null)

  const clearances = items?.filter((i) => i.itemKind === "CLEARANCE") ?? []
  const tasks = items?.filter((i) => i.itemKind === "TASK") ?? []

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-14 rounded-sm" />
        <Skeleton className="h-40 rounded-sm" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Waiting on you"
        description="Checklist items and clearance sign-offs assigned to you."
      />

      {(items?.length ?? 0) === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          variant="card"
          title="Nothing is waiting on you"
          description="Clearance sign-offs and onboarding tasks assigned to you appear here."
        />
      ) : (
        <div className="space-y-6">
          {clearances.length > 0 && (
            <Group
              title="Clearance sign-offs"
              subtitle="Relieving cannot be issued until these are signed."
              items={clearances}
              onAct={(item) => setSigning(item)}
              highlight
            />
          )}
          {tasks.length > 0 && (
            <Group
              title="Tasks"
              items={tasks}
              onAct={(item) => setDone.mutate({ itemId: item.id, done: true })}
              actionLabel="Mark done"
              isPending={setDone.isPending}
            />
          )}
        </div>
      )}

      <SignClearanceDialog
        item={signing}
        onOpenChange={(open) => !open && setSigning(null)}
        onSigned={() => setSigning(null)}
      />
    </div>
  )
}

function Group({
  title,
  subtitle,
  items,
  onAct,
  actionLabel = "Sign off",
  highlight,
  isPending,
}: {
  title: string
  subtitle?: string
  items: MyChecklistItem[]
  onAct: (item: MyChecklistItem) => void
  actionLabel?: string
  highlight?: boolean
  isPending?: boolean
}) {
  return (
    <section className="overflow-hidden rounded-sm border">
      <header className={cn("border-b px-3 py-2", highlight ? "bg-amber-500/10" : "bg-muted/50")}>
        <h2 className="flex items-center gap-1.5 text-xs font-medium">
          {highlight && <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />}
          {title}
          <span className="text-muted-foreground font-normal">({items.length})</span>
        </h2>
        {subtitle && <p className="text-muted-foreground mt-0.5 text-[11px]">{subtitle}</p>}
      </header>
      <ul className="divide-y">
        {items.map((item) => {
          const person = item.instance.employee
          const href =
            item.instance.kind === "EXIT"
              ? `/exit-clearance/${item.instance.id}`
              : `/onboarding/${item.instance.id}`
          return (
            <li key={item.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
              <AvatarDisplay
                firstName={person.firstName}
                lastName={person.lastName}
                src={person.profilePhoto}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{item.text}</p>
                <p className="text-muted-foreground text-xs">
                  <Link href={href} className="hover:text-foreground underline underline-offset-2">
                    {person.firstName} {person.lastName}
                  </Link>
                  {" · "}
                  {item.instance.kind === "EXIT" ? "Exit clearance" : "Onboarding"}
                  {item.dueDate && ` · due ${formatDate(item.dueDate)}`}
                </p>
                {item.helpText && (
                  <p className="text-muted-foreground mt-0.5 text-[11px]">{item.helpText}</p>
                )}
              </div>
              <Button onClick={() => onAct(item)} disabled={isPending} className="shrink-0">
                {actionLabel}
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
