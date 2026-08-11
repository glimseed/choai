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

const DB = "hledger-pwa"
const VERSION = 1
const FILES = "files"
const STATE = "state"
const OPEN = "open"

/** What is remembered besides the files themselves. */
interface OpenState {
  readonly id: typeof OPEN
  readonly label: string
  readonly entry: string
}

const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES, { keyPath: "path" })
      if (!db.objectStoreNames.contains(STATE)) db.createObjectStore(STATE, { keyPath: "id" })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("indexedDB refused to open"))
  })

/** One transaction, awaited to its end rather than to the last request. */
const within = async <T>(
  mode: IDBTransactionMode,
  stores: readonly string[],
  work: (transaction: IDBTransaction) => T,
): Promise<T> => {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction([...stores], mode)
      const result = work(transaction)
      transaction.oncomplete = () => resolve(result)
      transaction.onerror = () => reject(transaction.error ?? new Error("transaction failed"))
      transaction.onabort = () => reject(transaction.error ?? new Error("transaction aborted"))
    })
  } finally {
    db.close()
  }
}

const asArray = <T>(request: IDBRequest<T[]>): T[] => request.result ?? []

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
  if (state.result === undefined || asArray(files).length === 0) return undefined
  return { label: state.result.label, entry: state.result.entry, files: asArray(files) }
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
