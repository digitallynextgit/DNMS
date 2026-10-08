import type { Metadata } from "next"
import { PdfToolkit } from "@/features/tools"

export const metadata: Metadata = {
  title: "PDF Toolkit",
  description: "Merge, split, reorder and compress PDFs, and convert images to and from PDF.",
}

export default function Page() {
  return <PdfToolkit />
}
