/**
 * Where the books are between visits.
 *
 * A phone closes tabs whenever it likes, so a journal that only lived in memory
 * would have to be picked from the filesystem every time — and on iOS there is
 * no handle to a chosen file that can be kept. So the text itself is kept, one
 * record per file, keyed by the path hledger sees.
 *
 * What is stored is text, not a parsed model. The file is what is true: comments,
 * the order entries were written in, and directives all live in it, and rebuilding
 * it from a model would quietly lose them. A record is a path and its contents,
 * which is also what GitHub's contents API takes, so the same rows serve as the
 * working copy for syncing. What that sync knows — which sha each path was last
 * agreed at — is its own business and is kept by it, not here.
 */

import { STORE, rowsOf, within } from "~/lib/idb"

/** One file of a journal, as it stands here. */
export interface KeptFile {
  readonly path: string
  readonly text: string
  readonly updatedAt: number
}

/** Which journal to reopen, and what to call it. */
export interface KeptJournal {
  readonly label: string
  readonly entry: string
  readonly files: readonly KeptFile[]
}

const FILES = STORE.files
const STATE = STORE.state
const OPEN = "open"

/** What is remembered besides the files themselves. */
interface OpenState {
  readonly id: typeof OPEN
  readonly label: string
  readonly entry: string
}

/**
 * Ask that this not be thrown away.
 *
 * Browsers clear storage for sites they consider disposable — Safari after a
 * week of not being opened — and these are someone's books. Granted or refused,
 * the answer changes nothing here, so it is not waited on; installing the app or
 * syncing to GitHub is what makes it certain.
 */
export const askToKeep = (): void => {
  void navigator.storage?.persist?.()
}

/** Whether the browser has promised not to clear this away. */
export const keptForGood = async (): Promise<boolean> => (await navigator.storage?.persisted?.()) ?? false

/** The journal to reopen, if one was left open. */
export const lastOpened = async (): Promise<KeptJournal | undefined> => {
  const [state, files] = await within("readonly", [STATE, FILES], (transaction) => {
    const state = transaction.objectStore(STATE).get(OPEN) as IDBRequest<OpenState | undefined>
    const files = transaction.objectStore(FILES).getAll() as IDBRequest<KeptFile[]>
    return [state, files] as const
  })
  if (state.result === undefined || rowsOf(files).length === 0) return undefined
  return { label: state.result.label, entry: state.result.entry, files: rowsOf(files) }
}

/**
 * Keep a journal, replacing whatever was kept before.
 *
 * Everything goes in one transaction so that a journal is never half replaced:
 * the files of two different journals together would not read.
 */
export const keep = async (journal: KeptJournal): Promise<void> => {
  askToKeep()
  await within("readwrite", [STATE, FILES], (transaction) => {
    const files = transaction.objectStore(FILES)
    files.clear()
    for (const file of journal.files) files.put(file)
    transaction.objectStore(STATE).put({ id: OPEN, label: journal.label, entry: journal.entry })
  })
}

/** Forget the journal, so the next visit starts at the welcome screen. */
export const forget = async (): Promise<void> => {
  await within("readwrite", [STATE, FILES], (transaction) => {
    transaction.objectStore(FILES).clear()
    transaction.objectStore(STATE).delete(OPEN)
  })
}
