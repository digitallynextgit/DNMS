"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useEvalTemplates, useSaveEvalTemplate } from "@/hooks/use-evaluations"
import { validateCriteria, type EvalCriterion, type EvalSection } from "@/lib/evaluation"

export default function EvaluationTemplatePage() {
  const { data, isLoading } = useEvalTemplates()
  const save = useSaveEvalTemplate()

  const active = data?.data.find((t) => t.isActive) ?? data?.data[0]
  const [name, setName] = useState("")
  const [aLabel, setALabel] = useState("")
  const [bLabel, setBLabel] = useState("")
  const [criteria, setCriteria] = useState<EvalCriterion[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!data || loaded) return
    if (active) {
      setName(active.name)
      setALabel(active.sectionALabel)
      setBLabel(active.sectionBLabel)
      setCriteria(active.criteria)
    } else {
      setName("Standard Scorecard")
      setALabel(data.defaults.sectionALabel)
      setBLabel(data.defaults.sectionBLabel)
      setCriteria(data.defaults.criteria)
    }
    setLoaded(true)
  }, [data, active, loaded])

  const totalWeight =
    Math.round(criteria.reduce((s, c) => s + (Number(c.weight) || 0), 0) * 10) / 10
  const v = validateCriteria(criteria)

  function update(id: string, patch: Partial<EvalCriterion>) {
    setCriteria((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }
  function addRow(section: EvalSection) {
    setCriteria((cs) => [...cs, { id: crypto.randomUUID(), section, label: "", weight: 0 }])
  }
  function removeRow(id: string) {
    setCriteria((cs) => cs.filter((c) => c.id !== id))
  }

  function handleSave() {
    save.mutate({
      id: active?.id,
      name: name.trim(),
      criteria,
      sectionALabel: aLabel.trim(),
      sectionBLabel: bLabel.trim(),
    })
  }

  if (isLoading) return <Skeleton className="h-96 rounded" />

  const SectionEditor = ({
    section,
    label,
    onLabel,
  }: {
    section: EvalSection
    label: string
    onLabel: (v: string) => void
  }) => {
    const items = criteria.filter((c) => c.section === section)
    const secWeight = Math.round(items.reduce((s, c) => s + (Number(c.weight) || 0), 0) * 10) / 10
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between gap-3 text-sm">
            <Input
              value={label}
              onChange={(e) => onLabel(e.target.value)}
              className="h-8 max-w-md font-semibold"
            />
            <span className="text-muted-foreground shrink-0 text-xs font-normal">{secWeight}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <Input
                value={c.label}
                onChange={(e) => update(c.id, { label: e.target.value })}
                placeholder="Criterion name"
                className="h-8"
              />
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={c.weight}
                onChange={(e) => update(c.id, { weight: Number(e.target.value) })}
                className="h-8 w-20 text-right"
              />
              <span className="text-muted-foreground text-xs">%</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 h-8 w-8 shrink-0 p-0"
                onClick={() => removeRow(c.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => addRow(section)}>
            <Plus className="h-3.5 w-3.5" /> Add criterion
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
        <Link href="/performance/evaluations">
          <ArrowLeft className="h-4 w-4" /> Back to Evaluations
        </Link>
      </Button>

      <PageHeader
        title="Evaluation Template"
        description="Define the KPIs / parameters and weights used in every evaluation. Weights must total 100%."
      />

      <div className="space-y-1.5">
        <Label>Template name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-md" />
      </div>

      <SectionEditor section="A" label={aLabel} onLabel={setALabel} />
      <SectionEditor section="B" label={bLabel} onLabel={setBLabel} />

      <div className="bg-card sticky bottom-0 flex items-center justify-between gap-4 rounded border p-4">
        <span
          className={cn(
            "text-sm font-medium",
            v.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
          )}
        >
          Total weight: {totalWeight}%{v.ok ? "" : ` - ${v.reason}`}
        </span>
        <Button onClick={handleSave} disabled={!v.ok || !name.trim() || save.isPending}>
          {save.isPending ? "Saving…" : "Save Template"}
        </Button>
      </div>
    </div>
  )
}
