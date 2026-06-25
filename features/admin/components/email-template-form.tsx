"use client"

import * as React from "react"
import { Plus, X, Loader2 } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { slugify } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailTemplateData {
  id?: string
  slug?: string
  name?: string
  subject?: string
  bodyHtml?: string
  bodyText?: string | null
  mergeFields?: string[]
  isActive?: boolean
  trigger?: string | null
}

interface EmailTemplateFormProps {
  template?: EmailTemplateData
  onSuccess?: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function submitTemplate(data: Record<string, unknown>, isEdit: boolean): Promise<void> {
  const res = await fetch("/api/notifications/templates", {
    method: isEdit ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(
      json.error ?? (isEdit ? "Failed to update template" : "Failed to create template"),
    )
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EmailTemplateForm({ template, onSuccess }: EmailTemplateFormProps) {
  const qc = useQueryClient()
  const isEdit = Boolean(template?.id)

  const [name, setName] = React.useState(template?.name ?? "")
  const [slug, setSlug] = React.useState(template?.slug ?? "")
  const [subject, setSubject] = React.useState(template?.subject ?? "")
  const [bodyHtml, setBodyHtml] = React.useState(template?.bodyHtml ?? "")
  const [bodyText, setBodyText] = React.useState(template?.bodyText ?? "")
  const [mergeFields, setMergeFields] = React.useState<string[]>(template?.mergeFields ?? [])
  const [isActive, setIsActive] = React.useState(template?.isActive ?? true)
  const [trigger, setTrigger] = React.useState(template?.trigger ?? "")
  const [newField, setNewField] = React.useState("")
  const [slugManuallyEdited, setSlugManuallyEdited] = React.useState(isEdit)

  // Auto-generate slug from name when creating
  React.useEffect(() => {
    if (!slugManuallyEdited && name) {
      setSlug(slugify(name))
    }
  }, [name, slugManuallyEdited])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        slug: slug.trim(),
        name: name.trim(),
        subject: subject.trim(),
        bodyHtml: bodyHtml.trim(),
        bodyText: bodyText.trim() || undefined,
        mergeFields,
        isActive,
        trigger: trigger.trim() || undefined,
      }
      if (isEdit) payload.id = template!.id
      await submitTemplate(payload, isEdit)
    },
    onSuccess: () => {
      toast.success(isEdit ? "Template updated" : "Template created")
      qc.invalidateQueries({ queryKey: ["email-templates"] })
      onSuccess?.()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleAddField = () => {
    const trimmed = newField.trim().replace(/\s+/g, "_")
    if (!trimmed) return
    if (mergeFields.includes(trimmed)) {
      setNewField("")
      return
    }
    setMergeFields((prev) => [...prev, trimmed])
    setNewField("")
  }

  const handleRemoveField = (field: string) => {
    setMergeFields((prev) => prev.filter((f) => f !== field))
  }

  const handleNewFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddField()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !slug.trim() || !subject.trim() || !bodyHtml.trim()) return
    mutation.mutate()
  }

  const isSubmitting = mutation.isPending
  const canSubmit = name.trim() && slug.trim() && subject.trim() && bodyHtml.trim() && !isSubmitting

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Name */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="tpl-name">Name</Label>
        <Input
          id="tpl-name"
          placeholder="e.g. Welcome Email"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isSubmitting}
          maxLength={100}
          required
        />
      </div>

      {/* Slug */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="tpl-slug">
          Slug
          <span className="text-muted-foreground ml-1 text-xs">(unique identifier)</span>
        </Label>
        <Input
          id="tpl-slug"
          placeholder="e.g. welcome-email"
          value={slug}
          onChange={(e) => {
            setSlugManuallyEdited(true)
            setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
          }}
          disabled={isSubmitting}
          maxLength={80}
          required
          className="font-mono text-sm"
        />
      </div>

      {/* Subject */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="tpl-subject">Subject</Label>
        <Input
          id="tpl-subject"
          placeholder="e.g. Welcome to {{company_name}}!"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={isSubmitting}
          maxLength={200}
          required
        />
      </div>

      {/* Body HTML */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="tpl-body">
          Body HTML
          <span className="text-muted-foreground ml-1 text-xs">
            (supports {"{{merge_fields}}"})
          </span>
        </Label>
        <Textarea
          id="tpl-body"
          placeholder="<p>Hi {{first_name}},</p>"
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
          disabled={isSubmitting}
          rows={12}
          required
          className="resize-y font-mono text-xs"
        />
      </div>

      {/* Body Text (optional) */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="tpl-bodytext">
          Plain Text Body
          <span className="text-muted-foreground ml-1 text-xs">(optional fallback)</span>
        </Label>
        <Textarea
          id="tpl-bodytext"
          placeholder="Hi {{first_name}}, ..."
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          disabled={isSubmitting}
          rows={4}
          className="resize-y font-mono text-xs"
        />
      </div>

      <Separator />

      {/* Merge Fields */}
      <div className="flex flex-col gap-3">
        <Label>
          Merge Fields
          <span className="text-muted-foreground ml-1 text-xs">(available placeholders)</span>
        </Label>

        <div className="flex flex-wrap gap-2">
          {mergeFields.map((field) => (
            <Badge key={field} variant="secondary" className="gap-1 pr-1 font-mono text-xs">
              {`{{${field}}}`}
              <button
                type="button"
                onClick={() => handleRemoveField(field)}
                disabled={isSubmitting}
                className="text-muted-foreground hover:bg-background hover:text-foreground ml-0.5 rounded-full p-0.5"
                aria-label={`Remove ${field}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {mergeFields.length === 0 && (
            <p className="text-muted-foreground text-xs italic">No merge fields defined</p>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="field_name (press Enter to add)"
            value={newField}
            onChange={(e) => setNewField(e.target.value.replace(/\s+/g, "_"))}
            onKeyDown={handleNewFieldKeyDown}
            disabled={isSubmitting}
            className="font-mono text-sm"
            maxLength={60}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAddField}
            disabled={isSubmitting || !newField.trim()}
            aria-label="Add merge field"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* Trigger */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="tpl-trigger">
          Trigger
          <span className="text-muted-foreground ml-1 text-xs">(optional event name)</span>
        </Label>
        <Input
          id="tpl-trigger"
          placeholder="e.g. employee.created"
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          disabled={isSubmitting}
          maxLength={100}
          className="font-mono text-sm"
        />
      </div>

      {/* Active toggle */}
      <div className="flex items-center justify-between rounded border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="tpl-active" className="mb-0 cursor-pointer text-sm font-medium">
            Active
          </Label>
          <p className="text-muted-foreground text-xs">
            Inactive templates will not be used for automated emails.
          </p>
        </div>
        <Switch
          id="tpl-active"
          checked={isActive}
          onCheckedChange={setIsActive}
          disabled={isSubmitting}
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={!canSubmit}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting
            ? isEdit
              ? "Saving..."
              : "Creating..."
            : isEdit
              ? "Save Changes"
              : "Create Template"}
        </Button>
      </div>
    </form>
  )
}
