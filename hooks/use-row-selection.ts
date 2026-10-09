"use client"

import { useCallback, useMemo, useState } from "react"

/** Table row selection. Pass the CURRENT page's ids so select-all works per page. */
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

  // DataTable passes the rows it is showing, which beats `pageIds` when it pages or sorts itself.
  const toggleAll = useCallback(
    (ids: T[] = pageIds) => {
      setSelected((prev) => {
        const next = new Set(prev)
        const all = ids.length > 0 && ids.every((id) => next.has(id))
        if (all) ids.forEach((id) => next.delete(id))
        else ids.forEach((id) => next.add(id))
        return next
      })
    },
    [pageIds],
  )

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
