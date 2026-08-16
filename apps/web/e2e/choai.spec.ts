import { expect, test, type Page } from "@playwright/test"

import type { Choai } from "~/api/install"

declare global {
  interface Window {
    choai: Choai
  }
}

/**
 * The app driven as a tool rather than as a screen.
 *
 * There is nothing here that waits for a spinner or picks a row out of a table.
 * `ready` says the app has decided what is open, `idle` says everything asked
 * for has been answered, and every question in between is a capability.
 */

/** A journal to ask about. Opening one is a person's act, so it is done as one. */
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

test("the manifest says enough to be used by something that was not written against it", async ({
  page,
}) => {
  await page.goto("/")
  const manifest = await page.evaluate(() => window.choai.describe())

  expect(manifest.name).toBe("choai")
  expect(manifest.version).toBe("1")
  expect(Object.keys(manifest.capabilities).length).toBeGreaterThan(0)

  Object.entries(manifest.capabilities).forEach(([name, told]) => {
    expect(told.summary.length, `${name} says what it is for`).toBeGreaterThan(40)
    expect(told.arguments.type, `${name} takes an object`).toBe("object")
    expect(told.arguments.additionalProperties, `${name} refuses the unasked-for`).toBe(false)
    expect(Array.isArray(told.arguments.required), `${name} says which are required`).toBe(true)
    expect(typeof told.writes).toBe("boolean")
    expect(typeof told.leaves).toBe("boolean")
  })
})

test("what writes and what leaves the device are named, and neither drifts", async ({ page }) => {
  await page.goto("/")
  const manifest = await page.evaluate(() => window.choai.describe())
  const named = (of: (told: { writes: boolean; leaves: boolean; offered: boolean }) => boolean) =>
    Object.entries(manifest.capabilities)
      .filter(([, told]) => of(told))
      .map(([name]) => name)
      .sort()

  expect(named((told) => told.leaves)).toEqual(["github.push"])
  expect(named((told) => told.writes)).toEqual([
    "github.push",
    "proposal.apply",
    "transaction.create",
  ])

  // Two lines a capability must be added on the right side of, and neither is
  // derivable from the other. Nothing a model is given may put bytes outside
  // this device; and of the two that write, the one it is given is the one
  // whose writing was shown first.
  expect(named((told) => told.offered && told.leaves)).toEqual([])
  expect(named((told) => told.writes && !told.offered)).toEqual([
    "github.push",
    "transaction.create",
  ])
})

test("a question asked through the API and the same question on screen agree", async ({ page }) => {
  await openTheDemo(page)

  const answer = await page.evaluate(() => window.choai.report.incomeStatement({}))
  expect(answer.ok).toBe(true)
  if (!answer.ok) return

  await page.goto("/income-statement")
  await page.evaluate(() => window.choai.idle())

  await expect(page.getByText(answer.value.total.rendered).first()).toBeVisible()
  await Promise.all(
    answer.value.rows.map((row) => expect(page.getByText(row.amount.rendered).first()).toBeVisible()),
  )
})

test("figures come back exact, and never as a float", async ({ page }) => {
  await openTheDemo(page)

  const answer = await page.evaluate(async () =>
    JSON.stringify([
      await window.choai.report.balanceSheet({}),
      await window.choai.report.entries({ limit: 5 }),
      await window.choai.journal.similar({ description: "スーパー" }),
    ]),
  )

  expect(answer).not.toContain("floatingPoint")
  expect(answer).toContain("mantissa")
})

test("everything asked at once agrees with everything else", async ({ page }) => {
  await openTheDemo(page)

  const said = await page.evaluate(async () => {
    const many = await Promise.all(
      Array.from({ length: 30 }, (_, at) =>
        at % 3 === 0
          ? window.choai.report.balanceSheet({})
          : at % 3 === 1
            ? window.choai.report.incomeStatement({})
            : window.choai.report.entries({ limit: 5 }),
      ),
    )
    await window.choai.idle()
    return many.map((one) => (one.ok ? JSON.stringify(one.value) : `failed: ${one.error.at}`))
  })

  expect(new Set(said.filter((_, at) => at % 3 === 0)).size).toBe(1)
  expect(new Set(said.filter((_, at) => at % 3 === 1)).size).toBe(1)
  expect(new Set(said.filter((_, at) => at % 3 === 2)).size).toBe(1)
})

test("a refusal says which case it was and what would have fitted", async ({ page }) => {
  await openTheDemo(page)

  const unknown = await page.evaluate(() => window.choai.call("report.nope", {}))
  expect(unknown).toEqual({ ok: false, error: { at: "no-such-capability", name: "report.nope" } })

  const wrong = await page.evaluate(() => window.choai.call("journal.similar", { limit: "five" }))
  expect(wrong.ok).toBe(false)
  if (wrong.ok) return

  expect(wrong.error.at).toBe("bad-arguments")
  if (wrong.error.at !== "bad-arguments") return

  expect(wrong.error.wrong).toEqual([
    { path: "description", wanted: "to be given" },
    { path: "limit", wanted: "a number" },
  ])
  expect(wrong.error.wanted.required).toEqual(["description"])
})

test("what the agent looked at can be put in the title bar, and the screens follow", async ({
  page,
}) => {
  await openTheDemo(page)

  const shown = await page.evaluate(() => window.choai.view.setQuery({ query: "acct:expenses:rent" }))
  expect(shown.ok).toBe(true)

  // The query reaches the box a person types in, and the journal narrows to it.
  await expect(page.getByPlaceholder("hledger query")).toHaveValue("acct:expenses:rent")
  await expect(page.getByText("landlord").first()).toBeVisible()
  await expect(page.getByText("supermarket")).toHaveCount(0)
})

test("something arriving at the app is told there is a way in that is not the screen", async ({
  page,
}) => {
  // An agent driving a browser sees the screens, and nothing in them says there
  // is another door. The console is the one surface it reads by habit.
  const said: string[] = []
  page.on("console", (message) => {
    if (message.type() === "info") said.push(message.text())
  })

  await page.goto("/")
  await page.evaluate(() => window.choai.ready)
  expect(said.join("\n")).toContain("window.choai.describe()")

  // And one arriving by fetching the host is told the same, and told that
  // fetching is not how this one is called.
  const served = await page.request.get("/llms.txt")
  expect(served.status()).toBe(200)

  const text = await served.text()
  expect(text).toContain("The interface lives in the page")
  expect(text).toContain("describe()")

  // It illustrates rather than catalogues. Naming one to show the shape is what
  // an example is for; writing the list out would make a second telling of the
  // table, and that is the one that would be wrong within a month. The line is
  // drawn at a count because that is what actually distinguishes the two.
  const manifest = await page.evaluate(() => window.choai.describe())
  const all = Object.keys(manifest.capabilities)
  const named = all.filter((name) => text.includes(name))
  expect(named.length).toBeLessThan(all.length / 2)
})

test("with no journal open, a question about one says so rather than answering", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() => window.choai.ready)

  const answer = await page.evaluate(() => window.choai.report.balance({}))
  expect(answer).toEqual({ ok: false, error: { at: "no-journal" } })
})
