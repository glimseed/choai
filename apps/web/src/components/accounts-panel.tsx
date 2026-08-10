import { For, Show } from "solid-js"
import { useNavigate } from "@solidjs/router"

import { info } from "~/lib/journal"
import { accountQuery, useQuery } from "~/lib/query"

/**
 * The account list, as the shell's side panel — the explorer of this app.
 *
 * Selecting an account sets the global query rather than navigating somewhere
 * new, so the account you picked stays selected while you move between the
 * journal, the balance sheet and the income statement.
 */
export function AccountsPanel() {
  const [query, setQuery] = useQuery()
  const navigate = useNavigate()

  const selected = (name: string): boolean => query() === accountQuery(name)

  const choose = (name: string): void => {
    // Clicking the same account again clears the filter, so the panel is a
    // toggle rather than a trap you have to escape from the query box.
    setQuery(selected(name) ? "" : accountQuery(name))
  }

  return (
    <Show
      when={info()}
      fallback={<p class="px-3 py-2 text-xs text-muted-foreground">No journal open.</p>}
    >
      <div class="py-1">
        <button
          type="button"
          onClick={() => setQuery("")}
          class="w-full px-3 py-1 text-left text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          classList={{ "bg-accent text-accent-foreground": query() === "" }}
        >
          All accounts
        </button>
        <For each={info()!.accounts}>
          {(name) => (
            <button
              type="button"
              onClick={() => choose(name)}
              onDblClick={() => navigate("/")}
              title={name}
              class="w-full truncate px-3 py-1 text-left text-xs hover:bg-accent hover:text-accent-foreground"
              classList={{ "bg-accent text-accent-foreground": selected(name) }}
              style={{ "padding-left": `${0.75 + depthOf(name) * 0.75}rem` }}
            >
              {leafOf(name)}
            </button>
          )}
        </For>
      </div>
    </Show>
  )
}

/** hledger names accounts with colons, so the colons are the tree. */
const depthOf = (name: string): number => name.split(":").length - 1
const leafOf = (name: string): string => name.slice(name.lastIndexOf(":") + 1)
