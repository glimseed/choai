import { For, Show, type JSX } from "solid-js"

import { journal } from "~/journal/store"
import { accountQuery, useQuery } from "~/journal/query"
import { getOrUndefined } from "~/lib/monad"

/**
 * The account list, as the shell's side panel — the explorer of this app.
 *
 * Choosing an account sets the query rather than going somewhere new, so the
 * account stays chosen while moving between the journal, the balance sheet and
 * the income statement.
 */
export function AccountsPanel(): JSX.Element {
  const [query, setQuery] = useQuery()

  const chosen = (account: string): boolean => query() === accountQuery(account)

  /** Choosing the same account again clears the filter, so the panel is a toggle
   * rather than something to escape from the query box. */
  const choose = (account: string): void =>
    setQuery(chosen(account) ? "" : accountQuery(account))

  return (
    <Show
      when={getOrUndefined(journal())}
      fallback={<p class="px-3 py-2 text-xs text-muted-foreground">No journal open.</p>}
    >
      {(open) => (
        <div class="py-1">
          <button
            type="button"
            onClick={() => setQuery("")}
            class="w-full px-3 py-1 text-left text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            classList={{ "bg-accent text-accent-foreground": query() === "" }}
          >
            All accounts
          </button>
          <For each={open().summary.accounts}>
            {(account) => (
              <button
                type="button"
                onClick={() => choose(account)}
                title={account}
                class="w-full truncate px-3 py-1 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                classList={{ "bg-accent text-accent-foreground": chosen(account) }}
                style={{ "padding-left": `${0.75 + depthOf(account) * 0.75}rem` }}
              >
                {leafOf(account)}
              </button>
            )}
          </For>
        </div>
      )}
    </Show>
  )
}

/** hledger names accounts with colons, so the colons are the tree. */
const depthOf = (account: string): number => account.split(":").length - 1
const leafOf = (account: string): string => account.slice(account.lastIndexOf(":") + 1)
