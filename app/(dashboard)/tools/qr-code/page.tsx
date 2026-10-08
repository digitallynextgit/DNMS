import type { Metadata } from "next"
import { QrCodeGenerator } from "@/features/tools"

export const metadata: Metadata = {
  title: "QR Code Generator",
  description: "Turn a link or text into a QR code, with an optional image in the middle.",
}

export default function QrCodePage() {
  return <QrCodeGenerator />
}
