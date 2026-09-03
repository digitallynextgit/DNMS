"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { signIn } from "next-auth/react"
import { Check, Eye, EyeOff, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { signupSchema, suggestSlug, type SignupInput } from "../schemas/signup.schema"
import { checkSlugAvailable, createWorkspace } from "../server/signup.actions"

/**
 * Create a company (M5).
 *
 * Signs the founder in immediately afterwards with the password they just
 * chose, rather than sending them to /login to type it again - they proved they
 * know it thirty seconds ago, and a signup that ends on a login form reads as a
 * failure.
 */
export function SignupForm() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [slugState, setSlugState] = useState<{
    checking: boolean
    available: boolean | null
    reason: string | null
  }>({ checking: false, available: null, reason: null })
  const [, startTransition] = useTransition()

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      companyName: "",
      slug: "",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
    },
  })
  const { isSubmitting } = form.formState

  const companyName = form.watch("companyName")
  const slug = form.watch("slug")

  // Suggest a workspace name from the company name until the field is touched.
  useEffect(() => {
    if (form.getFieldState("slug").isDirty) return
    form.setValue("slug", suggestSlug(companyName), { shouldValidate: false })
  }, [companyName, form])

  // Availability, debounced. The regex lives in the schema; this answers the
  // question a regex cannot - whether somebody already has it.
  useEffect(() => {
    if (!slug || slug.length < 3) {
      setSlugState({ checking: false, available: null, reason: null })
      return
    }
    setSlugState((s) => ({ ...s, checking: true }))
    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await checkSlugAvailable(slug)
        setSlugState({
          checking: false,
          available: res.ok ? res.data.available : null,
          reason: res.ok ? res.data.reason : null,
        })
      })
    }, 400)
    return () => clearTimeout(timer)
  }, [slug])

  async function onSubmit(values: SignupInput) {
    const created = await createWorkspace(values)
    if (!created.ok) {
      toast.error(created.error)
      return
    }

    const signedIn = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    })
    if (signedIn?.ok) {
      toast.success(`${values.companyName} is ready.`)
      router.push(created.data.redirectTo)
      router.refresh()
      return
    }
    // The workspace exists either way - never imply it does not.
    toast.success("Workspace created. Please sign in.")
    router.push(`/login?email=${encodeURIComponent(values.email)}`)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="companyName"
          render={({ field }) => (
            <FormItem className="space-y-2.5">
              <FormLabel className="mb-2 block text-sm font-medium">Company name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Acme Media"
                  aria-label="Acme Media"
                  autoComplete="organization"
                  disabled={isSubmitting}
                  className="h-11 rounded-sm"
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-destructive text-xs" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem className="space-y-2.5">
              <FormLabel className="mb-2 block text-sm font-medium">Workspace address</FormLabel>
              <FormControl>
                <div className="border-input focus-within:ring-ring flex h-11 items-center rounded-sm border focus-within:ring-1">
                  <span className="text-muted-foreground pl-3 text-sm select-none">
                    dnms.digitallynext.com/
                  </span>
                  <input
                    {...field}
                    disabled={isSubmitting}
                    autoComplete="off"
                    spellCheck={false}
                    className="min-w-0 flex-1 bg-transparent py-2 pr-3 text-sm outline-none"
                    onChange={(e) => field.onChange(e.target.value.toLowerCase())}
                  />
                  <span className="pr-3">
                    {slugState.checking ? (
                      <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                    ) : slugState.available ? (
                      <Check className="h-4 w-4 text-emerald-500" aria-label="Available" />
                    ) : null}
                  </span>
                </div>
              </FormControl>
              {slugState.reason ? (
                <p className="text-destructive text-xs">{slugState.reason}</p>
              ) : (
                <FormDescription className="text-xs">
                  This is where your team will sign in. It cannot be changed later.
                </FormDescription>
              )}
              <FormMessage className="text-destructive text-xs" />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem className="space-y-2.5">
                <FormLabel className="mb-2 block text-sm font-medium">First name</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="given-name"
                    disabled={isSubmitting}
                    className="h-11 rounded-sm"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-destructive text-xs" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem className="space-y-2.5">
                <FormLabel className="mb-2 block text-sm font-medium">Last name</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="family-name"
                    disabled={isSubmitting}
                    className="h-11 rounded-sm"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-destructive text-xs" />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="space-y-2.5">
              <FormLabel className="mb-2 block text-sm font-medium">Work email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@yourcompany.com"
                  aria-label="you@yourcompany.com"
                  autoComplete="email"
                  disabled={isSubmitting}
                  className="h-11 rounded-sm"
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
                    placeholder="At least 8 characters"
                    aria-label="At least 8 characters"
                    autoComplete="new-password"
                    disabled={isSubmitting}
                    className="h-11 rounded-sm pr-10"
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

        <Button
          type="submit"
          className="h-11 w-full rounded-sm text-sm"
          disabled={isSubmitting || slugState.available === false}
          loading={isSubmitting}
        >
          {isSubmitting ? "Creating your workspace…" : "Start 21-day trial"}
        </Button>

        <p className="text-muted-foreground text-center text-xs">
          No card required. Every module, your own data.
        </p>
      </form>
    </Form>
  )
}
