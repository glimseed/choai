import type { Trouble } from "~/hledger/wire"
import type { Result } from "~/lib/monad"
import { clearDraft, stopComposing } from "~/compose/store"
import { stopEditingEntry } from "~/compose/editing"
import { openBook, type OpenJournal } from "./store"

/**
 * Putting one book down and picking another up.
 *
 * Everything that was in hand belonged to the book being put down, and the most
 * dangerous of those is the entry being edited: it is held as a file name and a
 * range of lines, and those lines mean something else entirely in another book.
 * Saving after a switch would write a company's correction into a household's
 * journal.
 *
 * So this is the only way books change. The store can open one; only this closes
 * what was open first, and it does it before anything of the new book arrives.
 */
export const switchTo = async (id: string): Promise<Result<OpenJournal, Trouble>> => {
  stopEditingEntry()
  stopComposing()
  clearDraft()
  return openBook(id)
}
