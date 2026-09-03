"use client"

/**
 * Project → Portal access tab.
 *
 * Who at the client can sign in and see THIS project, and which sections. Each
 * person's sections are their own - two people on the same project can be given
 * different views, and changing one never moves the other.
 *
 * When the project is filed under a client, the people already on that client's
 * books are offered as a pick-list, so giving someone a second project is one
 * click rather than a re-typed invitation. The client's own page
 * (Clients → Contacts) is the same accounts from the other end.
 */

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Plus,
  KeyRound,
  Trash2,
  Users,
  Mail,
  Phone,
  Pencil,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { Link } from "@/components/tenant-link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
// A leaf helper, imported by its concrete path: the clients barrel renders the
// contacts tab from this feature, so importing it here would be a cycle.
import { clientHref } from "@/features/clients/lib/client-href"
import { CLIENT_MODULES, type ClientModuleKey } from "../modules"

interface ClientAccess {
  id: string
  modules: ClientModuleKey[]
  status: "ACTIVE" | "SUSPENDED"
  createdAt: string
  clientUser: {
    id: string
    name: string
    email: string
    phone: string | null
    isActive: boolean
    mustChangePassword: boolean
    lastLoginAt: string | null
  }
}

interface ClientRef {
  id: string
  name: string
  slug: string | null
}

/** Someone at the project's client who does not have this project yet. */
interface Candidate {
  id: string
  name: string
  email: string
}

export function ProjectClientsTab({
  projectRef,
  canManage,
}: {
  projectRef: string
  canManage: boolean
}) {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ClientAccess | null>(null)
  const [removing, setRemoving] = React.useState<ClientAccess | null>(null)
  const [resetting, setResetting] = React.useState<ClientAccess | null>(null)
  const [resetForceChange, setResetForceChange] = React.useState(true)

  const key = ["project-clients", projectRef]
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key })
    // The client's page counts contacts and grants.
    qc.invalidateQueries({ queryKey: ["client"] })
    qc.invalidateQueries({ queryKey: ["clients"] })
  }

  const { data, isPending } = useQuery({
    queryKey: key,
    // Double `data`: withProjectManager → respond() wraps the service's own
    // { data } payload.
    queryFn: async () =>
      (
        await apiFetch<{
          data: { data: ClientAccess[]; client: ClientRef | null; candidates: Candidate[] }
        }>(`/api/projects/${projectRef}/clients`)
      ).data,
    enabled: canManage,
  })
  const client = data?.client ?? null
  const candidates = data?.candidates ?? []

  const remove = useMutation({
    mutationFn: (row: ClientAccess) =>
      apiFetch(`/api/projects/${projectRef}/clients/${row.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Removed from this project")
      setRemoving(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const resetPassword = useMutation({
    mutationFn: (row: ClientAccess) =>
      apiFetch(`/api/projects/${projectRef}/clients/${row.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forcePasswordChange: resetForceChange }),
      }),
    onSuccess: () => {
      toast.success("A new password has been emailed")
      setResetting(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleStatus = useMutation({
    mutationFn: (row: ClientAccess) =>
      apiFetch(`/api/projects/${projectRef}/clients/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: row.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }),
      }),
    onSuccess: (_r, row) => {
      toast.success(row.status === "ACTIVE" ? "Access paused" : "Access resumed")
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!canManage) {
    return (
      <EmptyState
        icon={Users}
        title="Not available"
        description="Only the Account Manager or a project admin can manage portal access."
        variant="card"
      />
    )
  }

  const clients = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          {client ? (
            <>
              People at{" "}
              <Link
                href={clientHref(client)}
                className="text-foreground font-medium hover:underline"
              >
                {client.name}
              </Link>{" "}
              who can sign in at <span className="font-medium">/login</span> and see this project.
              Each sees only the sections ticked for them.
            </>
          ) : (
            <>
              People who can sign in at <span className="font-medium">/login</span> and see this
              project. File the project under a client to pick from its existing contacts.
            </>
          )}
        </p>
        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add person
        </Button>
      </div>

      {isPending && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-sm" />
          ))}
        </div>
      )}

      {!isPending && clients.length === 0 && (
        <EmptyState
          icon={Users}
          title="Nobody can see this project yet"
          description="Add a person to give them a login and share this project with them."
          variant="card"
        />
      )}

      <div className="space-y-3">
        {clients.map((row) => {
          const c = row.clientUser
          const paused = row.status !== "ACTIVE" || !c.isActive
          return (
            <div key={row.id} className="bg-card rounded-sm border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{c.name}</p>
                    {paused && (
                      <Badge variant="secondary" className="text-[10px]">
                        {c.isActive ? "Paused" : "Login disabled"}
                      </Badge>
                    )}
                    {c.mustChangePassword && (
                      <Badge variant="outline" className="text-[10px]">
                        Password change pending
                      </Badge>
                    )}
                    {!c.lastLoginAt && (
                      <Badge variant="outline" className="text-[10px]">
                        Never signed in
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {c.email}
                    </span>
                    {c.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {c.phone}
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="mr-1 flex items-center gap-1.5">
                    <Switch
                      checked={row.status === "ACTIVE"}
                      onCheckedChange={() => toggleStatus.mutate(row)}
                      aria-label="Access to this project"
                    />
                    <span className="text-muted-foreground text-[11px]">Access</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => setEditing(row)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Sections
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => {
                      setResetForceChange(true)
                      setResetting(row)
                    }}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    New password
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive h-8 px-2"
                    onClick={() => setRemoving(row)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
                <span className="text-muted-foreground mr-1 text-[11px]">Can see:</span>
                {row.modules.length === 0 ? (
                  <span className="text-muted-foreground text-[11px]">nothing yet</span>
                ) : (
                  CLIENT_MODULES.filter((m) => row.modules.includes(m.key)).map((m) => (
                    <Badge key={m.key} variant="secondary" className="text-[10px]">
                      {m.label}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      <ClientDialog
        projectRef={projectRef}
        access={editing}
        client={client}
        candidates={candidates}
        open={addOpen || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setAddOpen(false)
            setEditing(null)
          }
        }}
        onDone={invalidate}
      />

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove from this project?"
        description={
          removing
            ? `${removing.clientUser.name} will stop seeing this project immediately. Their login stays active for any other project they're on.`
            : ""
        }
        confirmLabel="Remove"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />

      {/* A modal too, so every action on this tab opens the same way rather than
          mixing a centre popup with a side panel. */}
      <Dialog open={!!resetting} onOpenChange={(o) => !o && setResetting(null)}>
        <DialogContent className="max-w-md lg:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Issue a new password</DialogTitle>
            <DialogDescription className="text-xs">
              A new password is generated and emailed to{" "}
              <span className="text-foreground font-medium">{resetting?.clientUser.email}</span>.
              Their current password stops working straight away.
            </DialogDescription>
          </DialogHeader>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-sm border p-3">
            <Checkbox
              checked={resetForceChange}
              onCheckedChange={(v) => setResetForceChange(v === true)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-xs font-medium">
                Force a password change on first sign-in
              </span>
              <span className="text-muted-foreground block text-[11px]">
                Recommended - the emailed password has travelled through an inbox.
              </span>
            </span>
          </label>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-9 text-xs" onClick={() => setResetting(null)}>
              Cancel
            </Button>
            <Button
              className="h-9 text-xs"
              loading={resetPassword.isPending}
              disabled={resetPassword.isPending}
              onClick={() => resetting && resetPassword.mutate(resetting)}
            >
              Generate and email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Add / edit ─────────────────────────────────────────────────────────────

const STEPS = [
  { number: 1, label: "Who" },
  { number: 2, label: "Access" },
]

/** Same numbered-circle wizard header the employee form uses. */
function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-0">
      {STEPS.map((step, index) => {
        const isCompleted = currentStep > step.number
        const isActive = currentStep === step.number
        return (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-[2px] text-sm font-semibold transition-all",
                  isCompleted && "bg-primary text-primary-foreground",
                  isActive &&
                    "bg-primary text-primary-foreground ring-primary ring-2 ring-offset-2",
                  !isCompleted && !isActive && "bg-muted text-muted-foreground",
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : step.number}
              </div>
              <span
                className={cn(
                  "hidden text-xs sm:block",
                  isActive ? "text-foreground font-medium" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-1 mb-5 h-px w-12 transition-colors sm:w-20",
                  currentStep > step.number ? "bg-primary" : "bg-muted",
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

const NEW_PERSON = "__new__"

interface ClientDialogProps {
  projectRef: string
  /** null = adding; set = editing an existing grant. */
  access: ClientAccess | null
  client: ClientRef | null
  candidates: Candidate[]
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}

/**
 * Two-step modal, mirroring the employee wizard: WHO they are, then WHAT they
 * can see. When the project has a client, step one starts with that client's
 * existing people; picking one skips the identity fields, because the account
 * already exists and no password is issued.
 *
 * Remounted on every open (the key), so the fields seed from `access` fresh
 * each time without an effect.
 */
function ClientDialog(props: ClientDialogProps) {
  return <ClientDialogForm key={props.open ? "open" : "closed"} {...props} />
}

function ClientDialogForm({
  projectRef,
  access,
  client,
  candidates,
  open,
  onOpenChange,
  onDone,
}: ClientDialogProps) {
  const isEdit = !!access
  const [step, setStep] = React.useState(1)
  const [contactId, setContactId] = React.useState("")
  const [name, setName] = React.useState(access?.clientUser.name ?? "")
  const [email, setEmail] = React.useState(access?.clientUser.email ?? "")
  const [phone, setPhone] = React.useState(access?.clientUser.phone ?? "")
  const [modules, setModules] = React.useState<ClientModuleKey[]>(access?.modules ?? [])
  const [forceChange, setForceChange] = React.useState(true)

  const usingExisting = !isEdit && !!contactId

  const save = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        return apiFetch(`/api/projects/${projectRef}/clients/${access!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, phone, modules }),
        })
      }
      // Envelope: respond() wraps the service payload, so credentialsSent sits
      // at res.data.credentialsSent alongside res.data.data.
      return apiFetch<{ data: { credentialsSent: boolean } }>(
        `/api/projects/${projectRef}/clients`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            usingExisting
              ? { contactId, modules }
              : { name, email, phone, modules, forcePasswordChange: forceChange },
          ),
        },
      )
    },
    onSuccess: (res) => {
      if (isEdit) {
        toast.success("Updated")
      } else if (usingExisting) {
        toast.success("Added to this project")
      } else {
        // An existing account keeps its password, so promising an email went
        // out would be a lie.
        const sent = (res as { data?: { credentialsSent?: boolean } } | undefined)?.data
          ?.credentialsSent
        toast.success(
          sent === false
            ? "That person already had a login - they've been added to this project"
            : "Added - their password has been emailed",
        )
      }
      onOpenChange(false)
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function toggle(key: ClientModuleKey) {
    setModules((m) => (m.includes(key) ? m.filter((k) => k !== key) : [...m, key]))
  }

  // Step 1 needs a usable identity; step 2 needs at least one section. Gating
  // "Next" on step 1 means you cannot reach the access screen and then discover
  // the email was malformed.
  const step1Valid =
    usingExisting || (name.trim().length >= 2 && (isEdit || /\S+@\S+\.\S+/.test(email)))
  const step2Valid = modules.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg lg:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {isEdit ? `Edit ${access!.clientUser.name}` : "Add a person to this project"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {step === 1
              ? "Who are they? Their email is also how they sign in."
              : "What should they be able to see on this project?"}
          </DialogDescription>
        </DialogHeader>

        <div>
          <StepIndicator currentStep={step} />

          {step === 1 ? (
            <div className="space-y-4">
              {!isEdit && client && candidates.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Already at {client.name}</Label>
                  <Select
                    value={contactId || NEW_PERSON}
                    onValueChange={(v) => setContactId(v === NEW_PERSON ? "" : v)}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NEW_PERSON} className="text-xs">
                        Someone new
                      </SelectItem>
                      {candidates.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.name}
                          <span className="text-muted-foreground ml-1.5">{c.email}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-[11px]">
                    An existing login keeps its password. Only someone new is emailed one.
                  </p>
                </div>
              )}

              {!usingExisting && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="client-name" className="text-xs">
                      Full name<span className="text-destructive"> *</span>
                    </Label>
                    <Input
                      id="client-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Priya Sharma"
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="client-email" className="text-xs">
                      Email<span className="text-destructive"> *</span>
                    </Label>
                    <Input
                      id="client-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isEdit}
                      placeholder="you@theircompany.com"
                      className="h-9 text-sm"
                    />
                    <p className="text-muted-foreground text-[11px]">
                      {isEdit
                        ? "The email is their login, so it can't be changed here."
                        : "Their login, and where the generated password is sent."}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="client-phone" className="text-xs">
                      Phone
                    </Label>
                    <Input
                      id="client-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">
                  Sections they can see<span className="text-destructive"> *</span>
                </Label>
                {CLIENT_MODULES.map((m) => (
                  <label
                    key={m.key}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-sm border p-3 transition-colors",
                      modules.includes(m.key) ? "border-foreground/30 bg-muted/40" : "",
                    )}
                  >
                    <Checkbox
                      checked={modules.includes(m.key)}
                      onCheckedChange={() => toggle(m.key)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium">{m.label}</span>
                      <span className="text-muted-foreground block text-[11px]">
                        {m.description}
                      </span>
                    </span>
                  </label>
                ))}
                <p className="text-muted-foreground text-[11px]">
                  Anything left unticked stays invisible to them - they can&apos;t reach it by URL
                  either.
                </p>
              </div>

              {!isEdit && !usingExisting && (
                <div className="space-y-2 border-t pt-4">
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-sm border p-3">
                    <Checkbox
                      checked={forceChange}
                      onCheckedChange={(v) => setForceChange(v === true)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-xs font-medium">
                        Force a password change on first sign-in
                      </span>
                      <span className="text-muted-foreground block text-[11px]">
                        Recommended - the generated password is sent by email, so it shouldn&apos;t
                        stay the live one.
                      </span>
                    </span>
                  </label>
                  <p className="text-muted-foreground text-[11px]">
                    A password is generated automatically and emailed to them. It is never shown
                    here.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step === 1 ? (
            <>
              <Button variant="outline" className="h-9 text-xs" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button className="h-9 text-xs" disabled={!step1Valid} onClick={() => setStep(2)}>
                Next
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="h-9 text-xs" onClick={() => setStep(1)}>
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                Back
              </Button>
              <Button
                className="h-9 text-xs"
                disabled={!step2Valid || save.isPending}
                loading={save.isPending}
                onClick={() => save.mutate()}
              >
                {isEdit
                  ? "Save changes"
                  : usingExisting
                    ? "Add to project"
                    : "Add person and email password"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
