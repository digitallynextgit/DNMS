import { ImageResponse } from "next/og"
import { siteConfig } from "@/config/site"

// Branded social-share card (LinkedIn / Slack / X / WhatsApp previews). Rendered
// once at build/first-request; self-contained with inline styles and the default
// font so it needs no external assets.
export const alt = siteConfig.defaultTitle
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background: "linear-gradient(135deg, #0b0b0f 0%, #17171d 60%, #241016 100%)",
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          color: "#f87171",
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: "0.06em",
        }}
      >
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "#ef4444" }} />
        {siteConfig.name}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 40,
          fontSize: 76,
          fontWeight: 800,
          lineHeight: 1.05,
          maxWidth: 960,
        }}
      >
        Run your entire company on one platform
      </div>
      <div
        style={{ display: "flex", marginTop: 32, fontSize: 30, color: "#a1a1aa", maxWidth: 900 }}
      >
        HR · Attendance · Leave · Payroll · Projects · Recruitment · Client Portal · SEO
      </div>
      <div style={{ display: "flex", marginTop: 48, fontSize: 24, color: "#71717a" }}>
        {siteConfig.fullName}
      </div>
    </div>,
    { ...size },
  )
}
