/**
 * The one database this app has, and the only place its shape is written down.
 *
 * IndexedDB versions the whole database rather than a store at a time, so every
 * store has to be declared together — hence one module rather than each keeping
 * its own. Depends on nothing but the browser.
 */

const DB = "hledger-pwa"

/**
 * Raised on every added store. Existing databases are upgraded in place; the
 * stores already there are left alone.
 */
const VERSION = 2

/** The stores, by the name they are opened with. */
export const STORE = {
  /** One record per journal file: `{ path, text, updatedAt }`. */
  files: "files",
  /** Which journal is open: a single record under a known key. */
  state: "state",
  /** What syncing knows: where a file came from, and at which sha. */
  remote: "remote",
} as const

export type StoreName = (typeof STORE)[keyof typeof STORE]

const connect = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE.files)) db.createObjectStore(STORE.files, { keyPath: "path" })
      if (!db.objectStoreNames.contains(STORE.state)) db.createObjectStore(STORE.state, { keyPath: "id" })
      if (!db.objectStoreNames.contains(STORE.remote)) db.createObjectStore(STORE.remote, { keyPath: "id" })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("indexedDB refused to open"))
  })

/**
 * Do some work in one transaction, and wait for the transaction rather than for
 * the requests inside it — a request that has answered is not yet a change that
 * has been written.
 */
export const within = async <T>(
  mode: IDBTransactionMode,
  stores: readonly StoreName[],
  work: (transaction: IDBTransaction) => T,
): Promise<T> => {
  const db = await connect()
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

/** The rows a getAll asked for, or none. */
export const rowsOf = <T>(request: IDBRequest<T[]>): T[] => request.result ?? []
