"use client"

import { Fragment, useMemo } from "react"
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink, Lightbulb, Lock } from "lucide-react"
import { Link } from "@/components/tenant-link"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { HELP_GUIDES, getGuide } from "../guides"
import { useHelpLang } from "../hooks/use-help-lang"
import { canSeeGuide, canSeeSection } from "../lib/visibility"
import { tr } from "../lib/text"
import type { HelpGuide, HelpLang, HelpSection } from "../types"
import { HelpLangSwitch } from "./help-lang-switch"
import { HelpShotFigure } from "./help-shot"

const UI = {
  back: { en: "Back to Help & Guides", hi: "मदद और गाइड पर वापस" },
  open: { en: "Open this page", hi: "यह पेज खोलें" },
  onPage: { en: "On this page", hi: "इस पेज पर" },
  tips: { en: "Good to know", hi: "ध्यान रखें" },
  faq: { en: "Questions", hi: "सवाल-जवाब" },
  prev: { en: "Previous", hi: "पिछली गाइड" },
  next: { en: "Next", hi: "अगली गाइड" },
}

/** /help/[slug] - one guide, in the reader's language, only the parts they can use. */
export function GuideView({ slug }: { slug: string }) {
  const [lang] = useHelpLang()
  const { permissions, roles, isLoading } = usePermissions()
  const guide = getGuide(slug)

  const visibleGuides = useMemo(
    () => HELP_GUIDES.filter((g) => canSeeGuide(g, permissions, roles)),
    [permissions, roles],
  )

  if (!guide) {
    return (
      <EmptyState
        icon={BookOpen}
        variant="card"
        title={lang === "hi" ? "गाइड नहीं मिली" : "Guide not found"}
        description={
          lang === "hi"
            ? "यह गाइड मौजूद नहीं है या हटा दी गई है।"
            : "This guide doesn't exist or has been moved."
        }
        action={{ label: tr(UI.back, lang), href: "/help" }}
      />
    )
  }

  if (isLoading) return <GuideSkeleton />

  if (!canSeeGuide(guide, permissions, roles)) {
    return (
      <EmptyState
        icon={Lock}
        variant="card"
        title={lang === "hi" ? "यह गाइड आपके लिए नहीं है" : "This guide isn't for your role"}
        description={
          lang === "hi"
            ? "यह उस पेज के बारे में है जो आपके अकाउंट में नहीं खुलता। ज़रूरत हो तो अपने एडमिन से बात करें।"
            : "It explains a page your account can't open. Ask your admin if you need access."
        }
        action={{ label: tr(UI.back, lang), href: "/help" }}
      />
    )
  }

  const sections = guide.sections.filter((s) => canSeeSection(s, permissions, roles))
  const index = visibleGuides.findIndex((g) => g.slug === guide.slug)
  const prev = index > 0 ? visibleGuides[index - 1] : undefined
  const next = index >= 0 ? visibleGuides[index + 1] : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr(guide.title, lang)}
        description={tr(guide.summary, lang)}
        backHref="/help"
        backLabel={tr(UI.back, lang)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <HelpLangSwitch />
            {guide.href && (
              <Button asChild variant="outline">
                <Link href={guide.href} className="gap-1.5">
                  <ExternalLink className="h-4 w-4" />
                  {tr(UI.open, lang)}
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <article className="max-w-3xl min-w-0 space-y-12">
          {sections.map((s, i) => (
            <GuideSectionView key={s.id} section={s} number={i + 1} lang={lang} />
          ))}

          {(prev || next) && (
            <nav className="grid gap-3 border-t pt-6 sm:grid-cols-2">
              {prev ? <PagerLink guide={prev} lang={lang} dir="prev" /> : <span />}
              {next && <PagerLink guide={next} lang={lang} dir="next" />}
            </nav>
          )}
        </article>

        {sections.length > 1 && (
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {tr(UI.onPage, lang)}
              </p>
              <ol className="space-y-1.5 border-l pl-3">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="text-muted-foreground hover:text-foreground block text-sm leading-snug"
                    >
                      {tr(s.title, lang)}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

function GuideSectionView({
  section,
  number,
  lang,
}: {
  section: HelpSection
  number: number
  lang: HelpLang
}) {
  return (
    <section id={section.id} className="scroll-mt-20 space-y-4">
      <h2 className="flex items-baseline gap-2 text-lg font-semibold">
        <span className="text-muted-foreground text-sm tabular-nums">{number}.</span>
        {tr(section.title, lang)}
      </h2>

      {section.intro && (
        <p className="text-muted-foreground text-sm leading-relaxed">{tr(section.intro, lang)}</p>
      )}

      {section.steps && section.steps.length > 0 && (
        <ol className="space-y-5">
          {section.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="bg-foreground text-background mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-3">
                <p className="text-sm leading-relaxed">
                  <StepText text={tr(step.text, lang)} />
                </p>
                {step.shot && (
                  <HelpShotFigure shot={step.shot} alt={tr(step.text, lang)} lang={lang} />
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {section.tips && section.tips.length > 0 && (
        <div className="space-y-2 rounded-sm border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            {tr(UI.tips, lang)}
          </p>
          <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
            {section.tips.map((t, i) => (
              <li key={i}>{tr(t, lang)}</li>
            ))}
          </ul>
        </div>
      )}

      {section.faq && section.faq.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{tr(UI.faq, lang)}</p>
          <div className="divide-y rounded-sm border">
            {section.faq.map((f, i) => (
              <details key={i} className="group px-4 py-3">
                <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">
                  <span className="text-muted-foreground mr-2 inline-block transition-transform group-open:rotate-90">
                    ›
                  </span>
                  {tr(f.q, lang)}
                </summary>
                <p className="text-muted-foreground mt-2 pl-4 text-sm leading-relaxed">
                  {tr(f.a, lang)}
                </p>
              </details>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/** Step text with "(1)", "(2)"... drawn as the same amber markers as the screenshot. */
function StepText({ text }: { text: string }) {
  const parts = text.split(/\((\d{1,2})\)/)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span
            key={i}
            className="mx-0.5 inline-flex h-4 w-4 -translate-y-px items-center justify-center rounded-full bg-amber-400 align-middle text-[10px] font-semibold text-black"
          >
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}

function PagerLink({
  guide,
  lang,
  dir,
}: {
  guide: HelpGuide
  lang: HelpLang
  dir: "prev" | "next"
}) {
  return (
    <Link
      href={`/help/${guide.slug}`}
      className={
        "hover:border-foreground/30 flex flex-col gap-0.5 rounded-sm border p-4 transition-colors " +
        (dir === "next" ? "sm:items-end sm:text-right" : "")
      }
    >
      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        {dir === "prev" && <ArrowLeft className="h-3 w-3" />}
        {tr(dir === "prev" ? UI.prev : UI.next, lang)}
        {dir === "next" && <ArrowRight className="h-3 w-3" />}
      </span>
      <span className="text-sm font-medium">{tr(guide.title, lang)}</span>
    </Link>
  )
}

function GuideSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="aspect-[16/9] w-full" />
      </div>
    </div>
  )
}
