// Main-thread side of the engine. One worker, one request queue, typed replies.

import type { JournalInfo, Request, Responses } from "./protocol"

interface Pending {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
}

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, Pending>()

function ensureWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })
  worker.onmessage = (event: MessageEvent<{ id: number; ok: boolean; data?: unknown; error?: string }>) => {
    const entry = pending.get(event.data.id)
    if (!entry) return
    pending.delete(event.data.id)
    if (event.data.ok) entry.resolve(event.data.data)
    else entry.reject(new Error(event.data.error ?? "engine failed"))
  }
  // A worker that dies takes every in-flight request with it; failing them
  // explicitly beats leaving the UI waiting on promises that never settle.
  worker.onerror = (event) => {
    const error = new Error(`engine worker failed: ${event.message}`)
    for (const entry of pending.values()) entry.reject(error)
    pending.clear()
    worker = null
  }
  return worker
}

function send<T>(message: Record<string, unknown>): Promise<T> {
  const id = nextId++
  const target = ensureWorker()
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject })
    target.postMessage({ ...message, id })
  })
}

/**
 * Hand the engine a set of journal files and parse the entry one.
 *
 * Paths are as hledger will see them, so `include` directives between them
 * resolve normally. This is the expensive call; queries afterwards are cheap.
 */
export function openJournal(files: Record<string, string>, entry: string): Promise<JournalInfo> {
  return send<JournalInfo>({ op: "open", files, entry })
}

/** Run a report against the journal already loaded. */
export function query<K extends Request["kind"]>(
  request: Extract<Request, { kind: K }>,
): Promise<Responses[K]> {
  return send<Responses[K]>({ op: "query", request })
}
