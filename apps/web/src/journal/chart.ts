import { createResource, createRoot } from "solid-js"

import { ask } from "~/hledger/client"
import { getOrUndefined } from "~/lib/monad"
import { inChartOrder } from "./declarations"
import { journal } from "./store"

/**
 * What hledger takes each account to be, for whichever journal is open.
 *
 * Asked once as the journal changes rather than by each list that wants it:
 * four explorers putting the same question to a queue that answers one at a
 * time is three waits nobody needed.
 *
 * Here rather than in `declarations.ts` because that file is arithmetic on
 * names and this one is a question put to hledger — and a list that only wants
 * to know the order of things should not have to reach the open journal to find
 * out.
 */
const placings = createRoot(() =>
  createResource(
    () => getOrUndefined(journal()),
    async () => {
      const reply = await ask({ kind: "accountTypes" })
      return reply.ok ? reply.value : {}
    },
  ),
)

/**
 * The open journal's accounts, in the order its chart is read.
 *
 * Until hledger has answered there is no order to sort by, and what shows is
 * the order it arrived in — which is what was there before this existed, never
 * an empty list.
 */
export const inChartOrderNow = (accounts: readonly string[]): readonly string[] =>
  inChartOrder(accounts, placings[0]() ?? {})
