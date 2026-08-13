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
 * First-sign-in password change for a client.
 *
 * The gate in proxy.ts holds them here until `mustChangePassword` clears IN THE
 * JWT COOKIE - the middleware reads the cookie, not the database. `update()`
 * races that cookie write, so a router.push() straight afterwards was leaving
 * with the stale token and getting bounced right back here, looking like the
 * button did nothing. Signing in again with the new password re-issues the
 * token deterministically, and a hard navigation guarantees the proxy sees it.
 * Same fix as the staff form (features/auth/components/change-password-form).
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

    // The password is already changed at this point. Re-authenticate with it so
    // NextAuth mints a fresh JWT carrying mustChangePassword=false.
    const email = session?.user?.email
    const reauth = email
      ? await signIn("client-credentials", {
          email,
          password: values.newPassword,
          redirect: false,
        })
      : null

    // If the token could NOT be refreshed, sending them to /portal would just
    // bounce off the proxy back to this page - the very loop this is fixing.
    // Drop them at the login screen instead, where the new password works.
    if (!reauth?.ok) {
      toast.success("Password updated - please sign in with your new password")
      await signOut({ callbackUrl: "/client-login" })
      return
    }

    toast.success("Password updated")
    // Hard navigation, not router.push: a client-side transition can be served
    // from the router cache and/or carry the pre-update cookie, and the proxy
    // would send us straight back here.
    window.location.href = "/portal"
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

        <Button
          type="submit"
          className="h-11 w-full text-sm"
          disabled={isSubmitting}
          loading={isSubmitting}
        >
          {isSubmitting ? "Saving…" : "Set password"}
        </Button>

        {/* The proxy pins them to this page until the flag clears, so without an
            escape hatch a client who mistypes their temporary password has no
            way off it. */}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/client-login" })}
          className="text-muted-foreground hover:text-foreground mx-auto block text-xs"
        >
          Sign out
        </button>
      </form>
    </Form>
  )
}
