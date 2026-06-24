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
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

export default function EmailTemplatesPage() {
  const { can } = usePermissions()
  const canWrite = can(PERMISSIONS.EMAIL_TEMPLATE_WRITE)
  const qc = useQueryClient()

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingTemplate, setEditingTemplate] = React.useState<EmailTemplate | null>(null)

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

      {isLoading ? (
        <div className="rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No email templates yet"
          description="Create your first email template to start sending transactional emails."
          action={canWrite ? { label: "Create Template", onClick: handleCreate } : undefined}
        />
      ) : (
        <div className="rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Last Updated</TableHead>
                {canWrite && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>
                    <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                      {template.slug}
                    </code>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] text-sm">
                    {truncate(template.subject, 50)}
                  </TableCell>
                  <TableCell>
                    {template.trigger ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        {template.trigger}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={template.isActive}
                      disabled={!canWrite || toggleActiveMutation.isPending}
                      onCheckedChange={(checked) =>
                        toggleActiveMutation.mutate({ id: template.id, isActive: checked })
                      }
                      aria-label={`Toggle ${template.name}`}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(template.updatedAt)}
                  </TableCell>
                  {canWrite && (
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleEdit(template)}
                        aria-label={`Edit ${template.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
