"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { signIn } from "next-auth/react"
import { Eye, EyeOff } from "lucide-react"
import { Spinner } from "@/components/shared/spinner"
import { toast } from "sonner"
import Link from "next/link"

import { loginSchema, type LoginInput } from "@/features/auth/schemas/auth.schema"
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

// Only honour internal, relative callback paths. Anything else (an absolute
// URL, a protocol-relative `//evil.com`, or a missing param) falls back to the
// dashboard - this prevents open-redirect attacks via a crafted ?callbackUrl=.
function safeCallbackUrl(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw
  return "/dashboard"
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"))
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: searchParams.get("email") ?? "",
      password: "",
    },
  })

  const { isSubmitting } = form.formState

  // Surface auth redirects (e.g. a rejected Google sign-in) as a toast, then
  // strip the ?error= param so it doesn't re-fire on refresh.
  useEffect(() => {
    const err = searchParams.get("error")
    if (!err) return
    const messages: Record<string, string> = {
      no_account: "No account exists for this email. Contact your HR administrator.",
      deactivated: "Your account has been deactivated. Contact your HR administrator.",
      AccessDenied: "You do not have permission to sign in.",
    }
    toast.error(messages[err] ?? "Sign-in failed. Please try again.")

    const params = new URLSearchParams(Array.from(searchParams.entries()))
    params.delete("error")
    const qs = params.toString()
    router.replace(qs ? `/login?${qs}` : "/login", { scroll: false })
  }, [searchParams, router])

  async function onSubmit(values: LoginInput) {
    setAuthError(null)

    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    })

    if (result?.error) {
      setAuthError("Invalid email or password")
      toast.error("Invalid email or password")
      return
    }

    if (result?.ok) {
      toast.success("Signed in successfully")
      router.push(callbackUrl)
      router.refresh()
    }
  }

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true)
    try {
      await signIn("google", { callbackUrl })
    } catch {
      toast.error("Google sign-in failed. Please try again.")
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="space-y-5">
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
                    placeholder="username@digitallynext.com"
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
                      onClick={() => setShowPassword((prev) => !prev)}
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

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Forgot password?
            </Link>
          </div>

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

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="border-border w-full border-t" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background text-muted-foreground px-2 text-xs tracking-wider uppercase">
            or
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full text-sm"
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading || isSubmitting}
      >
        {isGoogleLoading ? (
          <Spinner className="mr-2" />
        ) : (
          <svg
            className="mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
        )}
        {isGoogleLoading ? "Redirecting…" : "Sign in with Google"}
      </Button>
    </div>
  )
}
