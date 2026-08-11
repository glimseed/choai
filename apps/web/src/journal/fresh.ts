import type { Trouble } from "~/hledger/wire"
import type { Result } from "~/lib/monad"
import { connection } from "~/github/kept"
import { open, type OpenJournal } from "./store"

/**
 * Beginning with nothing.
 *
 * An empty journal is a real journal: hledger reads a file with nothing in it
 * and answers that there is nothing in it. So there is no template here, no
 * header comment, no example account — the first line of the file will be
 * whatever its owner writes first.
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
  return open({ label: name, files: { [name]: "" }, entry: `/${name}` })
}

const nameOf = (path: string | undefined): string | undefined => {
  const name = path?.slice(path.lastIndexOf("/") + 1).trim()
  return name === undefined || name === "" ? undefined : name
}
