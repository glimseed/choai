import { For, type JSX } from "solid-js"
import { A } from "@solidjs/router"

import { LOCALES, LOCALE_NAMES, locale, setLocale, t } from "~/i18n"
import { Button } from "~/components/ui/button"

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
