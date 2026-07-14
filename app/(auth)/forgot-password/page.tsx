"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import Link from "next/link"
import { toast } from "sonner"
import { Mail, ArrowLeft, KeyRound, Eye, EyeOff } from "lucide-react"
import { Spinner } from "@/components/shared/spinner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthShell } from "@/features/auth"
import { apiFetch } from "@/lib/api-fetch"

type Step = "email" | "otp" | "password"

// Basic shape check used to gate the "Send code" button. The server still
// re-validates with zod and confirms the employee is active before sending.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPasswordPage() {
  const router = useRouter()

  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [token, setToken] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  // Seconds left before "Resend code" is allowed again. Set to 60 each time a
  // code is sent (initial send and every resend).
  const [resendCooldown, setResendCooldown] = useState(0)

  // Tick the resend cooldown down to zero, one second at a time.
  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setInterval(() => setResendCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000)
    return () => clearInterval(id)
  }, [resendCooldown])

  // Step 1 - request the code (server confirms the active employee first).
  const requestOtp = useMutation({
    mutationFn: async () =>
      (
        await apiFetch<{ data: { sent: true } }>("/api/password/forgot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })
      ).data,
    onSuccess: () => {
      setStep("otp")
      setResendCooldown(60)
      toast.success("Verification code sent to your email.")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Step 2 - verify the code, receive the reset token.
  const verifyOtp = useMutation({
    mutationFn: async () =>
      (
        await apiFetch<{ data: { token: string } }>("/api/password/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp }),
        })
      ).data,
    onSuccess: (data) => {
      setToken(data.token)
      setStep("password")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Step 3 - set the new password, then send them to login.
  const resetPassword = useMutation({
    mutationFn: async () =>
      (
        await apiFetch<{ data: { reset: true } }>("/api/password/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        })
      ).data,
    onSuccess: () => {
      toast.success("Password updated. Please sign in with your new password.")
      router.push(`/login?email=${encodeURIComponent(email)}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const emailValid = EMAIL_RE.test(email.trim())
  const passwordsMismatch = confirm.length > 0 && password !== confirm

  return (
    <AuthShell>
      <div className="mb-6 space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {step === "email" && "Forgot password"}
          {step === "otp" && "Enter verification code"}
          {step === "password" && "Set a new password"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {step === "email" && "Enter your work email and we'll send you a 6-digit code."}
          {step === "otp" && (
            <>
              We sent a 6-digit code to <strong className="text-foreground">{email}</strong>. It
              expires in 10 minutes.
            </>
          )}
          {step === "password" && "Choose a strong password you haven't used before."}
        </p>
      </div>

      {/* ── Step 1: email ───────────────────────────────────────────────── */}
      {step === "email" && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            requestOtp.mutate()
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="email" className="mb-2 block text-sm font-medium">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="username@digitallynext.com"
              className="h-11"
              required
            />
          </div>
          {requestOtp.isError && (
            <p className="text-destructive text-xs">{(requestOtp.error as Error).message}</p>
          )}
          <Button
            type="submit"
            className="h-11 w-full gap-2 text-sm"
            disabled={requestOtp.isPending || !emailValid}
          >
            {requestOtp.isPending ? <Spinner /> : <Mail className="h-4 w-4" />}
            Send code
          </Button>
        </form>
      )}

      {/* ── Step 2: OTP ─────────────────────────────────────────────────── */}
      {step === "otp" && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            verifyOtp.mutate()
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="otp" className="mb-2 block text-sm font-medium">
              Verification code
            </Label>
            <Input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••••"
              className="h-12 text-center text-lg tracking-[0.6em]"
              maxLength={6}
              autoFocus
              required
            />
          </div>
          {verifyOtp.isError && (
            <p className="text-destructive text-xs">{(verifyOtp.error as Error).message}</p>
          )}
          <Button
            type="submit"
            className="h-11 w-full gap-2 text-sm"
            disabled={verifyOtp.isPending || otp.length !== 6}
          >
            {verifyOtp.isPending ? <Spinner /> : <KeyRound className="h-4 w-4" />}
            Verify code
          </Button>
          <div className="text-center">
            <button
              type="button"
              onClick={() => requestOtp.mutate()}
              disabled={requestOtp.isPending || resendCooldown > 0}
              className="text-muted-foreground hover:text-foreground disabled:hover:text-muted-foreground text-xs disabled:opacity-50"
            >
              {requestOtp.isPending
                ? "Resending…"
                : resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : "Didn't get it? Resend code"}
            </button>
          </div>
        </form>
      )}

      {/* ── Step 3: new password ────────────────────────────────────────── */}
      {step === "password" && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (passwordsMismatch || password.length < 8) return
            resetPassword.mutate()
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="password" className="mb-2 block text-sm font-medium">
              New password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="h-11 pr-10"
                minLength={8}
                required
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow((s) => !s)}
                className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center pr-3 transition-colors"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm" className="mb-2 block text-sm font-medium">
              Confirm password
            </Label>
            <Input
              id="confirm"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              className="h-11"
              required
            />
            {passwordsMismatch && (
              <p className="text-destructive text-xs">Passwords do not match</p>
            )}
          </div>
          {resetPassword.isError && (
            <p className="text-destructive text-xs">{(resetPassword.error as Error).message}</p>
          )}
          <Button
            type="submit"
            className="h-11 w-full gap-2 text-sm"
            disabled={
              resetPassword.isPending || password.length < 8 || passwordsMismatch || !confirm
            }
            loading={resetPassword.isPending}
          >
            Update password
          </Button>
        </form>
      )}

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm"
        >
          <ArrowLeft className="mr-1 h-3 w-3" />
          Back to login
        </Link>
      </div>
    </AuthShell>
  )
}
