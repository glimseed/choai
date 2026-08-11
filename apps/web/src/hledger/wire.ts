/**
 * The shapes hledger sends and receives.
 *
 * These mirror hledger's own JSON, which is what `hledger --output-format=json`
 * emits, so they follow upstream rather than being a format invented here.
 * Fields hledger sends as `null` are typed as such because that is what arrives;
 * `fromWire` turns them into `undefined` before they travel any further in.
 */

/** hledger's Decimal. */
export interface Quantity {
  readonly decimalMantissa: number
  readonly decimalPlaces: number
}

export interface AmountStyle {
  readonly ascommodityside: "L" | "R"
  readonly ascommodityspaced: boolean
  readonly asdecimalmark: string | null
  readonly asdigitgroups: readonly [string, readonly number[]] | null
  readonly asprecision: number | null
}

export interface Amount {
  readonly acommodity: string
  readonly aquantity: Quantity
  readonly astyle: AmountStyle
}

/** One amount per commodity; empty means a zero balance. */
export type MixedAmount = readonly Amount[]

export interface Posting {
  readonly paccount: string
  readonly pamount: MixedAmount
  readonly pcomment: string
  readonly pdate: string | null
  readonly pstatus: string
}

export interface Transaction {
  readonly tindex: number
  readonly tdate: string
  readonly tdescription: string
  readonly tcomment: string
  readonly tpostings: readonly Posting[]
}

/**
 * One row of a balance report.
 *
 * `prrName` is the full account name for an account row. hledger's DisplayName
 * serialises to a bare string, and the totals row has no account at all, which
 * arrives as an empty array.
 */
export interface ReportRow {
  readonly prrName: string | readonly []
  readonly prrTotal: MixedAmount
}

export interface BalanceReport {
  readonly prRows: readonly ReportRow[]
  readonly prTotals: ReportRow
}

/** A window onto a report with many rows, and how many rows there were in all. */
export interface Page<T> {
  readonly items: readonly T[]
  readonly offset: number
  readonly total: number
}

export interface JournalSummary {
  readonly transactions: number
  readonly accounts: readonly string[]
  /** The symbols this journal keeps its books in, as hledger found them. */
  readonly commodities: readonly string[]
}

export type Request =
  | { readonly kind: "entries"; readonly query: string; readonly limit: number; readonly offset: number }
  | { readonly kind: "register"; readonly query: string; readonly limit: number; readonly offset: number }
  | { readonly kind: "balance"; readonly query: string }
  | { readonly kind: "balancesheet"; readonly query: string }
  | { readonly kind: "incomestatement"; readonly query: string }
  | { readonly kind: "accounts" }
  | { readonly kind: "similar"; readonly description: string; readonly limit: number }
  | { readonly kind: "renderTransaction"; readonly transaction: Transaction }

/** What each request answers with. */
export interface Answer {
  entries: Page<Transaction>
  register: Page<unknown>
  balance: BalanceReport
  balancesheet: BalanceReport
  incomestatement: BalanceReport
  accounts: readonly string[]
  /** Past transactions resembling a description, most alike and most recent first. */
  similar: readonly Transaction[]
  renderTransaction: string
}

/**
 * Why a call produced no answer.
 *
 * Mirrors the Failure type in Bindings.hs, plus the ways the crossing itself can
 * go wrong. Held as a case and its particulars so a screen can decide what to
 * say, and say something different for each.
 */
export type Trouble =
  | { readonly kind: "no-journal" }
  | { readonly kind: "file-missing"; readonly path: string }
  | { readonly kind: "read-failed"; readonly detail: string }
  | { readonly kind: "malformed-request"; readonly detail: string }
  | { readonly kind: "unknown-report"; readonly report: string }
  | { readonly kind: "missing-transaction" }
  | { readonly kind: "crashed"; readonly detail: string }
  | { readonly kind: "unreachable"; readonly detail: string }
  | { readonly kind: "unreadable-answer"; readonly detail: string }
