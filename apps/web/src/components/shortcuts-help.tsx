import { For, type JSX } from "solid-js"

import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { HelpIcon } from "~/lib/ui/icons"
import { SHORTCUTS, shortcutKeys } from "~/lib/shortcuts"
import { t } from "~/i18n"

/**
 * What the keyboard can do here.
 *
 * Built from the same list the handler reads, so nothing can be shown that does
 * not work, or work without being shown.
 */
export function ShortcutsHelp(): JSX.Element {
  return (
    <Popover placement="bottom-end" gutter={6}>
      <PopoverTrigger
        as="button"
        type="button"
        aria-label={t("shortcuts.title")}
        title={t("shortcuts.title")}
        class="inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <HelpIcon class="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent class="w-64 p-3">
        <p class="mb-2 text-xs font-medium">{t("shortcuts.title")}</p>
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
      </PopoverContent>
    </Popover>
  )
}
