import { callByName } from "~/api/call"
import type { Hitch } from "~/api/hitch"
import { Ok, type Result } from "~/lib/monad"
import { capabilityOf } from "./naming"
import { instructions, toolsOffered } from "./prompt"
import type { Failure, Shown, Talker, Turn } from "./talker"

/**
 * One exchange: ask, run whatever was asked for, ask again with the answers.
 *
 * Nothing here holds state, and nothing here knows whose model it is talking to
 * — that is the `Talker`'s to know. What happens along the way is handed to
 * `onBeat` as it happens, so a panel can show it arriving without this knowing
 * there is a panel.
 *
 * What comes back from a capability goes over as it is, `Hitch` and all. A model
 * reads JSON perfectly well, and a failure said in its own terms — which field
 * was wrong, what hledger objected to, on which line — is worth more to
 * something that is about to try again than any sentence we could write for it.
 */

/** Room for thinking and an answer together, where a provider counts them as one. */
const ROOM = 16000

/** How many times round before we stop, whatever the model still wants. */
const TURNS = 12

export interface Said {
  readonly from: "you" | "ai"
  readonly text: string
  /** What was attached to it, for showing back. Only ever on what a person said. */
  readonly shown?: readonly Shown[]
}

export interface Ran {
  readonly capability: string
  readonly args: unknown
  readonly answer: Result<unknown, Hitch>
}

export type Beat = { readonly is: "said"; readonly said: Said } | { readonly is: "ran"; readonly ran: Ran }

export type Ending =
  | { readonly stopped: "done" }
  | { readonly stopped: "refused"; readonly why?: string }
  | { readonly stopped: "cut-off" }
  | { readonly stopped: "too-many-turns" }

export interface Conversed {
  readonly ending: Ending
  /** The conversation as it now stands, for the next thing said to be added to. */
  readonly turns: readonly Turn[]
}

export const converse = (
  talker: Talker,
  key: string,
  model: string,
  turns: readonly Turn[],
  onBeat: (beat: Beat) => void,
): Promise<Result<Conversed, Failure>> => step(talker, key, model, turns, onBeat, TURNS)

const step = async (
  talker: Talker,
  key: string,
  model: string,
  turns: readonly Turn[],
  onBeat: (beat: Beat) => void,
  left: number,
): Promise<Result<Conversed, Failure>> => {
  if (left <= 0) return Ok({ ending: { stopped: "too-many-turns" }, turns })

  const reply = await talker.send(key, {
    model,
    system: instructions(),
    turns,
    tools: toolsOffered(),
    maxTokens: ROOM,
  })
  if (!reply.ok) return reply

  if (reply.value.stopped === "refused") {
    const why = reply.value.why
    return Ok({ ending: { stopped: "refused", ...(why === undefined ? {} : { why }) }, turns })
  }

  const grown: readonly Turn[] = [...turns, { role: "model", content: reply.value.content }]

  const spoke = talker.textIn(reply.value.content)
  if (spoke !== "") onBeat({ is: "said", said: { from: "ai", text: spoke } })

  if (reply.value.stopped === "cut-off") return Ok({ ending: { stopped: "cut-off" }, turns: grown })

  const asked = talker.calledIn(reply.value.content)
  if (asked.length === 0) return Ok({ ending: { stopped: "done" }, turns: grown })

  const answers = await Promise.all(
    asked.map(async (one) => {
      const capability = capabilityOf(one.name)
      const answer = await callByName(capability, one.input)
      onBeat({ is: "ran", ran: { capability, args: one.input, answer } })
      return { id: one.id, name: one.name, answer }
    }),
  )

  return step(talker, key, model, [...grown, talker.answering(answers)], onBeat, left - 1)
}
