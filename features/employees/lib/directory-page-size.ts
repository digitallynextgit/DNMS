// Rows per page the Employee and Intern directories offer. Shared by the pages (which prefetch the
// first page) and the client, so both ask the server for the same page.

export const DIRECTORY_PAGE_SIZES = [10, 20, 50, 100] as const
export const DEFAULT_DIRECTORY_PAGE_SIZE = 10

export function directoryPageSize(raw: string | null | undefined): number {
  const n = Number(raw)
  return (DIRECTORY_PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_DIRECTORY_PAGE_SIZE
}
