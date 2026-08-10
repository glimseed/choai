import { Err, Ok, type Result } from "~/lib/monad"
import type { Ask, Outgoing } from "./worker"
import type { Answer, JournalSummary, Request, Trouble } from "./wire"

/**
 * Talking to hledger: one worker, one queue of waiting calls, answers as values.
 *
 * Nothing here throws. A call that did not work comes back as `Err(Trouble)`,
 * carrying which case it was, so a screen can say something fitting rather than
 * printing whatever sentence it was handed.
 */

export type Reply<T> = Result<T, Trouble>

interface Waiting {
  readonly settle: (reply: Reply<unknown>) => void
}

const waiting = new Map<number, Waiting>()

const counter = { next: 1 }

const channel: { worker?: Worker } = {}

const connect = (): Worker => {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })
  worker.onmessage = (event: MessageEvent<Outgoing>) => {
    const pending = waiting.get(event.data.id)
    waiting.delete(event.data.id)
    pending?.settle(event.data.ok ? Ok(event.data.value) : Err(event.data.trouble))
  }
  worker.onerror = (event) => abandon({ kind: "unreachable", detail: event.message })
  return worker
}

/**
 * A worker that dies takes every call in flight with it.
 *
 * They are answered rather than left waiting, since a promise that never
 * settles would leave the screen spinning with nothing to explain it.
 */
const abandon = (trouble: Trouble): void => {
  const stranded = [...waiting.values()]
  waiting.clear()
  channel.worker = undefined
  stranded.forEach((pending) => pending.settle(Err(trouble)))
}

/**
 * Nothing leaves here by throwing, including the act of reaching the worker.
 *
 * Starting one can fail on its own, and a rejected promise from this point would
 * be swallowed by whichever caller is not awaiting it, leaving a screen that
 * says nothing at all.
 */
const send = <T>(message: Ask): Promise<Reply<T>> => {
  const id = counter.next++
  try {
    const worker = channel.worker ?? connect()
    channel.worker = worker
    return new Promise<Reply<T>>((settle) => {
      waiting.set(id, { settle: settle as (reply: Reply<unknown>) => void })
      worker.postMessage({ ...message, id })
    })
  } catch (cause) {
    waiting.delete(id)
    return Promise.resolve(Err({ kind: "unreachable", detail: String(cause) }))
  }
}

/**
 * Hand hledger a set of journal files and parse the entry one.
 *
 * Paths are as hledger will see them, so `include` directives between them
 * resolve normally. This is the call that costs; the reports afterwards are
 * cheap.
 */
export const openJournal = (
  files: Readonly<Record<string, string>>,
  entry: string,
): Promise<Reply<JournalSummary>> => send<JournalSummary>({ op: "open", files, entry })

/** Run a report against the journal already open. */
export const ask = <K extends Request["kind"]>(
  request: Extract<Request, { kind: K }>,
): Promise<Reply<Answer[K]>> => send<Answer[K]>({ op: "query", request })
