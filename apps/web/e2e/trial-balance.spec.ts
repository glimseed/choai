import { expect, test, type Page } from "@playwright/test"

import type { Choai } from "~/api/install"

declare global {
  interface Window {
    choai: Choai
  }
}

/**
 * The report a set of books is checked with, rather than one of the statements
 * they come to.
 *
 * Every account on a line of its own, each balance in the debit or the credit
 * column by its sign, and the two columns coming to the same figure. All three
 * are hledger's doing: flat and with the empty accounts kept is asked of it, and
 * so are the totals — a column added up by the screen drawing it would be the
 * screen checking its own arithmetic.
 */
const openTheDemo = async (page: Page): Promise<void> => {
  await page.goto("/")
  await page.evaluate(() => window.choai.ready)
  await page.getByRole("button", { name: "Try the demo" }).click()

  await expect
    .poll(async () => {
      const open = await page.evaluate(() => window.choai.journal.summary({}))
      return open.ok ? open.value.transactions : 0
    })
    .toBe(9)
}

test("the two columns come to the same figure", async ({ page }) => {
  await openTheDemo(page)

  const answer = await page.evaluate(() => window.choai.report.trialBalance({}))
  expect(answer.ok).toBe(true)
  if (!answer.ok) return

  // The whole of what the report is for.
  expect(answer.value.debits.rendered).toBe(answer.value.credits.rendered)
  expect(answer.value.debits.rendered).not.toBe("0")

  // A balance falls in one column by its sign and leaves the other empty: an
  // asset on the left, what the books owe on the right.
  const of = (account: string) => answer.value.rows.find((row) => row.account === account)
  expect(of("assets:bank:checking")?.credit.amounts).toEqual([])
  expect(of("assets:bank:checking")?.debit.amounts.length).toBe(1)
  expect(of("liabilities:card")?.debit.amounts).toEqual([])
  expect(of("liabilities:card")?.credit.amounts.length).toBe(1)

  // Flat, and whole names: no row stands for what is under it, or the columns
  // would count a parent beside its own children and still claim to add up.
  expect(answer.value.rows.map((row) => row.account)).toContain("assets:bank:checking")
  expect(answer.value.rows.map((row) => row.account)).not.toContain("assets")
})

/**
 * An account that came to nothing is still an account the books have, and one of
 * the things a check is run to see. hledger leaves it out of a balance report
 * unless asked, so the trial balance asks.
 */
test("an account that nets to nothing is still on it", async ({ page }) => {
  await openTheDemo(page)

  const spentAndRefunded = await page.evaluate(() =>
    window.choai.transaction.propose({
      transactions: [
        {
          date: "2026-03-01",
          payee: "a shop",
          postings: [
            { account: "expenses:returned", amount: "$25.00" },
            { account: "assets:cash", amount: "$-25.00" },
          ],
        },
        {
          date: "2026-03-02",
          payee: "a shop",
          postings: [
            { account: "assets:cash", amount: "$25.00" },
            { account: "expenses:returned", amount: "$-25.00" },
          ],
        },
      ],
    }),
  )
  expect(spentAndRefunded.ok).toBe(true)
  if (!spentAndRefunded.ok) return

  const kept = await page.evaluate(
    (id) => window.choai.proposal.apply({ id }),
    spentAndRefunded.value.id,
  )
  expect(kept.ok).toBe(true)

  const answer = await page.evaluate(() => window.choai.report.trialBalance({}))
  expect(answer.ok).toBe(true)
  if (!answer.ok) return

  const returned = answer.value.rows.find((row) => row.account === "expenses:returned")
  expect(returned).toBeDefined()
  expect(returned?.debit.amounts).toEqual([])
  expect(returned?.credit.amounts).toEqual([])

  // Nothing there changed what the check comes to.
  expect(answer.value.debits.rendered).toBe(answer.value.credits.rendered)
})

test("the trial balance is what the fourth view is, in name and on screen", async ({ page }) => {
  await openTheDemo(page)

  await page.getByRole("button", { name: "Trial balance" }).first().click()
  await expect(page).toHaveURL(/\/trial-balance/)

  await expect(page.getByRole("columnheader", { name: "Debit" })).toBeVisible()
  await expect(page.getByRole("columnheader", { name: "Credit" })).toBeVisible()

  // The row for an asset carries a figure on the left and nothing on the right.
  const checking = page.getByRole("row").filter({ hasText: "assets:bank:checking" })
  await expect(checking.getByRole("cell").nth(1)).toHaveText("$7,942.00")
  await expect(checking.getByRole("cell").nth(2)).toHaveText("")

  // And the columns agree where it matters, in the row that is read last.
  const total = page.getByRole("row").filter({ hasText: "Total" })
  await expect(total.getByRole("cell").nth(1)).toHaveText("$10,769.15")
  await expect(total.getByRole("cell").nth(2)).toHaveText("$10,769.15")
})
