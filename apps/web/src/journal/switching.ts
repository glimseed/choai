import type { Trouble } from "~/hledger/wire"
import type { Result } from "~/lib/monad"
import { forgetChat, stopChatting } from "~/ai/store"
import { clearDraft, stopComposing } from "~/compose/store"
import { stopEditingEntry } from "~/compose/editing"
import { forgetAll } from "./proposals"
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
 * A conversation is the same argument in words: every figure in it was read out
 * of the book being put down, so carrying it over would have someone answering
 * about one set of books while looking at another.
 *
 * So this is the only way books change. The store can open one; only this closes
 * what was open first, and it does it before anything of the new book arrives.
 */
export const switchTo = async (id: string): Promise<Result<OpenJournal, Trouble>> => {
  stopEditingEntry()
  stopComposing()
  clearDraft()
  stopChatting()
  forgetChat()
  forgetAll()
  return openBook(id)
}
