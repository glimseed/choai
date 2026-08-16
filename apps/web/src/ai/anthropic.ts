import { Err, Ok, type Result } from "~/lib/monad"
import {
  readJson,
  reach,
  type Ask,
  type Block,
  type Called,
  type Failure,
  type Model,
  type Reply,
  type Shown,
  type Spent,
  type Stopped,
  type Talker,
  type Turn,
} from "./talker"

/**
 * Claude, from the browser, with the reader's own key.
 *
 * There is no server here and there is not going to be one, so the request goes
 * straight to api.anthropic.com and says so: the header below is the documented
 * way of admitting that the key is in a browser, and it means exactly what it
 * says.
 *
 * Turns come back and go out again untouched. Thinking blocks in particular have
 * to travel unedited, and the way to be sure of that is never to have taken them
 * apart.
 */

const ROOT = "https://api.anthropic.com"

const headers = (key: string): HeadersInit => ({
  "x-api-key": key,
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true",
  "content-type": "application/json",
})

const failureOf = async (response: Response): Promise<Failure> => {
  const detail = await response.text().catch(() => "")
  if (response.status === 401 || response.status === 403) return { kind: "unauthorised" }
  if (response.status === 429) {
    const after = Number(response.headers.get("retry-after"))
    return { kind: "rate-limited", ...(Number.isFinite(after) ? { retryAfter: after } : {}) }
  }
  if (response.status === 529) return { kind: "overloaded" }
  return { kind: "refused", status: response.status, detail }
}

/** Claude's words for stopping, in the four that mean different things here. */
const stoppedBy = (reason: string): Stopped => {
  switch (reason) {
    case "tool_use":
      return "tools"
    case "refusal":
      return "refused"
    case "max_tokens":
      return "cut-off"
    default:
      return "done"
  }
}

/**
 * What the exchange cost.
 *
 * `input_tokens` is the part that was not cached, not the whole prompt — the
 * cached and newly-cached parts are counted beside it — so the three are added
 * to get what was actually sent.
 */
const spentOn = (usage: {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}): Spent => {
  const cached = usage.cache_read_input_tokens ?? 0
  return {
    sent: (usage.input_tokens ?? 0) + cached + (usage.cache_creation_input_tokens ?? 0),
    back: usage.output_tokens ?? 0,
    cached,
  }
}

const models = async (key: string): Promise<Result<readonly Model[], Failure>> => {
  const reached = await reach(`${ROOT}/v1/models?limit=20`, { method: "GET", headers: headers(key) })
  if (!reached.ok) return reached
  if (!reached.value.ok) return Err(await failureOf(reached.value))

  const body = await readJson<{ data?: readonly { id: string; display_name?: string }[] }>(reached.value)
  return body.ok
    ? Ok((body.value.data ?? []).map((one) => ({ id: one.id, label: one.display_name ?? one.id })))
    : body
}

/**
 * One exchange.
 *
 * Thinking is asked for explicitly rather than left to the model's default,
 * because the default differs between models and because leaving it off is
 * worse than it sounds: without it a tool call is sometimes written out as
 * ordinary text, which reads like an answer and runs nothing.
 *
 * `maxTokens` bounds thinking and answer together, so it is set with room for
 * both rather than around the length of the answer alone.
 *
 * The tools and the instructions are marked to be cached. They render ahead of
 * everything else and are the same bytes every turn — the facts about the open
 * journal are deliberately in the first thing said rather than up here, so that
 * opening another book does not throw the cache away.
 */
const send = async (key: string, ask: Ask): Promise<Result<Reply, Failure>> => {
  const reached = await reach(`${ROOT}/v1/messages`, {
    method: "POST",
    headers: headers(key),
    body: JSON.stringify({
      model: ask.model,
      max_tokens: ask.maxTokens,
      system: [{ type: "text", text: ask.system, cache_control: { type: "ephemeral" } }],
      messages: ask.turns.map((turn) => ({
        role: turn.role === "model" ? "assistant" : "user",
        content: turn.content,
      })),
      tools: ask.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.schema,
        strict: true,
      })),
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
    }),
  })
  if (!reached.ok) return reached
  if (!reached.value.ok) return Err(await failureOf(reached.value))

  const body = await readJson<{
    model?: string
    stop_reason?: string
    stop_details?: { category?: string | null } | null
    content?: readonly Block[]
    usage?: Parameters<typeof spentOn>[0]
  }>(reached.value)
  if (!body.ok) return body

  const category = body.value.stop_details?.category
  return Ok({
    model: body.value.model ?? ask.model,
    stopped: stoppedBy(body.value.stop_reason ?? "end_turn"),
    ...(typeof category === "string" ? { why: category } : {}),
    content: body.value.content ?? [],
    spent: spentOn(body.value.usage ?? {}),
  })
}

export const anthropic: Talker = {
  id: "anthropic",
  label: "Claude",
  keysFrom: "https://platform.claude.com/settings/keys",
  defaultModel: "claude-opus-5",
  models,
  send,

  said: (text: string, shown: readonly Shown[] = []): Turn => ({
    role: "user",
    content: [
      ...shown.map((one) => ({
        type: "image",
        source: { type: "base64", media_type: one.mediaType, data: one.data },
      })),
      { type: "text", text },
    ],
  }),

  answering: (results): Turn => ({
    role: "user",
    content: results.map((result) => ({
      type: "tool_result",
      tool_use_id: result.id,
      content: JSON.stringify(result.answer),
    })),
  }),

  textIn: (blocks): string =>
    blocks
      .filter((block) => block["type"] === "text" && typeof block["text"] === "string")
      .map((block) => block["text"] as string)
      .join("\n"),

  calledIn: (blocks): readonly Called[] =>
    blocks.flatMap((block) =>
      block["type"] === "tool_use" && typeof block["id"] === "string" && typeof block["name"] === "string"
        ? [{ id: block["id"], name: block["name"], input: block["input"] }]
        : [],
    ),
}
