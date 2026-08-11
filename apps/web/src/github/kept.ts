/**
 * What syncing remembers between visits: where the books live, what may open
 * them, and what each file looked like when the two sides last agreed.
 *
 * The token is kept in this browser and sent to api.github.com and nowhere else.
 * It is here rather than in localStorage for one reason only — everything else
 * this app keeps is here — and it is cleared by disconnecting.
 *
 * `baseText` is the copy the two sides last agreed on. Keeping it is what turns
 * a rejected push into something that can be settled: with the common ancestor
 * in hand, entries added here can be laid over entries added elsewhere instead
 * of one side being told to give way.
 */

import { STORE, rowsOf, within } from "~/lib/idb"

/** Where a journal lives, and what may reach it. */
export interface Connection {
  readonly owner: string
  readonly repo: string
  /** Empty means the repository's default branch. */
  readonly branch: string
  /** Path of the entry file in the repository, eg `books/main.journal`. */
  readonly path: string
  /** A fine-grained personal access token with Contents: read and write. */
  readonly token: string
}

/** What the two sides last agreed on, for one file. */
export interface Agreed {
  readonly path: string
  readonly repoPath: string
  readonly sha: string
  readonly baseText: string
  readonly at: number
}

const REMOTE = STORE.remote
const CONNECTION = "connection"

interface Row {
  readonly id: string
  readonly connection?: Connection
  readonly agreed?: Agreed
}

const keyOf = (path: string): string => `agreed:${path}`

export const connection = async (): Promise<Connection | undefined> => {
  const row = await within("readonly", [REMOTE], (transaction) =>
    transaction.objectStore(REMOTE).get(CONNECTION) as IDBRequest<Row | undefined>,
  )
  return row.result?.connection
}

export const connect = async (settings: Connection): Promise<void> => {
  await within("readwrite", [REMOTE], (transaction) => {
    transaction.objectStore(REMOTE).put({ id: CONNECTION, connection: settings })
  })
}

/** Forget the connection and everything agreed under it, token included. */
export const disconnect = async (): Promise<void> => {
  await within("readwrite", [REMOTE], (transaction) => {
    transaction.objectStore(REMOTE).clear()
  })
}

export const agreedOn = async (path: string): Promise<Agreed | undefined> => {
  const row = await within("readonly", [REMOTE], (transaction) =>
    transaction.objectStore(REMOTE).get(keyOf(path)) as IDBRequest<Row | undefined>,
  )
  return row.result?.agreed
}

export const everythingAgreed = async (): Promise<readonly Agreed[]> => {
  const rows = await within("readonly", [REMOTE], (transaction) =>
    transaction.objectStore(REMOTE).getAll() as IDBRequest<Row[]>,
  )
  return rowsOf(rows)
    .map((row) => row.agreed)
    .filter((agreed): agreed is Agreed => agreed !== undefined)
}

export const agree = async (agreed: Agreed): Promise<void> => {
  await within("readwrite", [REMOTE], (transaction) => {
    transaction.objectStore(REMOTE).put({ id: keyOf(agreed.path), agreed })
  })
}
