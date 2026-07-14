"use client"

import * as React from "react"
import { Plus, Pencil, Mail } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { EmailTemplateForm } from "@/features/admin"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS } from "@/lib/constants"
import { formatDate, truncate } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailTemplate {
  id: string
  slug: string
  name: string
  subject: string
  bodyHtml: string
  bodyText: string | null
  mergeFields: string[]
  isActive: boolean
  trigger: string | null
  createdAt: string
  updatedAt: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

export default function EmailTemplatesPage() {
  const { can } = usePermissions()
  const canWrite = can(PERMISSIONS.EMAIL_TEMPLATE_WRITE)
  const qc = useQueryClient()

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingTemplate, setEditingTemplate] = React.useState<EmailTemplate | null>(null)
  const [page, setPage] = React.useState(1)

  const { data, isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/templates")
      if (!res.ok) throw new Error("Failed to load templates")
      const json = await res.json()
      return json.data as EmailTemplate[]
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch("/api/notifications/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive }),
      })
      if (!res.ok) throw new Error("Failed to update template")
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates"] })
    },
    onError: () => {
      toast.error("Failed to update template status")
    },
  })

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setSheetOpen(true)
  }

  const handleCreate = () => {
    setEditingTemplate(null)
    setSheetOpen(true)
  }

  const handleSheetClose = () => {
    setSheetOpen(false)
    setEditingTemplate(null)
  }

  const templates = data ?? []

  // Client-side pagination over the full reused /api/notifications/templates list.
  const totalPages = Math.max(1, Math.ceil(templates.length / PAGE_SIZE))
  const pagedTemplates = templates.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Keep the current page in range when the list size changes (e.g. after a delete).
  React.useEffect(() => {
    if (!isLoading && page > totalPages) setPage(totalPages)
  }, [page, totalPages, isLoading])

  const columns: DataTableColumn<EmailTemplate>[] = [
    { header: "Name", className: "font-medium", cell: (template) => template.name },
    {
      header: "Slug",
      cell: (template) => (
        <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{template.slug}</code>
      ),
    },
    {
      header: "Subject",
      className: "text-muted-foreground max-w-[200px] text-sm",
      cell: (template) => truncate(template.subject, 50),
    },
    {
      header: "Trigger",
      cell: (template) =>
        template.trigger ? (
          <Badge variant="outline" className="font-mono text-xs">
            {template.trigger}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        ),
    },
    {
      header: "Active",
      cell: (template) => (
        <Switch
          checked={template.isActive}
          disabled={!canWrite || toggleActiveMutation.isPending}
          onCheckedChange={(checked) =>
            toggleActiveMutation.mutate({ id: template.id, isActive: checked })
          }
          aria-label={`Toggle ${template.name}`}
        />
      ),
    },
    {
      header: "Last Updated",
      className: "text-muted-foreground text-sm",
      cell: (template) => formatDate(template.updatedAt),
    },
    ...(canWrite
      ? [
          {
            header: "",
            align: "right" as const,
            headClassName: "w-[60px]",
            cell: (template: EmailTemplate) => (
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => handleEdit(template)}
                aria-label={`Edit ${template.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Email Templates"
        description="Manage transactional email templates used across the DNMS platform."
        actions={
          canWrite ? (
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          ) : undefined
        }
      />

      {/* The table renders from the first paint: while `isLoading` it draws
          skeleton rows inside its own real <thead>, derived from `columns`, so
          the placeholder always has the right column count and alignment. */}
      {isLoading || templates.length > 0 ? (
        <DataTable
          columns={columns}
          rows={pagedTemplates}
          rowKey={(template) => template.id}
          showSerial
          serialOffset={(page - 1) * PAGE_SIZE}
          loading={isLoading}
          skeletonRows={PAGE_SIZE}
          pagination={{
            page,
            totalPages,
            total: templates.length,
            onPageChange: setPage,
            itemLabel: "template",
          }}
        />
      ) : (
        <EmptyState
          icon={Mail}
          variant="card"
          title="No email templates yet"
          description="Create your first email template to start sending transactional emails."
          action={canWrite ? { label: "Create Template", onClick: handleCreate } : undefined}
        />
      )}

      <Sheet open={sheetOpen} onOpenChange={handleSheetClose}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-[640px]">
          <SheetHeader>
            <SheetTitle>{editingTemplate ? "Edit Template" : "Create Template"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <EmailTemplateForm
              template={editingTemplate ?? undefined}
              onSuccess={handleSheetClose}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
