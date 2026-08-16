import type { JsonSchema } from "~/lib/monad"
import { CAPABILITIES, type Name } from "./table"

/**
 * What this app can be asked to do, said in a way something can read without
 * having been written against it.
 *
 * Every field is copied off the table rather than restated, so the manifest
 * cannot describe a capability that is not there or a shape that is not the one
 * being checked.
 */

/**
 * The version of what is promised here, not of the app.
 *
 * It changes when a capability is taken away or when what one takes or answers
 * with narrows. Adding a capability, or adding a spare argument to one, leaves
 * anything already written against it working, and leaves this alone.
 */
export const VERSION = "2"

export interface Told {
  readonly summary: string
  readonly writes: boolean
  readonly needsJournal: boolean
  readonly leaves: boolean
  /** Whether a model is given this to call. See `api/capability.ts`. */
  readonly offered: boolean
  readonly arguments: JsonSchema
}

export interface Manifest {
  readonly name: "choai"
  readonly version: string
  readonly capabilities: Readonly<Record<Name, Told>>
}

export const describe = (): Manifest => ({
  name: "choai",
  version: VERSION,
  capabilities: Object.fromEntries(
    Object.entries(CAPABILITIES).map(([name, capability]) => [
      name,
      {
        summary: capability.summary,
        writes: capability.writes,
        needsJournal: capability.needsJournal,
        leaves: capability.leaves,
        offered: capability.offered,
        arguments: capability.takes.schema,
      },
    ]),
  ) as Readonly<Record<Name, Told>>,
})
