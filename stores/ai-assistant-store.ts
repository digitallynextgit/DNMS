import { create } from "zustand"

/**
 * Open state for the AI assistant, shared because the two halves live apart:
 * the launcher sits in the Topbar and the panel is rendered by the dashboard
 * layout. Not persisted - the assistant should start closed on every visit
 * rather than reopening over whatever page you land on.
 */
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
