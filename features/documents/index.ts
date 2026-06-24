// Public API for the "documents" feature (CLAUDE.md §1, rule #2).
// Cross-feature & app imports use THIS barrel; internals stay private.
// NOTE: server-only modules (server/*.service-style, emails, IO clients) are
// intentionally NOT re-exported here — API routes import those directly.
export * from "./components/document-card"
export * from "./components/document-list"
export * from "./components/document-upload-dialog"
export * from "./hooks/use-documents"
export * from "./schemas/document.schema"
export * from "./server/documents.actions"
export * from "./server/employee-documents.actions"
