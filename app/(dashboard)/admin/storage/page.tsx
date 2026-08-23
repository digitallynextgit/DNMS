import { StoragePicker } from "@/features/storage"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Storage",
  description: "Configure and monitor file storage connections and usage.",
}

export default function StoragePage() {
  return <StoragePicker />
}
