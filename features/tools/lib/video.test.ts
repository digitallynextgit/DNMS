import { describe, expect, it } from "vitest"
import {
  AUDIO_BITRATE,
  BlobAssembler,
  CONTAINER_CODECS,
  ENCODE_HELP,
  FORMAT_HELP,
  MAX_GIF_SECONDS,
  PREFERRED_CODECS,
  audioName,
  chooseCodec,
  codecLabel,
  compressedName,
  convertVideoBitrate,
  convertedName,
  dropMessage,
  estimateBytes,
  estimateGifBytes,
  fitResolution,
  formatBitrate,
  formatDuration,
  formatTime,
  gifDelays,
  gifFrameCount,
  gifFrameTimes,
  gifName,
  gifSize,
  initialRange,
  moveRangeEnd,
  moveRangeStart,
  parseTime,
  planCompressAudio,
  planCompression,
  rangeProblem,
  sourceVideoBitrate,
  tidyRange,
  timeLeftLabel,
  timeTag,
  trimContainer,
  trimmedName,
  videoBitrate,
  videoErrorMessage,
  wavBytes,
} from "./video"

describe("formatTime / formatDuration", () => {
  it("shows minutes, seconds and tenths", () => {
    expect(formatTime(0)).toBe("0:00.0")
    expect(formatTime(12.5)).toBe("0:12.5")
    expect(formatTime(65.04)).toBe("1:05.0")
    expect(formatTime(725)).toBe("12:05.0")
    expect(formatTime(3723.4)).toBe("1:02:03.4")
  })

  it("rounds to the nearest tenth, carrying into the next second", () => {
    expect(formatTime(59.96)).toBe("1:00.0")
    expect(formatTime(-3)).toBe("0:00.0")
    expect(formatTime(Number.NaN)).toBe("0:00.0")
  })

  it("shows lengths in whole seconds", () => {
    expect(formatDuration(31.6)).toBe("0:32")
    expect(formatDuration(245)).toBe("4:05")
    expect(formatDuration(3723)).toBe("1:02:03")
  })
})

describe("parseTime", () => {
  it("reads seconds, m:ss and h:mm:ss", () => {
    expect(parseTime("12")).toBe(12)
    expect(parseTime("12.5")).toBe(12.5)
    expect(parseTime("1:05")).toBe(65)
    expect(parseTime("01:05.3")).toBeCloseTo(65.3)
    expect(parseTime("1:02:03")).toBe(3723)
    expect(parseTime(" 0:12 ")).toBe(12)
  })

  it("takes plain seconds over a minute, and a comma for the decimal point", () => {
    expect(parseTime("90")).toBe(90)
    expect(parseTime("0:12,5")).toBe(12.5)
    expect(parseTime(".5")).toBe(0.5)
  })

  it("round-trips what formatTime shows", () => {
    for (const t of [0, 0.1, 12.5, 59.9, 61.2, 725.3, 3723.4]) {
      expect(parseTime(formatTime(t))).toBeCloseTo(t, 5)
    }
  })

  it("refuses things that aren't times", () => {
    for (const bad of ["", "abc", "-5", "1:75", "1:60:00", "1::2", "1:2:3:4", "1.5:20", "12s"]) {
      expect(parseTime(bad), bad).toBeNull()
    }
  })
})

describe("timeTag", () => {
  it("makes file-name friendly times", () => {
    expect(timeTag(12)).toBe("0m12s")
    expect(timeTag(5)).toBe("0m05s")
    expect(timeTag(75.5)).toBe("1m15.5s")
    expect(timeTag(3723)).toBe("1h02m03s")
  })
})

describe("selection", () => {
  const range = { start: 10, end: 20 }

  it("moves the start, pushing the end along when they'd cross", () => {
    expect(moveRangeStart(range, 5, 60)).toEqual({ start: 5, end: 20 })
    expect(moveRangeStart(range, 25, 60)).toEqual({ start: 25, end: 35 })
    // Pushed past the end of the video: the end stops there.
    expect(moveRangeStart(range, 55, 60)).toEqual({ start: 55, end: 60 })
    expect(moveRangeStart(range, -3, 60)).toEqual({ start: 0, end: 20 })
  })

  it("moves the end, pulling the start back when they'd cross", () => {
    expect(moveRangeEnd(range, 30, 60)).toEqual({ start: 10, end: 30 })
    expect(moveRangeEnd(range, 5, 60)).toEqual({ start: 0, end: 5 })
    expect(moveRangeEnd(range, 99, 60)).toEqual({ start: 10, end: 60 })
  })

  it("keeps a selection within the longest allowed", () => {
    expect(moveRangeEnd(range, 40, 60, 15)).toEqual({ start: 25, end: 40 })
    expect(moveRangeStart({ start: 10, end: 40 }, 12, 60, 15)).toEqual({ start: 12, end: 27 })
  })

  it("starts with the whole video, or its first part", () => {
    expect(initialRange(42)).toEqual({ start: 0, end: 42 })
    expect(initialRange(42, 5)).toEqual({ start: 0, end: 5 })
    expect(initialRange(3, 5)).toEqual({ start: 0, end: 3 })
  })

  it("explains what's wrong with a selection", () => {
    expect(rangeProblem({ start: 0, end: 10 }, 60)).toBeNull()
    expect(rangeProblem({ start: 10, end: 10 }, 60)).toMatch(/after the start/)
    expect(rangeProblem({ start: 0, end: 70 }, 60)).toMatch(/past the end/)
    expect(rangeProblem({ start: 0, end: 20 }, 60, MAX_GIF_SECONDS)).toMatch(/15 seconds or less/)
    expect(rangeProblem({ start: 0, end: 15 }, 60, MAX_GIF_SECONDS)).toBeNull()
  })

  it("rounds to tenths", () => {
    expect(tidyRange({ start: 1.234, end: 5.678 })).toEqual({ start: 1.2, end: 5.7 })
  })
})

describe("fitResolution", () => {
  it("limits the short side, for landscape and for reels", () => {
    expect(fitResolution(1920, 1080, "720")).toEqual({ width: 1280, height: 720 })
    expect(fitResolution(1080, 1920, "720")).toEqual({ width: 720, height: 1280 })
    expect(fitResolution(3840, 2160, "1080")).toEqual({ width: 1920, height: 1080 })
  })

  it("never scales up", () => {
    expect(fitResolution(1280, 720, "1080")).toEqual({ width: 1280, height: 720 })
    expect(fitResolution(640, 360, "original")).toEqual({ width: 640, height: 360 })
  })

  it("always comes out even", () => {
    const out = fitResolution(1440, 1080, "480")
    expect(out).toEqual({ width: 640, height: 480 })
    const odd = fitResolution(853, 479, "original")
    expect(odd.width % 2).toBe(0)
    expect(odd.height % 2).toBe(0)
  })
})

describe("videoBitrate", () => {
  it("gives about 5 Mbps for balanced 1080p30", () => {
    const bps = videoBitrate({ width: 1920, height: 1080, fps: 30, preset: "balanced" })
    expect(bps).toBeGreaterThan(4_500_000)
    expect(bps).toBeLessThan(5_500_000)
  })

  it("goes small < balanced < high", () => {
    const at = (preset: "small" | "balanced" | "high") =>
      videoBitrate({ width: 1280, height: 720, fps: 30, preset })
    expect(at("small")).toBeLessThan(at("balanced"))
    expect(at("balanced")).toBeLessThan(at("high"))
  })

  it("gives 60 fps half as much again as 30, not double", () => {
    const b30 = videoBitrate({ width: 1920, height: 1080, fps: 30, preset: "balanced" })
    const b60 = videoBitrate({ width: 1920, height: 1080, fps: 60, preset: "balanced" })
    expect(b60 / b30).toBeCloseTo(1.5, 1)
  })

  it("stays under an already-small original", () => {
    const bps = videoBitrate({
      width: 1920,
      height: 1080,
      fps: 30,
      preset: "balanced",
      sourceBitrate: 2_000_000,
      sourceWidth: 1920,
      sourceHeight: 1080,
    })
    expect(bps).toBeLessThan(2_000_000)
  })

  it("never drops below a watchable floor", () => {
    expect(videoBitrate({ width: 160, height: 90, fps: 10, preset: "small" })).toBe(200_000)
  })

  it("works out the original's video bitrate from its size", () => {
    // 60 s, 45 MB, 128 kbps sound -> about 6 Mbps of video.
    const bps = sourceVideoBitrate(45_000_000, 60, 128_000)
    expect(bps).toBe(6_000_000 - 128_000)
    expect(sourceVideoBitrate(1000, 0, null)).toBeNull()
  })
})

describe("convertVideoBitrate", () => {
  const hd = { width: 1920, height: 1080, fps: 30 }

  it("keeps about the original's bitrate between similar codecs", () => {
    expect(convertVideoBitrate({ ...hd, sourceBitrate: 4_000_000, from: "avc", to: "avc" })).toBe(
      4_000_000,
    )
  })

  it("gives H.264 more bits than the HEVC it replaces, and VP9 fewer than H.264", () => {
    expect(convertVideoBitrate({ ...hd, sourceBitrate: 5_000_000, from: "hevc", to: "avc" })).toBe(
      7_000_000,
    )
    expect(convertVideoBitrate({ ...hd, sourceBitrate: 4_000_000, from: "avc", to: "vp9" })).toBe(
      3_000_000,
    )
  })

  it("never goes above high quality for the size", () => {
    const ceiling = convertVideoBitrate({
      ...hd,
      sourceBitrate: 50_000_000,
      from: "avc",
      to: "avc",
    })
    expect(ceiling).toBeLessThan(10_000_000)
    expect(convertVideoBitrate({ ...hd, sourceBitrate: null, from: null, to: "avc" })).toBe(ceiling)
  })
})

describe("planCompressAudio", () => {
  it("keeps AAC that isn't much over the target", () => {
    expect(
      planCompressAudio({
        preset: "balanced",
        sourceCodec: "aac",
        sourceBitrate: 128_000,
        canEncodeAac: true,
      }),
    ).toEqual({ action: "copy" })
    expect(
      planCompressAudio({
        preset: "balanced",
        sourceCodec: "aac",
        sourceBitrate: null,
        canEncodeAac: false,
      }),
    ).toEqual({ action: "copy" })
  })

  it("re-makes big or non-AAC sound as AAC", () => {
    expect(
      planCompressAudio({
        preset: "small",
        sourceCodec: "aac",
        sourceBitrate: 256_000,
        canEncodeAac: true,
      }),
    ).toEqual({ action: "encode", bitrate: AUDIO_BITRATE.small })
    expect(
      planCompressAudio({
        preset: "balanced",
        sourceCodec: "pcm-s16",
        sourceBitrate: 1_536_000,
        canEncodeAac: true,
      }),
    ).toEqual({ action: "encode", bitrate: AUDIO_BITRATE.balanced })
  })

  it("leaves it to the converter when AAC can't be made", () => {
    expect(
      planCompressAudio({
        preset: "balanced",
        sourceCodec: "opus",
        sourceBitrate: 96_000,
        canEncodeAac: false,
      }),
    ).toEqual({ action: "auto" })
  })
})

describe("planCompression", () => {
  const phoneVideo = {
    fileBytes: 120 * 1024 * 1024, // 60 s at about 16 Mbps, like an iPhone 1080p
    duration: 60,
    width: 1080,
    height: 1920,
    fps: 30,
    hasAudio: true,
    audioCodec: "aac",
    audioBitrate: 128_000,
    canEncodeAac: true,
  }

  it("shrinks a typical phone video a lot", () => {
    const plan = planCompression({ ...phoneVideo, preset: "balanced", maxResolution: "original" })
    expect(plan.resize).toBe(false)
    expect(plan.audio).toEqual({ action: "copy" })
    expect(plan.estimatedBytes).toBeLessThan(phoneVideo.fileBytes * 0.5)
  })

  it("resizes when asked", () => {
    const plan = planCompression({ ...phoneVideo, preset: "small", maxResolution: "720" })
    expect(plan).toMatchObject({ width: 720, height: 1280, resize: true })
    expect(plan.estimatedBytes).toBeLessThan(15 * 1024 * 1024)
  })

  it("has no sound plan for a silent video", () => {
    const plan = planCompression({
      ...phoneVideo,
      hasAudio: false,
      audioCodec: null,
      audioBitrate: null,
      preset: "balanced",
      maxResolution: "original",
    })
    expect(plan.audio).toBeNull()
  })
})

describe("estimateBytes / formatBitrate", () => {
  it("turns bitrates and length into bytes", () => {
    // 1 Mbps for 8 s = 1 MB, plus a little for the container.
    expect(estimateBytes(1_000_000, 0, 8)).toBe(1_020_000)
  })

  it("shows bitrates simply", () => {
    expect(formatBitrate(5_040_000)).toBe("5.0 Mbps")
    expect(formatBitrate(850_000)).toBe("850 kbps")
  })
})

describe("chooseCodec", () => {
  const mp4Video = (source: string | null, encodable: string[]) =>
    chooseCodec({
      source,
      preferred: PREFERRED_CODECS.mp4.video,
      container: CONTAINER_CODECS.mp4.video,
      encodable,
    })

  it("copies a track that's already what we want", () => {
    expect(mp4Video("avc", ["avc"])).toEqual({ codec: "avc", copy: true })
  })

  it("re-makes iPhone HEVC as H.264 for MP4", () => {
    expect(mp4Video("hevc", ["avc", "hevc"])).toEqual({ codec: "avc", copy: false })
  })

  it("copies the original in when H.264 can't be made but MP4 holds it", () => {
    expect(mp4Video("hevc", [])).toEqual({ codec: "hevc", copy: true })
  })

  it("falls back to whatever the container takes and the browser makes", () => {
    expect(mp4Video("prores", ["vp9"])).toEqual({ codec: "vp9", copy: false })
    expect(mp4Video("prores", [])).toBeNull()
  })

  it("copies any WebM-friendly codec into WebM", () => {
    const webm = (source: string, encodable: string[]) =>
      chooseCodec({
        source,
        preferred: PREFERRED_CODECS.webm.video,
        container: CONTAINER_CODECS.webm.video,
        encodable,
      })
    expect(webm("vp8", ["vp9"])).toEqual({ codec: "vp8", copy: true })
    expect(webm("avc", ["vp9", "vp8"])).toEqual({ codec: "vp9", copy: false })
  })

  it("names codecs the everyday way", () => {
    expect(codecLabel("avc")).toBe("H.264")
    expect(codecLabel("hevc")).toBe("HEVC (H.265)")
    expect(codecLabel("pcm-s16")).toBe("PCM")
    expect(codecLabel(null)).toBe("Unknown")
    expect(codecLabel("xyz")).toBe("XYZ")
  })
})

describe("names and containers", () => {
  it("names each output", () => {
    expect(compressedName("Reel final.MOV")).toBe("Reel final-compressed.mp4")
    expect(trimmedName("ad.mp4", { start: 12, end: 25 }, "mp4")).toBe("ad-trim-0m12s-0m25s.mp4")
    expect(trimmedName("ad.mov", { start: 72.5, end: 80 }, "mov")).toBe("ad-trim-1m12.5s-1m20s.mov")
    expect(gifName("clip.webm")).toBe("clip.gif")
    expect(audioName("interview.mp4", "m4a")).toBe("interview-audio.m4a")
    expect(audioName("interview.mp4", "wav")).toBe("interview-audio.wav")
  })

  it("adds -converted only when the type doesn't change", () => {
    expect(convertedName("IMG_0042.MOV", "mp4")).toBe("IMG_0042.mp4")
    expect(convertedName("screen.webm", "mp4")).toBe("screen.mp4")
    expect(convertedName("clip.mp4", "mp4")).toBe("clip-converted.mp4")
    expect(convertedName("clip.m4v", "mp4")).toBe("clip-converted.mp4")
    expect(convertedName("clip.webm", "webm")).toBe("clip-converted.webm")
  })

  it("trims MOV to MOV, WebM to WebM and everything else to MP4", () => {
    expect(trimContainer("video/quicktime", "a.mp4")).toBe("mov")
    expect(trimContainer("video/webm", "a.webm")).toBe("webm")
    expect(trimContainer("video/x-matroska", "a.mkv")).toBe("mp4")
    expect(trimContainer("video/mp4", "a.mov")).toBe("mp4")
    expect(trimContainer(null, "a.MOV")).toBe("mov")
  })
})

describe("GIF maths", () => {
  it("sizes frames by width, never bigger than the video", () => {
    expect(gifSize(480, 1920, 1080)).toEqual({ width: 480, height: 270 })
    expect(gifSize(480, 1080, 1920)).toEqual({ width: 480, height: 853 })
    expect(gifSize(640, 320, 240)).toEqual({ width: 320, height: 240 })
  })

  it("counts and places frames", () => {
    expect(gifFrameCount(5, 10)).toBe(50)
    expect(gifFrameCount(0.01, 8)).toBe(1)
    const times = gifFrameTimes({ start: 2, end: 3 }, 8)
    expect(times).toHaveLength(8)
    expect(times[0]).toBe(2)
    expect(times[7]).toBeCloseTo(2.875)
  })

  it("keeps the GIF exactly as long as the clip", () => {
    for (const fps of [8, 10, 15]) {
      const count = gifFrameCount(10, fps)
      const delays = gifDelays(count, fps)
      expect(delays.reduce((a, b) => a + b, 0)).toBe(10_000)
      for (const d of delays) expect(d % 10).toBe(0)
    }
    expect(gifDelays(3, 15)).toEqual([70, 60, 70])
  })

  it("guesses sizes that grow with pixels and frames", () => {
    const small = estimateGifBytes(320, 180, 50)
    const big = estimateGifBytes(640, 360, 150)
    expect(big).toBeGreaterThan(small * 10)
    expect(small).toBeGreaterThan(500_000)
  })

  it("sizes a WAV", () => {
    // A minute of 48 kHz stereo 16-bit is about 11 MB.
    expect(wavBytes(60, 48000, 2)).toBe(44 + 60 * 48000 * 4)
  })
})

describe("timeLeftLabel", () => {
  it("waits until there's enough to go on", () => {
    expect(timeLeftLabel(1000, 0.5)).toBeNull()
    expect(timeLeftLabel(10_000, 0.01)).toBeNull()
    expect(timeLeftLabel(10_000, 1)).toBeNull()
  })

  it("says roughly how long is left", () => {
    expect(timeLeftLabel(10_000, 0.5)).toBe("Less than a minute left")
    expect(timeLeftLabel(60_000, 0.25)).toBe("About 3 min left")
    expect(timeLeftLabel(30 * 60_000, 0.25)).toBe("About 1 h 30 min left")
  })
})

describe("errors", () => {
  it("explains unreadable formats", () => {
    const err = new Error("Input has an unsupported or unrecognizable format.")
    err.name = "UnsupportedInputFormatError"
    expect(videoErrorMessage(err)).toBe(FORMAT_HELP)
    expect(videoErrorMessage(new Error("Decoding error: something"))).toBe(FORMAT_HELP)
  })

  it("explains running out of memory", () => {
    expect(videoErrorMessage(new RangeError("Array buffer allocation failed"))).toMatch(/memory/)
  })

  it("explains encoders the browser lacks", () => {
    const err = new Error("Unsupported configuration")
    err.name = "NotSupportedError"
    expect(videoErrorMessage(err)).toBe(ENCODE_HELP)
  })

  it("has a fallback", () => {
    expect(videoErrorMessage("weird")).toMatch(/Something went wrong/)
  })

  it("says why a track was left out", () => {
    expect(dropMessage("video", "undecodable_source_codec")).toBe(FORMAT_HELP)
    expect(dropMessage("video", "no_encodable_target_codec")).toBe(ENCODE_HELP)
    expect(dropMessage("audio", "unknown_source_codec")).toMatch(/can't read/)
    expect(dropMessage("audio", "no_encodable_target_codec")).toMatch(/left out/)
  })
})

describe("BlobAssembler", () => {
  async function bytesOf(asm: BlobAssembler): Promise<number[]> {
    return Array.from(new Uint8Array(await asm.toBlob("application/octet-stream").arrayBuffer()))
  }

  it("joins appended pieces", async () => {
    const asm = new BlobAssembler()
    asm.write(0, new Uint8Array([1, 2, 3]))
    asm.write(3, new Uint8Array([4, 5]))
    expect(asm.size).toBe(5)
    expect(await bytesOf(asm)).toEqual([1, 2, 3, 4, 5])
  })

  it("patches bytes already written, across piece boundaries", async () => {
    const asm = new BlobAssembler()
    asm.write(0, new Uint8Array([1, 2, 3, 4]))
    asm.write(4, new Uint8Array([5, 6, 7, 8]))
    asm.write(2, new Uint8Array([30, 40, 50, 60])) // spans both pieces
    asm.write(0, new Uint8Array([10])) // a header filled in at the end
    expect(await bytesOf(asm)).toEqual([10, 2, 30, 40, 50, 60, 7, 8])
    expect(asm.size).toBe(8)
  })

  it("patches and extends in one write", async () => {
    const asm = new BlobAssembler()
    asm.write(0, new Uint8Array([1, 2, 3]))
    asm.write(2, new Uint8Array([9, 9, 9]))
    expect(await bytesOf(asm)).toEqual([1, 2, 9, 9, 9])
  })

  it("fills a gap with zeros", async () => {
    const asm = new BlobAssembler()
    asm.write(0, new Uint8Array([1]))
    asm.write(3, new Uint8Array([4]))
    expect(await bytesOf(asm)).toEqual([1, 0, 0, 4])
  })

  it("copies the data it's given (the writer reuses its buffers)", async () => {
    const asm = new BlobAssembler()
    const buf = new Uint8Array([1, 2, 3])
    asm.write(0, buf.subarray(1))
    buf.fill(0)
    expect(await bytesOf(asm)).toEqual([2, 3])
  })

  it("keeps the type", () => {
    const asm = new BlobAssembler()
    asm.write(0, new Uint8Array([1]))
    expect(asm.toBlob("video/mp4").type).toBe("video/mp4")
  })
})
