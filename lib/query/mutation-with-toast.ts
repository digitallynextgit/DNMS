import type { QueryClient, QueryKey, UseMutationOptions } from "@tanstack/react-query"
import { toast } from "sonner"

interface MutationWithToastOptions<TData, TVars> {
  mutationFn: (vars: TVars) => Promise<TData>
  invalidate?: QueryKey[]
  /** A string or (data, vars) => string. Omit for no toast. */
  success?: string | ((data: TData, vars: TVars) => string)
  /** Runs after invalidation and the toast. */
  onSuccess?: (data: TData, vars: TVars) => void | Promise<unknown>
  /** Return false to suppress the default error toast. */
  onError?: (error: Error, vars: TVars) => void | false
}

/** Standard mutation: invalidate + success toast on success, `error.message` toast on error. */
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
