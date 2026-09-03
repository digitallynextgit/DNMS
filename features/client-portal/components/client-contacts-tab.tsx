"use client"

/**
 * Client → Contacts tab: the people at a client who can sign in, and which of
 * the client's projects each of them can see.
 *
 * The same accounts and grants as a project's Portal access tab, from the
 * other end. Here a person is the unit and their projects hang off them, so
 * "give Priya the new store too" is one click on her card rather than a
 * re-typed invitation on the store's page.
 *
 * Types are declared here rather than imported from features/clients, because
 * that feature renders this tab: importing its hooks from here would make the
 * two features load each other.
 */

import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Plus,
  KeyRound,
  Trash2,
  Users,
  Mail,
  Phone,
  Pencil,
  FolderKanban,
  Power,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { CLIENT_MODULES, type ClientModuleKey } from "../modules"

export interface ContactProjectOption {
  id: string
  name: string
  code: string
  slug: string | null
}

export interface ContactGrant {
  id: string
  modules: ClientModuleKey[]
  status: "ACTIVE" | "SUSPENDED"
  createdAt: string
  project: ContactProjectOption
}

export interface ContactRow {
  id: string
  name: string
  email: string
  phone: string | null
  isActive: boolean
  mustChangePassword: boolean
  lastLoginAt: string | null
  createdAt: string
  access: ContactGrant[]
}

interface Props {
  /** Slug or id, for the API URLs. */
  clientRef: string
  clientName: string
  /** The client's projects - the only ones a contact here can be granted. */
  projects: ContactProjectOption[]
  contacts: ContactRow[]
  canWrite: boolean
  /** Called after any change, so the owner refetches the client. */
  onChanged: () => void
}

const JSON_HEADERS = { "Content-Type": "application/json" }

export function ClientContactsTab({
  clientRef,
  clientName,
  projects,
  contacts,
  canWrite,
  onChanged,
}: Props) {
  const [addOpen, setAddOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ContactRow | null>(null)
  const [resetting, setResetting] = React.useState<ContactRow | null>(null)
  const [resetForce, setResetForce] = React.useState(true)
  const [granting, setGranting] = React.useState<ContactRow | null>(null)
  const [editingGrant, setEditingGrant] = React.useState<{
    contact: ContactRow
    grant: ContactGrant
  } | null>(null)
  const [revoking, setRevoking] = React.useState<{
    contact: ContactRow
    grant: ContactGrant
  } | null>(null)

  const api = (path: string, init?: RequestInit) =>
    apiFetch(`/api/clients/${clientRef}${path}`, init)
  const onError = (e: Error) => toast.error(e.message)

  const toggleLogin = useMutation({
    mutationFn: (c: ContactRow) =>
      api(`/contacts/${c.id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ isActive: !c.isActive }),
      }),
    onSuccess: (_r, c) => {
      toast.success(c.isActive ? "Login disabled" : "Login enabled")
      onChanged()
    },
    onError,
  })

  const resetPassword = useMutation({
    mutationFn: (c: ContactRow) =>
      api(`/contacts/${c.id}/password`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ forcePasswordChange: resetForce }),
      }),
    onSuccess: () => {
      toast.success("A new password has been emailed")
      setResetting(null)
      onChanged()
    },
    onError,
  })

  const toggleGrant = useMutation({
    mutationFn: (g: ContactGrant) =>
      api(`/grants/${g.id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ status: g.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }),
      }),
    onSuccess: (_r, g) => {
      toast.success(g.status === "ACTIVE" ? "Access paused" : "Access resumed")
      onChanged()
    },
    onError,
  })

  const revoke = useMutation({
    mutationFn: (g: ContactGrant) => api(`/grants/${g.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Project removed from this contact")
      setRevoking(null)
      onChanged()
    },
    onError,
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          People at {clientName} who can sign in at <span className="font-medium">/login</span>.
          Each sees only the projects and sections granted to them.
        </p>
        {canWrite && (
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add contact
          </Button>
        )}
      </div>

      {contacts.length === 0 && (
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description="Add someone at this client to give them a portal login."
          variant="card"
          action={canWrite ? { label: "Add contact", onClick: () => setAddOpen(true) } : undefined}
        />
      )}

      <div className="space-y-3">
        {contacts.map((c) => {
          const grantable = projects.filter((p) => !c.access.some((a) => a.project.id === p.id))
          return (
            <div
              key={c.id}
              className={cn("bg-card rounded-sm border p-4", !c.isActive && "opacity-70")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{c.name}</p>
                    {!c.isActive && (
                      <Badge variant="secondary" className="text-[10px]">
                        Login disabled
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

                {canWrite && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => setEditing(c)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => {
                        setResetForce(true)
                        setResetting(c)
                      }}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      New password
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-8 gap-1.5 text-xs",
                        c.isActive ? "text-muted-foreground hover:text-destructive" : "",
                      )}
                      title={c.isActive ? "Disable login" : "Enable login"}
                      disabled={toggleLogin.isPending}
                      onClick={() => toggleLogin.mutate(c)}
                    >
                      <Power className="h-3.5 w-3.5" />
                      {c.isActive ? "Disable" : "Enable"}
                    </Button>
                  </div>
                )}
              </div>

              {/* Their projects. Each grant is its own row with its own sections,
                  so two projects can expose different things to the same person. */}
              <div className="mt-3 space-y-2 border-t pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px] tracking-wide uppercase">
                    Projects
                  </span>
                  {canWrite && grantable.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground h-7 gap-1 text-xs"
                      onClick={() => setGranting(c)}
                    >
                      <Plus className="h-3 w-3" />
                      Grant a project
                    </Button>
                  )}
                </div>
                {c.access.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    No projects yet - they can sign in, but will see an empty portal.
                  </p>
                ) : (
                  c.access.map((g) => (
                    <div
                      key={g.id}
                      className="bg-muted/30 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-sm px-3 py-2"
                    >
                      <Link
                        href={`/projects/${g.project.slug || g.project.id}?tab=clients`}
                        className="inline-flex min-w-40 items-center gap-1.5 text-xs font-medium hover:underline"
                      >
                        <FolderKanban className="text-muted-foreground h-3.5 w-3.5" />
                        {g.project.name}
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                        {CLIENT_MODULES.filter((m) => g.modules.includes(m.key)).map((m) => (
                          <Badge key={m.key} variant="secondary" className="text-[10px]">
                            {m.label}
                          </Badge>
                        ))}
                      </div>
                      {canWrite && (
                        <div className="flex items-center gap-1">
                          <div className="mr-1 flex items-center gap-1.5">
                            <Switch
                              checked={g.status === "ACTIVE"}
                              onCheckedChange={() => toggleGrant.mutate(g)}
                              aria-label={`Access to ${g.project.name}`}
                            />
                            <span className="text-muted-foreground text-[11px]">Access</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Sections"
                            aria-label={`Sections for ${g.project.name}`}
                            onClick={() => setEditingGrant({ contact: c, grant: g })}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                            title="Remove project"
                            aria-label={`Remove ${g.project.name}`}
                            onClick={() => setRevoking({ contact: c, grant: g })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      <ContactDialog
        clientRef={clientRef}
        projects={projects}
        contact={editing}
        open={addOpen || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setAddOpen(false)
            setEditing(null)
          }
        }}
        onDone={onChanged}
      />

      <GrantDialog
        clientRef={clientRef}
        contact={granting ?? editingGrant?.contact ?? null}
        grant={editingGrant?.grant ?? null}
        projects={projects}
        open={!!granting || !!editingGrant}
        onOpenChange={(o) => {
          if (!o) {
            setGranting(null)
            setEditingGrant(null)
          }
        }}
        onDone={onChanged}
      />

      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title="Remove this project?"
        description={
          revoking
            ? `${revoking.contact.name} will stop seeing ${revoking.grant.project.name} immediately. Their login and any other projects stay as they are.`
            : ""
        }
        confirmLabel="Remove"
        variant="destructive"
        isLoading={revoke.isPending}
        onConfirm={() => revoking && revoke.mutate(revoking.grant)}
      />

      <Dialog open={!!resetting} onOpenChange={(o) => !o && setResetting(null)}>
        <DialogContent className="max-w-md lg:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Issue a new password</DialogTitle>
            <DialogDescription className="text-xs">
              A new password is generated and emailed to{" "}
              <span className="text-foreground font-medium">{resetting?.email}</span>. Their current
              password stops working straight away.
            </DialogDescription>
          </DialogHeader>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-sm border p-3">
            <Checkbox
              checked={resetForce}
              onCheckedChange={(v) => setResetForce(v === true)}
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

// ─── Shared pieces ──────────────────────────────────────────────────────────

/** The sections checklist, identical to the one on the project's tab. */
function ModulePicker({
  value,
  onChange,
}: {
  value: ClientModuleKey[]
  onChange: (next: ClientModuleKey[]) => void
}) {
  const toggle = (key: ClientModuleKey) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key])
  return (
    <div className="space-y-2">
      {CLIENT_MODULES.map((m) => (
        <label
          key={m.key}
          className={cn(
            "flex cursor-pointer items-start gap-2.5 rounded-sm border p-3 transition-colors",
            value.includes(m.key) ? "border-foreground/30 bg-muted/40" : "",
          )}
        >
          <Checkbox
            checked={value.includes(m.key)}
            onCheckedChange={() => toggle(m.key)}
            className="mt-0.5"
          />
          <span className="min-w-0">
            <span className="block text-xs font-medium">{m.label}</span>
            <span className="text-muted-foreground block text-[11px]">{m.description}</span>
          </span>
        </label>
      ))}
    </div>
  )
}

function ProjectSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (id: string) => void
  options: ContactProjectOption[]
  placeholder: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 text-sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((p) => (
          <SelectItem key={p.id} value={p.id} className="text-xs">
            {p.name}
            <span className="text-muted-foreground ml-1.5 font-mono text-[10px]">{p.code}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ─── Add / edit a contact ───────────────────────────────────────────────────

interface ContactDialogProps {
  clientRef: string
  projects: ContactProjectOption[]
  /** null = adding; set = editing name/phone. */
  contact: ContactRow | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}

/**
 * Remounted on every open (the key), so the fields seed from `contact` fresh
 * each time without an effect.
 */
function ContactDialog(props: ContactDialogProps) {
  return <ContactForm key={props.open ? "open" : "closed"} {...props} />
}

function ContactForm({
  clientRef,
  projects,
  contact,
  open,
  onOpenChange,
  onDone,
}: ContactDialogProps) {
  const isEdit = !!contact
  const [name, setName] = React.useState(contact?.name ?? "")
  const [email, setEmail] = React.useState(contact?.email ?? "")
  const [phone, setPhone] = React.useState(contact?.phone ?? "")
  const [forceChange, setForceChange] = React.useState(true)
  const [projectId, setProjectId] = React.useState("")
  const [modules, setModules] = React.useState<ClientModuleKey[]>([])

  const save = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        return apiFetch(`/api/clients/${clientRef}/contacts/${contact!.id}`, {
          method: "PATCH",
          headers: JSON_HEADERS,
          body: JSON.stringify({ name, phone }),
        })
      }
      return apiFetch<{ data: { credentialsSent: boolean } }>(
        `/api/clients/${clientRef}/contacts`,
        {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({
            name,
            email,
            phone,
            forcePasswordChange: forceChange,
            ...(projectId ? { grant: { projectId, modules } } : {}),
          }),
        },
      )
    },
    onSuccess: (res) => {
      if (isEdit) {
        toast.success("Contact updated")
      } else {
        const sent = (res as { data?: { credentialsSent?: boolean } } | undefined)?.data
          ?.credentialsSent
        toast.success(
          sent === false
            ? "That person already had a login - they've been added to this client"
            : "Contact added - their password has been emailed",
        )
      }
      onOpenChange(false)
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const identityValid = name.trim().length >= 2 && (isEdit || /\S+@\S+\.\S+/.test(email))
  // A chosen project needs at least one section; no project is fine.
  const grantValid = !projectId || modules.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg lg:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {isEdit ? `Edit ${contact!.name}` : "Add a contact"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isEdit
              ? "Their email is their login, so it cannot be changed here."
              : "Who are they? A password is generated and emailed to them - it is never shown here."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="contact-name" className="text-xs">
              Full name<span className="text-destructive"> *</span>
            </Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-email" className="text-xs">
              Email<span className="text-destructive"> *</span>
            </Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isEdit}
              placeholder="you@theircompany.com"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-phone" className="text-xs">
              Phone
            </Label>
            <Input
              id="contact-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {!isEdit && (
            <>
              <div className="space-y-2 border-t pt-4">
                <Label className="text-xs">Give them a project now (optional)</Label>
                {projects.length === 0 ? (
                  <p className="text-muted-foreground text-[11px]">
                    This client has no projects yet. You can grant one later.
                  </p>
                ) : (
                  <ProjectSelect
                    value={projectId}
                    onChange={setProjectId}
                    options={projects}
                    placeholder="No project yet"
                  />
                )}
                {projectId && (
                  <div className="pt-1">
                    <Label className="mb-2 block text-xs">
                      Sections they can see<span className="text-destructive"> *</span>
                    </Label>
                    <ModulePicker value={modules} onChange={setModules} />
                  </div>
                )}
              </div>

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
                    Recommended - the generated password is sent by email.
                  </span>
                </span>
              </label>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-9 text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="h-9 text-xs"
            disabled={!identityValid || !grantValid || save.isPending}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            {isEdit ? "Save changes" : "Add contact and email password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Grant / edit sections ──────────────────────────────────────────────────

interface GrantDialogProps {
  clientRef: string
  contact: ContactRow | null
  /** null = a new grant; set = editing that grant's sections. */
  grant: ContactGrant | null
  projects: ContactProjectOption[]
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}

/** Remounted on every open, for the same reason as ContactDialog. */
function GrantDialog(props: GrantDialogProps) {
  return <GrantForm key={props.open ? "open" : "closed"} {...props} />
}

function GrantForm({
  clientRef,
  contact,
  grant,
  projects,
  open,
  onOpenChange,
  onDone,
}: GrantDialogProps) {
  const isEdit = !!grant
  const [projectId, setProjectId] = React.useState(grant?.project.id ?? "")
  const [modules, setModules] = React.useState<ClientModuleKey[]>(grant?.modules ?? [])

  const available = contact
    ? projects.filter((p) => !contact.access.some((a) => a.project.id === p.id))
    : []

  const save = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        return apiFetch(`/api/clients/${clientRef}/grants/${grant!.id}`, {
          method: "PATCH",
          headers: JSON_HEADERS,
          body: JSON.stringify({ modules }),
        })
      }
      return apiFetch(`/api/clients/${clientRef}/grants`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ contactId: contact!.id, projectId, modules }),
      })
    },
    onSuccess: () => {
      toast.success(isEdit ? "Sections updated" : "Project granted")
      onOpenChange(false)
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg lg:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {isEdit
              ? `${grant!.project.name} for ${contact?.name}`
              : `Grant ${contact?.name} a project`}
          </DialogTitle>
          <DialogDescription className="text-xs">
            What should they be able to see? Anything left unticked stays invisible to them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs">
                Project<span className="text-destructive"> *</span>
              </Label>
              <ProjectSelect
                value={projectId}
                onChange={setProjectId}
                options={available}
                placeholder="Choose a project"
              />
            </div>
          )}
          <div>
            <Label className="mb-2 block text-xs">
              Sections<span className="text-destructive"> *</span>
            </Label>
            <ModulePicker value={modules} onChange={setModules} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-9 text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="h-9 text-xs"
            disabled={(!isEdit && !projectId) || modules.length === 0 || save.isPending}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            {isEdit ? "Save sections" : "Grant project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
