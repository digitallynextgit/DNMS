import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { GuideView, getGuide } from "@/features/help"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = getGuide((await params).slug)
  return guide ? { title: `${guide.title.en} - Help`, description: guide.summary.en } : {}
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params
  if (!getGuide(slug)) notFound()
  return <GuideView slug={slug} />
}
