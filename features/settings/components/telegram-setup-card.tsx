"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Plug, Send, XCircle } from "lucide-react"
import { toast } from "sonner"

import { apiFetch } from "@/lib/api-fetch"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface Status {
  configured: boolean
  botUsername: string | null
  expectedUrl: string
  webhookUrl: string | null
  pending: number
  lastError: string | null
  tokenError: string | null
}

const KEY = ["settings", "telegram"] as const

/** Under the Telegram settings: is the bot reachable, and is its webhook pointed at this DNMS. */
export function TelegramSetupCard() {
  const qc = useQueryClient()
  const status = useQuery({
    queryKey: KEY,
    queryFn: async () => (await apiFetch<{ data: Status }>("/api/settings/telegram")).data,
  })
  const connect = useMutation({
    mutationFn: () => apiFetch("/api/settings/telegram", { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY })
      toast.success("Telegram is connected")
    },
    onError: (e: Error) => toast.error(e.message || "Could not connect"),
  })

  const s = status.data
  const connected = !!s && s.configured && !s.tokenError && s.webhookUrl === s.expectedUrl
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="h-4 w-4" />
          Telegram bot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!s ? (
          <Skeleton className="h-9 w-56" />
        ) : !s.configured ? (
          <p className="text-muted-foreground">
            Create a bot with @BotFather in Telegram (send it /newbot), paste the token above and
            save, then press Connect here.
          </p>
        ) : (
          <>
            <p className="flex items-center gap-2">
              {s.tokenError ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
              {s.tokenError
                ? `Telegram rejected the token: ${s.tokenError}`
                : `Bot @${s.botUsername} is reachable.`}
            </p>
            <p className="flex items-center gap-2">
              {connected ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <XCircle className="h-4 w-4 text-amber-500" />
              )}
              {connected
                ? "Webhook connected: messages to the bot reach DNMS."
                : s.webhookUrl
                  ? `Webhook points elsewhere (${s.webhookUrl}). Press Connect.`
                  : "Webhook not set. Press Connect."}
            </p>
            {s.lastError && (
              <p className="text-muted-foreground text-xs">Last Telegram error: {s.lastError}</p>
            )}
            <Button
              variant={connected ? "outline" : "default"}
              onClick={() => connect.mutate()}
              loading={connect.isPending}
              disabled={!!s.tokenError}
            >
              <Plug className="mr-2 h-4 w-4" /> {connected ? "Reconnect" : "Connect"}
            </Button>
            <p className="text-muted-foreground text-xs">
              Employees link their own Telegram from Profile → Notifications.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
