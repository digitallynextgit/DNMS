import { describe, expect, it } from "vitest"
import {
  MODEL,
  MODEL_SIDE,
  backgroundFill,
  cutoutFileName,
  dividerForKey,
  fitPixels,
  isDownloadProblem,
  maskCoverage,
  maskFromOutput,
  megabytes,
  modelFileUrl,
  modelPlans,
  modelProblem,
  planFile,
  rgbaToModelInput,
  softenMask,
  withinTime,
} from "./background"

describe("modelPlans", () => {
  it("uses the graphics card first, the processor as the fallback", () => {
    expect(modelPlans({ webgpu: true, f16: true })).toEqual([
      { device: "webgpu", dtype: "fp16" },
      { device: "wasm", dtype: "fp16" },
    ])
  })

  it("only uses the processor without WebGPU, or without 16-bit maths", () => {
    expect(modelPlans({ webgpu: false, f16: false })).toEqual([{ device: "wasm", dtype: "fp16" }])
    expect(modelPlans({ webgpu: true, f16: false })).toEqual([{ device: "wasm", dtype: "fp16" }])
  })
})

describe("model files", () => {
  it("uses the same file - and so one download - for both ways of running", () => {
    const file = { path: "onnx/model_fp16.onnx", bytes: 88_141_111 }
    expect(planFile({ device: "webgpu", dtype: "fp16" })).toEqual(file)
    expect(planFile({ device: "wasm", dtype: "fp16" })).toEqual(file)
    expect(modelFileUrl({ device: "webgpu", dtype: "fp16" })).toBe(
      modelFileUrl({ device: "wasm", dtype: "fp16" }),
    )
  })

  it("points at the pinned revision on Hugging Face", () => {
    expect(modelFileUrl({ device: "wasm", dtype: "fp16" })).toBe(
      `https://huggingface.co/Ko033/isnet-general-use-onnx/resolve/${MODEL.revision}/onnx/model_fp16.onnx`,
    )
  })

  it("quotes sizes in decimal megabytes", () => {
    expect(megabytes(88_141_111)).toBe("88 MB")
    expect(megabytes(10)).toBe("1 MB")
  })

  it("looks at photos as a 1024 square", () => {
    expect(MODEL_SIDE).toBe(1024)
  })
})

describe("fitPixels", () => {
  it("leaves photos under the limit alone", () => {
    expect(fitPixels(4032, 3024, 40_000_000)).toEqual({ width: 4032, height: 3024, scaled: false })
  })

  it("shrinks bigger ones to fit, keeping the shape", () => {
    const r = fitPixels(10000, 5000, 16_000_000)
    expect(r.scaled).toBe(true)
    expect(r.width * r.height).toBeLessThanOrEqual(16_000_000)
    expect(r.width / r.height).toBeCloseTo(2, 2)
  })
})

describe("cutoutFileName", () => {
  it("adds -no-background and the new extension", () => {
    expect(cutoutFileName("IMG_1234.HEIC", "png")).toBe("IMG_1234-no-background.png")
    expect(cutoutFileName("team photo.jpg", "jpg")).toBe("team photo-no-background.jpg")
    expect(cutoutFileName("image.png", "png")).toBe("image-no-background.png")
  })

  it("has a name even when the file had none", () => {
    expect(cutoutFileName("", "png")).toBe("image-no-background.png")
  })
})

describe("backgroundFill", () => {
  it("is a flat colour for white and colour, none for see-through and blur", () => {
    expect(backgroundFill({ kind: "white", colour: "#123456" })).toBe("#ffffff")
    expect(backgroundFill({ kind: "colour", colour: "#123456" })).toBe("#123456")
    expect(backgroundFill({ kind: "transparent", colour: "#123456" })).toBeNull()
    expect(backgroundFill({ kind: "blur", colour: "#123456" })).toBeNull()
  })

  it("puts white behind a see-through JPG", () => {
    expect(backgroundFill({ kind: "transparent", colour: "#123456" }, true)).toBe("#ffffff")
  })
})

describe("modelProblem", () => {
  it("spots download problems", () => {
    expect(modelProblem(new TypeError("Failed to fetch"))).toBe("network")
    expect(modelProblem(new TypeError("network error"))).toBe("network")
    expect(modelProblem(new Error("Could not locate file: model.onnx"))).toBe("network")
    expect(modelProblem(new TypeError("Failed to fetch"), false)).toBe("offline")
    expect(modelProblem(new DOMException("over", "QuotaExceededError"))).toBe("storage")
  })

  it("spots graphics card and memory problems", () => {
    expect(
      modelProblem(new Error("Too many storage buffers in shader. Current: 17, Max is 16")),
    ).toBe("gpu")
    expect(modelProblem(new Error("WebGPU validation failed. [Invalid Buffer]"))).toBe("gpu")
    expect(modelProblem(new Error("The graphics card gave an unusable answer"))).toBe("gpu")
    expect(modelProblem(new Error("failed to call OrtRun(). ERROR_MESSAGE: std::bad_alloc"))).toBe(
      "memory",
    )
  })

  it("falls back to other", () => {
    expect(modelProblem(new Error("something odd"))).toBe("other")
    expect(modelProblem("weird")).toBe("other")
  })

  it("knows which problems another way of running the AI won't fix", () => {
    expect(isDownloadProblem("network")).toBe(true)
    expect(isDownloadProblem("offline")).toBe(true)
    expect(isDownloadProblem("storage")).toBe(true)
    expect(isDownloadProblem("gpu")).toBe(false)
    expect(isDownloadProblem("memory")).toBe(false)
  })
})

describe("rgbaToModelInput", () => {
  it("makes red, green and blue planes, normalised", () => {
    // Two pixels: pure red, then white (alpha is ignored).
    const rgba = [255, 0, 0, 255, 255, 255, 255, 0]
    const out = rgbaToModelInput(rgba, 2, 1, { mean: [0.5, 0.5, 0.5], std: [0.5, 0.5, 0.5] })
    expect(Array.from(out)).toEqual([1, 1, -1, 1, -1, 1])
  })

  it("uses the model's own mean and spread", () => {
    const out = rgbaToModelInput([0, 0, 0, 255], 1, 1, MODEL)
    expect(out[0]).toBeCloseTo(-0.5, 5)
    expect(out[2]).toBeCloseTo(-0.5, 5)
  })
})

describe("maskFromOutput", () => {
  it("passes a full-range answer straight through", () => {
    expect(Array.from(maskFromOutput([0, 0.5, 1])!)).toEqual([0, 128, 255])
  })

  it("stretches an answer that doesn't reach the ends, like rembg", () => {
    expect(Array.from(maskFromOutput([0.2, 0.35, 0.8])!)).toEqual([0, 64, 255])
  })

  it("doesn't blow up an answer with hardly any spread", () => {
    expect(Array.from(maskFromOutput([0.1, 0.12, 0.11])!)).toEqual([26, 31, 28])
  })

  it("gives up on an answer that's mostly not-a-number", () => {
    expect(maskFromOutput([NaN, NaN, 0.5])).toBeNull()
    expect(maskFromOutput([])).toBeNull()
  })

  it("treats a stray not-a-number as see-through", () => {
    const values = new Array<number>(1000).fill(1)
    values[0] = 0
    values[3] = NaN
    const mask = maskFromOutput(values)!
    expect(mask[3]).toBe(0)
    expect(mask[4]).toBe(255)
  })
})

describe("withinTime", () => {
  it("passes on the answer when it comes in time", async () => {
    await expect(withinTime(Promise.resolve(7), 1000, "slow")).resolves.toBe(7)
  })

  it("passes on the error when it fails in time", async () => {
    await expect(withinTime(Promise.reject(new Error("broke")), 1000, "slow")).rejects.toThrow(
      "broke",
    )
  })

  it("gives up after the time limit", async () => {
    await expect(withinTime(new Promise(() => {}), 10, "too slow")).rejects.toThrow("too slow")
  })
})

describe("maskCoverage", () => {
  it("is the share of pixels kept", () => {
    expect(maskCoverage(Uint8ClampedArray.from([0, 255, 200, 10]))).toBe(0.5)
    expect(maskCoverage(new Uint8ClampedArray(0))).toBe(0)
  })
})

describe("softenMask", () => {
  const edge = Uint8ClampedArray.from(
    Array.from({ length: 10 * 10 }, (_, i) => (i % 10 < 5 ? 0 : 255)),
  )

  it("feathers a hard edge and leaves flat areas flat", () => {
    const soft = softenMask(edge, 10, 10, 1)
    const row = Array.from(soft.slice(30, 40))
    expect(row[0]).toBe(0)
    expect(row[9]).toBe(255)
    expect(row[4]).toBeGreaterThan(0)
    expect(row[5]).toBeLessThan(255)
    // Still goes up from left to right.
    for (let i = 1; i < 10; i++) expect(row[i]).toBeGreaterThanOrEqual(row[i - 1]!)
  })

  it("doesn't change the mask it was given, and radius 0 is a plain copy", () => {
    const before = edge.slice()
    softenMask(edge, 10, 10, 2)
    expect(edge).toEqual(before)
    expect(softenMask(edge, 10, 10, 0)).toEqual(edge)
  })
})

describe("dividerForKey", () => {
  it("moves with the arrow keys, more with Shift or Page keys", () => {
    expect(dividerForKey("ArrowLeft", 50)).toBe(48)
    expect(dividerForKey("ArrowRight", 50)).toBe(52)
    expect(dividerForKey("ArrowRight", 50, true)).toBe(60)
    expect(dividerForKey("PageDown", 50)).toBe(40)
    expect(dividerForKey("Home", 50)).toBe(0)
    expect(dividerForKey("End", 50)).toBe(100)
  })

  it("stays between 0 and 100, and ignores other keys", () => {
    expect(dividerForKey("ArrowLeft", 1)).toBe(0)
    expect(dividerForKey("PageUp", 95)).toBe(100)
    expect(dividerForKey("a", 50)).toBeNull()
  })
})
