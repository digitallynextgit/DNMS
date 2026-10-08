"use client"

import { useState } from "react"
import {
  Download,
  Link2,
  Link2Off,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Trash2,
  Upload,
  UserX,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { SearchInput } from "@/components/shared/search-input"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { DateField } from "@/components/shared/date-field"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { apiFetch } from "@/lib/api-fetch"
import { PERMISSIONS } from "@/lib/constants"
import { exportToCsv } from "@/lib/export-csv"
import { exportToXlsx } from "@/lib/export-xlsx"
import { formatDate } from "@/lib/utils"
import {
  useStockItems,
  useStockMatrix,
  useLinkableEmployees,
  useCreateStockItem,
  useUpdateStockItem,
  useCreateStockIssue,
  useUpdateRegisterRow,
  useBulkStockIssues,
  type LinkableEmployee,
  type PaginationMeta,
  type StockMatrixRow,
  type StockItemRow,
} from "../hooks/use-stock"
import { QtyInput } from "./qty-input"
import { StockImportDialog } from "./stock-import-dialog"

// A holder is a NAME first and an employee link second; non-employees stay as plain names.

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
  const [restockItem, setRestockItem] = useState<StockItemRow | null>(null)
  const [exporting, setExporting] = useState(false)
  const [editRow, setEditRow] = useState<StockMatrixRow | null>(null)
  const [linkTarget, setLinkTarget] = useState<StockMatrixRow | null>(null)
  const [bulkLinkOpen, setBulkLinkOpen] = useState(false)
  const [toDelete, setToDelete] = useState<StockMatrixRow | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const items = useStockItems()
  const register = useStockMatrix({ q, itemId: itemFilter, unlinkedOnly, page })
  const bulk = useBulkStockIssues()

  const rows = register.data?.rows ?? []
  const meta = register.data?.meta
  const hasFilters = Boolean(q) || itemFilter !== "all" || unlinkedOnly

  // Selection is per matrix ROW KEY; ids resolve only for rows on screen, so filter/page changes clear it.
  const selection = useRowSelection(rows.map((r) => r.key))

  function resetPaging(nextPage = 1) {
    setPage(nextPage)
    selection.clear()
  }

  function selectedIssueIds(): string[] {
    const keys = new Set(selection.selectedIds)
    return rows.filter((r) => keys.has(r.key)).flatMap((r) => r.issueIds)
  }

  const doneWords = { delete: "Deleted", link: "Linked", unlink: "Unlinked" } as const

  function runBulk(ids: string[], action: "link" | "unlink" | "delete", employeeId?: string) {
    bulk.mutate(
      { ids, action, employeeId },
      {
        onSuccess: ({ affected }) => {
          toast.success(`${doneWords[action]} ${affected} entr${affected === 1 ? "y" : "ies"}`)
          selection.clear()
          setBulkLinkOpen(false)
          setBulkDeleteOpen(false)
          setLinkTarget(null)
          setToDelete(null)
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  // Export fetches EVERY page (current filters applied).

  async function fetchAllMatrixRows(): Promise<StockMatrixRow[]> {
    const all: StockMatrixRow[] = []
    for (let pageNo = 1; ; pageNo++) {
      const params = new URLSearchParams()
      if (q) params.set("q", q)
      if (itemFilter !== "all") params.set("itemId", itemFilter)
      if (unlinkedOnly) params.set("unlinked", "1")
      params.set("page", String(pageNo))
      params.set("limit", "100")
      const { data } = await apiFetch<{
        data: { rows: StockMatrixRow[]; meta: PaginationMeta }
      }>(`/api/stock/register?${params.toString()}`)
      all.push(...data.rows)
      if (pageNo >= data.meta.totalPages) return all
    }
  }

  async function handleExport(kind: "register" | "items", format: "xlsx" | "csv") {
    setExporting(true)
    try {
      const stamp = new Date().toISOString().slice(0, 10)
      const itemList = items.data ?? []
      let header: string[]
      let table: (string | number | null)[][]
      if (kind === "register") {
        const allRows = await fetchAllMatrixRows()
        header = [
          "Given to",
          "Employee",
          "Employee No",
          "Link",
          "Issued on",
          ...itemList.map((i) => i.name),
        ]
        table = allRows.map((r) => [
          r.holderName,
          r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : "",
          r.employee?.employeeNo ?? "",
          r.employee ? (r.employee.isActive ? "Linked" : "Linked (deactivated)") : "Not linked",
          r.issuedOn ? formatDate(r.issuedOn) : "",
          ...itemList.map((i) => r.cells[i.id]?.quantity ?? null),
        ])
      } else {
        header = ["Item", "Price per piece", "Purchased", "Issued", "Left"]
        table = itemList.map((i) => [
          i.name,
          i.pricePerPiece,
          i.purchasedQty,
          i.issuedQty,
          i.leftQty,
        ])
      }
      const base = kind === "register" ? `stock-register-${stamp}` : `stock-items-${stamp}`
      if (format === "xlsx") {
        await exportToXlsx(
          header,
          table,
          `${base}.xlsx`,
          kind === "register" ? "Register" : "Items",
        )
      } else {
        exportToCsv(header, table, `${base}.csv`)
      }
      toast.success(`Exported ${table.length} row(s)`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed")
    } finally {
      setExporting(false)
    }
  }

  // Columns mirror the uploaded sheet: Holder | On date | one column per item.
  const columns: DataTableColumn<StockMatrixRow>[] = [
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
    {
      header: "Issued on",
      cell: (r) => (
        <span className="text-muted-foreground text-sm whitespace-nowrap">
          {r.issuedOn ? formatDate(r.issuedOn) : "—"}
        </span>
      ),
    },
    ...(items.data ?? []).map(
      (item): DataTableColumn<StockMatrixRow> => ({
        header: item.name,
        cell: (r) => {
          const qty = r.cells[item.id]?.quantity ?? 0
          return qty > 0 ? (
            <span className="text-sm font-medium tabular-nums">{qty}</span>
          ) : (
            <span className="text-muted-foreground/50 text-sm">—</span>
          )
        },
      }),
    ),
    ...(canWrite
      ? [
          {
            header: "",
            cell: (r: StockMatrixRow) => (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Edit this row"
                  onClick={() => setEditRow(r)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {r.employee ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Unlink from this employee"
                    disabled={bulk.isPending}
                    onClick={() => runBulk(r.issueIds, "unlink")}
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
                  title="Delete row"
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
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={exporting} loading={exporting}>
                  <Download className="mr-1.5 h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-muted-foreground text-xs">
                  Register (current filters)
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleExport("register", "xlsx")}>
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("register", "csv")}>
                  CSV (.csv)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-muted-foreground text-xs">
                  Items summary
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleExport("items", "xlsx")}>
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("items", "csv")}>
                  CSV (.csv)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canWrite && (
              <>
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
              </>
            )}
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(items.data ?? []).map((item) => (
          <div key={item.id} className="border-border bg-card rounded-sm border p-4">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-sm font-semibold">{item.name}</span>
              {canWrite ? (
                <span className="flex shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    title={`Restock ${item.name} (add pieces)`}
                    onClick={() => setRestockItem(item)}
                  >
                    <PackagePlus className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title={`Edit ${item.name}`}
                    onClick={() => setItemDialog({ mode: "edit", item })}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </span>
              ) : (
                <Package className="text-muted-foreground h-4 w-4 shrink-0" />
              )}
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {item.leftQty}
              <span className="text-muted-foreground text-xs font-normal"> left</span>
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {item.issuedQty} issued of {item.purchasedQty}
              {item.pricePerPiece !== null && ` · ₹${item.pricePerPiece}/pc`}
            </p>
          </div>
        ))}
        {items.data?.length === 0 && !items.isLoading && (
          <div className="text-muted-foreground col-span-full text-sm">
            No items yet - add one or import the Excel workbook.
          </div>
        )}
      </section>

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
            <Button
              variant="outline"
              onClick={() => runBulk(selectedIssueIds(), "unlink")}
              disabled={bulk.isPending}
            >
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

      {!register.isLoading && rows.length === 0 ? (
        <EmptyState
          icon={Package}
          title={
            register.isError
              ? "Couldn't load the register. Try reloading."
              : hasFilters
                ? "Nothing matches these filters."
                : "No stock issued yet."
          }
          description={
            !register.isError && !hasFilters
              ? "Import the Excel workbook or record an issue to get started."
              : undefined
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.key}
            loading={register.isLoading}
            minWidth="min-w-[860px]"
            showSerial
            serialOffset={meta ? (meta.page - 1) * meta.limit : 0}
            selection={canWrite ? selection : undefined}
          />
          {meta && (
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              onPageChange={(next) => resetPaging(next)}
              itemLabel="row"
            />
          )}
        </>
      )}

      <StockImportDialog open={importOpen} onOpenChange={setImportOpen} />
      {itemDialog && <ItemDialog state={itemDialog} onClose={() => setItemDialog(null)} />}
      {restockItem && <RestockDialog item={restockItem} onClose={() => setRestockItem(null)} />}
      {issueOpen && <IssueDialog items={items.data ?? []} onClose={() => setIssueOpen(false)} />}
      {editRow && (
        <EditRowDialog row={editRow} items={items.data ?? []} onClose={() => setEditRow(null)} />
      )}
      {linkTarget && (
        <EmployeePickerDialog
          title={`Link "${linkTarget.holderName}" to an employee`}
          description="Deactivated employees are included - the holder may have left since."
          initialSearch={linkTarget.holderName}
          busy={bulk.isPending}
          onClose={() => setLinkTarget(null)}
          onPick={(employee) => runBulk(linkTarget.issueIds, "link", employee.id)}
        />
      )}
      {bulkLinkOpen && (
        <EmployeePickerDialog
          title={`Link ${selection.count} row${selection.count === 1 ? "" : "s"} to an employee`}
          description="Every selected row is linked to the one employee you pick (deactivated included)."
          initialSearch=""
          busy={bulk.isPending}
          onClose={() => setBulkLinkOpen(false)}
          onPick={(employee) => runBulk(selectedIssueIds(), "link", employee.id)}
        />
      )}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selection.count} register row${selection.count === 1 ? "" : "s"}?`}
        description="The selected rows are removed from the register. This cannot be undone."
        variant="destructive"
        confirmLabel="Delete selected"
        isLoading={bulk.isPending}
        onConfirm={() => runBulk(selectedIssueIds(), "delete")}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this register row?"
        description={
          toDelete
            ? `Everything issued to ${toDelete.holderName}${
                toDelete.issuedOn ? ` on ${formatDate(toDelete.issuedOn)}` : ""
              } is removed. This cannot be undone.`
            : ""
        }
        variant="destructive"
        confirmLabel="Delete"
        isLoading={bulk.isPending}
        onConfirm={() => toDelete && runBulk(toDelete.issueIds, "delete")}
      />
    </div>
  )
}

function EditRowDialog({
  row,
  items,
  onClose,
}: {
  row: StockMatrixRow
  items: StockItemRow[]
  onClose: () => void
}) {
  const [holderName, setHolderName] = useState(row.holderName)
  const [issuedOn, setIssuedOn] = useState(row.issuedOn ? row.issuedOn.slice(0, 10) : "")
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, String(row.cells[i.id]?.quantity ?? 0)])),
  )
  const update = useUpdateRegisterRow()

  function submit() {
    if (!holderName.trim()) return toast.error("Holder is required")
    const cells: { itemId: string; issueIds: string[]; quantity: number }[] = []
    for (const item of items) {
      const raw = (quantities[item.id] ?? "0").trim()
      const qty = raw === "" ? 0 : Number(raw)
      if (!Number.isInteger(qty) || qty < 0)
        return toast.error(`${item.name}: quantity must be a whole number (0 clears it)`)
      cells.push({ itemId: item.id, issueIds: row.cells[item.id]?.issueIds ?? [], quantity: qty })
    }
    if (cells.every((c) => c.quantity === 0))
      return toast.error("Every quantity is 0 - use Delete to remove the whole row")
    update.mutate(
      {
        holderName: holderName.trim(),
        employeeId: row.employee?.id ?? null,
        issuedOn: issuedOn || null,
        cells,
      },
      {
        onSuccess: () => {
          toast.success("Row updated")
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
          <DialogTitle>Edit register row</DialogTitle>
          <DialogDescription>
            Change the holder, date, or per-item quantities - 0 removes that item from the row.
            {row.employee && ` Stays linked to ${row.employee.firstName} ${row.employee.lastName}.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-row-holder">Holder</Label>
              <Input
                id="edit-row-holder"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Issued on</Label>
              {/* modal: rendered inside a Dialog, so the popover must layer above it. */}
              <DateField value={issuedOn} onChange={setIssuedOn} modal />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((item) => (
              <div key={item.id} className="space-y-1.5">
                <Label htmlFor={`edit-row-${item.id}`}>{item.name}</Label>
                <QtyInput
                  id={`edit-row-${item.id}`}
                  value={quantities[item.id] ?? "0"}
                  onChange={(v) => setQuantities((prev) => ({ ...prev, [item.id]: v }))}
                />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={update.isPending} loading={update.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RestockDialog({ item, onClose }: { item: StockItemRow; onClose: () => void }) {
  const [qty, setQty] = useState("1")
  const [price, setPrice] = useState(item.pricePerPiece?.toString() ?? "")
  const update = useUpdateStockItem()

  function submit() {
    const qtyNum = Number(qty)
    if (!Number.isInteger(qtyNum) || qtyNum < 1) return toast.error("How many pieces were bought?")
    const priceNum = price.trim() === "" ? null : Number(price)
    if (priceNum !== null && (!Number.isFinite(priceNum) || priceNum < 0))
      return toast.error("Price must be a non-negative number")
    update.mutate(
      // Price only when given - an empty box means "unchanged", never "clear".
      { id: item.id, restockBy: qtyNum, ...(priceNum !== null ? { pricePerPiece: priceNum } : {}) },
      {
        onSuccess: () => {
          toast.success(
            `Added ${qtyNum} to ${item.name} (now ${item.purchasedQty + qtyNum} purchased)`,
          )
          onClose()
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Restock {item.name}</DialogTitle>
          <DialogDescription>
            Adds to the {item.purchasedQty} already purchased ({item.leftQty} currently left). To
            CORRECT a wrong total instead, use the pencil on the item card.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="restock-qty">Pieces bought</Label>
            <QtyInput id="restock-qty" value={qty} onChange={setQty} min={1} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="restock-price">Price per piece</Label>
            <Input
              id="restock-price"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="unchanged if empty"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={update.isPending} loading={update.isPending}>
            Add stock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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
              <QtyInput id="stock-item-purchased" value={purchased} onChange={setPurchased} />
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
              <QtyInput id="stock-issue-qty" value={quantity} onChange={setQuantity} min={1} />
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
            <Label>Issued on</Label>
            {/* modal: rendered inside a Dialog, so the popover must layer above it. */}
            <DateField value={issuedOn} onChange={setIssuedOn} modal />
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
