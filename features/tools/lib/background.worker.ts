import type { PreTrainedModel, ProgressInfo } from "@huggingface/transformers"
import {
  MODEL,
  planFile,
  type FromWorker,
  type LoadProgress,
  type ModelPlan,
  type ToWorker,
} from "./background"

// One worker loads one model, then answers "run" messages. transformers.js and ONNX Runtime
// only ever load here, never on the page.

type Transformers = typeof import("@huggingface/transformers")
type AnyTensor = InstanceType<Transformers["Tensor"]>

let model: PreTrainedModel | null = null
let inputName = "input_image"
let transformers: Transformers | null = null

function post(message: FromWorker, transfer: Transferable[] = []) {
  self.postMessage(message, { transfer })
}

function report(progress: LoadProgress) {
  post({ type: "progress", progress })
}

function errorParts(err: unknown): { name: string; message: string } {
  if (err instanceof Error) return { name: err.name, message: err.message }
  return { name: "Error", message: String(err) }
}

self.addEventListener("message", (e: MessageEvent<ToWorker>) => {
  const m = e.data
  if (m.type === "load") {
    load(m.plan, m.stage).then(
      () => post({ type: "ready" }),
      (err: unknown) => post({ type: "error", ...errorParts(err) }),
    )
  } else if (m.type === "run") {
    run(m.pixels, m.width, m.height).then(
      (values) => post({ type: "result", id: m.id, values }, [values.buffer]),
      (err: unknown) => post({ type: "error", id: m.id, ...errorParts(err) }),
    )
  }
})

async function load(plan: ModelPlan, stage: "download" | "cache") {
  const t = await import("@huggingface/transformers")
  transformers = t
  t.env.logLevel = t.LogLevel.ERROR
  // Clearing the path makes ONNX Runtime use the bundled WASM rather than fetching it from jsDelivr.
  const wasm = t.env.backends.onnx.wasm
  if (wasm) wasm.wasmPaths = undefined

  const total = planFile(plan).bytes
  model = await t.AutoModel.from_pretrained(MODEL.id, {
    revision: MODEL.revision,
    device: plan.device,
    dtype: plan.dtype,
    progress_callback: (info: ProgressInfo) => {
      if (info.status === "progress" && info.file.endsWith(".onnx")) {
        report({ stage, loaded: info.loaded, total: info.total || total })
      } else if (info.status === "done" && info.file.endsWith(".onnx")) {
        report({ stage: "start", loaded: 0, total: 0 })
      }
    },
  })
  const sessions = model.sessions as Record<string, { inputNames?: string[] } | undefined>
  inputName = sessions.model?.inputNames?.[0] ?? inputName
}

async function run(pixels: Float32Array, width: number, height: number): Promise<Float32Array> {
  if (!model || !transformers) throw new Error("The AI isn't loaded yet")
  const input = new transformers.Tensor("float32", pixels, [1, 3, height, width])
  try {
    const out = (await model({ [inputName]: input })) as Record<string, AnyTensor>
    const first = Object.values(out)[0]
    if (!first) throw new Error("The AI gave no answer")
    const data = (first.type === "float32" ? first : first.to("float32")).data as Float32Array
    // A copy of its own, so it can be handed to the page without copying again.
    return new Float32Array(data)
  } finally {
    input.dispose()
  }
}
