import { describe, expect, it } from "vitest"
import {
  SOCIAL_NETWORKS,
  SOCIAL_PRESETS,
  aspectLabel,
  containRect,
  coverRect,
  cropRect,
  enlargement,
  getPreset,
  moveCrop,
  parseSide,
  presetsFor,
  socialFileName,
} from "./social-sizes"

describe("presets", () => {
  it("have the standard sizes", () => {
    const size = (id: string) => {
      const p = getPreset(id)
      return p ? `${p.width}x${p.height}` : null
    }
    expect(size("instagram-post")).toBe("1080x1080")
    expect(size("instagram-portrait")).toBe("1080x1350")
    expect(size("instagram-story")).toBe("1080x1920")
    expect(size("facebook-post")).toBe("1200x630")
    expect(size("facebook-cover")).toBe("1640x624")
    expect(size("linkedin-post")).toBe("1200x627")
    expect(size("linkedin-banner")).toBe("1584x396")
    expect(size("linkedin-company-cover")).toBe("1128x191")
    expect(size("x-post")).toBe("1600x900")
    expect(size("x-header")).toBe("1500x500")
    expect(size("youtube-thumbnail")).toBe("1280x720")
    expect(size("youtube-banner")).toBe("2560x1440")
    expect(size("whatsapp-status")).toBe("1080x1920")
    expect(size("og-image")).toBe("1200x630")
  })

  it("all belong to a listed network, with unique ids and safe areas that fit", () => {
    const ids = new Set(SOCIAL_PRESETS.map((p) => p.id))
    expect(ids.size).toBe(SOCIAL_PRESETS.length)
    for (const n of SOCIAL_NETWORKS) expect(presetsFor(n.id).length).toBeGreaterThan(0)
    for (const p of SOCIAL_PRESETS) {
      if (!p.safe) continue
      expect(p.safe.width).toBeLessThanOrEqual(p.width)
      expect(p.safe.height).toBeLessThanOrEqual(p.height)
    }
  })
})

describe("aspectLabel", () => {
  it("gives simple ratios, or a decimal when they get unwieldy", () => {
    expect(aspectLabel(1080, 1080)).toBe("1:1")
    expect(aspectLabel(1080, 1350)).toBe("4:5")
    expect(aspectLabel(1080, 1920)).toBe("9:16")
    expect(aspectLabel(2560, 1440)).toBe("16:9")
    expect(aspectLabel(1200, 627)).toBe("1.91:1")
    expect(aspectLabel(1584, 396)).toBe("4:1")
  })
})

describe("parseSide", () => {
  it("takes whole numbers in range only", () => {
    expect(parseSide("1080")).toBe(1080)
    expect(parseSide(" 500 ")).toBe(500)
    expect(parseSide("10")).toBeNull()
    expect(parseSide("5000")).toBeNull()
    expect(parseSide("12.5")).toBeNull()
    expect(parseSide("")).toBeNull()
  })
})

describe("socialFileName", () => {
  it("names the file after the photo, the preset and the size", () => {
    expect(socialFileName("photo.jpg", "instagram-post", 1080, 1080, "jpg")).toBe(
      "photo-instagram-post-1080x1080.jpg",
    )
    expect(socialFileName("My Team (2).PNG", "x-header", 1500, 500, ".webp")).toBe(
      "my-team-2-x-header-1500x500.webp",
    )
    expect(socialFileName("!!!.png", "custom", 800, 600, "png")).toBe("image-custom-800x600.png")
  })
})

describe("cropRect", () => {
  it("takes the biggest frame of the right shape at zoom 1, centred", () => {
    // A 4000 x 3000 landscape photo cropped square: the full height.
    expect(cropRect(4000, 3000, 1080, 1080, 1, { x: 0.5, y: 0.5 })).toEqual({
      x: 500,
      y: 0,
      w: 3000,
      h: 3000,
    })
    // The same photo cropped wide (3:1): the full width.
    expect(cropRect(4000, 3000, 1500, 500, 1, { x: 0.5, y: 0.5 })).toEqual({
      x: 0,
      y: 1500 - 4000 / 6,
      w: 4000,
      h: 4000 / 3,
    })
  })

  it("shrinks the frame when zoomed in, and keeps it inside the image", () => {
    const r = cropRect(4000, 3000, 1080, 1080, 2, { x: 0, y: 1 })
    expect(r).toEqual({ x: 0, y: 1500, w: 1500, h: 1500 })
  })
})

describe("moveCrop", () => {
  it("moves the frame and stops at the edges", () => {
    const c = moveCrop(4000, 3000, 1080, 1080, 1, { x: 0.5, y: 0.5 }, 200, 0)
    expect(c.x).toBeCloseTo((700 + 1500) / 4000)
    const far = moveCrop(4000, 3000, 1080, 1080, 1, { x: 0.5, y: 0.5 }, 99999, 99999)
    expect(far.x).toBeCloseTo((1000 + 1500) / 4000)
    expect(far.y).toBeCloseTo(0.5)
  })
})

describe("containRect / coverRect", () => {
  it("fits the whole picture, or fills the box", () => {
    expect(containRect(2000, 1000, 1000, 1000)).toEqual({ x: 0, y: 250, w: 1000, h: 500 })
    expect(coverRect(2000, 1000, 1000, 1000)).toEqual({ x: -500, y: 0, w: 2000, h: 1000 })
  })
})

describe("enlargement", () => {
  it("says when a small photo would be stretched", () => {
    expect(enlargement("crop", 540, 540, 1080, 1080, 1)).toBeCloseTo(2)
    expect(enlargement("crop", 4000, 3000, 1080, 1080, 1)).toBeLessThan(1)
    expect(enlargement("fit", 1000, 500, 2000, 2000, 1)).toBeCloseTo(2)
  })
})
