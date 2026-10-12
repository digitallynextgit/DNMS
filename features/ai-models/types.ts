// Admin -> AI Models: what the page reads. Keys never leave the server; only their last 4 characters.

export interface AiKeyView {
  id: string
  label: string | null
  last4: string
  isActive: boolean
  position: number
  lastUsedAt: string | null
  lastError: string | null
  lastErrorAt: string | null
  createdAt: string
}

export interface AiProviderView {
  id: string
  kind: string
  label: string
  baseUrl: string | null
  fastModels: string
  smartModels: string
  isDefault: boolean
  isActive: boolean
  position: number
  keys: AiKeyView[]
}

export interface AiKeyTest {
  ok: boolean
  model: string | null
  ms: number
  error: string | null
}
