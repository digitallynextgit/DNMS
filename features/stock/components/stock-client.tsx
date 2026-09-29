"use client"

import { useState } from "react"
import { Link2, Link2Off, Package, PackagePlus, Plus, Trash2, Upload, UserX } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { SearchInput } from "@/components/shared/search-input"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { Pagination } from "@/components/shared/pagination"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { useRowSelection } from "@/hooks/use-row-selection"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { PERMISSIONS } from "@/lib/constants"
import { formatDate } from "@/lib/utils"
import {
  useStockItems,
  useStockIssues,
  useLinkableEmployees,
  useCreateStockItem,
  useUpdateStockItem,
  useCreateStockIssue,
  useUpdateStockIssue,
  useDeleteStockIssue,
  useBulkStockIssues,
  type LinkableEmployee,
  type StockIssueRow,
  type StockItemRow,
} from "../hooks/use-stock"
import { StockImportDialog } from "./stock-import-dialog"

// =============================================================================
// The stock register: what HR bought (items) and who holds it (issues).
// A holder is a NAME first and an employee link second - rows imported for
// people who are not employees stay as plain names, with a "Link" action for
// when a matching employee (active or deactivated) exists.
// =============================================================================

export function StockClient() {
  const { can } = usePermissions()
  const canWrite = can(PERMISSIONS.EMPLOYEE_WRITE)

  const [q, setQ] = useState("")
  const [itemFilter, setItemFilter] = useState("all")
  const [unlinkedOnly, setUnlinkedOnly] = useState(false)
  const [page, setPage] = useState(1)

  const [importOpen, setImportOpen] = useState(false)
  const [itemDialog, setItemDialog] = useState<
    { mode: "create" } | { mode: "edit"; item: StockItemRow } | null
  >(null)
  const [issueOpen, setIssueOpen] = useState(false)
  const [linkTarget, setLinkTarget] = useState<StockIssueRow | null>(null)
  const [bulkLinkOpen, setBulkLinkOpen] = useState(false)
  const [toDelete, setToDelete] = useState<StockIssueRow | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const items = useStockItems()
  const issues = useStockIssues({ q, itemId: itemFilter, unlinkedOnly, page })
  const updateIssue = useUpdateStockIssue()
  const deleteIssue = useDeleteStockIssue()
  const bulk = useBulkStockIssues()

  const rows = issues.data?.rows ?? []
  const meta = issues.data?.meta
  const hasFilters = Boolean(q) || itemFilter !== "all" || unlinkedOnly

  // Selection spans pages: toggleAll works on the CURRENT page's ids, while
  // ids picked on other pages stay selected until acted on or cleared.
  const selection = useRowSelection(rows.map((r) => r.id))

  /** Any filter change restarts at page 1 with a clean selection. */
  function resetPaging() {
    setPage(1)
    selection.clear()
  }

  function runBulk(action: "link" | "unlink" | "delete", employeeId?: string) {
    bulk.mutate(
      { ids: selection.selectedIds, action, employeeId },
      {
        onSuccess: ({ affected }) => {
          toast.success(
            action === "delete"
              ? `Deleted ${affected} entr${affected === 1 ? "y" : "ies"}`
              : action === "link"
                ? `Linked ${affected} entr${affected === 1 ? "y" : "ies"}`
                : `Unlinked ${affected} entr${affected === 1 ? "y" : "ies"}`,
          )
          selection.clear()
          setBulkLinkOpen(false)
          setBulkDeleteOpen(false)
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  const columns: DataTableColumn<StockIssueRow>[] = [
    {
      header: "Holder",
      cell: (r) =>
        r.employee ? (
          <div className="flex min-w-0 items-center gap-2.5">
            <AvatarDisplay
              src={r.employee.profilePhoto}
              firstName={r.employee.firstName}
              lastName={r.employee.lastName}
              size="sm"
              className="shrink-0"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {r.employee.firstName} {r.employee.lastName}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {r.employee.employeeNo}
                {!r.employee.isActive && " · deactivated"}
                {/* The sheet's spelling, when it differs from the employee record. */}
                {r.holderName.toLowerCase() !==
                  `${r.employee.firstName} ${r.employee.lastName}`.toLowerCase() &&
                  ` · uploaded as "${r.holderName}"`}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
              <UserX className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.holderName}</p>
              <p className="text-muted-foreground text-xs">Not linked to an employee</p>
            </div>
          </div>
        ),
    },
    { header: "Item", cell: (r) => <span className="text-sm">{r.item.name}</span> },
    { header: "Qty", cell: (r) => <span className="text-sm tabular-nums">{r.quantity}</span> },
    {
      header: "Issued on",
      cell: (r) => (
        <span className="text-muted-foreground text-sm">
          {r.issuedOn ? formatDate(r.issuedOn) : "—"}
        </span>
      ),
    },
    {
      header: "Notes",
      cell: (r) => (
        <span className="text-muted-foreground line-clamp-1 max-w-[220px] text-xs">
          {r.notes ?? ""}
        </span>
      ),
    },
    ...(canWrite
      ? [
          {
            header: "",
            cell: (r: StockIssueRow) => (
              <div className="flex justify-end gap-1">
                {r.employee ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Unlink from this employee"
                    onClick={() =>
                      updateIssue.mutate(
                        { id: r.id, employeeId: null },
                        {
                          onSuccess: () => toast.success("Unlinked - the name is kept"),
                          onError: (e) => toast.error(e.message),
                        },
                      )
                    }
                  >
                    <Link2Off className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Link to an employee"
                    onClick={() => setLinkTarget(r)}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  title="Delete entry"
                  onClick={() => setToDelete(r)}
                >
                  <Trash2 className="text-destructive h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Register"
        description="What was bought, who holds it, and what is left."
        actions={
          canWrite ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="mr-1.5 h-4 w-4" />
                Import Excel
              </Button>
              <Button variant="outline" onClick={() => setItemDialog({ mode: "create" })}>
                <PackagePlus className="mr-1.5 h-4 w-4" />
                Add item
              </Button>
              <Button onClick={() => setIssueOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Issue stock
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* ── Items: purchased / issued / left ─────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(items.data ?? []).map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={!canWrite}
            onClick={() => canWrite && setItemDialog({ mode: "edit", item })}
            className="border-border bg-card enabled:hover:border-foreground/25 rounded-sm border p-4 text-left transition-colors"
            title={canWrite ? "Edit item" : undefined}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold">{item.name}</span>
              <Package className="text-muted-foreground h-4 w-4 shrink-0" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {item.leftQty}
              <span className="text-muted-foreground text-xs font-normal"> left</span>
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {item.issuedQty} issued of {item.purchasedQty}
              {item.pricePerPiece !== null && ` · ₹${item.pricePerPiece}/pc`}
            </p>
          </button>
        ))}
        {items.data?.length === 0 && !items.isLoading && (
          <div className="text-muted-foreground col-span-full text-sm">
            No items yet - add one or import the Excel workbook.
          </div>
        )}
      </section>

      {/* ── Register ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={q}
          onChange={(value) => {
            setQ(value)
            resetPaging()
          }}
          placeholder="Search holder, employee or item…"
          className="w-full sm:w-72"
        />
        <Select
          value={itemFilter}
          onValueChange={(value) => {
            setItemFilter(value)
            resetPaging()
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All items" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All items</SelectItem>
            {(items.data ?? []).map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={unlinkedOnly ? "default" : "outline"}
          onClick={() => {
            setUnlinkedOnly((v) => !v)
            resetPaging()
          }}
        >
          <UserX className="mr-1.5 h-3.5 w-3.5" />
          Unlinked only
        </Button>
      </div>

      {/* ── Selection bar: appears once anything is ticked ───────────────── */}
      {canWrite && selection.count > 0 && (
        <div className="border-border bg-muted/40 flex flex-wrap items-center gap-2 rounded-sm border px-3 py-2">
          <span className="text-sm font-medium">{selection.count} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setBulkLinkOpen(true)}
              disabled={bulk.isPending}
            >
              <Link2 className="mr-1.5 h-3.5 w-3.5" />
              Link to employee
            </Button>
            <Button variant="outline" onClick={() => runBulk("unlink")} disabled={bulk.isPending}>
              <Link2Off className="mr-1.5 h-3.5 w-3.5" />
              Unlink
            </Button>
            <Button
              variant="destructive"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={bulk.isPending}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
            <Button variant="ghost" onClick={selection.clear} disabled={bulk.isPending}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {!issues.isLoading && rows.length === 0 ? (
        <EmptyState
          icon={Package}
          title={
            issues.isError
              ? "Couldn't load the register. Try reloading."
              : hasFilters
                ? "Nothing matches these filters."
                : "No stock issued yet."
          }
          description={
            !issues.isError && !hasFilters
              ? "Import the Excel workbook or record an issue to get started."
              : undefined
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            loading={issues.isLoading}
            minWidth="min-w-[760px]"
            showSerial
            serialOffset={meta ? (meta.page - 1) * meta.limit : 0}
            selection={canWrite ? selection : undefined}
          />
          {meta && (
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              onPageChange={setPage}
              itemLabel="entry"
            />
          )}
        </>
      )}

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      <StockImportDialog open={importOpen} onOpenChange={setImportOpen} />
      {itemDialog && <ItemDialog state={itemDialog} onClose={() => setItemDialog(null)} />}
      {issueOpen && <IssueDialog items={items.data ?? []} onClose={() => setIssueOpen(false)} />}
      {linkTarget && (
        <EmployeePickerDialog
          title={`Link "${linkTarget.holderName}" to an employee`}
          description="Deactivated employees are included - the holder may have left since."
          initialSearch={linkTarget.holderName}
          busy={updateIssue.isPending}
          onClose={() => setLinkTarget(null)}
          onPick={(employee) =>
            updateIssue.mutate(
              { id: linkTarget.id, employeeId: employee.id },
              {
                onSuccess: () => {
                  toast.success(`Linked to ${employee.firstName} ${employee.lastName}`)
                  setLinkTarget(null)
                },
                onError: (err) => toast.error(err.message),
              },
            )
          }
        />
      )}
      {bulkLinkOpen && (
        <EmployeePickerDialog
          title={`Link ${selection.count} entr${selection.count === 1 ? "y" : "ies"} to an employee`}
          description="Every selected entry is linked to the one employee you pick (deactivated included)."
          initialSearch=""
          busy={bulk.isPending}
          onClose={() => setBulkLinkOpen(false)}
          onPick={(employee) => runBulk("link", employee.id)}
        />
      )}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selection.count} register entr${selection.count === 1 ? "y" : "ies"}?`}
        description="The selected rows are removed from the register. This cannot be undone."
        variant="destructive"
        confirmLabel="Delete selected"
        isLoading={bulk.isPending}
        onConfirm={() => runBulk("delete")}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this register entry?"
        description={
          toDelete
            ? `${toDelete.quantity} × ${toDelete.item.name} issued to ${toDelete.holderName}. This cannot be undone.`
            : ""
        }
        variant="destructive"
        confirmLabel="Delete"
        isLoading={deleteIssue.isPending}
        onConfirm={() => {
          if (!toDelete) return
          deleteIssue.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success("Entry deleted")
              setToDelete(null)
            },
            onError: (e) => toast.error(e.message),
          })
        }}
      />
    </div>
  )
}

// ─── Add / edit an item ───────────────────────────────────────────────────────

function ItemDialog({
  state,
  onClose,
}: {
  state: { mode: "create" } | { mode: "edit"; item: StockItemRow }
  onClose: () => void
}) {
  const editing = state.mode === "edit" ? state.item : null
  const [name, setName] = useState(editing?.name ?? "")
  const [price, setPrice] = useState(editing?.pricePerPiece?.toString() ?? "")
  const [purchased, setPurchased] = useState(editing?.purchasedQty.toString() ?? "0")
  const create = useCreateStockItem()
  const update = useUpdateStockItem()
  const pending = create.isPending || update.isPending

  function submit() {
    const priceNum = price.trim() === "" ? null : Number(price)
    const purchasedNum = Number(purchased)
    if (!name.trim()) return toast.error("Item name is required")
    if (priceNum !== null && (!Number.isFinite(priceNum) || priceNum < 0))
      return toast.error("Price must be a non-negative number")
    if (!Number.isInteger(purchasedNum) || purchasedNum < 0)
      return toast.error("Purchased quantity must be a whole number")

    const payload = { name: name.trim(), pricePerPiece: priceNum, purchasedQty: purchasedNum }
    const opts = {
      onSuccess: () => {
        toast.success(editing ? "Item updated" : "Item added")
        onClose()
      },
      onError: (e: Error) => toast.error(e.message),
    }
    if (editing) update.mutate({ id: editing.id, ...payload }, opts)
    else create.mutate(payload, opts)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.name}` : "Add stock item"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Adjust the name, price, or total purchased. 'Left' is computed from the register."
              : "An item HR buys and issues - name, price per piece, and how many were bought."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="stock-item-name">Name</Label>
            <Input
              id="stock-item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Diary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="stock-item-price">Price per piece</Label>
              <Input
                id="stock-item-price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stock-item-purchased">Purchased qty</Label>
              <Input
                id="stock-item-purchased"
                inputMode="numeric"
                value={purchased}
                onChange={(e) => setPurchased(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending} loading={pending}>
            {editing ? "Save" : "Add item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Record an issue ─────────────────────────────────────────────────────────

function IssueDialog({ items, onClose }: { items: StockItemRow[]; onClose: () => void }) {
  const [itemId, setItemId] = useState(items[0]?.id ?? "")
  const [holderName, setHolderName] = useState("")
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState("1")
  const [issuedOn, setIssuedOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [empSearch, setEmpSearch] = useState("")
  const employees = useLinkableEmployees(empSearch)
  const create = useCreateStockIssue()

  function submit() {
    const qty = Number(quantity)
    if (!itemId) return toast.error("Pick an item")
    if (!holderName.trim()) return toast.error("Who is this issued to?")
    if (!Number.isInteger(qty) || qty < 1) return toast.error("Quantity must be at least 1")
    create.mutate(
      {
        itemId,
        holderName: holderName.trim(),
        employeeId,
        quantity: qty,
        issuedOn: issuedOn || null,
      },
      {
        onSuccess: () => {
          toast.success("Issued")
          onClose()
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Issue stock</DialogTitle>
          <DialogDescription>
            Type any name - picking an employee below links the entry, but is optional.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Item</Label>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick an item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} ({i.leftQty} left)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stock-issue-qty">Quantity</Label>
              <Input
                id="stock-issue-qty"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stock-issue-holder">Issued to (any name)</Label>
            <Input
              id="stock-issue-holder"
              value={holderName}
              onChange={(e) => {
                setHolderName(e.target.value)
                setEmpSearch(e.target.value)
                setEmployeeId(null)
              }}
              placeholder="e.g. Deepak Goel"
            />
          </div>
          {holderName.trim() && !employeeId && (employees.data?.length ?? 0) > 0 && (
            <div className="border-border max-h-36 space-y-0.5 overflow-y-auto rounded-sm border p-1">
              {employees.data!.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className="hover:bg-muted flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
                  onClick={() => {
                    setEmployeeId(e.id)
                    setHolderName(`${e.firstName} ${e.lastName}`.trim())
                  }}
                >
                  <AvatarDisplay
                    src={e.profilePhoto}
                    firstName={e.firstName}
                    lastName={e.lastName}
                    size="chip"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {e.firstName} {e.lastName}
                  </span>
                  {!e.isActive && (
                    <Badge variant="outline" className="text-[10px]">
                      deactivated
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}
          {employeeId && (
            <p className="text-muted-foreground text-xs">
              Linked to an employee.{" "}
              <button type="button" className="underline" onClick={() => setEmployeeId(null)}>
                Keep as plain name instead
              </button>
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="stock-issue-date">Issued on</Label>
            <Input
              id="stock-issue-date"
              type="date"
              value={issuedOn}
              onChange={(e) => setIssuedOn(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={create.isPending} loading={create.isPending}>
            Issue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Pick an employee (single link + bulk link share this) ──────────────────

function EmployeePickerDialog({
  title,
  description,
  initialSearch,
  busy,
  onPick,
  onClose,
}: {
  title: string
  description: string
  initialSearch: string
  busy: boolean
  onPick: (employee: LinkableEmployee) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState(initialSearch)
  const employees = useLinkableEmployees(search)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <SearchInput value={search} onChange={setSearch} placeholder="Search employees…" />
        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          {(employees.data ?? []).map((e) => (
            <button
              key={e.id}
              type="button"
              disabled={busy}
              className="hover:bg-muted flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-left text-sm"
              onClick={() => onPick(e)}
            >
              <AvatarDisplay
                src={e.profilePhoto}
                firstName={e.firstName}
                lastName={e.lastName}
                size="sm"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {e.firstName} {e.lastName}
                </span>
                <span className="text-muted-foreground block text-xs">{e.employeeNo}</span>
              </span>
              {!e.isActive && (
                <Badge variant="outline" className="text-[10px]">
                  deactivated
                </Badge>
              )}
            </button>
          ))}
          {!employees.isLoading && (employees.data?.length ?? 0) === 0 && (
            <p className="text-muted-foreground px-2 py-4 text-sm">No employees match.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
