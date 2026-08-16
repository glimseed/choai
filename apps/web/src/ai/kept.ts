/**
 * What talking to a model needs: a key per provider, which one to use, and
 * which of its models.
 *
 * A key is kept in this browser and sent to that provider's host and nowhere
 * else. It is here rather than in localStorage for the same one reason the
 * GitHub token is — everything else this app keeps is here — and in a store of
 * its own rather than beside that token, because disconnecting from GitHub
 * clears that store whole and these keys have nothing to do with GitHub.
 *
 * One row per provider, so changing providers does not throw away the key for
 * the other one. Nothing is shared between them: a key is only ever read with
 * the provider it was saved under.
 *
 * **Two modules may read this, and no more:** the one that talks to the model
 * and the panel where a key is typed in. Nothing under `api/` imports it, which
 * is what keeps a key out of reach of anything the model itself can ask for.
 * There is no linter to hold that line, so it is written here instead.
 */

import { STORE, within } from "~/lib/idb"
import type { Which } from "./talker"

const KEYS = STORE.keys
const CHOSEN = "chosen"

interface Row {
  readonly id: string
  readonly key?: string
  readonly model?: string
  readonly which?: Which
}

const row = async (id: string): Promise<Row | undefined> => {
  const found = await within("readonly", [KEYS], (transaction) =>
    transaction.objectStore(KEYS).get(id) as IDBRequest<Row | undefined>,
  )
  return found.result
}

const put = async (next: Row): Promise<void> => {
  const was = await row(next.id)
  await within("readwrite", [KEYS], (transaction) => {
    transaction.objectStore(KEYS).put({ ...was, ...next })
  })
}

/** Which provider is being used, if one has been chosen. */
export const which = async (): Promise<Which | undefined> => (await row(CHOSEN))?.which

export const keepWhich = (value: Which): Promise<void> => put({ id: CHOSEN, which: value })

/** The key for one provider, if one has been saved. */
export const key = async (of: Which): Promise<string | undefined> => (await row(of))?.key

export const keepKey = (of: Which, value: string): Promise<void> => put({ id: of, key: value })

/** Forget one provider's key. Which model was chosen is not a secret and stays. */
export const forgetKey = async (of: Which): Promise<void> => {
  const was = await row(of)
  await within("readwrite", [KEYS], (transaction) => {
    transaction.objectStore(KEYS).put({ id: of, ...(was?.model === undefined ? {} : { model: was.model }) })
  })
}

export const model = async (of: Which): Promise<string | undefined> => (await row(of))?.model

export const keepModel = (of: Which, value: string): Promise<void> => put({ id: of, model: value })
