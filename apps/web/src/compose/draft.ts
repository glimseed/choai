/**
 * A transaction being written, and the journal text it becomes.
 *
 * Amounts stay as they were typed. `¥1,200` and `1200` are both things a person
 * writes, and hledger is what decides what they mean — turning them into numbers
 * here would mean deciding about currency symbols and digit groups ourselves,
 * and then deciding again, differently, when writing them back out.
 */

export interface DraftPosting {
  readonly account: string
  readonly amount: string
}

export interface Draft {
  readonly date: string
  readonly description: string
  readonly postings: readonly DraftPosting[]
}

export const emptyDraft = (today: string): Draft => ({
  date: today,
  description: "",
  postings: [
    { account: "", amount: "" },
    { account: "", amount: "" },
  ],
})

/** Today, as hledger writes dates. */
export const todayISO = (): string => {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Postings worth writing: the ones that name an account. */
const written = (draft: Draft): readonly DraftPosting[] =>
  draft.postings.filter((posting) => posting.account.trim() !== "")

/**
 * Enough to write: a date, a description, and two accounts.
 *
 * An amount is not required anywhere. hledger works out the last one from the
 * rest, which is the whole reason a two-line entry only needs one figure.
 */
export const isWritable = (draft: Draft): boolean =>
  draft.date.trim() !== "" && draft.description.trim() !== "" && written(draft).length >= 2

/**
 * The journal text this draft becomes.
 *
 * An amount left empty is written as an account on its own, which is how a
 * journal says "work this one out from the others".
 */
export const draftToJournal = (draft: Draft): string =>
  [`${draft.date.trim()} ${draft.description.trim()}`, ...written(draft).map(postingLine)].join("\n") + "\n"

const postingLine = (posting: DraftPosting): string =>
  posting.amount.trim() === ""
    ? `    ${posting.account.trim()}`
    : `    ${posting.account.trim()}  ${posting.amount.trim()}`

/**
 * Add the draft to the end of a journal.
 *
 * Only ever appended, and separated by a blank line. The file on the other side
 * is text somebody wrote by hand and keeps in version control; reformatting it
 * would spread a diff across the whole thing for the sake of one new entry.
 */
export const appendToJournal = (journal: string, draft: Draft): string =>
  `${journal.replace(/\s*$/, "")}\n\n${draftToJournal(draft)}`
