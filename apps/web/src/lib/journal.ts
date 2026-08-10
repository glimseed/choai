// Which journal is open, and how it got there.
//
// The journal text is the source of truth; everything on screen is derived from
// it by the engine. Loading is the expensive step, so it happens once here and
// the screens only run queries.

import { createSignal } from "solid-js"
import { openJournal } from "~/engine/client"
import type { JournalInfo } from "~/engine/protocol"
import { DEMO_JOURNAL } from "./demo"

export interface OpenSource {
  /** Shown in the UI so it is obvious which journal is loaded. */
  label: string
  /** Every file the journal needs, keyed by the path hledger will see. */
  files: Record<string, string>
  /** Which of them to parse; the others are reachable through `include`. */
  entry: string
}

const [info, setInfo] = createSignal<JournalInfo | null>(null)
const [source, setSource] = createSignal<OpenSource | null>(null)
const [loading, setLoading] = createSignal(false)
const [error, setError] = createSignal<string | null>(null)

export { info, source, loading, error }

export async function open(next: OpenSource): Promise<void> {
  setLoading(true)
  setError(null)
  try {
    const loaded = await openJournal(next.files, next.entry)
    setSource(next)
    setInfo(loaded)
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e))
    setInfo(null)
    setSource(null)
  } finally {
    setLoading(false)
  }
}

export function openDemo(): Promise<void> {
  return open({
    label: "demo journal",
    files: { "demo.journal": DEMO_JOURNAL },
    entry: "/demo.journal",
  })
}

/**
 * Open files chosen from disk.
 *
 * All of them are placed in the virtual filesystem, not just the entry, so a
 * journal split across files with `include` works: hledger resolves those names
 * itself against the same directory.
 */
export async function openLocalFiles(fileList: FileList): Promise<void> {
  const files: Record<string, string> = {}
  for (const file of Array.from(fileList)) {
    files[file.name] = await file.text()
  }
  const names = Object.keys(files)
  const entry =
    names.find((n) => /^(main|all)\.(journal|hledger|ledger)$/i.test(n)) ?? names[0]
  await open({
    label: names.length > 1 ? `${entry} (+${names.length - 1} more)` : entry,
    files,
    entry: `/${entry}`,
  })
}
