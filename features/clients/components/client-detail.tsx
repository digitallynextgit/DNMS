"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Activity,
  Building2,
  ChevronLeft,
  FileText,
  FolderKanban,
  Globe,
  Layers,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  Users,
} from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import { PERMISSIONS, CLIENT_STATUS_LABELS, CLIENT_STATUS_COLORS } from "@/lib/constants"
import { Link, useTenantPath } from "@/components/tenant-link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/shared/page-header"
import { StatStrip } from "@/components/shared/stat-strip"
import { StatusBadge } from "@/components/shared/status-badge"
import { InfoRow } from "@/components/shared/info-row"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/shared/loading-skeleton"
import { useUrlState } from "@/hooks/use-url-state"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { ClientContactsTab } from "@/features/client-portal"
import { useClient, clientKeys } from "../hooks/use-clients"
import { ClientFormDialog } from "./client-form-dialog"
import { ClientProjectsTab } from "./client-projects-tab"
import { ClientActivityTab } from "./client-activity-tab"

const TABS = ["overview", "projects", "contacts", "activity"] as const
type Tab = (typeof TABS)[number]

/**
 * One client: who they are, what we are building for them, who at their end
 * can sign in, and whether anyone does. The company's own details live on the
 * Overview tab; everything that hangs off the company has a tab of its own.
 */
export function ClientDetail({ clientRef }: { clientRef: string }) {
  const { can } = usePermissions()
  const canWrite = can(PERMISSIONS.CLIENT_WRITE)
  const router = useRouter()
  const tenantPath = useTenantPath()
  const qc = useQueryClient()

  const [tabParam, setTab] = useUrlState("tab", "overview")
  const tab: Tab = (TABS as readonly string[]).includes(tabParam) ? (tabParam as Tab) : "overview"
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: client, isLoading, isError } = useClient(clientRef)
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: clientKeys.detail(clientRef) })
    qc.invalidateQueries({ queryKey: clientKeys.all })
  }

  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/clients/${clientRef}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Client deleted")
      qc.invalidateQueries({ queryKey: clientKeys.all })
      router.push(tenantPath("/projects/clients"))
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeaderSkeleton withActions />
        <StatCardsSkeleton count={4} />
        <div className="border-border bg-card rounded-sm border">
          <TableSkeleton rows={5} cols={5} />
        </div>
      </div>
    )
  }

  if (!client || isError) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground text-sm">Client not found.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/projects/clients">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to clients
          </Link>
        </Button>
      </div>
    )
  }

  // Delete only when nothing hangs off the client; otherwise the honest way to
  // retire it is status INACTIVE, which the edit form offers. The server
  // refuses either way - this just keeps the button off the screen.
  const canDelete = canWrite && client.stats.projects === 0 && client.stats.contacts === 0
  const website = client.website
    ? client.website.startsWith("http")
      ? client.website
      : `https://${client.website}`
    : null

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/projects/clients"
        backLabel="Back to clients"
        leading={
          <span className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border">
            <Building2 className="text-muted-foreground h-5 w-5" />
          </span>
        }
        title={client.name}
        titleSuffix={
          <span className="bg-muted/50 text-muted-foreground shrink-0 rounded-sm border px-2 py-0.5 font-mono text-xs">
            {client.code}
          </span>
        }
        description={client.industry ?? undefined}
        actions={
          <>
            <StatusBadge
              status={client.status}
              colorMap={CLIENT_STATUS_COLORS}
              labelMap={CLIENT_STATUS_LABELS}
              size="button"
            />
            {canWrite && (
              <Button variant="outline" size="sm" className="h-8" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive h-8"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Delete
              </Button>
            )}
          </>
        }
      />

      <StatStrip
        items={[
          { label: "Projects", value: client.stats.projects, icon: FolderKanban },
          {
            label: "Active projects",
            value: client.stats.activeProjects,
            icon: Activity,
            tone: client.stats.activeProjects > 0 ? "success" : "default",
          },
          { label: "Contacts", value: client.stats.contacts, icon: Users },
          {
            label: "Last portal login",
            value: client.stats.lastLoginAt
              ? formatRelativeTime(client.stats.lastLoginAt)
              : "Never",
            isText: true,
          },
        ]}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-1.5">
            <FolderKanban className="h-3.5 w-3.5" />
            Projects
            <Count n={client.stats.projects} />
          </TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Contacts
            <Count n={client.stats.contacts} />
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow
                label="Account manager"
                value={
                  client.owner ? (
                    <span className="flex items-center gap-1.5">
                      <AvatarDisplay
                        src={client.owner.profilePhoto}
                        firstName={client.owner.firstName}
                        lastName={client.owner.lastName}
                        size="xs"
                      />
                      {client.owner.firstName} {client.owner.lastName}
                    </span>
                  ) : undefined
                }
              />
              <InfoRow label="Industry" value={client.industry ?? undefined} />
              <InfoRow
                label="Website"
                icon={Globe}
                value={
                  website ? (
                    <a href={website} target="_blank" rel="noreferrer" className="hover:underline">
                      {client.website}
                    </a>
                  ) : undefined
                }
              />
              <InfoRow
                label="Email"
                icon={Mail}
                value={
                  client.email ? (
                    <a href={`mailto:${client.email}`} className="hover:underline">
                      {client.email}
                    </a>
                  ) : undefined
                }
              />
              <InfoRow label="Phone" icon={Phone} value={client.phone ?? undefined} />
              <InfoRow label="Tax / GST" mono value={client.taxId ?? undefined} />
              <InfoRow
                label="Address"
                icon={MapPin}
                value={client.address ?? undefined}
                className="sm:col-span-2"
              />
              <InfoRow
                label="Client since"
                value={`${formatDate(client.createdAt)}${
                  client.createdBy
                    ? ` · added by ${client.createdBy.firstName} ${client.createdBy.lastName}`
                    : ""
                }`}
              />
            </CardContent>
          </Card>

          {client.notes && (
            <Card>
              <CardContent className="p-5">
                <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs tracking-wide uppercase">
                  <FileText className="h-3.5 w-3.5" />
                  Notes
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-line">{client.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          <ClientProjectsTab client={client} />
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <ClientContactsTab
            clientRef={clientRef}
            clientName={client.name}
            projects={client.projects}
            contacts={client.contacts}
            canWrite={canWrite}
            onChanged={invalidate}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <ClientActivityTab clientRef={clientRef} />
        </TabsContent>
      </Tabs>

      <ClientFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        mode="edit"
        clientId={client.id}
        ownerLabel={client.owner ? `${client.owner.firstName} ${client.owner.lastName}` : undefined}
        initial={{
          name: client.name,
          status: client.status,
          industry: client.industry ?? "",
          website: client.website ?? "",
          email: client.email ?? "",
          phone: client.phone ?? "",
          address: client.address ?? "",
          taxId: client.taxId ?? "",
          notes: client.notes ?? "",
          ownerId: client.ownerId ?? "",
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this client?"
        description={`"${client.name}" has no projects or contacts, so nothing else is affected. This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  )
}

/** A small count beside a tab label. Hidden at zero - "Projects 0" reads as a warning. */
function Count({ n }: { n: number }) {
  if (n === 0) return null
  return (
    <span className="bg-muted text-muted-foreground ml-1 rounded-sm px-1.5 py-0.5 text-[10px] tabular-nums">
      {n}
    </span>
  )
}
