import { For, Show, createSignal, type JSX } from "solid-js"

import { HelpIcon, XIcon } from "~/lib/ui/icons"
import { SHORTCUTS, shortcutKeys } from "~/lib/shortcuts"
import { t } from "~/i18n"

/**
 * What the keyboard can do here, kept in the corner of the window.
 *
 * The list is built from the same table the handler reads, so a key cannot be
 * shown without working, or work without being shown.
 *
 * It is a disclosure rather than a popover: clicking elsewhere leaves it open,
 * so the keys can be kept in sight while they are being tried. The card takes
 * the corner the button was in and carries its own ✕, which puts the way out
 * where the way in was and spends no height on a row of its own.
 */
export function ShortcutsHelp(): JSX.Element {
  const [open, setOpen] = createSignal(false)
  return (
    <div class="fixed bottom-3 right-3 z-30">
      <Show
        when={open()}
        fallback={
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("shortcuts.title")}
            title={t("shortcuts.title")}
            aria-expanded={false}
            class="inline-flex size-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
          >
            <HelpIcon class="h-4 w-4" />
          </button>
        }
      >
        <div class="w-64 rounded-md border border-border bg-card p-3 shadow-lg">
          <div class="mb-2 flex items-center justify-between gap-2">
            <p class="text-xs font-medium">{t("shortcuts.title")}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("shortcuts.hide")}
              title={t("shortcuts.hide")}
              aria-expanded
              class="-mr-1 inline-flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <XIcon class="h-3.5 w-3.5" />
            </button>
          </div>
          <dl class="flex flex-col gap-1.5">
            <For each={SHORTCUTS}>
              {(shortcut) => (
                <div class="flex items-baseline justify-between gap-3">
                  <dt class="text-xs text-muted-foreground">{t(shortcut.labelKey)}</dt>
                  <dd class="shrink-0 rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                    {shortcutKeys(shortcut)}
                  </dd>
                </div>
              )}
            </For>
          </dl>
        </div>
      </Show>
    </div>
  )
}
