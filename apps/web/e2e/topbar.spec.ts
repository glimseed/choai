import { expect, test, type Page } from "@playwright/test"

import type { Choai } from "~/api/install"

declare global {
  interface Window {
    choai: Choai
  }
}

/**
 * The top bar, measured rather than looked at.
 *
 * The search box is centred on the bar, which means it begins at half of
 * whatever is left over — so every pixel of its idle width costs half a pixel
 * of room on each side, and it can walk onto the slot beside it without any
 * of them moving, since it is laid over the row rather than in it. That is not
 * something to check by eye at one window size.
 *
 * The worst case is the journal's name at its cap, not at whatever this journal
 * happens to be called, so the cap is what is measured against.
 */
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

const WINDOWS = [
  { what: "a small phone", width: 375 },
  { what: "a phone", width: 393 },
  { what: "a tablet", width: 768 },
  { what: "a desktop", width: 1280 },
] as const

for (const { what, width } of WINDOWS) {
  test(`on ${what} the search box clears the journal's name`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await openTheDemo(page)

    const search = page.getByRole("searchbox")
    const name = page.locator("button", { hasText: "▾" }).first()

    const box = (await search.boundingBox())!
    const named = (await name.boundingBox())!
    const cap = await name.evaluate((one) => parseFloat(getComputedStyle(one).maxWidth))

    expect(box.x).toBeGreaterThan(named.x + cap)
    // And it is still something somebody could type into.
    expect(box.width).toBeGreaterThanOrEqual(88)
  })
}

test("it widens for what is being typed, and stays wide while that is still there", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await openTheDemo(page)

  const search = page.getByRole("searchbox")
  const idle = (await search.boundingBox())!.width

  await search.fill("acct:expenses")
  await expect.poll(async () => (await search.boundingBox())!.width).toBeGreaterThan(idle * 2)

  // Put away, and it keeps its room: a filter that is on and out of sight is
  // worse than one taking up space, since the box is the only place the
  // question every figure is answering is written down.
  await page.locator("body").click({ position: { x: 5, y: 400 } })
  await expect(search).not.toBeFocused()
  expect((await search.boundingBox())!.width).toBeGreaterThan(idle * 2)

  // Emptied, it gives the room back.
  await search.fill("")
  await page.locator("body").click({ position: { x: 5, y: 400 } })
  await expect.poll(async () => (await search.boundingBox())!.width).toBe(idle)
})
