import { commitDraft } from "~/compose/commit"
import { draftToJournal, whatIsMissing, type Draft, type DraftPosting, type Tag } from "~/compose/draft"
import { propose, type Item, type Proposal } from "~/journal/proposals"
import { Err, Ok, type Result } from "~/lib/monad"
import { fromRefusal, type Hitch } from "../hitch"
import { withJournal } from "./journal"

/**
 * Writing entries, offered and outright.
 *
 * Both build the same `Draft` the compose panel builds, and both hand it to the
 * same place a person's does, so an entry written here and an entry typed in are
 * the same act reaching the journal by the same road.
 */

/** A transaction as something without a screen describes one. */
export interface Written {
  readonly date: string
  readonly payee: string
  readonly note?: string
  readonly tags?: readonly { readonly name: string; readonly value: string }[]
  readonly postings: readonly {
    readonly account: string
    readonly amount?: string
  }[]
}

export interface Suggested extends Written {
  readonly confidence?: number
  readonly why?: string
}

const tagsOf = (given: Written["tags"]): readonly Tag[] =>
  (given ?? []).map((tag) => ({ name: tag.name, value: tag.value }))

const postingsOf = (given: Written["postings"]): readonly DraftPosting[] =>
  given.map((posting) => ({ account: posting.account, amount: posting.amount ?? "", tags: [] }))

const draftOf = (given: Written): Draft => ({
  date: given.date,
  payee: given.payee,
  note: given.note ?? "",
  tags: tagsOf(given.tags),
  postings: postingsOf(given.postings),
})

/** Where a book stands after an entry joined it. */
export interface Kept {
  readonly transactions: number
  readonly written: string
}

export const create = (args: Written): Promise<Result<Kept, Hitch>> =>
  withJournal(async () => {
    const draft = draftOf(args)

    const missing = whatIsMissing(draft)
    if (missing.length > 0) return Err({ at: "incomplete", missing })

    const done = await commitDraft(draft)
    return done.ok
      ? Ok({ transactions: done.value.summary.transactions, written: draftToJournal(draft) })
      : Err({ at: "hledger", trouble: done.error })
  })

/** One entry of a proposal, as it will read and as sure as it was written. */
export interface Offered {
  readonly at: number
  readonly text: string
  readonly confidence: number
  readonly why?: string
  readonly missing: readonly string[]
}

export interface OfferedAll {
  readonly id: string
  readonly items: readonly Offered[]
  /** Whether hledger read the whole of it as one journal. */
  readonly reads: boolean
  readonly saidWhat?: string
}

export const shapeOf = (proposal: Proposal): OfferedAll => ({
  id: proposal.id,
  items: proposal.items.map((item, at) => ({
    at,
    text: draftToJournal(item.draft),
    confidence: item.confidence,
    ...(item.why === undefined ? {} : { why: item.why }),
    missing: whatIsMissing(item.draft),
  })),
  reads: proposal.reads.ok,
  ...(proposal.reads.ok ? {} : { saidWhat: describeTrouble(proposal.reads.error) }),
})

const describeTrouble = (trouble: { kind: string; detail?: string }): string =>
  trouble.detail ?? trouble.kind

export const offer = (args: {
  readonly transactions: readonly Suggested[]
}): Promise<Result<OfferedAll, Hitch>> =>
  withJournal(async () => {
    const items: readonly Item[] = args.transactions.map((one) => ({
      draft: draftOf(one),
      confidence: one.confidence ?? 1,
      ...(one.why === undefined ? {} : { why: one.why }),
    }))

    const made = await propose(items)
    return made.ok ? Ok(shapeOf(made.value)) : Err(fromRefusal(made.error))
  })
