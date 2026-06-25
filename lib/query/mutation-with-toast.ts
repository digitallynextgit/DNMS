import type { QueryClient, QueryKey, UseMutationOptions } from "@tanstack/react-query"
import { toast } from "sonner"

interface MutationWithToastOptions<TData, TVars> {
  mutationFn: (vars: TVars) => Promise<TData>
  /** Query keys to invalidate on success. */
  invalidate?: QueryKey[]
  /** Success toast - a fixed string, or a fn of (data, vars) for dynamic text. Omit for no toast. */
  success?: string | ((data: TData, vars: TVars) => string)
  /** Extra side-effects after invalidation + toast. */
  onSuccess?: (data: TData, vars: TVars) => void | Promise<unknown>
  /** Override the default error toast (`e.message`). Return false to suppress it. */
  onError?: (error: Error, vars: TVars) => void | false
}

/**
 * Build the `useMutation` options for the app's standard mutation shape:
 * run `mutationFn`, then on success invalidate query keys + show a success
 * toast; on error show `error.message`. Call inside a hook that already has a
 * `QueryClient` (`const qc = useQueryClient()`), e.g.
 *
 *   useMutation(mutationWithToast(qc, {
 *     mutationFn: (id) => unwrap(await deleteThing(id)),
 *     invalidate: [["things"]],
 *     success: "Deleted",
 *   }))
 */
export function mutationWithToast<TData = unknown, TVars = void>(
  qc: QueryClient,
  opts: MutationWithToastOptions<TData, TVars>,
): UseMutationOptions<TData, Error, TVars> {
  return {
    mutationFn: opts.mutationFn,
    onSuccess: (data, vars) => {
      opts.invalidate?.forEach((queryKey) => qc.invalidateQueries({ queryKey }))
      if (opts.success != null) {
        toast.success(typeof opts.success === "function" ? opts.success(data, vars) : opts.success)
      }
      return opts.onSuccess?.(data, vars)
    },
    onError: (error, vars) => {
      const result = opts.onError?.(error, vars)
      if (result === false) return
      if (!opts.onError) toast.error(error.message || "Something went wrong")
    },
  }
}
