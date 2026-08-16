import { createRoot, createSignal, type Accessor } from "solid-js"

import type { JournalSummary, Trouble } from "~/hledger/wire"
import { appendToJournal, type Draft } from "~/compose/draft"
import { Err, Ok, getOrUndefined, type Result } from "~/lib/monad"
import { appendToEntry, entryText, journal, tryOut, type OpenJournal } from "./store"

/**
 * Entries written but not yet kept.
 *
 * The point of a proposal is that a diff exists before anything is decided:
 * whatever wrote these — a person, a script, a model — the text they become is
 * offered to hledger and shown before it is put anywhere. Applying is a second
 * act, and it can take some of them and leave the rest.
 *
 * Nothing here is persisted. A proposal is about a journal as it stands right
 * now, and outliving the session would only mean applying it to a book that had
 * moved on.
 */

/** One entry of a proposal, and how sure whatever wrote it was. */
export interface Item {
  readonly draft: Draft
  /** 0 to 1. A property of the proposal, not of the transaction. */
  readonly confidence: number
  readonly why?: string
}

export interface Proposal {
  readonly id: string
  readonly bookId: string
  /** The entry file as it stood when this was made. What "still applies" means. */
  readonly basedOn: string
  readonly items: readonly Item[]
  readonly at: number
  /** Whether hledger read the whole of it, and what it said if not. */
  readonly reads: Result<JournalSummary, Trouble>
}

/** Why a proposal could not be made or applied, in this module's own terms. */
export type Refusal =
  | { readonly at: "no-journal" }
  | { readonly at: "nothing-proposed" }
  | { readonly at: "no-such-proposal"; readonly id: string }
  | { readonly at: "stale-proposal"; readonly id: string }
  | { readonly at: "hledger"; readonly trouble: Trouble }

/** How long a proposal is worth keeping, and how many at once. */
const A_WHILE = 30 * 60 * 1000
const AT_MOST = 8

/**
 * Above this, an entry is not one a person needs to look at twice.
 *
 * Here rather than on a screen because the same line has to be drawn for
 * something reading the manifest — ninety-seven kept at once and three set
 * aside only means anything if both ends agree which three.
 */
export const SURE = 0.8

export const sureIn = (proposal: Proposal): readonly number[] =>
  proposal.items.flatMap((item, at) => (item.confidence >= SURE ? [at] : []))

const [held, setHeld] = createRoot(() => createSignal<readonly Proposal[]>([]))

export const proposals: Accessor<readonly Proposal[]> = held

/** The one being looked at: the newest that still stands. */
export const underReview = (): Proposal | undefined => fresh()[0]

export const show = (id: string): Proposal | undefined => fresh().find((one) => one.id === id)

const fresh = (): readonly Proposal[] => {
  const by = Date.now() - A_WHILE
  return held().filter((one) => one.at > by)
}

export const drop = (id: string): void => {
  setHeld((was) => was.filter((one) => one.id !== id))
}

export const forgetAll = (): void => {
  setHeld([])
}

/** Which items a decision covers: the ones named, or all of them. */
const chosen = (proposal: Proposal, only: readonly number[] | undefined): readonly Item[] =>
  only === undefined ? proposal.items : only.flatMap((at) => (proposal.items[at] === undefined ? [] : [proposal.items[at]]))

/**
 * The journal text a proposal becomes.
 *
 * Derived every time rather than stored, which is what makes applying some of
 * them the same act as applying all of them — a smaller rendering, not an edit
 * of something kept.
 */
export const textOf = (
  proposal: Proposal,
  base: string,
  only?: readonly number[],
): string => chosen(proposal, only).reduce((text, item) => appendToJournal(text, item.draft), base)

/** Where the entry file sits in `files`, which is without the leading slash. */
const entryPath = (open: OpenJournal): string => open.source.entry.replace(/^\//, "")

const candidate = (open: OpenJournal, text: string): Record<string, string> => ({
  ...open.source.files,
  [entryPath(open)]: text,
})

/**
 * Write these down without keeping them, and say whether they read.
 *
 * All of them are offered as one candidate, not one at a time. hledger parses
 * the whole journal on every open, so a hundred separate trials is a hundred
 * whole parses — two orders of magnitude of waiting, during which no screen can
 * answer anything.
 */
export const propose = async (items: readonly Item[]): Promise<Result<Proposal, Refusal>> => {
  if (items.length === 0) return Err({ at: "nothing-proposed" })

  const open = getOrUndefined(journal())
  const base = entryText()
  if (open === undefined || base === undefined) return Err({ at: "no-journal" })

  const made: Proposal = {
    id: crypto.randomUUID(),
    bookId: open.bookId,
    basedOn: base,
    items,
    at: Date.now(),
    reads: Ok({ transactions: 0, accounts: [], commodities: [] }),
  }

  const read = await tryOut(candidate(open, textOf(made, base)), open.source.entry)
  const proposal: Proposal = { ...made, reads: read }

  setHeld([proposal, ...fresh()].slice(0, AT_MOST))
  return Ok(proposal)
}

/**
 * Keep some of them, or all of them.
 *
 * Everything from reading the journal to handing the new text over happens
 * without awaiting anything, which is what makes the check worth making: a
 * write queued by someone else cannot slip between finding the journal
 * unchanged and joining the queue behind them. Put an `await` anywhere above
 * `appendToEntry` and this silently becomes a way to lose an entry — the text
 * composed here replaces the whole file, and would replace theirs with a copy
 * that never had it.
 *
 * What is left over is proposed again rather than left lying: the entries that
 * remain have not been read against the journal they would now be joining, and
 * saying they had would be the one lie this module must not tell.
 */
export const apply = async (
  id: string,
  only?: readonly number[],
): Promise<Result<OpenJournal, Refusal>> => {
  const proposal = show(id)
  if (proposal === undefined) return Err({ at: "no-such-proposal", id })

  const open = getOrUndefined(journal())
  const now = entryText()
  if (open === undefined || now === undefined) return Err({ at: "no-journal" })
  if (open.bookId !== proposal.bookId || now !== proposal.basedOn) {
    return Err({ at: "stale-proposal", id })
  }

  const written = await appendToEntry(textOf(proposal, now, only))
  if (!written.ok) return Err({ at: "hledger", trouble: written.error })

  drop(id)
  await proposeAgain(proposal, only)
  return Ok(written.value)
}

/** Whatever was not applied, offered afresh against the journal as it now is. */
const proposeAgain = async (proposal: Proposal, only: readonly number[] | undefined): Promise<void> => {
  if (only === undefined) return
  const left = proposal.items.filter((_, at) => !only.includes(at))
  if (left.length === 0) return
  await propose(left)
}
