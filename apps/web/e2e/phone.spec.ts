import { expect, test, type Page } from "@playwright/test"

import type { Choai } from "~/api/install"

declare global {
  interface Window {
    choai: Choai
  }
}

/**
 * A window too narrow to hold the list and the work at once.
 *
 * The rail and the explorer settle at some width between them; where that is
 * more than half of what there is, they take all of it and the work goes behind
 * them, reached by choosing something and left by a way back. Nothing decides
 * this by asking what kind of device it is — the same rule holds for a desktop
 * window dragged thin.
 *
 * Measured rather than looked at: "the panel is wide enough" and "the panel
 * reaches the far edge" are different claims, and only the second is the one
 * being made.
 */
const PHONE = { width: 375, height: 800 }
const DESK = { width: 1280, height: 800 }

const openTheDemo = async (page: Page): Promise<void> => {
  await page.goto("/")
  await page.getByRole("button", { name: "Try the demo" }).click()
  await expect
    .poll(async () => {
      const open = await page.evaluate(() => window.choai.journal.summary({}))
      return open.ok ? open.value.transactions : 0
    })
    .toBe(9)
}

/** The explorer: what it holds, for showing, and its region, for measuring. */
const explorer = (page: Page) => page.getByRole("button", { name: "All accounts" })
const listRegion = (page: Page) => page.locator("aside").first()
const anAccount = (page: Page) => page.getByRole("button", { name: "food", exact: true })
const back = (page: Page) => page.getByRole("button", { name: "Back to the list" })

test("a narrow window opens on the work, with the list a press away", async ({ page }) => {
  await page.setViewportSize(PHONE)
  await openTheDemo(page)

  // The work has the window: the list is not sitting in front of it, which is
  // what would leave somebody without a journal unable to reach the offer of one.
  await expect(explorer(page)).toBeHidden()
  await expect(back(page)).toBeVisible()

  await back(page).click()

  // Reaching the far edge, rather than merely being wide: the work is behind it
  // rather than beside it. Polled because the widths are animated, and half way
  // through one they are neither the old answer nor the new.
  await expect
    .poll(async () => {
      const list = (await listRegion(page).boundingBox())!
      return Math.round(list.x + list.width)
    })
    .toBeGreaterThanOrEqual(PHONE.width - 1)
  await expect(back(page)).toBeHidden()
})

test("choosing in the list is how the work is reached, and there is a way back", async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  await openTheDemo(page)
  await back(page).click()

  await anAccount(page).click()

  // The list is put away and the work has the window.
  await expect(back(page)).toBeVisible()
  await expect(explorer(page)).toBeHidden()

  // And what was chosen was not thrown away on the way.
  await expect(page.getByRole("searchbox")).toHaveValue("acct:expenses:food")

  await back(page).click()
  await expect(explorer(page)).toBeVisible()
  await expect(back(page)).toBeHidden()
})

test("the rail changes which list is shown rather than leaving it", async ({ page }) => {
  await page.setViewportSize(PHONE)
  await openTheDemo(page)
  await back(page).click()

  await page.getByRole("button", { name: "Balance sheet" }).first().click()

  await expect(explorer(page)).toBeVisible()
  await expect(back(page)).toBeHidden()
})

test("a window with room for both is left as it was", async ({ page }) => {
  await page.setViewportSize(DESK)
  await openTheDemo(page)

  const list = (await listRegion(page).boundingBox())!
  // Nowhere near the far edge: the work is beside it, not behind it.
  expect(list.x + list.width).toBeLessThan(DESK.width / 2)

  await anAccount(page).click()
  await expect(explorer(page)).toBeVisible()
  await expect(back(page)).toBeHidden()
  await expect(page.getByRole("searchbox")).toHaveValue("acct:expenses:food")
})

/**
 * Going to the text behind the journal is going to the work, not staying in the
 * list — so it puts the list away like choosing an account does.
 *
 * And it is a way in only. It used to turn into its own way out once you were
 * there, which meant two ways back that differ by which screen you are on; the
 * one at the top of the work is the way back from anything reached from this
 * list, and one of those is enough to learn.
 */
test("going to the journal's text opens it as the work", async ({ page }) => {
  await page.setViewportSize(PHONE)
  await openTheDemo(page)
  await back(page).click()

  await page.getByRole("button", { name: "Edit the text" }).click()

  await expect(explorer(page)).toBeHidden()
  await expect(back(page)).toBeVisible()
  await expect(page).toHaveURL(/\/source/)

  // Back to the list, and the way in is not offered again from where it leads.
  await back(page).click()
  await expect(explorer(page)).toBeVisible()
  await expect(page.getByRole("button", { name: "Edit the text" })).toBeHidden()

  // And the journal itself is a rail press away from there.
  await page.getByRole("button", { name: "Journal", exact: true }).first().click()
  await expect(page).toHaveURL(/^[^?]*\/(\?|$)/)
  await expect(page.getByRole("button", { name: "Edit the text" })).toBeVisible()
})

/** With room for both, it is a filter's neighbour and moves nothing. */
test("on a wide window the text is opened beside the list, not instead of it", async ({ page }) => {
  await page.setViewportSize(DESK)
  await openTheDemo(page)

  await page.getByRole("button", { name: "Edit the text" }).click()

  await expect(explorer(page)).toBeVisible()
  await expect(back(page)).toBeHidden()
  await expect(page).toHaveURL(/\/source/)
})
