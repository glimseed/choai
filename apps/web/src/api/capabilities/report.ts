import { ask } from "~/hledger/client"
import { Err, Ok, type Result } from "~/lib/monad"
import { askBalance, type BalanceKind } from "~/reports/ask"
import { linesOf } from "~/reports/tree"
import { entryOf, figureOf, type Entry, type Figure } from "../answered"
import { fromHledger, type Hitch } from "../hitch"
import { withJournal } from "./journal"

/**
 * hledger's reports, asked for by something other than a screen.
 *
 * The query is a raw hledger query and is passed through untouched, because
 * hledger decides what `date:lastmonth acct:expenses:food` means and working any
 * of it out here would only ever be a second, worse answer.
 */

export interface Row {
  readonly account: string
  /** How far in this account sits under the rows above it. */
  readonly depth: number
  /** The part of the name below the nearest account that is also a row. */
  readonly label: string
  readonly amount: Figure
}

export interface Balance {
  readonly rows: readonly Row[]
  readonly total: Figure
}

/** A window onto a report with many rows, and how many rows there were in all. */
export interface Some<T> {
  readonly items: readonly T[]
  readonly offset: number
  readonly total: number
}

const balanceOf = (kind: BalanceKind, query: string | undefined): Promise<Result<Balance, Hitch>> =>
  withJournal(async () => {
    const reply = await askBalance(kind, query ?? "")
    if (!reply.ok) return Err(fromHledger(reply.error))

    return Ok({
      rows: linesOf(reply.value.prRows).map((line) => ({
        account: line.account,
        depth: line.depth,
        label: line.label,
        amount: figureOf(line.amount),
      })),
      total: figureOf(reply.value.prTotals.prrTotal),
    })
  })

export const balance = (args: { readonly query?: string }): Promise<Result<Balance, Hitch>> =>
  balanceOf("balance", args.query)

export const balanceSheet = (args: { readonly query?: string }): Promise<Result<Balance, Hitch>> =>
  balanceOf("balancesheet", args.query)

export const incomeStatement = (args: { readonly query?: string }): Promise<Result<Balance, Hitch>> =>
  balanceOf("incomestatement", args.query)

export const entries = (args: {
  readonly query?: string
  readonly limit?: number
  readonly offset?: number
}): Promise<Result<Some<Entry>, Hitch>> =>
  withJournal(async () => {
    const reply = await ask({
      kind: "entries",
      query: args.query ?? "",
      limit: args.limit ?? 50,
      offset: args.offset ?? 0,
    })
    if (!reply.ok) return Err(fromHledger(reply.error))

    return Ok({
      items: reply.value.items.map(entryOf),
      offset: reply.value.offset,
      total: reply.value.total,
    })
  })
