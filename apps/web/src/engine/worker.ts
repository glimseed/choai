/// <reference lib="webworker" />
//
// The hledger engine runs here rather than on the main thread. Loading a
// journal of a thousand transactions costs about 290 ms, and compiling the ~7 MB
// module costs more; both would be visible as a frozen page. Queries afterwards
// are 10-25 ms, so the worker also keeps the instance alive between them — the
// parsed journal lives in its wasm memory and is not re-read per screen.

import { WASI, File, OpenFile, PreopenDirectory, ConsoleStdout } from "@bjorn3/browser_wasi_shim"
import ghcJsffi from "./ghc-jsffi.mjs"
import type { Request } from "./protocol"

interface EngineExports {
  hs_init(argc: number, argv: number): void
  hledgerLoad(path: string): Promise<string>
  hledgerQuery(request: string): Promise<string>
}

type Incoming =
  | { id: number; op: "open"; files: Record<string, string>; entry: string }
  | { id: number; op: "query"; request: Request }

const DIRECTORY = new Map<string, File>()
let engine: EngineExports | null = null

/**
 * hledger reads journals from the filesystem, so the host puts them into one.
 *
 * This is not a workaround for the sake of it: hledger's Text entry point builds
 * its handle with createPipe, which WASI does not implement. Going through a
 * filesystem also means `include` directives resolve themselves, because hledger
 * does that lookup against this same directory.
 */
async function start(): Promise<EngineExports> {
  const wasi = new WASI(
    [],
    [],
    [
      new OpenFile(new File([])),
      ConsoleStdout.lineBuffered((line) => console.log("[engine]", line)),
      ConsoleStdout.lineBuffered((line) => console.warn("[engine]", line)),
      new PreopenDirectory("/", DIRECTORY),
    ],
  )

  const url = `${import.meta.env.BASE_URL}engine.wasm`
  const module = await WebAssembly.compileStreaming(fetch(url))

  // The JSFFI glue needs the instance's exports, and the instance needs the
  // glue, so the knot is tied through a shared object filled in afterwards.
  const exportsRef: Record<string, unknown> = {}
  const instance = await WebAssembly.instantiate(module, {
    wasi_snapshot_preview1: wasi.wasiImport,
    ghc_wasm_jsffi: ghcJsffi(exportsRef),
  })
  Object.assign(exportsRef, instance.exports)
  wasi.initialize(instance as never)

  const exports = instance.exports as unknown as EngineExports
  // _initialize does not start the Haskell runtime. Without this the first call
  // into Haskell aborts the instance with "RTS is not initialised".
  if (typeof exports.hs_init !== "function") {
    throw new Error("engine.wasm was linked without --export=hs_init")
  }
  exports.hs_init(0, 0)
  return exports
}

/** Unwrap the engine's {ok, data} envelope, turning failures into exceptions. */
function unwrap(raw: string): unknown {
  const parsed = JSON.parse(raw) as { ok: boolean; data?: unknown; error?: string }
  if (!parsed.ok) throw new Error(parsed.error ?? "engine reported failure")
  return parsed.data
}

self.onmessage = async (event: MessageEvent<Incoming>) => {
  const message = event.data
  try {
    if (!engine) engine = await start()

    if (message.op === "open") {
      // Replacing the directory contents in place keeps the instance, and with
      // it the compiled module, alive across journal changes.
      DIRECTORY.clear()
      const encoder = new TextEncoder()
      for (const [name, contents] of Object.entries(message.files)) {
        DIRECTORY.set(name, new File(encoder.encode(contents)))
      }
      const data = unwrap(await engine.hledgerLoad(message.entry))
      self.postMessage({ id: message.id, ok: true, data })
    } else {
      const data = unwrap(await engine.hledgerQuery(JSON.stringify(message.request)))
      self.postMessage({ id: message.id, ok: true, data })
    }
  } catch (error) {
    self.postMessage({
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
