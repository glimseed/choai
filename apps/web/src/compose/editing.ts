import { createSignal, type Accessor } from "solid-js"

import type { Transaction, Trouble } from "~/hledger/wire"
import { journal } from "~/journal/store"
import { spanOf, textAt, type Span } from "~/journal/lines"
import { None, Some, getOrUndefined, type Option } from "~/lib/monad"
import { commitEntry } from "./commit"
import { dock } from "~/dock"

/**
 * Editing an entry that is already written.
 *
 * The row on screen is a rendering of a few lines of a file, and this opens
 * exactly those lines — not a form built from what hledger parsed. Handing back
 * a form would mean writing the entry out again from its parts, and everything
 * the parts do not carry, from the alignment to a comment on the third posting,
 * would be lost in the round trip.
 *
 * What is saved is the file with those lines replaced, offered to hledger first.
 */

const [where, setWhere] = createSignal<Span | undefined>(undefined)
const [text, setText] = createSignal("")
const [trouble, setTrouble] = createSignal<Option<Trouble>>(None)
const [saving, setSaving] = createSignal(false)

/** The entry being edited, if any: which file, and which lines of it. */
export const editing: Accessor<Span | undefined> = where

/** The lines themselves, as they are being edited. */
export const entryDraft: Accessor<string> = text

export const entryTrouble: Accessor<Option<Trouble>> = trouble
export const entrySaving: Accessor<boolean> = saving

/** Open the lines a transaction came from. Does nothing if its file is not open. */
export const startEditingEntry = (transaction: Transaction): void => {
  const open = getOrUndefined(journal())
  if (open === undefined) return
  const span = spanOf(transaction.tsourcepos)
  const file = open.source.files[span.path]
  if (file === undefined) return
  dock.show("editing")
  setWhere(span)
  setText(textAt(file, span))
  setTrouble(None)
}

export const stopEditingEntry = (): void => {
  setWhere(undefined)
  setTrouble(None)
}

export const editEntry = (written: string): void => {
  setText(written)
}

/**
 * Put the edited lines back.
 *
 * Removing an entry is the same act with nothing written in its place, so both
 * go through here and both are read by hledger before anything is kept.
 */
export const saveEntry = async (written: string): Promise<boolean> => {
  const span = where()
  if (span === undefined) return false

  setSaving(true)
  setTrouble(None)
  const result = await commitEntry(span, written)
  setSaving(false)

  if (!result.ok) {
    setTrouble(Some(result.error))
    return false
  }
  stopEditingEntry()
  return true
}

export const removeEntry = (): Promise<boolean> => saveEntry("")
