import { StoragePicker } from "@/features/storage"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Storage" }

export default function StoragePage() {
  return <StoragePicker />
}
