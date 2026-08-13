"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { signIn } from "next-auth/react"
import { z } from "zod"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

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

const schema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
})
type Values = z.infer<typeof schema>

// Only internal portal paths are honoured as a callback - anything else falls
// back to /portal. Prevents an open redirect via a crafted ?callbackUrl=.
function safeCallbackUrl(raw: string | null): string {
  if (raw && raw.startsWith("/portal") && !raw.startsWith("//")) return raw
  return "/portal"
}

/**
 * Sign-in for EXTERNAL client accounts. Separate from the staff LoginForm and
 * pointed at the `client-credentials` provider, so a client password is never
 * checked against the employee table (and there is no Google button - staff SSO
 * is not a route into the portal).
 */
export function ClientLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"))
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  })
  const { isSubmitting } = form.formState

  async function onSubmit(values: Values) {
    setAuthError(null)
    const result = await signIn("client-credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    })

    if (result?.error || !result?.ok) {
      // One message for every failure mode (wrong password, unknown email,
      // disabled account) so the form can't be used to enumerate accounts.
      setAuthError("Invalid email or password")
      toast.error("Invalid email or password")
      return
    }

    toast.success("Signed in")
    router.push(callbackUrl)
    router.refresh()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="space-y-2.5">
              <FormLabel className="mb-2 block text-sm font-medium">Email address</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@yourcompany.com"
                  autoComplete="email"
                  disabled={isSubmitting}
                  className="h-11"
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-destructive text-xs" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem className="space-y-2.5">
              <FormLabel className="mb-2 block text-sm font-medium">Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
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

        {authError && (
          <p role="alert" className="text-destructive text-xs">
            {authError}
          </p>
        )}

        <Button
          type="submit"
          className="h-11 w-full text-sm"
          disabled={isSubmitting}
          loading={isSubmitting}
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Form>
  )
}
