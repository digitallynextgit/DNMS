import { create } from "zustand"

/** Shared: the launcher (Topbar) and panel (layout) live apart. Not persisted - starts closed. */
interface AiAssistantStore {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useAiAssistantStore = create<AiAssistantStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
}))
