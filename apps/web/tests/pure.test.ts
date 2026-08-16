import { describe, expect, test } from "bun:test"

import { amountExample } from "~/compose/hint"
import { emptyDraft, isWritable, whatIsMissing } from "~/compose/draft"
import { digits, fields, listOf, nothing, oneOf, spare, text } from "~/lib/monad/shape"
import { looksTabular, rowsOf } from "~/lib/csv"
import { narrowed } from "~/reports/ask"
import { PERIODS, TERMS, periodByTerm } from "~/reports/periods"

/**
 * The parts that are only functions, checked as functions.
 *
 * Anything that needs hledger, a journal, or a screen is left to the end-to-end
 * tests, which drive the app through window.choai rather than mocking it.
 */

describe("what a draft still needs", () => {
  const two = (draft: ReturnType<typeof emptyDraft>) => ({
    ...draft,
    postings: [
      { account: "expenses:food", amount: "", tags: [] },
      { account: "assets:cash", amount: "", tags: [] },
    ],
  })

  test("an empty one needs all three", () => {
    expect(whatIsMissing(emptyDraft(""))).toEqual(["date", "payee", "postings"])
  })

  test("an amount is never missing — hledger works the last one out", () => {
    const draft = two({ ...emptyDraft("2026-08-16"), payee: "Shop" })
    expect(whatIsMissing(draft)).toEqual([])
    expect(isWritable(draft)).toBe(true)
  })

  test("one account is not enough", () => {
    const draft = { ...emptyDraft("2026-08-16"), payee: "Shop" }
    expect(whatIsMissing(draft)).toEqual(["postings"])
  })
})

describe("query terms", () => {
  test("are joined with a space", () => {
    expect(narrowed("acct:food", "date:thisyear")).toBe("acct:food date:thisyear")
  })

  test("asking for nothing narrows nothing", () => {
    expect(narrowed("", undefined)).toBe("")
    expect(narrowed(undefined, "date:thisyear")).toBe("date:thisyear")
  })
})

describe("periods", () => {
  test("every term is one hledger is given as written", () => {
    expect(TERMS).toEqual(["date:thismonth", "date:thisyear", "date:lastyear", ""])
  })

  test("all time is the empty term, and is a period like any other", () => {
    expect(periodByTerm("")?.key).toBe("incomeStatement.allTime")
    expect(periodByTerm("date:whenever")).toBeUndefined()
    expect(PERIODS.length).toBe(4)
  })
})

describe("an example amount", () => {
  test("is in the currency the books are kept in", () => {
    expect(amountExample(["¥"])).toBe("¥1200")
  })

  test("is not guessed for books with nothing in them", () => {
    expect(amountExample([])).toBeUndefined()
    expect(amountExample([""])).toBeUndefined()
  })
})

describe("shape", () => {
  const posting = fields({ account: text("account"), amount: spare(text("amount")) })
  const entry = fields({
    date: text("date"),
    payee: text("payee"),
    postings: listOf("postings", posting),
  })

  test("reads a value in and keeps only what was asked for", () => {
    const read = entry.of({ date: "2026-08-16", payee: "Shop", postings: [{ account: "a" }], extra: 1 })
    expect(read).toEqual({ ok: true, value: { date: "2026-08-16", payee: "Shop", postings: [{ account: "a" }] } })
  })

  test("says every way it did not fit at once, with a path into it", () => {
    const read = entry.of({ payee: "Shop", postings: [{ amount: 3 }] })
    expect(read.ok).toBe(false)
    expect(read.ok ? [] : read.error).toEqual([
      { path: "date", wanted: "to be given" },
      { path: "postings[0].account", wanted: "to be given" },
      { path: "postings[0].amount", wanted: "a string" },
    ])
  })

  test("null arriving from outside is the same as left out", () => {
    const read = fields({ note: spare(text("note")) }).of({ note: null })
    expect(read).toEqual({ ok: true, value: {} })
  })

  test("the schema is strict enough to be a tool definition", () => {
    expect(entry.schema.additionalProperties).toBe(false)
    expect(entry.schema.required).toEqual(["date", "payee", "postings"])
    expect(posting.schema.required).toEqual(["account"])
  })

  test("a number has to be one", () => {
    expect(digits("n").of(Number.NaN).ok).toBe(false)
    expect(digits("n").of(Number.POSITIVE_INFINITY).ok).toBe(false)
    expect(digits("n").of(0).ok).toBe(true)
  })

  test("oneOf says what it would have taken", () => {
    const read = oneOf("p", ["yes", "no"]).of("maybe")
    expect(read.ok ? [] : read.error).toEqual([{ path: "", wanted: 'one of "yes", "no"' }])
  })

  test("taking nothing takes nothing at all", () => {
    expect(nothing.of(undefined)).toEqual({ ok: true, value: {} })
    expect(nothing.of({}).ok).toBe(true)
    expect(nothing.of("no").ok).toBe(false)
  })
})

describe("reading a statement", () => {
  test("a comma inside quotes belongs to the field, not between two", () => {
    expect(rowsOf('date,payee\n2026-01-01,"Smith, John"')).toEqual([
      ["date", "payee"],
      ["2026-01-01", "Smith, John"],
    ])
  })

  test("two quotes inside a quoted field are one quote", () => {
    expect(rowsOf('a\n"say ""hi"""')).toEqual([["a"], ['say "hi"']])
  })

  test("a line ending inside quotes does not end the row", () => {
    expect(rowsOf('a,b\n"one\ntwo",3')).toEqual([
      ["a", "b"],
      ["one\ntwo", "3"],
    ])
  })

  test("Windows line endings are line endings, not a stray character", () => {
    expect(rowsOf("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  test("a file that ends without a newline still has its last row", () => {
    expect(rowsOf("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  test("a note dropped in by accident is not a statement", () => {
    expect(looksTabular(rowsOf("a,b\n1,2"))).toBe(true)
    expect(looksTabular(rowsOf("just a note"))).toBe(false)
    expect(looksTabular(rowsOf("a,b"))).toBe(false)
  })
})
