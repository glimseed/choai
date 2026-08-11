import type { AccountType } from "~/hledger/wire"

/**
 * Telling hledger what kind of account each name is.
 *
 * hledger works out the kind from the name — but only for the English names it
 * knows: assets, liabilities, equity, revenues, expenses. A book kept in any
 * other language has accounts it cannot place, and an account it cannot place
 * appears in no balance sheet and no income statement, however correct the
 * entries are.
 *
 * The remedy is hledger's own: an `account` directive carrying a `type:` tag.
 * A kind given to a parent is inherited by everything under it, so the handful
 * of names at the top of the tree is all that has to be said.
 */

/** The kinds a chart is built from, in the order a balance sheet reads. */
export const KINDS = ["Asset", "Liability", "Equity", "Revenue", "Expense"] as const

export type Kind = (typeof KINDS)[number]

/** hledger's own letters for them, which is what goes in the file. */
export const LETTER: Readonly<Record<Kind, string>> = {
  Asset: "A",
  Liability: "L",
  Equity: "E",
  Revenue: "R",
  Expense: "X",
}

/** The first segment of an account name, which is the one worth declaring. */
export const topOf = (account: string): string => account.split(":")[0] ?? account

/**
 * The top-level accounts hledger could not place.
 *
 * Only the top level: naming a child as well would say nothing the parent has
 * not already said.
 */
export const unplaced = (
  accounts: readonly string[],
  types: Readonly<Record<string, AccountType>>,
): readonly string[] => [...new Set(accounts.map(topOf))].filter((name) => types[name] === undefined)

/**
 * A guess at what a name means, offered as a starting point.
 *
 * Only the words that are unambiguous on their own. Anything that changes
 * meaning with who is keeping the books — a salary is income to a person and a
 * cost to a company — is left for the reader to say.
 */
export const guess = (account: string): Kind | undefined =>
  HINTS.find(([pattern]) => pattern.test(account))?.[1]

const HINTS: readonly (readonly [RegExp, Kind])[] = [
  [/資産|現金|預金|銀行|売掛|棚卸|備品/, "Asset"],
  [/負債|買掛|借入|未払|預り|カード/, "Liability"],
  [/純資産|資本|元入|開始残高|繰越利益/, "Equity"],
  [/収益|売上|収入|受取/, "Revenue"],
  [/費用|経費|仕入|支払|租税/, "Expense"],
]

/** One `account` directive per name, in the order the kinds are listed. */
export const directives = (chosen: ReadonlyMap<string, Kind>): string =>
  [...chosen]
    .sort(([, a], [, b]) => KINDS.indexOf(a) - KINDS.indexOf(b))
    .map(([name, kind]) => `account ${name}  ; type:${LETTER[kind]}`)
    .join("\n")

/**
 * The file with those directives at the top of it.
 *
 * At the top because that is where a reader looks for what a file declares —
 * hledger itself would take them anywhere, since it gathers declarations from
 * the whole file before it decides anything.
 */
export const declaring = (file: string, block: string): string =>
  block === "" ? file : `${block}\n\n${file.replace(/^\n+/, "")}`
