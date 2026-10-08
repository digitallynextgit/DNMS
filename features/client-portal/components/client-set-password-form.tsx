"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { signIn, signOut, useSession } from "next-auth/react"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

import { apiFetch } from "@/lib/api-fetch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { clientPasswordSchema, type ClientPasswordInput } from "../schemas/client-portal.schema"

const FIELDS = [
  { name: "currentPassword", label: "Temporary password", autoComplete: "current-password" },
  { name: "newPassword", label: "New password", autoComplete: "new-password" },
  { name: "confirmPassword", label: "Confirm new password", autoComplete: "new-password" },
] as const

/**
 * First-sign-in password change. The proxy reads mustChangePassword from the JWT cookie, so we
 * sign in again to mint a fresh token, then hard-navigate (same fix as the staff form).
 */
export function ClientSetPasswordForm() {
  const { data: session } = useSession()
  const [visible, setVisible] = useState<Record<string, boolean>>({})

  const form = useForm<ClientPasswordInput>({
    resolver: zodResolver(clientPasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  })
  const { isSubmitting } = form.formState

  async function onSubmit(values: ClientPasswordInput) {
    try {
      await apiFetch("/api/portal/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update your password")
      return
    }

    // Re-authenticate so NextAuth mints a JWT with mustChangePassword=false.
    const email = session?.user?.email
    const reauth = email
      ? await signIn("credentials", {
          email,
          password: values.newPassword,
          redirect: false,
        })
      : null

    // No fresh token means /portal would bounce back here - send them to the login screen instead.
    if (!reauth?.ok) {
      toast.success("Password updated - please sign in with your new password")
      await signOut({ callbackUrl: "/login" })
      return
    }

    toast.success("Password updated")
    // Hard navigation: a client-side transition may carry the old cookie and bounce back here.
    window.location.assign("/portal")
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {FIELDS.map((f) => (
          <FormField
            key={f.name}
            control={form.control}
            name={f.name}
            render={({ field }) => (
              <FormItem className="space-y-2.5">
                <FormLabel className="mb-2 block text-sm font-medium">{f.label}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={visible[f.name] ? "text" : "password"}
                      autoComplete={f.autoComplete}
                      disabled={isSubmitting}
                      className="h-11 pr-10"
                      {...field}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={visible[f.name] ? "Hide password" : "Show password"}
                      onClick={() => setVisible((v) => ({ ...v, [f.name]: !v[f.name] }))}
                      className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center pr-3 transition-colors"
                    >
                      {visible[f.name] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage className="text-destructive text-xs" />
              </FormItem>
            )}
          />
        ))}

        <Button type="submit" className="w-full" disabled={isSubmitting} loading={isSubmitting}>
          {isSubmitting ? "Saving…" : "Set password"}
        </Button>

        {/* Escape hatch: the proxy pins them here, so a mistyped temp password would trap them. */}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-muted-foreground hover:text-foreground mx-auto block text-xs"
        >
          Sign out
        </button>
      </form>
    </Form>
  )
}
