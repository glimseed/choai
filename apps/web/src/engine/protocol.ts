// The shapes the engine speaks. These mirror hledger's own JSON, which is what
// `hledger --output-format=json` emits, so they follow upstream rather than
// being a format invented here.

/** hledger's Decimal. */
export interface Quantity {
  decimalMantissa: number
  decimalPlaces: number
  /** Present in the JSON, deliberately unused: see formatAmount. */
  floatingPoint: number
}

export interface AmountStyle {
  ascommodityside: "L" | "R"
  ascommodityspaced: boolean
  asdecimalmark: string | null
  asdigitgroups: [string, number[]] | null
  asprecision: number | null
  asrounding: string
}

export interface Amount {
  acommodity: string
  aquantity: Quantity
  astyle: AmountStyle
  acost: unknown | null
}

/** A MixedAmount is a list of Amounts, one per commodity. */
export type MixedAmount = Amount[]

export interface Posting {
  paccount: string
  pamount: MixedAmount
  pcomment: string
  pdate: string | null
  pstatus: string
  ptype: string
  ptags: [string, string][]
}

export interface Transaction {
  tindex: number
  tdate: string
  tdate2: string | null
  tstatus: string
  tcode: string
  tdescription: string
  tcomment: string
  ttags: [string, string][]
  tpostings: Posting[]
}

/**
 * One row of a balance report.
 *
 * `prrName` is the full account name for an account row. hledger's DisplayName
 * serialises to the bare string rather than an object, and the totals row has no
 * account at all, which arrives as an empty array.
 */
export interface ReportRow {
  prrName: string | []
  prrAmounts: MixedAmount[]
  prrTotal: MixedAmount
  prrAverage: MixedAmount
}

export interface BalanceReport {
  prDates: unknown[]
  prRows: ReportRow[]
  prTotals: ReportRow
}

/** A window onto a report with many rows, plus how many rows there were. */
export interface Page<T> {
  items: T[]
  offset: number
  total: number
}

export interface JournalInfo {
  transactions: number
  accounts: string[]
}

export type Request =
  | { kind: "entries"; query?: string; limit?: number; offset?: number }
  | { kind: "register"; query?: string; limit?: number; offset?: number }
  | { kind: "balance"; query?: string }
  | { kind: "balancesheet"; query?: string }
  | { kind: "incomestatement"; query?: string }
  | { kind: "accounts" }
  | { kind: "renderTransaction"; transaction: Transaction }

/** Maps each request to what it answers with. */
export interface Responses {
  entries: Page<Transaction>
  register: Page<unknown>
  balance: BalanceReport
  balancesheet: BalanceReport
  incomestatement: BalanceReport
  accounts: string[]
  renderTransaction: string
}

/**
 * Render an amount the way hledger would.
 *
 * Built from the mantissa and scale rather than `floatingPoint`, which is in
 * the JSON but cannot represent every decimal exactly. Money must not be
 * rendered through a binary float.
 */
export function formatAmount(amount: Amount): string {
  const { decimalMantissa, decimalPlaces } = amount.aquantity
  const style = amount.astyle
  const places = style.asprecision ?? decimalPlaces
  const negative = decimalMantissa < 0
  let digits = Math.abs(decimalMantissa).toString().padStart(decimalPlaces + 1, "0")

  // Re-scale to the precision the style asks for, without going through a float.
  if (places > decimalPlaces) {
    digits += "0".repeat(places - decimalPlaces)
  } else if (places < decimalPlaces) {
    const cut = decimalPlaces - places
    const keep = digits.slice(0, digits.length - cut) || "0"
    const next = digits.charCodeAt(digits.length - cut) - 48
    digits = next >= 5 ? (BigInt(keep) + 1n).toString() : keep
  }

  const whole = digits.slice(0, digits.length - places) || "0"
  const fraction = places > 0 ? digits.slice(digits.length - places) : ""
  const mark = style.asdecimalmark ?? "."
  const grouped = group(whole, style.asdigitgroups)
  const number = (negative ? "-" : "") + grouped + (fraction ? mark + fraction : "")

  const gap = style.ascommodityspaced ? " " : ""
  return style.ascommodityside === "R"
    ? `${number}${gap}${amount.acommodity}`
    : `${amount.acommodity}${gap}${number}`
}

function group(whole: string, groups: AmountStyle["asdigitgroups"]): string {
  if (!groups) return whole
  const [separator, sizes] = groups
  const parts: string[] = []
  let rest = whole
  let i = 0
  while (rest.length > 0) {
    const size = sizes[Math.min(i, sizes.length - 1)]
    if (!size || rest.length <= size) break
    parts.unshift(rest.slice(rest.length - size))
    rest = rest.slice(0, rest.length - size)
    i++
  }
  parts.unshift(rest)
  return parts.join(separator)
}

/** Render a whole MixedAmount; an empty one is a zero balance. */
export function formatMixed(mixed: MixedAmount): string {
  if (mixed.length === 0) return "0"
  return mixed.map(formatAmount).join(", ")
}
