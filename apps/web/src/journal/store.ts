import { createRoot, createSignal, type Accessor } from "solid-js"

import { openJournal } from "~/hledger/client"
import type { JournalSummary, Trouble } from "~/hledger/wire"
import { createTask } from "~/lib/pending"
import { Err, None, Ok, Some, getOrUndefined, match, type Option, type Result } from "~/lib/monad"
import { t } from "~/i18n"
import { demoJournal } from "./demo"
import { forget as forgetKept, keep, lastOpened } from "./kept"

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
  void keepOnThisDevice(open.source)
  return Ok(open)
}

/**
 * Kept only once hledger has read it.
 *
 * Whatever fails to read is put back by whoever tried it, and putting it back
 * ends in another open, so the copy on the device is always one hledger has
 * accepted. Failing to keep it is not worth interrupting anyone over — the
 * journal in hand still works, and the next open tries again — so it is caught
 * here and goes no further.
 */
const keepOnThisDevice = async (source: Source): Promise<void> => {
  const now = Date.now()
  const files = Object.entries(source.files).map(([path, text]) => ({ path, text, updatedAt: now }))
  try {
    await keep({ label: source.label, entry: source.entry, files })
  } catch {
    // A private window, or a refused quota, and neither is worth a word.
  }
}

const forget = (cause: Trouble): Result<OpenJournal, Trouble> => {
  setOpened(None)
  setTrouble(Some(cause))
  return Err(cause)
}

const [settled, setSettled] = createSignal(false)

/**
 * Whether the journal left open last time is still on its way back.
 *
 * Between the first paint and hledger having read it there is nothing to show,
 * and "no journal open" would be a lie for that second or two.
 */
export const settling = (): boolean => !settled()

/**
 * Reopen whatever was left open on this device.
 *
 * Called once, when the app starts. Anything already open wins: a journal
 * chosen by hand is more recent than one remembered.
 */
export const reopenKept = async (): Promise<void> => {
  try {
    if (getOrUndefined(opened()) !== undefined) return
    const kept = await lastOpened()
    if (kept === undefined) return
    const files = Object.fromEntries(kept.files.map((file) => [file.path, file.text]))
    await open({ label: kept.label, files, entry: kept.entry })
  } catch {
    // Nothing to reopen is the same as nothing kept.
  } finally {
    setSettled(true)
  }
}

/** Put the books away: closed here, and cleared from this device. */
export const closeJournal = async (): Promise<void> => {
  setOpened(None)
  setTrouble(None)
  await forgetKept()
}

/**
 * Add text to the end of the open journal.
 *
 * Written by trying it: the new contents are handed to hledger, and if they will
 * not read, the journal goes back to exactly what it was and the reason is
 * returned. A draft that does not balance must not cost anyone the books they
 * had open.
 */
export const appendToEntry = async (text: string): Promise<Result<OpenJournal, Trouble>> => {
  const current = getOrUndefined(opened())
  if (current === undefined) return Err({ kind: "no-journal" })

  const name = entryName(current.source)
  const before = current.source.files[name] ?? ""
  const after = { ...current.source, files: { ...current.source.files, [name]: text } }

  const result = await open(after)
  if (result.ok) return result

  await open({ ...current.source, files: { ...current.source.files, [name]: before } })
  setTrouble(Some(result.error))
  return result
}

/** The entry path as hledger sees it, back to the key the files are held under. */
const entryName = (source: Source): string => source.entry.replace(/^\//, "")

/** The text of the file new entries are added to. */
export const entryText = (): string | undefined => {
  const current = getOrUndefined(opened())
  return current === undefined ? undefined : current.source.files[entryName(current.source)]
}

/** Open the journal that ships with the app, so a first visit has something to look at. */
export const openDemo = (): Promise<Result<OpenJournal, Trouble>> => {
  const demo = demoJournal()
  return open({
    label: t("welcome.demoLabel"),
    files: { [demo.filename]: demo.contents },
    entry: `/${demo.filename}`,
  })
}

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
