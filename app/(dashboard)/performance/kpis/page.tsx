"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"

interface Kpi {
  id: string
  name: string
  description: string | null
  weight: number
  isActive: boolean
}

async function fetchKpis(): Promise<{ data: Kpi[] }> {
  const res = await fetch("/api/performance/kpis?includeInactive=true")
  if (!res.ok) throw new Error("Failed to load KPIs")
  return res.json()
}

export default function KpisPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ["kpis"], queryFn: fetchKpis })
  const kpis = data?.data ?? []

  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [weight, setWeight] = useState("1")

  const invalidate = () => qc.invalidateQueries({ queryKey: ["kpis"] })

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/performance/kpis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, weight: Number(weight) }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error?.message || "Failed")
      return res.json()
    },
    onSuccess: () => {
      invalidate()
      toast.success("KPI added")
      setOpen(false)
      setName("")
      setDescription("")
      setWeight("1")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/performance/kpis/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
    },
    onSuccess: () => {
      invalidate()
      toast.success("KPI removed")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="KPIs"
        description="Define the key performance indicators used in reviews"
        actions={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Add KPI
          </Button>
        }
      />

      <div className="bg-card rounded border">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded" />
            ))}
          </div>
        ) : kpis.length === 0 ? (
          <div className="text-muted-foreground py-12 text-center text-sm">
            No KPIs defined yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">KPI</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Weight</th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {kpis.map((k) => (
                <tr key={k.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{k.name}</p>
                    {k.description && (
                      <p className="text-muted-foreground text-xs">{k.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">
                      {k.weight}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 h-7 w-7"
                      disabled={delMut.isPending}
                      onClick={() => {
                        if (confirm(`Delete KPI "${k.name}"?`)) delMut.mutate(k.id)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add KPI</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="kpi-name">Name</Label>
              <Input
                id="kpi-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Quality of Work"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kpi-desc">Description</Label>
              <Textarea
                id="kpi-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kpi-weight">Weight</Label>
              <Input
                id="kpi-weight"
                type="number"
                min={1}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!name.trim() || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
