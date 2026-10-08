"use client"

import { useState } from "react"
import { Combine, FileImage, Images, LayoutGrid, Minimize2, Scissors } from "lucide-react"
import { TabsBar, type TabItem } from "@/components/shared/tabs-bar"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { PrivacyNote, ToolPage } from "./tool-page"
import { CompressTab } from "./pdf/compress-tab"
import { ImagesToPdfTab } from "./pdf/images-to-pdf-tab"
import { MergeTab } from "./pdf/merge-tab"
import { OrganiseTab } from "./pdf/organise-tab"
import { PdfToImagesTab } from "./pdf/pdf-to-images-tab"
import { SplitTab } from "./pdf/split-tab"

type TabId = "merge" | "split" | "organise" | "compress" | "images-to-pdf" | "pdf-to-images"

const TABS: readonly (TabItem & { value: TabId })[] = [
  { value: "merge", label: "Merge", icon: Combine },
  { value: "split", label: "Split", icon: Scissors },
  { value: "organise", label: "Organise pages", icon: LayoutGrid },
  { value: "compress", label: "Compress", icon: Minimize2 },
  { value: "images-to-pdf", label: "Images to PDF", icon: FileImage },
  { value: "pdf-to-images", label: "PDF to images", icon: Images },
]

// Inactive tabs stay mounted (just hidden), so files and settings survive a
// look at another tab - and a long job keeps running while you do.
const PANEL = "mt-0 data-[state=inactive]:hidden"

export function PdfToolkit() {
  const [tab, setTab] = useState<TabId>("merge")
  return (
    <ToolPage slug="pdf-toolkit">
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <TabsBar items={TABS} spacing="none" />
        <PrivacyNote className="mt-3 mb-4" />
        <TabsContent value="merge" forceMount className={PANEL}>
          <MergeTab />
        </TabsContent>
        <TabsContent value="split" forceMount className={PANEL}>
          <SplitTab />
        </TabsContent>
        <TabsContent value="organise" forceMount className={PANEL}>
          <OrganiseTab />
        </TabsContent>
        <TabsContent value="compress" forceMount className={PANEL}>
          <CompressTab />
        </TabsContent>
        <TabsContent value="images-to-pdf" forceMount className={PANEL}>
          <ImagesToPdfTab active={tab === "images-to-pdf"} />
        </TabsContent>
        <TabsContent value="pdf-to-images" forceMount className={PANEL}>
          <PdfToImagesTab />
        </TabsContent>
      </Tabs>
    </ToolPage>
  )
}
