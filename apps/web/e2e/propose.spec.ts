import { expect, test, type Page } from "@playwright/test"

import type { Choai } from "~/api/install"

declare global {
  interface Window {
    choai: Choai
  }
}

/**
 * Entries offered, looked at, and kept — without a model.
 *
 * A proposal is the same whoever wrote it, so this drives it the way a script
 * would and checks the screen the way a person would. Doing it without a model
 * is the point: the part that can lose somebody's books is this part, and it is
 * worth having working before anything unattended is pointed at it.
 */

const HOW_MANY = async (page: Page): Promise<number> => {
  const open = await page.evaluate(() => window.choai.journal.summary({}))
  return open.ok ? open.value.transactions : -1
}

const openTheDemo = async (page: Page): Promise<void> => {
  await page.goto("/")
  await page.getByRole("button", { name: "Try the demo" }).click()
  await expect.poll(() => HOW_MANY(page)).toBe(9)
}

const SOUND = {
  date: "2026-03-01",
  payee: "supermarket",
  postings: [{ account: "expenses:food", amount: "$12.00" }, { account: "assets:cash" }],
}

const DOUBTFUL = {
  date: "2026-03-02",
  payee: "who knows",
  confidence: 0.4,
  why: "no account has been used for this payee before",
  postings: [{ account: "expenses:food", amount: "$3.00" }, { account: "assets:cash" }],
}

test("what is offered is shown before it is kept, and the doubtful ones are set aside", async ({
  page,
}) => {
  await openTheDemo(page)

  const offered = await page.evaluate(
    ([sound, doubtful]) =>
      window.choai.transaction.propose({ transactions: [sound, doubtful] as never }),
    [SOUND, DOUBTFUL],
  )
  expect(offered.ok).toBe(true)
  if (!offered.ok) return
  expect(offered.value.reads).toBe(true)

  // Nothing is kept by offering it.
  expect(await HOW_MANY(page)).toBe(9)

  // The dock opens on it by itself, with the sure one ticked and the other not.
  await expect(page.getByText("1 ready, 1 worth a look")).toBeVisible()
  const boxes = page.getByRole("checkbox")
  await expect(boxes.nth(0)).toBeChecked()
  await expect(boxes.nth(1)).not.toBeChecked()

  // Keeping the ticked one leaves the other where it was, offered afresh.
  await page.getByRole("button", { name: "Add 1 to the journal" }).click()
  await expect.poll(() => HOW_MANY(page)).toBe(10)
  await expect(page.getByText("0 ready, 1 worth a look")).toBeVisible()

  const left = await page.evaluate(() => window.choai.proposal.list({}))
  expect(left.ok && left.value.length).toBe(1)
  expect(left.ok && left.value[0]?.items.length).toBe(1)
})

test("something hledger will not read is refused, and the journal is left exactly as it was", async ({
  page,
}) => {
  await openTheDemo(page)
  const before = await page.evaluate(() => window.choai.report.balanceSheet({}))

  const offered = await page.evaluate(() =>
    window.choai.transaction.propose({
      transactions: [
        {
          date: "2026-03-01",
          payee: "will not balance",
          postings: [
            { account: "expenses:food", amount: "$10.00" },
            { account: "assets:cash", amount: "$99.00" },
          ],
        },
      ],
    }),
  )
  expect(offered.ok).toBe(true)
  if (!offered.ok) return

  expect(offered.value.reads).toBe(false)
  expect(offered.value.saidWhat).toBeTruthy()

  // Nothing was written, and — the assertion that would catch a missing
  // restore — what hledger answers afterwards is what it answered before.
  expect(await HOW_MANY(page)).toBe(9)
  const after = await page.evaluate(() => window.choai.report.balanceSheet({}))
  expect(after).toEqual(before)

  const kept = await page.evaluate(
    (id) => window.choai.proposal.apply({ id }),
    offered.value.id,
  )
  expect(kept.ok).toBe(false)
  expect(await HOW_MANY(page)).toBe(9)
})

test("a proposal made against a journal that has since moved is refused rather than applied", async ({
  page,
}) => {
  await openTheDemo(page)

  const offered = await page.evaluate(
    (sound) => window.choai.transaction.propose({ transactions: [sound as never] }),
    SOUND,
  )
  expect(offered.ok).toBe(true)
  if (!offered.ok) return

  // Somebody else writes in the meantime.
  const meanwhile = await page.evaluate(
    (sound) => window.choai.transaction.create(sound as never),
    { ...SOUND, payee: "somebody else" },
  )
  expect(meanwhile.ok).toBe(true)

  const kept = await page.evaluate((id) => window.choai.proposal.apply({ id }), offered.value.id)
  expect(kept.ok).toBe(false)
  expect(kept.ok ? "" : kept.error.at).toBe("stale-proposal")

  // Ten, not eleven: the write that got there first is still the only one.
  expect(await HOW_MANY(page)).toBe(10)
})
