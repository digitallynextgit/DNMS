"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { signIn, signOut, useSession } from "next-auth/react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
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

const schema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type FormValues = z.infer<typeof schema>

export function ChangePasswordForm() {
  const { data: session } = useSession()
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  })
  const { isSubmitting } = form.formState

  async function onSubmit(values: FormValues) {
    try {
      await apiFetch<{ data: { ok: true } }>("/api/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: values.newPassword }),
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update password")
      return
    }
    // Re-issue the JWT (now mustChangePassword=false) by signing in with the new
    // password - deterministic, unlike update() which races the cookie write. Then
    // hard-navigate so the proxy reads the fresh cookie.
    const email = session?.user?.email
    if (email) {
      await signIn("credentials", { email, password: values.newPassword, redirect: false })
    }
    toast.success("Password updated")
    window.location.href = "/dashboard"
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem className="space-y-2.5">
              <FormLabel className="mb-2 block text-sm font-medium">New password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    disabled={isSubmitting}
                    className="h-11 pr-10"
                    {...field}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((p) => !p)}
                    className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center pr-3 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormControl>
              <FormMessage className="text-destructive text-xs" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem className="space-y-2.5">
              <FormLabel className="mb-2 block text-sm font-medium">Confirm password</FormLabel>
              <FormControl>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  className="h-11"
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-destructive text-xs" />
            </FormItem>
          )}
        />

        <Button type="submit" className="h-11 w-full text-sm" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? "Saving…" : "Set password & continue"}
        </Button>

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
