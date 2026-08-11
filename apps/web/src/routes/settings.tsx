import { For, Show, createResource, type JSX } from "solid-js"
import { A } from "@solidjs/router"

import { LOCALES, LOCALE_NAMES, locale, setLocale, t } from "~/i18n"
import { Button } from "~/components/ui/button"
import { closeJournal, journal } from "~/journal/store"
import { GitHubPanel } from "~/components/github-panel"
import { handOver } from "~/journal/handover"
import { keptForGood } from "~/journal/kept"
import { getOrUndefined } from "~/lib/monad"

export default function Settings(): JSX.Element {
  return (
    <div class="flex max-w-md flex-col gap-6">
      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium">{t("settings.language")}</h2>
        <div class="flex flex-wrap gap-2">
          <For each={LOCALES}>
            {(option) => (
              <Button
                variant={locale() === option ? "default" : "outline"}
                size="sm"
                onClick={() => setLocale(option)}
              >
                {LOCALE_NAMES[option]}
              </Button>
            )}
          </For>
        </div>
        <p class="text-xs text-muted-foreground">{t("settings.languageHint")}</p>
      </section>
      <Library />
      <GitHubPanel />
      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium">{t("licenses.title")}</h2>
        <p class="text-xs text-muted-foreground">{t("licenses.app")}</p>
        <A
          href="/licenses"
          class="self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {t("licenses.show")}
        </A>
      </section>
    </div>
  )
}

/**
 * The journal in hand: where it is kept, how to take it away, how to put it
 * down.
 *
 * Closing clears it from the device, so it says so on the button rather than in
 * a dialog afterwards.
 */
function Library(): JSX.Element {
  const [promised] = createResource(keptForGood)
  return (
    <Show when={getOrUndefined(journal())}>
      {(open) => (
        <section class="flex flex-col gap-2">
          <h2 class="text-sm font-medium">{t("library.title")}</h2>
          <p class="text-xs">{open().source.label}</p>
          <p class="text-xs text-muted-foreground">
            {promised() === false ? t("library.notKept") : t("library.kept")}
          </p>
          <div class="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void handOver(open().source)}>
              {t("journal.export")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => void closeJournal()}>
              {t("library.close")}
            </Button>
          </div>
        </section>
      )}
    </Show>
  )
}
