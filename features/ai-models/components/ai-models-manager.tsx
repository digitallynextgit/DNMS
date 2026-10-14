"use client"

import { useState } from "react"
import { format } from "date-fns"
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
  XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { cn } from "@/lib/utils"
import { AI_KIND_IDS, AI_KINDS, isAiKind, type AiKind } from "@/lib/ai-providers"
import {
  useAddAiKey,
  useAiProviders,
  useCreateAiProvider,
  useDeleteAiKey,
  useDeleteAiProvider,
  useTestAiKey,
  useUpdateAiKey,
  useUpdateAiProvider,
} from "../hooks/use-ai-models"
import type { AiKeyTest, AiKeyView, AiProviderView } from "../types"

const when = (iso: string) => format(new Date(iso), "d MMM, h:mm a")
const kindLabel = (kind: string) => (isAiKind(kind) ? AI_KINDS[kind].label : kind)

/** Admin -> AI Models: the AI services DNMS uses, their keys, and the order they're tried in. */
export function AiModelsManager() {
  const { data: providers, isPending } = useAiProviders()
  const [dialog, setDialog] = useState<AiProviderView | "new" | null>(null)

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Models"
        description="The AI services DNMS uses for writing help, summaries, reports and the assistant."
        actions={
          <Button className="gap-2" onClick={() => setDialog("new")}>
            <Plus className="h-4 w-4" /> Add provider
          </Button>
        }
      />

      <p className="text-muted-foreground bg-muted/40 rounded-sm border px-4 py-3 text-xs leading-relaxed">
        Every AI task tries the <span className="text-foreground font-medium">default</span>{" "}
        provider&apos;s keys first, in order. If a key is wrong, busy or out of quota, DNMS moves to
        the next key, then to the next provider below. Add more keys or providers to keep AI working
        when one runs out.
      </p>

      {isPending ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-48 rounded-sm" />
          ))}
        </div>
      ) : !providers?.length ? (
        <EmptyState
          variant="card"
          icon={Sparkles}
          title="No AI provider yet"
          description="Add Gemini, Claude or another service with at least one API key. Until then, AI buttons in DNMS say AI isn't set up."
          action={{ label: "Add provider", onClick: () => setDialog("new") }}
        />
      ) : (
        <ol className="space-y-4">
          {providers.map((p, i) => (
            <ProviderCard
              key={p.id}
              provider={p}
              index={i}
              canUp={!p.isDefault && i > 0 && !providers[i - 1]!.isDefault}
              canDown={!p.isDefault && i < providers.length - 1}
              onEdit={() => setDialog(p)}
            />
          ))}
        </ol>
      )}

      {dialog && (
        <ProviderDialog
          key={dialog === "new" ? "new" : dialog.id}
          provider={dialog === "new" ? null : dialog}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

function ProviderCard({
  provider: p,
  index,
  canUp,
  canDown,
  onEdit,
}: {
  provider: AiProviderView
  index: number
  canUp: boolean
  canDown: boolean
  onEdit: () => void
}) {
  const update = useUpdateAiProvider()
  const remove = useDeleteAiProvider()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [addingKey, setAddingKey] = useState(false)
  const info = isAiKind(p.kind) ? AI_KINDS[p.kind] : null

  return (
    <li
      className={cn(
        "bg-card space-y-4 rounded-sm border p-4 sm:p-5",
        p.isDefault && "border-primary/50",
        !p.isActive && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span
          className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-sm font-semibold tabular-nums"
          title={`Tried ${index === 0 ? "first" : `${index + 1}${index === 1 ? "nd" : index === 2 ? "rd" : "th"}`}`}
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold">{p.label}</p>
            <span className="text-muted-foreground text-xs">{kindLabel(p.kind)}</span>
            {p.isDefault && <Badge className="text-[10px]">Default</Badge>}
            {!p.isActive && (
              <Badge variant="secondary" className="text-[10px]">
                Off
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            Quick tasks: <span className="text-foreground font-mono">{p.fastModels}</span>
            <span className="mx-1.5">·</span>
            Bigger tasks: <span className="text-foreground font-mono">{p.smartModels}</span>
          </p>
          {p.baseUrl && (
            <p className="text-muted-foreground truncate font-mono text-[11px]">{p.baseUrl}</p>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!p.isDefault && (
            <Button
              variant="outline"
              className="h-8 gap-1.5 px-3 text-xs"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: p.id, isDefault: true })}
            >
              <Star className="h-3.5 w-3.5" /> Make default
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={`Move ${p.label} up`}
            title="Try earlier"
            disabled={!canUp || update.isPending}
            onClick={() => update.mutate({ id: p.id, move: "up" })}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={`Move ${p.label} down`}
            title="Try later"
            disabled={!canDown || update.isPending}
            onClick={() => update.mutate({ id: p.id, move: "down" })}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Switch
            checked={p.isActive}
            disabled={p.isDefault || update.isPending}
            onCheckedChange={(on) => update.mutate({ id: p.id, isActive: on })}
            aria-label={p.isActive ? `Switch ${p.label} off` : `Switch ${p.label} on`}
            title={p.isDefault ? "The default is always on" : undefined}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="gap-2" onSelect={onEdit}>
                <Pencil className="h-3.5 w-3.5" /> Edit name and models
              </DropdownMenuItem>
              {info?.keysUrl && (
                <DropdownMenuItem asChild>
                  <a href={info.keysUrl} target="_blank" rel="noreferrer" className="gap-2">
                    <ExternalLink className="h-3.5 w-3.5" /> Get a {info.label} key
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive gap-2"
                onSelect={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove provider
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Keys · {p.keys.length}
          </p>
          <Button
            variant="ghost"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => setAddingKey(true)}
          >
            <Plus className="h-3.5 w-3.5" /> Add key
          </Button>
        </div>
        {p.keys.length === 0 ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            No keys: this provider is skipped until you add one.
          </p>
        ) : (
          <ul className="divide-y rounded-sm border">
            {p.keys.map((k, i) => (
              <KeyRow
                key={k.id}
                providerId={p.id}
                apiKey={k}
                index={i}
                canUp={i > 0}
                canDown={i < p.keys.length - 1}
              />
            ))}
          </ul>
        )}
      </div>

      {addingKey && <KeyDialog provider={p} onClose={() => setAddingKey(false)} />}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Remove ${p.label}?`}
        description={
          p.isDefault
            ? "Its keys are deleted too. The next provider in the list becomes the default."
            : "Its keys are deleted too. AI tasks stop trying it."
        }
        confirmLabel="Remove"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => remove.mutate(p.id, { onSuccess: () => setConfirmDelete(false) })}
      />
    </li>
  )
}

function KeyRow({
  providerId,
  apiKey: k,
  index,
  canUp,
  canDown,
}: {
  providerId: string
  apiKey: AiKeyView
  index: number
  canUp: boolean
  canDown: boolean
}) {
  const update = useUpdateAiKey()
  const remove = useDeleteAiKey()
  const test = useTestAiKey()
  const [result, setResult] = useState<AiKeyTest | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const ids = { providerId, keyId: k.id }

  // The newer of "last worked" and "last failed" is the key's state.
  const failedLast =
    !!k.lastErrorAt && (!k.lastUsedAt || new Date(k.lastErrorAt) > new Date(k.lastUsedAt))

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5",
        !k.isActive && "opacity-60",
      )}
    >
      <KeyRound className="text-muted-foreground h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{k.label || `Key ${index + 1}`}</span>
          <span className="text-muted-foreground font-mono text-xs">••••{k.last4}</span>
          {!k.isActive && (
            <Badge variant="secondary" className="text-[10px]">
              Off
            </Badge>
          )}
        </p>
        {result ? (
          <p
            className={cn(
              "flex items-start gap-1 text-[11px]",
              result.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
            )}
          >
            {result.ok ? (
              <CheckCircle2 className="mt-px h-3 w-3 shrink-0" />
            ) : (
              <XCircle className="mt-px h-3 w-3 shrink-0" />
            )}
            <span className="break-all">
              {result.ok
                ? `Works · ${result.model} answered in ${(result.ms / 1000).toFixed(1)}s`
                : result.error}
            </span>
          </p>
        ) : failedLast ? (
          <p className="text-destructive truncate text-[11px]" title={k.lastError ?? undefined}>
            Failed {when(k.lastErrorAt!)}: {k.lastError}
          </p>
        ) : k.lastUsedAt ? (
          <p className="text-muted-foreground text-[11px]">Last worked {when(k.lastUsedAt)}</p>
        ) : (
          <p className="text-muted-foreground text-[11px]">Not used yet</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          className="h-7 gap-1.5 px-2.5 text-xs"
          disabled={test.isPending}
          onClick={() =>
            test.mutate(ids, {
              onSuccess: setResult,
              onError: (e) =>
                setResult({
                  ok: false,
                  model: null,
                  ms: 0,
                  error: e instanceof Error ? e.message : "Test failed",
                }),
            })
          }
        >
          {test.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          Test
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Try this key earlier"
          disabled={!canUp || update.isPending}
          onClick={() => update.mutate({ ...ids, move: "up" })}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Try this key later"
          disabled={!canDown || update.isPending}
          onClick={() => update.mutate({ ...ids, move: "down" })}
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
        <Switch
          checked={k.isActive}
          disabled={update.isPending}
          onCheckedChange={(on) => update.mutate({ ...ids, isActive: on })}
          aria-label={k.isActive ? "Switch this key off" : "Switch this key on"}
        />
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive h-7 w-7"
          aria-label="Remove key"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Remove key ••••${k.last4}?`}
        description="DNMS stops using it straight away. The key itself still works at the provider until you delete it there."
        confirmLabel="Remove key"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => remove.mutate(ids, { onSuccess: () => setConfirmDelete(false) })}
      />
    </li>
  )
}

function ProviderDialog({
  provider,
  onClose,
}: {
  provider: AiProviderView | null
  onClose: () => void
}) {
  const editing = !!provider
  const create = useCreateAiProvider()
  const update = useUpdateAiProvider()
  const startKind: AiKind = provider && isAiKind(provider.kind) ? provider.kind : "gemini"
  const [kind, setKind] = useState<AiKind>(startKind)
  const [label, setLabel] = useState(provider?.label ?? AI_KINDS[startKind].label)
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? "")
  // Cloudflare keeps the whole URL; the form only asks for the Account ID inside it.
  const [accountId, setAccountId] = useState(
    /\/accounts\/([0-9a-f]{32})\//i.exec(provider?.baseUrl ?? "")?.[1] ?? "",
  )
  const [fastModels, setFastModels] = useState(
    provider?.fastModels ?? AI_KINDS[startKind].models.fast,
  )
  const [smartModels, setSmartModels] = useState(
    provider?.smartModels ?? AI_KINDS[startKind].models.smart,
  )
  const [key, setKey] = useState("")
  const info = AI_KINDS[kind]

  // A new type brings its own name and suggested models.
  function pickKind(next: AiKind) {
    setKind(next)
    setLabel(AI_KINDS[next].label)
    setFastModels(AI_KINDS[next].models.fast)
    setSmartModels(AI_KINDS[next].models.smart)
  }

  const pending = create.isPending || update.isPending
  const valid =
    label.trim().length >= 2 &&
    fastModels.trim() !== "" &&
    smartModels.trim() !== "" &&
    (kind !== "custom" || baseUrl.trim().startsWith("https://")) &&
    (kind !== "cloudflare" || /^[0-9a-f]{32}$/i.test(accountId.trim())) &&
    (editing || key.trim().length >= 8)

  function save() {
    const common = {
      label: label.trim(),
      fastModels: fastModels.trim(),
      smartModels: smartModels.trim(),
      ...(kind === "custom" ? { baseUrl: baseUrl.trim() } : {}),
      ...(kind === "cloudflare" ? { accountId: accountId.trim() } : {}),
    }
    if (provider) {
      update.mutate({ id: provider.id, ...common }, { onSuccess: onClose })
    } else {
      create.mutate({ kind, ...common, key: key.trim() }, { onSuccess: onClose })
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {editing ? `Edit ${provider.label}` : "Add an AI provider"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {editing
              ? "Rename it or change which models it uses."
              : "Pick the service, paste one API key, and DNMS can use it at once. Add more keys later."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!editing && (
            <div className="space-y-1.5">
              <Label className="text-xs">Service</Label>
              <Select value={kind} onValueChange={(v) => pickKind(v as AiKind)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_KIND_IDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {AI_KINDS[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label required className="text-xs">
              Name
            </Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {kind === "custom" && (
            <div className="space-y-1.5">
              <Label required className="text-xs">
                Chat-completions URL
              </Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1/chat/completions"
                className="h-9 font-mono text-xs"
              />
              <p className="text-muted-foreground text-[11px]">
                Any service that speaks the OpenAI chat-completions format.
              </p>
            </div>
          )}

          {kind === "cloudflare" && (
            <div className="space-y-1.5">
              <Label required className="text-xs">
                Account ID
              </Label>
              <Input
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="32 letters and numbers"
                className="h-9 font-mono text-xs"
              />
              <p className="text-muted-foreground text-[11px]">
                Cloudflare dashboard → AI → Workers AI → Use REST API shows it, next to Create a
                Workers AI API Token.
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label required className="text-xs">
                Model for quick tasks
              </Label>
              <Input
                value={fastModels}
                onChange={(e) => setFastModels(e.target.value)}
                className="h-9 font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label required className="text-xs">
                Model for bigger tasks
              </Label>
              <Input
                value={smartModels}
                onChange={(e) => setSmartModels(e.target.value)}
                className="h-9 font-mono text-xs"
              />
            </div>
          </div>
          <p className="text-muted-foreground -mt-2 text-[11px]">
            Quick tasks polish a sentence; bigger ones write reports and answer the assistant.
            Separate backup models with commas - they&apos;re tried in order.
          </p>

          {!editing && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label required className="text-xs">
                  API key
                </Label>
                {info.keysUrl && (
                  <a
                    href={info.keysUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary inline-flex items-center gap-1 text-[11px] hover:underline"
                  >
                    Get a key <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <Input
                type="password"
                autoComplete="off"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="h-9 font-mono text-xs"
              />
              <p className="text-muted-foreground text-[11px]">
                Stored encrypted and never shown again - only its last 4 characters.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || pending} loading={pending} onClick={save}>
            {editing ? "Save" : "Add provider"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function KeyDialog({ provider, onClose }: { provider: AiProviderView; onClose: () => void }) {
  const add = useAddAiKey()
  const [key, setKey] = useState("")
  const [label, setLabel] = useState("")
  const info = isAiKind(provider.kind) ? AI_KINDS[provider.kind] : null

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Add a {provider.label} key</DialogTitle>
          <DialogDescription className="text-xs">
            Tried after this provider&apos;s other keys, when they fail or run out. A key from a
            different account adds its own free allowance.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label required className="text-xs">
                API key
              </Label>
              {info?.keysUrl && (
                <a
                  href={info.keysUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex items-center gap-1 text-[11px] hover:underline"
                >
                  Get a key <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <Input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="h-9 font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Name (optional)</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Second Google account"
              className="h-9 text-sm"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={key.trim().length < 8 || add.isPending}
            loading={add.isPending}
            onClick={() =>
              add.mutate(
                { providerId: provider.id, key: key.trim(), label: label.trim() || null },
                { onSuccess: onClose },
              )
            }
          >
            Add key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
