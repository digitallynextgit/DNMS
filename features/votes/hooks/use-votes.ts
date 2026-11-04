"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type { VoteEventView, VoteOptionView } from "../types"
import type {
  VoteEventFormInput,
  VoteEventUpdateInput,
  VoteOptionFormInput,
  VoteOptionUpdateInput,
} from "../schemas/votes.schema"

/** "mine": what the signed-in person may see and vote on. "manage": the admin/HR view. */
export type VoteScope = "mine" | "manage"

export const voteKeys = {
  all: ["votes"] as const,
  list: (scope: VoteScope) => ["votes", scope] as const,
}

type Envelope<T> = { data: { data: T } }

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

export function useVoteEvents(scope: VoteScope) {
  return useQuery({
    queryKey: voteKeys.list(scope),
    queryFn: async () =>
      (
        await apiFetch<Envelope<VoteEventView[]>>(
          `/api/votes/events${scope === "manage" ? "?manage=1" : ""}`,
        )
      ).data.data,
    // Live counts for the people running it; voters only need a fresh page load.
    refetchInterval: scope === "manage" ? 30_000 : false,
  })
}

export function useCreateVoteEvent() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast<VoteEventView, VoteEventFormInput>(qc, {
      mutationFn: async (body) =>
        (await apiFetch<Envelope<VoteEventView>>("/api/votes/events", json("POST", body))).data
          .data,
      invalidate: [voteKeys.all],
      success: "Event created as a draft",
    }),
  )
}

export function useUpdateVoteEvent() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast<VoteEventView, { id: string; body: VoteEventUpdateInput }>(qc, {
      mutationFn: async ({ id, body }) =>
        (await apiFetch<Envelope<VoteEventView>>(`/api/votes/events/${id}`, json("PATCH", body)))
          .data.data,
      invalidate: [voteKeys.all],
      success: (_d, { body }) =>
        body.publish === true
          ? "Published. Voters have been notified."
          : body.publish === false
            ? "Back to draft"
            : body.close === true
              ? "Voting closed"
              : body.close === false
                ? "Voting reopened"
                : "Saved",
    }),
  )
}

export function useDeleteVoteEvent() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast<unknown, string>(qc, {
      mutationFn: (id) => apiFetch(`/api/votes/events/${id}`, { method: "DELETE" }),
      invalidate: [voteKeys.all],
      success: "Event deleted",
    }),
  )
}

async function uploadPhoto(optionId: string, file: File): Promise<VoteOptionView> {
  const form = new FormData()
  form.append("photo", file)
  return (
    await apiFetch<Envelope<VoteOptionView>>(`/api/votes/options/${optionId}/photo`, {
      method: "POST",
      body: form,
    })
  ).data.data
}

export function useAddVoteOption() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast<
      VoteOptionView,
      { eventId: string; body: VoteOptionFormInput; photo?: File | null }
    >(qc, {
      mutationFn: async ({ eventId, body, photo }) => {
        const option = (
          await apiFetch<Envelope<VoteOptionView>>(
            `/api/votes/events/${eventId}/options`,
            json("POST", body),
          )
        ).data.data
        return photo ? uploadPhoto(option.id, photo) : option
      },
      invalidate: [voteKeys.all],
      success: "Option added",
    }),
  )
}

export function useUpdateVoteOption() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast<VoteOptionView, { optionId: string; body: VoteOptionUpdateInput }>(qc, {
      mutationFn: async ({ optionId, body }) =>
        (
          await apiFetch<Envelope<VoteOptionView>>(
            `/api/votes/options/${optionId}`,
            json("PATCH", body),
          )
        ).data.data,
      invalidate: [voteKeys.all],
      success: "Option saved",
    }),
  )
}

export function useDeleteVoteOption() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast<unknown, string>(qc, {
      mutationFn: (optionId) => apiFetch(`/api/votes/options/${optionId}`, { method: "DELETE" }),
      invalidate: [voteKeys.all],
      success: "Option removed",
    }),
  )
}

export function useUploadOptionPhoto() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast<VoteOptionView, { optionId: string; file: File }>(qc, {
      mutationFn: ({ optionId, file }) => uploadPhoto(optionId, file),
      invalidate: [voteKeys.all],
      success: "Photo updated",
    }),
  )
}

export function useCastBallot() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast<unknown, { eventId: string; optionId: string }>(qc, {
      mutationFn: ({ eventId, optionId }) =>
        apiFetch(`/api/votes/events/${eventId}/ballot`, json("PUT", { optionId })),
      invalidate: [voteKeys.all],
      success: "Your vote is in",
    }),
  )
}
