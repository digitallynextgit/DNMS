"use client"

import { useCallback, useMemo, useState } from "react"

/**
 * Multi-row selection state for tables: an immutable `Set` of ids plus toggle
 * helpers and the indeterminate/all-selected flags for a "select all on page"
 * master checkbox. Pass the CURRENT page's ids so select-all operates per page.
 */
export function useRowSelection<T extends string = string>(pageIds: T[]) {
  const [selected, setSelected] = useState<Set<T>>(new Set())

  const isSelected = useCallback((id: T) => selected.has(id), [selected])

  const toggle = useCallback((id: T) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const someSelected = pageIds.some((id) => selected.has(id)) && !allSelected

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev)
      const all = pageIds.length > 0 && pageIds.every((id) => next.has(id))
      if (all) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })
  }, [pageIds])

  const clear = useCallback(() => setSelected(new Set()), [])

  const selectedIds = useMemo(() => Array.from(selected), [selected])

  return {
    selected,
    selectedIds,
    count: selected.size,
    isSelected,
    toggle,
    toggleAll,
    clear,
    allSelected,
    someSelected,
    setSelected,
  }
}
