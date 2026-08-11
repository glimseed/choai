import type { Trouble } from "~/hledger/wire"
import type { Result } from "~/lib/monad"
import { connection } from "~/github/kept"
import { open, type OpenJournal } from "./store"
import { starterJournal } from "./starter"

/**
 * Beginning with nothing written yet.
 *
 * Not an empty file, though it was one to begin with. Two things have to be
 * declared before a journal behaves as anyone expects: how amounts are written,
 * and what kind of account each name is — without the second, a book kept in
 * any language but English produces an empty balance sheet however correct its
 * entries are. Leaving those out is not neutrality, it is a trap.
 *
 * Beyond those declarations there is nothing: no entries, and no chart of
 * accounts beyond the five names every chart hangs from. The rest of the file
 * belongs to whoever keeps it.
 */

/** What a journal is called when nothing else says. */
const PLAIN = "main.journal"

/**
 * Start one, named to match the repository if there is one.
 *
 * Someone who has already said where their books will live has already chosen
 * the name; taking it from there means the first send lands at that path rather
 * than beside it.
 */
export const startFresh = async (): Promise<Result<OpenJournal, Trouble>> => {
  const name = nameOf((await connection())?.path) ?? PLAIN
  return open({ label: name, files: { [name]: starterJournal() }, entry: `/${name}` })
}

const nameOf = (path: string | undefined): string | undefined => {
  const name = path?.slice(path.lastIndexOf("/") + 1).trim()
  return name === undefined || name === "" ? undefined : name
}
