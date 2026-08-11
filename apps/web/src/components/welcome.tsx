import { Show, type JSX } from "solid-js"

import { openDemo, openFiles, opening, openingTrouble, settling } from "~/journal/store"
import { startFresh } from "~/journal/fresh"
import { getOrUndefined } from "~/lib/monad"
import { Button } from "~/components/ui/button"
import { t } from "~/i18n"
import { TroubleNote } from "./trouble-note"

/**
 * What there is to do when no journal is open yet.
 *
 * Held back while the journal left open last time is on its way back: offering
 * to open one, a moment before one appears, would be an invitation to undo what
 * the app is in the middle of doing.
 */
export function Welcome(): JSX.Element {
  return (
    <Show
      when={!settling()}
      fallback={<p class="mx-auto max-w-md py-16 text-sm text-muted-foreground">{t("welcome.starting")}</p>}
    >
      <Choices />
    </Show>
  )
}

function Choices(): JSX.Element {
  let chooser!: HTMLInputElement

  return (
    <div class="mx-auto flex max-w-md flex-col items-start gap-4 py-16">
      <div>
        <h2 class="text-lg font-semibold">{t("welcome.heading")}</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          {t("welcome.body")}
        </p>
      </div>

      <div class="flex gap-2">
        <Button onClick={() => chooser.click()} disabled={opening()}>
          {t("welcome.openFiles")}
        </Button>
        <Button variant="outline" onClick={() => void startFresh()} disabled={opening()}>
          {t("welcome.startFresh")}
        </Button>
        <Button variant="ghost" onClick={() => void openDemo()} disabled={opening()}>
          {t("welcome.tryDemo")}
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
        <p class="text-sm text-muted-foreground">{t("welcome.starting")}</p>
      </Show>
      <Show when={getOrUndefined(openingTrouble())}>
        {(trouble) => <TroubleNote trouble={trouble()} />}
      </Show>
    </div>
  )
}
