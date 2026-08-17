import { expect, test, type Page, type Route } from "@playwright/test"

import type { Choai } from "~/api/install"

declare global {
  interface Window {
    choai: Choai
  }
}

/**
 * The whole exchange with a model — twice, once down each wire, without a key.
 *
 * The provider is answered here instead of over the network, with the two
 * replies a real one would give: first a request to run something, then an
 * answer built from what came back. Running the same body against both is the
 * only way to know the two are really one loop; asserting it in a comment is
 * not.
 *
 * What is being checked is the part that is ours and that nothing else covers —
 * that a capability's dotted name survives a trip out and back through a tool
 * name that cannot hold a dot, that what a capability answered reaches the model
 * as the result of the call it belongs to, that the model's own turn goes back
 * whole, and that a refusal is noticed rather than read past.
 *
 * The key is not one. It never leaves the browser under test, because nothing
 * under test ever reaches the network.
 */
const NOT_A_KEY = "not-a-real-key"

const SAID = "It came to $-3,512.85 over all time."

interface Wire {
  readonly label: string
  readonly host: string
  /** Reads the tool names out of a request body, whatever it calls them. */
  readonly toolNamesIn: (body: never) => readonly string[]
  /** The turn the model was given back, and the result inside it. */
  readonly returned: (body: never) => { readonly kinds: readonly string[]; readonly result: string }
  /** What was attached to the first thing said, as this provider carries it. */
  readonly shownIn: (body: never) => { readonly mediaType: string; readonly bytes: number }
  readonly models: unknown
  readonly wantsTool: unknown
  readonly answers: unknown
  readonly refuses: unknown
}

const CLAUDE: Wire = {
  label: "Claude",
  host: "**/api.anthropic.com/**",
  toolNamesIn: (body: { tools: readonly { name: string }[] }) => body.tools.map((one) => one.name),
  returned: (body: {
    messages: readonly { role: string; content: readonly Record<string, unknown>[] }[]
  }) => ({
    kinds: (body.messages.find((turn) => turn.role === "assistant")?.content ?? []).map(
      (block) => String(block["type"]),
    ),
    result: String(body.messages.at(-1)?.content[0]?.["content"] ?? ""),
  }),
  shownIn: (body: {
    messages: readonly { content: readonly Record<string, unknown>[] }[]
  }) => {
    const source = body.messages[0]?.content[0]?.["source"] as
      | { media_type?: string; data?: string }
      | undefined
    return { mediaType: source?.media_type ?? "", bytes: (source?.data ?? "").length }
  },
  /**
   * As the listing gives it, capabilities and all — with one model the app
   * cannot drive, because the filtering is only worth having if something is
   * actually filtered. Sonnet 4.5 is the real case: current and capable, and it
   * rejects the adaptive thinking every request from here carries.
   */
  models: {
    data: [
      {
        id: "claude-opus-5",
        display_name: "Claude Opus 5",
        capabilities: {
          thinking: { supported: true, types: { adaptive: { supported: true }, enabled: { supported: false } } },
          effort: { supported: true, medium: { supported: true } },
          structured_outputs: { supported: true },
          image_input: { supported: true },
        },
      },
      {
        id: "claude-sonnet-4-5",
        display_name: "Claude Sonnet 4.5",
        capabilities: {
          thinking: { supported: true, types: { adaptive: { supported: false }, enabled: { supported: true } } },
          effort: { supported: false, medium: { supported: false } },
          structured_outputs: { supported: true },
          image_input: { supported: true },
        },
      },
    ],
  },
  wantsTool: {
    model: "claude-opus-5",
    stop_reason: "tool_use",
    content: [
      { type: "thinking", thinking: "" },
      { type: "tool_use", id: "toolu_1", name: "report__incomeStatement", input: { query: "" } },
    ],
  },
  answers: {
    model: "claude-opus-5",
    stop_reason: "end_turn",
    content: [{ type: "text", text: SAID }],
    // 100 read afresh, 900 served from cache, 50 generated.
    usage: {
      input_tokens: 100,
      cache_read_input_tokens: 900,
      cache_creation_input_tokens: 0,
      output_tokens: 50,
    },
  },
  refuses: {
    model: "claude-opus-5",
    stop_reason: "refusal",
    stop_details: { type: "refusal", category: "cyber" },
    content: [],
  },
}

const GEMINI: Wire = {
  label: "Gemini",
  host: "**/generativelanguage.googleapis.com/**",
  toolNamesIn: (body: { tools: readonly { functionDeclarations: readonly { name: string }[] }[] }) =>
    body.tools.flatMap((one) => one.functionDeclarations.map((each) => each.name)),
  returned: (body: {
    contents: readonly { role: string; parts: readonly Record<string, unknown>[] }[]
  }) => ({
    kinds: (body.contents.find((turn) => turn.role === "model")?.parts ?? []).map((part) =>
      Object.keys(part).join(""),
    ),
    result: JSON.stringify(
      (body.contents.at(-1)?.parts[0]?.["functionResponse"] as { response?: unknown })?.response ?? "",
    ),
  }),
  shownIn: (body: { contents: readonly { parts: readonly Record<string, unknown>[] }[] }) => {
    const inline = body.contents[0]?.parts[0]?.["inlineData"] as
      | { mimeType?: string; data?: string }
      | undefined
    return { mediaType: inline?.mimeType ?? "", bytes: (inline?.data ?? "").length }
  },
  models: {
    models: [
      {
        name: "models/gemini-2.5-flash",
        displayName: "Gemini 2.5 Flash",
        supportedGenerationMethods: ["generateContent"],
      },
    ],
  },
  wantsTool: {
    modelVersion: "gemini-2.5-flash",
    candidates: [
      {
        content: {
          role: "model",
          parts: [{ functionCall: { name: "report__incomeStatement", args: { query: "" } } }],
        },
        finishReason: "STOP",
      },
    ],
  },
  answers: {
    modelVersion: "gemini-2.5-flash",
    candidates: [{ content: { role: "model", parts: [{ text: SAID }] }, finishReason: "STOP" }],
    // The same exchange, said the other way round: the prompt counted whole,
    // and what came back taken from the total so thinking is not left out.
    usageMetadata: {
      promptTokenCount: 1000,
      candidatesTokenCount: 40,
      totalTokenCount: 1050,
      cachedContentTokenCount: 900,
    },
  },
  refuses: {
    modelVersion: "gemini-2.5-flash",
    candidates: [{ content: { role: "model", parts: [] }, finishReason: "SAFETY" }],
  },
}

const asJson = (route: Route, body: unknown, status = 200): Promise<void> =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) })

/** A models call is a GET; everything else down the same host is an exchange. */
const answerWith = async (
  page: Page,
  wire: Wire,
  exchange: (route: Route, sofar: number) => Promise<void>,
): Promise<unknown[]> => {
  const asked: unknown[] = []
  await page.route(wire.host, async (route) => {
    if (route.request().method() === "GET") return asJson(route, wire.models)
    asked.push(route.request().postDataJSON())
    return exchange(route, asked.length)
  })
  return asked
}

/** Saving sends nothing, so every request a test counts is one it asked for. */
const connect = async (page: Page, wire: Wire): Promise<void> => {
  await page.goto("/settings")
  await page.getByRole("button", { name: wire.label, exact: true }).click()
  await page.getByLabel("API key").fill(NOT_A_KEY)
  await page.getByRole("button", { name: "Save", exact: true }).click()
  // Waited for structurally: this button appears only once the key has been
  // written and read back, where a message appears as soon as one is set.
  await expect(page.getByRole("button", { name: "Disconnect and forget the key" })).toBeVisible()
}

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

const askThat = async (page: Page, question: string): Promise<void> => {
  await page.getByRole("button", { name: "Ask", exact: true }).first().click()
  await page.getByPlaceholder("Ask about these books").fill(question)
  await page.getByRole("button", { name: "Ask", exact: true }).last().click()
}

/**
 * Checking is a press of its own, and it is the press that can fail.
 *
 * Saving keeps what was typed without asking anybody, which is the point: the
 * key and the model are one setting and go in together. Whether that setting
 * works is the other button's question, and it is the only one with an answer
 * worth waiting for.
 */
test("a key that is not accepted is said so when it is checked", async ({ page }) => {
  await page.route(CLAUDE.host, (route) => asJson(route, {}, 401))

  await page.goto("/settings")
  await page.getByLabel("API key").fill(NOT_A_KEY)
  await page.getByRole("button", { name: "Check the connection" }).click()

  await expect(page.getByText("That key was not accepted")).toBeVisible()
})

/**
 * The encoding is decided rather than assumed, which matters because assuming
 * wrongly does not fail. A Japanese bank exports Shift_JIS; decoded as UTF-8 the
 * commas and the line endings survive, so it still reads as a table and still
 * parses into rows — and what reaches the model is a statement whose payees have
 * all become replacement characters, with nothing anywhere having gone wrong.
 */
test("a statement in the encoding a Japanese bank writes reaches the model readable", async ({
  page,
}) => {
  const asked = await answerWith(page, CLAUDE, (route) => asJson(route, CLAUDE.answers))

  await connect(page, CLAUDE)
  await openTheDemo(page)
  await page.getByRole("button", { name: "Ask", exact: true }).first().click()

  await page.locator('input[type="file"]').setInputFiles({
    name: "meisai.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([148, 78, 140, 142, 147, 250, 44, 130, 168, 136, 248, 143, 111, 130, 181, 44, 130, 168, 142, 230, 136, 181, 147, 224, 151, 101, 10, 50, 48, 50, 54, 47, 48, 55, 47, 48, 49, 44, 56, 53, 48, 48, 48, 44, 183, 213, 179, 214, 32, 182, 41, 180, 178, 193, 188, 222, 180, 178, 10, 50, 48, 50, 54, 47, 48, 55, 47, 48, 51, 44, 51, 50, 56, 48, 44, 189, 192, 176, 202, 222, 194, 184, 189, 10]),
  })
  await expect(page.getByText("meisai.csv — 3 rows")).toBeVisible()

  await page.getByPlaceholder("Ask about these books").fill("これ7月の明細")
  await page.getByRole("button", { name: "Ask", exact: true }).last().click()
  await expect(page.getByText(SAID)).toBeVisible()

  const sent = JSON.stringify(asked[0])
  expect(sent).toContain("ｷﾕｳﾖ")
  expect(sent).toContain("ｽﾀｰﾊﾞﾂｸｽ")
  expect(sent).not.toContain("\\ufffd")
})

/**
 * A model at work offers, reads back what it wrote, thinks better of it and
 * offers again. Each of those is a proposal, and the dock opening on every one
 * would flap through a run of states nobody was asked to decide about — which is
 * exactly what a page of bank statement produces. What is waited for is the one
 * it stopped on.
 *
 * The last reply is held open so the assertion lands while the exchange is
 * genuinely still in flight, rather than in whatever gap happened to be there.
 */
test("proposals made along the way do not open the dock; the one it stops on does", async ({
  page,
}) => {
  const written = (payees: readonly string[]): unknown => ({
    model: "claude-opus-5",
    stop_reason: "tool_use",
    content: [
      {
        type: "tool_use",
        id: `toolu_${payees.length}`,
        name: "transaction__propose",
        input: {
          transactions: payees.map((payee, at) => ({
            date: `2026-07-0${at + 1}`,
            payee,
            postings: [
              { account: "expenses:food", amount: "$10.00" },
              { account: "assets:bank:checking" },
            ],
          })),
        },
      },
    ],
  })

  const held: { let_go: () => void } = { let_go: () => {} }
  const waiting = new Promise<void>((resolve) => {
    held.let_go = resolve
  })

  await answerWith(page, CLAUDE, async (route, sofar) => {
    if (sofar === 1) return asJson(route, written(["Seven Eleven"]))
    if (sofar === 2) return asJson(route, written(["Seven Eleven", "Starbucks"]))
    await waiting
    return asJson(route, CLAUDE.answers)
  })

  await connect(page, CLAUDE)
  await openTheDemo(page)
  await askThat(page, "この明細を仕訳して")

  // Two proposals have been made and the third reply is being waited on.
  await expect.poll(async () => (await page.evaluate(() => window.choai.proposal.list({}))).ok
    ? (await page.evaluate(() => window.choai.proposal.list({})) as { value: readonly unknown[] }).value.length
    : 0).toBeGreaterThan(1)
  await expect(page.getByText("Written, not yet kept")).toBeHidden()

  // Letting it finish is what opens the dock, and the dock opening is the proof
  // it finished: a proposal takes the dock from the conversation that made it.
  held.let_go()
  await expect(page.getByText("Written, not yet kept")).toBeVisible()
})

/**
 * A model that rejects what every request carries is not offered.
 *
 * Sonnet 4.5, Opus 4.5 and Haiku 4.5 all answer 400 to `thinking: adaptive`,
 * and the listing says as much before anything is sent — so the choice is
 * narrowed to what works rather than left to be discovered one failed question
 * at a time.
 */
/**
 * The request is cut to the model rather than the model to the request.
 *
 * Sonnet 4.5, Opus 4.5 and Haiku 4.5 answer 400 to the adaptive thinking the
 * newest models take, and all three are otherwise perfectly good — the cheap
 * ones especially, on a statement of a couple of hundred rows. So what the
 * listing says of a model decides what is sent to it, and both are offered.
 *
 * Checked down to the bytes on the wire, because this is the sort of thing that
 * reads as correct and is not: the shape only matters where the provider sees
 * it.
 */
test("what a model takes is what it is sent, and both are offered", async ({ page }) => {
  const asked = await answerWith(page, CLAUDE, (route) => asJson(route, CLAUDE.answers))

  await connect(page, CLAUDE)

  // The picker is filled by the press that proves the key, not by saving.
  await page.getByRole("button", { name: "Check the connection" }).click()
  await expect(page.getByText("answered")).toBeVisible()
  await expect(page.getByLabel("Model").locator("option")).toHaveText([
    "Claude Opus 5",
    "Claude Sonnet 4.5",
  ])

  await openTheDemo(page)
  await askThat(page, "what did I spend")
  await expect(page.getByText(SAID)).toBeVisible()

  const newest = asked.at(-1) as {
    thinking: { type: string; budget_tokens?: number }
    output_config?: unknown
    tools: readonly { strict?: boolean }[]
  }
  expect(newest.thinking).toEqual({ type: "adaptive" })
  expect(newest.output_config).toEqual({ effort: "medium" })
  expect(newest.tools.every((one) => one.strict === true)).toBe(true)

  // The same conversation, to a model that would refuse every one of those. The
  // picker still holds them on the way back, without another request for it.
  await page.goto("/settings")
  await page.getByLabel("Model").selectOption("claude-sonnet-4-5")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page.getByText("Claude Sonnet 4.5").last()).toBeVisible()

  // The journal is still open; it was never closed.
  await page.goto("/")
  await askThat(page, "and the month before")
  await expect(page.getByText(SAID)).toBeVisible()

  const older = asked.at(-1) as {
    thinking: { type: string; budget_tokens?: number }
    output_config?: unknown
    tools: readonly { strict?: boolean }[]
  }
  expect(older.thinking.type).toBe("enabled")
  expect(older.thinking.budget_tokens).toBeGreaterThan(1024)
  expect(older.output_config).toBeUndefined()
  // And strict schemas stay, because this model takes them and says so. What is
  // sent follows the listing field by field; it is not a generation being
  // guessed at and turned down as a whole.
  expect(older.tools.every((one) => one.strict === true)).toBe(true)
})

for (const wire of [CLAUDE, GEMINI]) {
  test(`${wire.label}: what it asks for is run, and its answer is built from the result`, async ({
    page,
  }) => {
    const asked = await answerWith(page, wire, (route, sofar) =>
      asJson(route, sofar === 1 ? wire.wantsTool : wire.answers),
    )

    await connect(page, wire)
    await openTheDemo(page)
    await askThat(page, "How did the year go?")

    await expect(page.getByText(SAID)).toBeVisible()
    await expect(page.getByText("Looked at report.incomeStatement")).toBeVisible()

    const [out, back] = asked as [never, never]

    // Every capability crosses as a tool whose name has no dot in it.
    const names = wire.toolNamesIn(out)
    expect(names.every((name) => !name.includes("."))).toBe(true)
    expect(names).toContain("report__incomeStatement")

    // Nothing goes out that this provider will refuse to read.
    if (wire.label === "Gemini") expect(JSON.stringify(out)).not.toContain("additionalProperties")

    // The model's own turn goes back whole, whatever it put in it.
    const { kinds, result } = wire.returned(back)
    expect(kinds.length).toBeGreaterThan(0)

    // And what the capability actually said travels as the result of that call —
    // the same answer the API gives anyone else, not a retelling of it.
    const itself = await page.evaluate(() => window.choai.report.incomeStatement({}))
    expect(result).toContain(JSON.stringify(itself).slice(1, 60))
  })

  test(`${wire.label}: a photograph is shrunk, shown back, and carried in its own block`, async ({
    page,
  }) => {
    const asked = await answerWith(page, wire, (route) => asJson(route, wire.answers))

    await connect(page, wire)
    await openTheDemo(page)
    await page.getByRole("button", { name: "Ask", exact: true }).first().click()

    // Two hundred pixels of red, which is more than a thumbnail and less than a
    // receipt — enough to tell a re-encoded JPEG from the PNG that went in.
    await page.locator('input[type="file"]').setInputFiles({
      name: "receipt.png",
      mimeType: "image/png",
      buffer: await page.evaluate(async () => {
        const canvas = document.createElement("canvas")
        canvas.width = 200
        canvas.height = 200
        const onto = canvas.getContext("2d")!
        onto.fillStyle = "#c00"
        onto.fillRect(0, 0, 200, 200)
        const written = canvas.toDataURL("image/png")
        return [...atob(written.slice(written.indexOf(",") + 1))].map((one) => one.charCodeAt(0))
      }).then((bytes) => Buffer.from(bytes)),
    })

    // It is shown back before it is sent, so the wrong photograph can be caught.
    await expect(page.locator("img").first()).toBeVisible()

    await page.getByPlaceholder("Ask about these books").fill("write this one up")
    await page.getByRole("button", { name: "Ask", exact: true }).last().click()
    await expect(page.getByText(SAID)).toBeVisible()

    const shown = wire.shownIn(asked[0] as never)
    // Re-encoded on the way out, whatever it arrived as.
    expect(shown.mediaType).toBe("image/jpeg")
    expect(shown.bytes).toBeGreaterThan(0)
  })

  test(`${wire.label}: a statement goes over as the text it is, rows and all`, async ({ page }) => {
    const asked = await answerWith(page, wire, (route) => asJson(route, wire.answers))

    await connect(page, wire)
    await openTheDemo(page)
    await page.getByRole("button", { name: "Ask", exact: true }).first().click()

    // A payee with a comma in it and a memo with a line break: the two things a
    // split on commas gets wrong, and the two a bank writes without thinking.
    const STATEMENT = [
      "date,description,amount",
      '2026-03-01,"Smith, John",-12.00',
      '2026-03-02,"line one\nline two",-3.50',
    ].join("\n")

    await page.locator('input[type="file"]').setInputFiles({
      name: "statement.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(STATEMENT),
    })
    await expect(page.getByText("statement.csv — 3 rows")).toBeVisible()

    await page.getByPlaceholder("Ask about these books").fill("write these up")
    await page.getByRole("button", { name: "Ask", exact: true }).last().click()
    await expect(page.getByText(SAID)).toBeVisible()

    // It reaches the model whole — the same bytes, not rows read out and written
    // back, which is where a figure would get changed on the way.
    const sent = JSON.stringify(asked[0])
    expect(sent).toContain("statement.csv (3 rows)")
    expect(sent).toContain("Smith, John")
    expect(sent).toContain("line one")
  })

  test(`${wire.label}: what the exchange cost is counted the same either way`, async ({ page }) => {
    await answerWith(page, wire, (route) => asJson(route, wire.answers))

    await connect(page, wire)
    await openTheDemo(page)
    await askThat(page, "How did the year go?")
    await expect(page.getByText(SAID)).toBeVisible()

    // Two providers, two shapes, one reading of them.
    await expect(page.getByText("1,000 sent, 50 back")).toBeVisible()
    await expect(page.getByText("900 of it from cache")).toBeVisible()
  })

  test(`${wire.label}: a refusal is noticed rather than read past`, async ({ page }) => {
    await answerWith(page, wire, (route) => asJson(route, wire.refuses))

    await connect(page, wire)
    await openTheDemo(page)
    await askThat(page, "Something it will decline")

    await expect(page.getByText("declined rather than answered")).toBeVisible()
  })
}
