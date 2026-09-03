"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { apiFetch } from "@/lib/api-fetch"
import { CLIENT_STATUS_LABELS } from "@/lib/constants"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FormDialog } from "@/components/shared/form-dialog"
import { EmployeeCombobox } from "@/features/employees/components/employee-combobox"
import { clientKeys } from "../hooks/use-clients"

export interface ClientFormValues {
  name: string
  status: string
  industry: string
  website: string
  email: string
  phone: string
  address: string
  taxId: string
  notes: string
  ownerId: string
}

const EMPTY_FORM: ClientFormValues = {
  name: "",
  status: "ACTIVE",
  industry: "",
  website: "",
  email: "",
  phone: "",
  address: "",
  taxId: "",
  notes: "",
  ownerId: "",
}

export interface SavedClient {
  id: string
  name: string
  code: string
  slug: string | null
  status: string
}

interface Props {
  open: boolean
  onClose: () => void
  mode: "create" | "edit"
  clientId?: string
  initial?: Partial<ClientFormValues>
  /** The current account manager's name, so edit mode can show it before a search. */
  ownerLabel?: string
  onSuccess?: (client: SavedClient) => void
}

/**
 * Create or edit a client - the company. Its people and their portal access
 * live on the client's page, not here: this form is about who the company is.
 *
 * Remounted on every open (the key), so the fields seed from `initial` fresh
 * each time without an effect. `initial` is an inline literal on the parent's
 * every render; seeding on it any other way would wipe in-progress edits
 * whenever the parent refetched.
 */
export function ClientFormDialog(props: Props) {
  return <ClientForm key={props.open ? "open" : "closed"} {...props} />
}

function ClientForm({ open, onClose, mode, clientId, initial, ownerLabel, onSuccess }: Props) {
  const qc = useQueryClient()
  const [form, setForm] = useState<ClientFormValues>(() => ({ ...EMPTY_FORM, ...initial }))

  const set = <K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res =
        mode === "create"
          ? await apiFetch<{ data: SavedClient }>("/api/clients", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await apiFetch<{ data: SavedClient }>(`/api/clients/${clientId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
      return res.data
    },
    onSuccess: (client) => {
      qc.invalidateQueries({ queryKey: clientKeys.all })
      // Prefix match: takes the detail and its activity pages with it.
      qc.invalidateQueries({ queryKey: ["client"] })
      toast.success(mode === "create" ? "Client created" : "Client updated")
      onSuccess?.(client)
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const canSubmit = form.name.trim().length >= 2

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || save.isPending) return
    save.mutate({
      name: form.name.trim(),
      status: form.status,
      industry: form.industry,
      website: form.website,
      email: form.email,
      phone: form.phone,
      address: form.address,
      taxId: form.taxId,
      notes: form.notes,
      ownerId: form.ownerId || null,
    })
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && !save.isPending && onClose()}
      title={mode === "create" ? "New Client" : "Edit Client"}
      isEdit={mode === "edit"}
      isPending={save.isPending}
      submitDisabled={!canSubmit}
      submitLabel={mode === "create" ? "Create Client" : "Save Changes"}
      onSubmit={handleSubmit}
      size="md"
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <div className="space-y-2">
            <Label htmlFor="client-name">Company name *</Label>
            <Input
              id="client-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Acme Studios"
            />
            {mode === "create" && (
              <p className="text-muted-foreground text-[11px]">
                A code <span className="font-mono font-medium">CL#####</span> is generated
                automatically.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CLIENT_STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Account Manager</Label>
          <p className="text-muted-foreground text-xs">
            Who owns the relationship. Each project still has its own account manager.
          </p>
          <EmployeeCombobox
            value={form.ownerId || undefined}
            onChange={(v) => set("ownerId", v ?? "")}
            initialLabel={ownerLabel}
            placeholder="Search employees..."
            modal
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="client-industry">Industry</Label>
            <Input
              id="client-industry"
              value={form.industry}
              onChange={(e) => set("industry", e.target.value)}
              placeholder="e.g. E-commerce"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-website">Website</Label>
            <Input
              id="client-website"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-email">Email</Label>
            <Input
              id="client-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="hello@acme.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-phone">Phone</Label>
            <Input
              id="client-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <div className="space-y-2">
            <Label htmlFor="client-address">Address</Label>
            <Textarea
              id="client-address"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              rows={2}
              placeholder="Billing address"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-tax">Tax / GST number</Label>
            <Input
              id="client-tax"
              value={form.taxId}
              onChange={(e) => set("taxId", e.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-notes">Notes</Label>
          <Textarea
            id="client-notes"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
            placeholder="Anything the team should know about working with this client."
          />
        </div>
      </div>
    </FormDialog>
  )
}
