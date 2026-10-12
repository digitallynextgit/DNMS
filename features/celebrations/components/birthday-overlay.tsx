"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Great_Vibes } from "next/font/google"
import { Cake, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { BirthdayShowProps } from "../types"
import BirthdayScene from "./birthday-scene"

const script = Great_Vibes({ weight: "400", subsets: ["latin"], preload: false, display: "swap" })

// When each beat starts, in ms after the font and photos are ready. The show then waits for her
// to blow out the candles and closes a few seconds after.
const BEATS = { title: 0, name: 1200, photos: 2400, chapters: 4200 } as const
/** Each photo's spotlight moment. The wish is reachable within 20 seconds. */
const CHAPTER_MS = 2000
const MESSAGE_AFTER_CHAPTERS_MS = 0
const WISH_AFTER_MESSAGE_MS = 1800
const AFTER_WISH_MS = 5000
const EASE = [0.22, 1, 0.36, 1] as const

const PALETTE = ["#F5C451", "#F28DB2", "#B9A2FF", "#FFB38A", "#8FE3CF", "#FFF4E0"]

const SPARKLES = [
  { left: "-9%", top: "8%", delay: 0 },
  { left: "103%", top: "-2%", delay: 0.25 },
  { left: "18%", top: "-28%", delay: 0.5 },
  { left: "88%", top: "92%", delay: 0.15 },
  { left: "52%", top: "-32%", delay: 0.65 },
  { left: "-4%", top: "88%", delay: 0.4 },
]

interface Piece {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  spin: number
  flip: number
  w: number
  h: number
  color: string
  age: number
  life: number
  round: boolean
}

/** A tiny canvas confetti engine: bursts of paper that flutter, fall and fade. */
function startConfetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")
  const pieces: Piece[] = []
  let raf = 0
  let last = 0

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  window.addEventListener("resize", resize)

  const tick = (now: number) => {
    if (!ctx) return
    // Frame-rate independent: 1 = one 60 Hz frame.
    const dt = last ? Math.min((now - last) / 16.67, 3) : 1
    last = now
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i]!
      p.age += dt
      p.vx *= 0.985 ** dt
      p.vy = p.vy * 0.985 ** dt + 0.24 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.spin * dt
      const alpha = Math.min(1, (p.life - p.age) / 40)
      if (alpha <= 0 || p.y > window.innerHeight + 40) {
        pieces.splice(i, 1)
        continue
      }
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      if (p.round) {
        ctx.beginPath()
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // Squashing one axis reads as paper turning over.
        const turn = Math.cos(p.age * p.flip)
        ctx.fillRect(-p.w / 2, (-p.h / 2) * turn, p.w, p.h * turn)
      }
      ctx.restore()
    }
    if (pieces.length > 0) raf = requestAnimationFrame(tick)
    else {
      raf = 0
      last = 0
    }
  }

  return {
    burst(x: number, y: number, count: number, angle: number, spread: number, speed: number) {
      for (let i = 0; i < count; i++) {
        const a = angle + (Math.random() - 0.5) * spread
        const v = speed * (0.45 + Math.random() * 0.75)
        pieces.push({
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          rot: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.3,
          flip: 0.08 + Math.random() * 0.2,
          w: 6 + Math.random() * 6,
          h: 9 + Math.random() * 8,
          color: PALETTE[Math.floor(Math.random() * PALETTE.length)]!,
          age: 0,
          life: 150 + Math.random() * 90,
          round: Math.random() < 0.22,
        })
      }
      if (!raf) raf = requestAnimationFrame(tick)
    },
    stop() {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
    },
  }
}

function Sparkle() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z" />
    </svg>
  )
}

function Show({ name, photos, onClose }: BirthdayShowProps & { onClose: () => void }) {
  const reduce = useReducedMotion() ?? false
  // -1 while the font and photos load; then title, name, photos, message, make-a-wish.
  const [stage, setStage] = useState(-1)
  const [blown, setBlown] = useState(false)
  const [chapter, setChapter] = useState<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const confettiRef = useRef<ReturnType<typeof startConfetti> | null>(null)
  const close = useEffectEvent(onClose)

  useEffect(() => {
    const confetti = canvasRef.current && !reduce ? startConfetti(canvasRef.current) : null
    confettiRef.current = confetti
    const timers: number[] = []
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))
    let cancelled = false

    const ready = Promise.all([
      document.fonts.load(`48px ${script.style.fontFamily}`).catch(() => undefined),
      ...photos.map(
        (p) =>
          new Promise<void>((resolve) => {
            const img = new Image()
            img.onload = img.onerror = () => resolve()
            img.src = p.src
          }),
      ),
    ])
    // Never keep her waiting on a slow photo: the night sky fades in meanwhile.
    const cap = new Promise<void>((resolve) => at(1800, resolve))

    void Promise.race([ready, cap]).then(() => {
      if (cancelled) return
      const w = window.innerWidth
      const h = window.innerHeight
      at(BEATS.title, () => setStage(0))
      at(BEATS.name, () => {
        setStage(1)
        confetti?.burst(w / 2, h * 0.3, 170, -Math.PI / 2, Math.PI * 2, 13)
      })
      at(BEATS.photos, () => setStage(2))
      photos.forEach((_, i) => {
        at(BEATS.chapters + i * CHAPTER_MS, () => {
          setStage(3)
          setChapter(i)
        })
      })
      const messageAt = BEATS.chapters + photos.length * CHAPTER_MS + MESSAGE_AFTER_CHAPTERS_MS
      at(messageAt, () => {
        setChapter(null)
        setStage(4)
      })
      at(messageAt + WISH_AFTER_MESSAGE_MS, () => setStage(5))
    })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
      window.removeEventListener("keydown", onKey)
      confetti?.stop()
      confettiRef.current = null
      document.body.style.cursor = ""
    }
  }, [photos, reduce])

  const blow = () => {
    if (blown || stage < 5) return
    setBlown(true)
    const w = window.innerWidth
    const h = window.innerHeight
    const c = confettiRef.current
    c?.burst(0, h, 130, -Math.PI / 3, 0.7, 24)
    c?.burst(w, h, 130, (-2 * Math.PI) / 3, 0.7, 24)
    c?.burst(w / 2, h * 0.55, 90, -Math.PI / 2, Math.PI * 2, 10)
  }

  // The show bows out a few seconds after her wish.
  useEffect(() => {
    if (!blown) return
    const t = window.setTimeout(close, AFTER_WISH_MS)
    return () => clearTimeout(t)
  }, [blown])

  const show = (s: number) => stage >= s

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Happy Birthday, ${name}`}
      className="fixed inset-0 z-[200] overflow-hidden bg-[#150a23] text-white select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.7 } }}
      exit={{ opacity: 0, transition: { duration: 0.9 } }}
    >
      <BirthdayScene
        photos={photos}
        stage={stage}
        focus={stage === 3 ? chapter : null}
        cakeIn={stage >= 5}
        blown={blown}
        reduce={reduce}
        fontFamily={script.style.fontFamily}
        onCake={blow}
      />
      {/* Vignette: keeps the eye on the middle of the room. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 55%, rgba(8,3,16,0.6) 100%)",
        }}
      />

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 z-40 rounded-full bg-white/10 p-2 text-white/80 backdrop-blur transition hover:bg-white/20 hover:text-white"
      >
        <X className="size-5" />
      </button>

      {/* Text floats over the 3D scene; clicks pass through to the cake except on buttons. */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-between px-4 pt-[4vh] pb-[3.5vh] text-center">
        <div className="flex flex-col items-center gap-[1vh]">
          <motion.p
            className="text-[11px] font-medium tracking-[0.4em] text-amber-100/70 uppercase md:text-xs"
            initial={{ opacity: 0, y: 8 }}
            animate={show(0) ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease: EASE }}
          >
            Today is all about you
          </motion.p>

          {/* Written out left to right, like a pen. */}
          <motion.h1
            className={cn(script.className, "-my-[0.5vh] leading-none")}
            style={{
              fontSize: "min(7.5vh, 12vw, 4.5rem)",
              filter: "drop-shadow(0 0 18px rgba(251, 191, 36, 0.35))",
            }}
            initial={{ clipPath: "inset(-30% 100% -30% -10%)" }}
            animate={show(0) ? { clipPath: "inset(-30% -10% -30% -10%)" } : {}}
            transition={{ duration: 1.5, ease: "easeInOut", delay: 0.2 }}
          >
            <span className="inline-block bg-gradient-to-b from-amber-50 via-amber-200 to-amber-400 bg-clip-text px-[0.3em] py-[0.15em] text-transparent">
              Happy Birthday
            </span>
          </motion.h1>

          <div className="relative">
            <motion.h2
              className="leading-[1.05] font-extrabold tracking-tight"
              style={{
                fontSize: "min(10vh, 15vw, 6.5rem)",
                textShadow: "0 8px 40px rgba(0,0,0,0.45)",
              }}
              initial={{ opacity: 0, scale: 0.55, filter: "blur(16px)" }}
              animate={show(1) ? { opacity: 1, scale: 1, filter: "blur(0px)" } : {}}
              transition={{
                default: { type: "spring", stiffness: 110, damping: 13 },
                opacity: { duration: 0.5 },
                filter: { duration: 0.7 },
              }}
            >
              <motion.span
                className="inline-block bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(100deg, #f9a8d4 0%, #fde68a 25%, #fffbeb 50%, #fde68a 75%, #f9a8d4 100%)",
                  backgroundSize: "200% 100%",
                }}
                animate={reduce ? undefined : { backgroundPosition: ["0% 50%", "200% 50%"] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
              >
                {name}
              </motion.span>
            </motion.h2>
            {!reduce &&
              show(1) &&
              SPARKLES.map((s, i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="pointer-events-none absolute text-amber-200"
                  style={{ left: s.left, top: s.top }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 1, 0.6, 1, 0], opacity: [0, 1, 1, 1, 0], rotate: [0, 90] }}
                  transition={{
                    duration: 2.4,
                    delay: 0.3 + s.delay,
                    repeat: Infinity,
                    repeatDelay: 0.6,
                  }}
                >
                  <Sparkle />
                </motion.span>
              ))}
          </div>
        </div>

        <div className="flex max-w-[38rem] flex-col items-center gap-[1.2vh] px-2">
          {/* One line per photo while it has the spotlight; then the message. */}
          <AnimatePresence mode="wait">
            {stage === 3 && chapter !== null ? (
              <motion.p
                key={`chapter-${chapter}`}
                className="text-lg leading-snug font-light text-amber-50 md:text-2xl"
                style={{ textShadow: "0 2px 18px rgba(0,0,0,0.8)" }}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
                transition={{ duration: 0.5, ease: EASE, delay: 0.15 }}
              >
                {photos[chapter]?.line}
              </motion.p>
            ) : show(4) ? (
              <motion.div
                key="message"
                className="flex flex-col items-center gap-[1.2vh]"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease: EASE }}
              >
                <p
                  className="text-[15px] leading-relaxed text-white/90 md:text-lg"
                  style={{ textShadow: "0 2px 18px rgba(0,0,0,0.7)" }}
                >
                  Thank you for leading with heart, for every lesson you&apos;ve taught us, and for
                  always believing in us.
                </p>
                <motion.p
                  className="text-[15px] font-medium text-amber-100 md:text-lg"
                  style={{ textShadow: "0 2px 18px rgba(0,0,0,0.7)" }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.9, delay: 1.2 }}
                >
                  Wishing you a year as beautiful as you are.
                </motion.p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="relative flex h-[6.5vh] min-h-12 items-center justify-center">
            <AnimatePresence mode="wait">
              {show(5) && !blown ? (
                <motion.button
                  key="wish"
                  type="button"
                  onClick={blow}
                  className="pointer-events-auto flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-amber-400 py-2.5 pr-5 pl-4 text-sm font-semibold text-white shadow-lg shadow-pink-500/40 md:text-base"
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: reduce ? 1 : [1, 1.05, 1],
                    transition: {
                      opacity: { duration: 0.5 },
                      y: { duration: 0.5 },
                      scale: { duration: 1.6, repeat: Infinity, ease: "easeInOut" },
                    },
                  }}
                  exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.25 } }}
                >
                  <Cake className="size-5" />
                  Make a wish &amp; blow out the candles
                </motion.button>
              ) : blown ? (
                <motion.p
                  key="signed"
                  className={cn(script.className, "text-amber-200")}
                  style={{
                    fontSize: "min(4.5vh, 7vw, 2.25rem)",
                    textShadow: "0 2px 18px rgba(0,0,0,0.7)",
                  }}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1, ease: EASE, delay: 0.5 }}
                >
                  With love, Team Digitally Next
                </motion.p>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-30 size-full"
      />
    </motion.div>
  )
}

export default function BirthdayOverlay({ name, photos }: BirthdayShowProps) {
  const [open, setOpen] = useState(true)
  // Bumped on replay so the show starts again from the top.
  const [run, setRun] = useState(0)

  return (
    <>
      <AnimatePresence>
        {open && <Show key={run} name={name} photos={photos} onClose={() => setOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            onClick={() => {
              setRun((r) => r + 1)
              setOpen(true)
            }}
            title="Replay your birthday wish"
            className="fixed right-5 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-amber-400 py-2 pr-4 pl-3 text-sm font-medium text-white shadow-lg shadow-pink-500/30 md:bottom-5"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1, transition: { delay: 0.6, type: "spring" } }}
            exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.2 } }}
          >
            <Cake className="size-4" />
            Happy Birthday!
          </motion.button>
        )}
      </AnimatePresence>
    </>
  )
}
