import { createRoot, createSignal, type Accessor } from "solid-js"

import { openJournal } from "~/hledger/client"
import type { JournalSummary, Trouble } from "~/hledger/wire"
import { createTask } from "~/lib/pending"
import { Err, None, Ok, Some, match, type Option, type Result } from "~/lib/monad"
import { t } from "~/i18n"
import { DEMO_JOURNAL } from "./demo"

/**
 * Which journal is open, and how it got there.
 *
 * The text of a journal is what is true; everything on screen is derived from it
 * by hledger. Opening is the expensive step, so it happens once here and the
 * screens only ask questions afterwards.
 */

export interface Source {
  /** Shown on screen, so it is plain which journal is loaded. */
  readonly label: string
  /** Every file the journal needs, keyed by the path hledger will see. */
  readonly files: Readonly<Record<string, string>>
  /** Which of them to parse; the rest are reached through `include`. */
  readonly entry: string
}

export interface OpenJournal {
  readonly source: Source
  readonly summary: JournalSummary
}

const [opened, setOpened] = createSignal<Option<OpenJournal>>(None)
const [trouble, setTrouble] = createSignal<Option<Trouble>>(None)

/**
 * The journal outlives any one screen, so this state lives at module scope.
 *
 * createTask sets up an effect and a cleanup, and those need an owner; without a
 * root of their own they would be created outside any and never be disposed.
 */
const task = createRoot(() => createTask())

/** The journal in hand, if there is one. */
export const journal: Accessor<Option<OpenJournal>> = opened

/** What went wrong last time opening was attempted, if anything. */
export const openingTrouble: Accessor<Option<Trouble>> = trouble

/** Whether to show that opening is under way; see lib/pending for the timing. */
export const opening: Accessor<boolean> = task.pending

export const open = async (source: Source): Promise<Result<OpenJournal, Trouble>> =>
  match(await attempt(source), {
    Ok: (summary) => remember({ source, summary }),
    Err: forget,
  })

/** Whatever happens below, an answer comes back rather than a rejection. */
const attempt = (source: Source): Promise<Result<JournalSummary, Trouble>> =>
  task
    .run(() => openJournal(source.files, source.entry))
    .catch((cause: unknown) => Err<Trouble, JournalSummary>({ kind: "unreachable", detail: String(cause) }))

const remember = (open: OpenJournal): Result<OpenJournal, Trouble> => {
  setOpened(Some(open))
  setTrouble(None)
  return Ok(open)
}

const forget = (cause: Trouble): Result<OpenJournal, Trouble> => {
  setOpened(None)
  setTrouble(Some(cause))
  return Err(cause)
}

/** Open the journal that ships with the app, so a first visit has something to look at. */
export const openDemo = (): Promise<Result<OpenJournal, Trouble>> =>
  open({
    label: t("welcome.demoLabel"),
    files: { "demo.journal": DEMO_JOURNAL },
    entry: "/demo.journal",
  })

/**
 * Open files chosen from disk.
 *
 * All of them go into the filesystem hledger reads, not only the entry, so a
 * journal split across files with `include` works: hledger resolves those names
 * itself against the same directory.
 */
export const openFiles = async (chosen: FileList): Promise<Result<OpenJournal, Trouble>> => {
  const contents = await Promise.all(
    [...chosen].map(async (file) => [file.name, await file.text()] as const),
  )
  const files = Object.fromEntries(contents)
  const names = contents.map(([name]) => name)
  const entry = names.find(looksLikeAnEntry) ?? names[0] ?? ""
  return open({
    label: names.length > 1 ? `${entry} (+${names.length - 1} more)` : entry,
    files,
    entry: `/${entry}`,
  })
}

/** The conventional names for the file that includes the others. */
const looksLikeAnEntry = (name: string): boolean =>
  /^(main|all)\.(journal|hledger|ledger)$/i.test(name)
