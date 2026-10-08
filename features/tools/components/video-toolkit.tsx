"use client"

import { useState } from "react"
import { AudioLines, ImagePlay, Minimize2, RefreshCw, Scissors } from "lucide-react"
import { TabsBar, type TabItem } from "@/components/shared/tabs-bar"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { PrivacyNote, ToolPage } from "./tool-page"
import { AudioTab } from "./video/audio-tab"
import { CompressTab } from "./video/compress-tab"
import { ConvertTab } from "./video/convert-tab"
import { GifTab } from "./video/gif-tab"
import { SupportNotice } from "./video/shared"
import { TrimTab } from "./video/trim-tab"

type TabId = "compress" | "trim" | "convert" | "gif" | "audio"

const TABS: readonly (TabItem & { value: TabId })[] = [
  { value: "compress", label: "Compress", icon: Minimize2 },
  { value: "trim", label: "Trim", icon: Scissors },
  { value: "convert", label: "Convert", icon: RefreshCw },
  { value: "gif", label: "Video to GIF", icon: ImagePlay },
  { value: "audio", label: "Extract audio", icon: AudioLines },
]

// Inactive tabs stay mounted (just hidden), so files and settings survive a
// look at another tab - and a long job keeps running while you do.
const PANEL = "mt-0 data-[state=inactive]:hidden"

/** mediabunny (MPL-2.0) + the browser's WebCodecs encoders; gifenc (MIT) for GIFs. Both load on demand. */
export function VideoToolkit() {
  const [tab, setTab] = useState<TabId>("compress")
  return (
    <ToolPage slug="video-toolkit">
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <TabsBar items={TABS} spacing="none" />
        <SupportNotice className="mt-3" />
        <PrivacyNote className="mt-3 mb-4" />
        <TabsContent value="compress" forceMount className={PANEL}>
          <CompressTab />
        </TabsContent>
        <TabsContent value="trim" forceMount className={PANEL}>
          <TrimTab active={tab === "trim"} />
        </TabsContent>
        <TabsContent value="convert" forceMount className={PANEL}>
          <ConvertTab />
        </TabsContent>
        <TabsContent value="gif" forceMount className={PANEL}>
          <GifTab active={tab === "gif"} />
        </TabsContent>
        <TabsContent value="audio" forceMount className={PANEL}>
          <AudioTab />
        </TabsContent>
      </Tabs>
    </ToolPage>
  )
}
