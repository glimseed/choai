import { createSignal, type Accessor } from "solid-js"

import { ask } from "~/hledger/client"
import type { Transaction, Trouble } from "~/hledger/wire"
import { appendToEntry, journal } from "~/journal/store"
import { getOrUndefined, type Option, None, Some } from "~/lib/monad"
import { appendToJournal, emptyDraft, isWritable, todayISO, type Draft } from "./draft"

/** The entry being written, and whether the panel for writing it is open. */

const [open, setOpen] = createSignal(false)
const [draft, setDraft] = createSignal<Draft>(emptyDraft(todayISO()))
const [trouble, setTrouble] = createSignal<Option<Trouble>>(None)
const [saving, setSaving] = createSignal(false)

export { draft, saving }

export const composing: Accessor<boolean> = open
export const savingTrouble: Accessor<Option<Trouble>> = trouble

export const startComposing = (): void => {
  setOpen(true)
}
export const stopComposing = (): void => {
  setOpen(false)
}
export const toggleComposing = (): void => {
  setOpen((was) => !was)
}

export const editDraft = (change: Partial<Draft>): void => {
  setDraft((was) => ({ ...was, ...change }))
}

export const editPosting = (index: number, change: Partial<Draft["postings"][number]>): void => {
  setDraft((was) => ({
    ...was,
    postings: was.postings.map((posting, at) => (at === index ? { ...posting, ...change } : posting)),
  }))
}

export const addPosting = (): void => {
  setDraft((was) => ({ ...was, postings: [...was.postings, { account: "", amount: "" }] }))
}

/**
 * Offer the accounts used last time this description was written.
 *
 * hledger decides what counts as similar — it is the same lookup its own `add`
 * consults — and only accounts are taken. The figure differs every time even
 * when the accounts do not, so filling it in would mostly be something to
 * delete.
 */
export const suggestFromDescription = async (description: string): Promise<void> => {
  if (description.trim() === "" || getOrUndefined(journal()) === undefined) return

  const reply = await ask({ kind: "similar", description, limit: 1 })
  if (!reply.ok) return

  const previous = reply.value[0]
  if (previous === undefined) return

  setDraft((was) => ({ ...was, postings: fillEmptyAccounts(was, previous) }))
}

/** Only empty account boxes are filled, so nothing already typed is overwritten. */
const fillEmptyAccounts = (was: Draft, previous: Transaction): Draft["postings"] => {
  const suggested = previous.tpostings.map((posting) => posting.paccount)
  const grown =
    was.postings.length >= suggested.length
      ? was.postings
      : [...was.postings, ...Array(suggested.length - was.postings.length).fill({ account: "", amount: "" })]

  return grown.map((posting, at) =>
    posting.account.trim() === "" && suggested[at] !== undefined
      ? { ...posting, account: suggested[at] }
      : posting,
  )
}

export const writable = (): boolean => isWritable(draft())

/**
 * Write the draft to the journal.
 *
 * The date stays behind afterwards: entries are usually written in runs, and
 * the run is usually one day's worth.
 */
export const save = async (journalText: string): Promise<boolean> => {
  setSaving(true)
  setTrouble(None)
  const result = await appendToEntry(appendToJournal(journalText, draft()))
  setSaving(false)

  if (!result.ok) {
    setTrouble(Some(result.error))
    return false
  }
  setDraft((was) => ({ ...emptyDraft(was.date) }))
  return true
}

/** Start again with today's date, as if the panel had just been opened. */
export const clearDraft = (): void => {
  setDraft(emptyDraft(todayISO()))
  setTrouble(None)
}
