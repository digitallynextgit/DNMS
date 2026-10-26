"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, ExternalLink, Send, Unplug } from "lucide-react"
import { toast } from "sonner"

import { apiFetch } from "@/lib/api-fetch"
import { formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface Status {
  configured: boolean
  botUsername: string | null
  linked: boolean
  username: string | null
  linkedAt: string | null
  pending: boolean
}

const KEY = ["profile", "telegram"] as const

/** Profile card: link (or unlink) the signed-in person's Telegram as a notification channel. */
export function TelegramLinkCard() {
  const qc = useQueryClient()
  const [waiting, setWaiting] = useState(false)
  const status = useQuery({
    queryKey: KEY,
    queryFn: async () => (await apiFetch<{ data: Status }>("/api/profile/telegram")).data,
    // While they are over in Telegram pressing Start, watch for the link to land.
    refetchInterval: (q) => (waiting && !q.state.data?.linked ? 3000 : false),
  })

  useEffect(() => {
    if (!waiting) return
    const t = setTimeout(() => setWaiting(false), 3 * 60_000)
    return () => clearTimeout(t)
  }, [waiting])

  const start = useMutation({
    mutationFn: async () =>
      (await apiFetch<{ data: { url: string } }>("/api/profile/telegram", { method: "POST" })).data,
    onSuccess: ({ url }) => {
      window.open(url, "_blank", "noopener")
      setWaiting(true)
    },
    onError: (e: Error) => toast.error(e.message || "Could not start the link"),
  })
  const unlink = useMutation({
    mutationFn: () => apiFetch("/api/profile/telegram", { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY })
      toast.success("Telegram unlinked")
    },
    onError: (e: Error) => toast.error(e.message || "Could not unlink"),
  })

  const s = status.data
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="h-4 w-4" />
          Telegram
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!s ? (
          <Skeleton className="h-9 w-48" />
        ) : !s.configured ? (
          <p className="text-muted-foreground text-sm">
            Telegram is not set up yet. An admin adds the bot token in Admin → Integrations.
          </p>
        ) : s.linked ? (
          <>
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Linked{s.username ? ` as @${s.username}` : ""}
              {s.linkedAt ? ` on ${formatDate(s.linkedAt, "d MMM yyyy")}` : ""}. Your DNMS
              notifications also arrive in Telegram.
            </p>
            <Button variant="outline" onClick={() => unlink.mutate()} loading={unlink.isPending}>
              <Unplug className="mr-2 h-4 w-4" /> Unlink
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              Get every DNMS notification on your phone, with nothing to install. Press the button,
              then press <strong>Start</strong> in Telegram
              {s.botUsername ? ` (@${s.botUsername})` : ""}.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => start.mutate()} loading={start.isPending}>
                <ExternalLink className="mr-2 h-4 w-4" /> Link Telegram
              </Button>
              {waiting && (
                <span className="text-muted-foreground text-xs">
                  Waiting for you to press Start in Telegram…
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
