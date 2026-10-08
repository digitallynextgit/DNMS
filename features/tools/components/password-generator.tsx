"use client"

import { useState, useSyncExternalStore } from "react"
import { Copy, ListPlus, RefreshCw, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { SegmentedControl } from "@/components/shared/segmented-control"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  MAX_LENGTH,
  MAX_WORDS,
  MIN_LENGTH,
  MIN_WORDS,
  PASSPHRASE_DEFAULTS,
  PASSWORD_DEFAULTS,
  SEPARATORS,
  generatePassphrase,
  generatePassword,
  passphraseBits,
  passwordBits,
  strengthOf,
  type CharsetKey,
  type PassphraseOptions,
  type PasswordOptions,
  type SeparatorKey,
  type Strength,
} from "../lib/password"
import { WORDLIST } from "../lib/wordlist"
import { ToolPage } from "./tool-page"

type Mode = "password" | "passphrase"

interface Settings {
  mode: Mode
  password: PasswordOptions
  passphrase: PassphraseOptions
}

const DEFAULTS: Settings = {
  mode: "password",
  password: PASSWORD_DEFAULTS,
  passphrase: PASSPHRASE_DEFAULTS,
}

const MODES = [
  { value: "password", label: "Password" },
  { value: "passphrase", label: "Passphrase" },
] as const satisfies readonly { value: Mode; label: string }[]

const CHARSET_OPTIONS: { key: CharsetKey; label: string }[] = [
  { key: "upper", label: "Uppercase (A-Z)" },
  { key: "lower", label: "Lowercase (a-z)" },
  { key: "numbers", label: "Numbers (0-9)" },
  { key: "symbols", label: "Symbols (!@#$...)" },
]

const STRENGTH: Record<
  Strength,
  { label: string; bars: number; bar: string; text: string; explain: string }
> = {
  weak: {
    label: "Weak",
    bars: 1,
    bar: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    explain: "Easy for a computer to guess. Make it longer or turn on more kinds of characters.",
  },
  fair: {
    label: "Fair",
    bars: 2,
    bar: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    explain: "OK for low-risk logins, but longer is safer.",
  },
  strong: {
    label: "Strong",
    bars: 3,
    bar: "bg-green-500",
    text: "text-green-700 dark:text-green-400",
    explain: "Hard to guess. Good for most accounts.",
  },
  "very-strong": {
    label: "Very strong",
    bars: 4,
    bar: "bg-emerald-600",
    text: "text-emerald-700 dark:text-emerald-400",
    explain: "Very hard to guess. Good for admin, hosting, domain and bank logins.",
  },
}

function make(s: Settings): string {
  return s.mode === "password"
    ? generatePassword(s.password)
    : generatePassphrase(s.passphrase, WORDLIST)
}

function bitsOf(s: Settings): number {
  return s.mode === "password"
    ? passwordBits(s.password)
    : passphraseBits(s.passphrase, WORDLIST.length)
}

async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${what} copied`)
  } catch {
    toast.error("Your browser blocked copying - select the text and copy it instead")
  }
}

const subscribeNothing = () => () => {}

/** True once running in the browser. Passwords are only ever made there, never on the server. */
function useInBrowser(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  )
}

export function PasswordGenerator() {
  const inBrowser = useInBrowser()
  return (
    <ToolPage slug="password-generator">
      {inBrowser ? <Generator /> : <GeneratorSkeleton />}
    </ToolPage>
  )
}

function Generator() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  // Safe to make it during the first render: this component only renders in the browser.
  const [secret, setSecret] = useState(() => make(DEFAULTS))
  const [batch, setBatch] = useState<string[] | null>(null)
  const bits = bitsOf(settings)
  const strength = STRENGTH[strengthOf(bits)]
  const what = settings.mode === "password" ? "Password" : "Passphrase"

  function change(next: Settings) {
    setSettings(next)
    setSecret(make(next))
    setBatch(null)
  }
  const setPassword = (patch: Partial<PasswordOptions>) =>
    change({ ...settings, password: { ...settings.password, ...patch } })
  const setPassphrase = (patch: Partial<PassphraseOptions>) =>
    change({ ...settings, passphrase: { ...settings.passphrase, ...patch } })

  const pw = settings.password
  const pp = settings.passphrase
  const setsOn = CHARSET_OPTIONS.filter((o) => pw[o.key]).length

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <Card>
        <CardContent className="space-y-6 p-5">
          <div className="space-y-2">
            <SegmentedControl
              aria-label="Password or passphrase"
              value={settings.mode}
              onChange={(mode) => change({ ...settings, mode })}
              options={MODES}
            />
            <p className="text-muted-foreground text-xs">
              {settings.mode === "password"
                ? "Random letters, numbers and symbols. Best when it's saved, not typed."
                : "Random words. Easier to read out, type and remember."}
            </p>
          </div>

          {settings.mode === "password" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="pw-length">Length: {pw.length} characters</Label>
                <input
                  id="pw-length"
                  type="range"
                  min={MIN_LENGTH}
                  max={MAX_LENGTH}
                  step={1}
                  value={pw.length}
                  onChange={(e) => setPassword({ length: Number(e.target.value) })}
                  className="accent-primary w-full"
                />
                <div className="text-muted-foreground flex justify-between text-xs">
                  <span>{MIN_LENGTH}</span>
                  <span>16 is a good everyday length</span>
                  <span>{MAX_LENGTH}</span>
                </div>
              </div>

              <fieldset className="space-y-3">
                <legend className="mb-3 text-sm font-medium">Use these characters</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {CHARSET_OPTIONS.map((o) => {
                    // The last one that's on can't be turned off - a password needs something in it.
                    const locked = pw[o.key] && setsOn === 1
                    return (
                      <SwitchRow
                        key={o.key}
                        id={`pw-${o.key}`}
                        label={o.label}
                        checked={pw[o.key]}
                        disabled={locked}
                        title={locked ? "Keep at least one kind turned on" : undefined}
                        onChange={(on) => setPassword({ [o.key]: on })}
                      />
                    )
                  })}
                </div>
                {setsOn === 1 && (
                  <p className="text-muted-foreground text-xs">
                    Keep at least one kind turned on. More kinds make a stronger password.
                  </p>
                )}
              </fieldset>
              <SwitchRow
                id="pw-lookalikes"
                label="Avoid look-alike characters (I, l, 1, O, 0)"
                hint="Handy when someone has to read it out or type it from paper."
                checked={pw.avoidLookAlikes}
                onChange={(on) => setPassword({ avoidLookAlikes: on })}
              />
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="pp-words">Words: {pp.words}</Label>
                <input
                  id="pp-words"
                  type="range"
                  min={MIN_WORDS}
                  max={MAX_WORDS}
                  step={1}
                  value={pp.words}
                  onChange={(e) => setPassphrase({ words: Number(e.target.value) })}
                  className="accent-primary w-full"
                />
                <div className="text-muted-foreground flex justify-between text-xs">
                  <span>{MIN_WORDS}</span>
                  <span>6 or more is strong</span>
                  <span>{MAX_WORDS}</span>
                </div>
              </div>
              <div className="max-w-56 space-y-2">
                <Label htmlFor="pp-separator">Between words</Label>
                <Select
                  value={pp.separator}
                  onValueChange={(v) => setPassphrase({ separator: v as SeparatorKey })}
                >
                  <SelectTrigger id="pp-separator">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SEPARATORS) as SeparatorKey[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {SEPARATORS[k].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <SwitchRow
                  id="pp-capitalise"
                  label="Capital first letters"
                  checked={pp.capitalise}
                  onChange={(on) => setPassphrase({ capitalise: on })}
                />
                <SwitchRow
                  id="pp-number"
                  label="Add a number"
                  checked={pp.addNumber}
                  onChange={(on) => setPassphrase({ addNumber: on })}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Some sites insist on a capital letter and a number - keep both on to be safe.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="bg-muted/40 rounded-sm border p-4">
              <p className="text-muted-foreground mb-1 text-xs">Your {what.toLowerCase()}</p>
              <p className="font-mono text-lg leading-relaxed break-all select-all">{secret}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => copyText(secret, what)}>
                <Copy />
                Copy
              </Button>
              <Button variant="outline" onClick={() => change({ ...settings })}>
                <RefreshCw />
                Generate again
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Strength</span>
                <span className={cn("font-semibold", strength.text)}>{strength.label}</span>
              </div>
              <div className="grid grid-cols-4 gap-1" aria-hidden>
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className={cn(
                      "h-1.5 rounded-sm",
                      n <= strength.bars ? strength.bar : "bg-muted",
                    )}
                  />
                ))}
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {strength.explain} About {Math.round(bits)} bits of randomness - every extra bit
                doubles the guesses needed to crack it.
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setBatch(Array.from({ length: 5 }, () => make(settings)))}
            >
              <ListPlus />
              {batch ? "Make 5 more" : "5 at once"}
            </Button>
            {batch && (
              <ul className="space-y-1.5" aria-label={`5 more ${what.toLowerCase()}s`}>
                {batch.map((p, i) => (
                  <li key={`${i}-${p}`} className="flex items-center gap-2 rounded-sm border pl-3">
                    <span className="min-w-0 flex-1 py-1.5 font-mono text-sm break-all select-all">
                      {p}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Copy ${what.toLowerCase()} ${i + 1}`}
                      title="Copy"
                      onClick={() => copyText(p, what)}
                    >
                      <Copy />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Made on your computer - never saved or sent anywhere. Save project passwords in the
                project&apos;s Passwords tab.
              </span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SwitchRow({
  id,
  label,
  hint,
  checked,
  disabled,
  title,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  title?: string
  onChange: (on: boolean) => void
}) {
  return (
    <div className="flex items-start gap-3" title={title}>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      <div className="pt-0.5">
        <Label htmlFor={id} className="mb-0 font-normal">
          {label}
        </Label>
        {hint && (
          <p id={`${id}-hint`} className="text-muted-foreground mt-1 text-xs">
            {hint}
          </p>
        )}
      </div>
    </div>
  )
}

/** Shown for the moment before the page is running in the browser. */
function GeneratorSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <Card>
        <CardContent className="space-y-6 p-5">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4 p-5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
