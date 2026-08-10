import { Show, type JSX } from "solid-js"

import { openDemo, openFiles, opening, openingTrouble } from "~/journal/store"
import { getOrUndefined } from "~/lib/monad"
import { Button } from "~/components/ui/button"
import { TroubleNote } from "./trouble-note"

/** What there is to do when no journal is open yet. */
export function Welcome(): JSX.Element {
  let chooser!: HTMLInputElement

  return (
    <div class="mx-auto flex max-w-md flex-col items-start gap-4 py-16">
      <div>
        <h2 class="text-lg font-semibold">No journal open</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Everything runs here in the browser — hledger itself, compiled to WebAssembly.
          Nothing you open is uploaded anywhere.
        </p>
      </div>

      <div class="flex gap-2">
        <Button onClick={() => chooser.click()} disabled={opening()}>
          Open journal files
        </Button>
        <Button variant="outline" onClick={() => void openDemo()} disabled={opening()}>
          Try the demo
        </Button>
      </div>

      <input
        ref={chooser}
        type="file"
        class="hidden"
        multiple
        accept=".journal,.hledger,.ledger,.txt"
        onChange={(event) => {
          const chosen = event.currentTarget.files
          if (chosen !== null && chosen.length > 0) void openFiles(chosen)
        }}
      />

      <Show when={opening()}>
        <p class="text-sm text-muted-foreground">Starting hledger…</p>
      </Show>
      <Show when={getOrUndefined(openingTrouble())}>
        {(trouble) => <TroubleNote trouble={trouble()} />}
      </Show>
    </div>
  )
}
