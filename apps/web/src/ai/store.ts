import { createSignal, type Accessor } from "solid-js"

import { journal } from "~/journal/store"
import { None, Some, getOrUndefined, type Option } from "~/lib/monad"
import { key, model as keptModel, which } from "./kept"
import { converse, type Beat, type Ending } from "./loop"
import { groundingFor } from "./prompt"
import { NOTHING_SPENT, alsoSpent, type Failure, type Shown, type Spent, type Turn } from "./talker"
import { talkerFor } from "./talkers"

/**
 * The conversation, and whether the panel for it is open.
 *
 * Two records are kept of the same exchange, on purpose. `beats` is what a
 * reader sees — what was asked, what was answered, and which capability ran in
 * between. `turns` is what goes back to the model, which is not the same thing:
 * the first question carries a description of the open journal that nobody
 * needs read back to them, and every answer carries thinking and tool blocks
 * that have to travel unedited but are not conversation.
 */

const [beats, setBeats] = createSignal<readonly Beat[]>([])
const [turns, setTurns] = createSignal<readonly Turn[]>([])
const [sending, setSending] = createSignal(false)
const [failure, setFailure] = createSignal<Option<Failure>>(None)
const [ending, setEnding] = createSignal<Option<Ending>>(None)
const [usedBy, setUsedBy] = createSignal<string | undefined>(undefined)
const [spent, setSpent] = createSignal<Spent>(NOTHING_SPENT)

export { beats, sending }

export const askingTrouble: Accessor<Option<Failure>> = failure
export const howItEnded: Accessor<Option<Ending>> = ending

/** What this conversation has cost so far, counting every exchange in it. */
export const spentSoFar: Accessor<Spent> = spent
export const anythingSaid = (): boolean => beats().length > 0

/**
 * Put the conversation away.
 *
 * Closing the panel is not this — a stray Escape should not cost a transcript.
 * Only an explicit clearing, or moving to another book, where what was said
 * about this one no longer means anything.
 */
export const forgetChat = (): void => {
  setBeats([])
  setTurns([])
  setFailure(None)
  setEnding(None)
  setUsedBy(undefined)
  setSpent(NOTHING_SPENT)
}

export const ask = async (text: string, shown: readonly Shown[] = []): Promise<void> => {
  const written = text.trim()
  if ((written === "" && shown.length === 0) || sending()) return

  const talker = talkerFor(await which())
  const saved = await key(talker.id)
  if (saved === undefined) {
    setFailure(Some({ kind: "unauthorised" }))
    return
  }

  /**
   * A conversation belongs to whoever has been holding it.
   *
   * Turns keep each provider's own blocks, unread and unedited, because that is
   * what has to go back. Handing Claude's to Gemini would not be a translation
   * problem, it would be nonsense — so changing provider starts again rather
   * than carrying anything across.
   */
  if (usedBy() !== undefined && usedBy() !== talker.id) forgetChat()
  setUsedBy(talker.id)

  setBeats((was) => [
    ...was,
    { is: "said", said: { from: "you", text: written, ...(shown.length === 0 ? {} : { shown }) } },
  ])
  setSending(true)
  setFailure(None)
  setEnding(None)

  const open = getOrUndefined(journal())
  const asked =
    turns().length === 0 && open !== undefined ? `${groundingFor(open)}\n\n${written}` : written

  const chosen = (await keptModel(talker.id)) ?? { id: talker.defaultModel, label: talker.defaultModel }
  const done = await converse(talker, saved, chosen, [...turns(), talker.said(asked, shown)], (beat) =>
    setBeats((was) => [...was, beat]),
  )
  setSending(false)

  if (!done.ok) {
    setFailure(Some(done.error))
    return
  }
  setTurns(done.value.turns)
  setEnding(Some(done.value.ending))
  setSpent((was) => alsoSpent(was, done.value.spent))
}
