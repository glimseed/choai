import type { ParentProps } from "solid-js"
import { Show, createSignal, onCleanup, onMount } from "solid-js"
import { useLocation, useNavigate } from "@solidjs/router"
import { Dynamic } from "solid-js/web"
import { getOrUndefined } from "~/lib/monad"

import { ActivityBar, AuxPanel, Shell, SidePanel, TitlesBar, type ActivityItem } from "~/lib/solid-workbench-ui"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { TextField, TextFieldInput } from "~/components/ui/text-field"
import { PanelLeftIcon, PlusIcon, ReceiptIcon, ScaleIcon, SettingsIcon, TrendingUpIcon, WalletIcon } from "~/lib/ui/icons"
import { JournalExplorer } from "~/explorer/JournalExplorer"
import { BalanceSheetExplorer } from "~/explorer/BalanceSheetExplorer"
import { IncomeStatementExplorer } from "~/explorer/IncomeStatementExplorer"
import { AccountsExplorer } from "~/explorer/AccountsExplorer"
import { SettingsExplorer } from "~/explorer/SettingsExplorer"
import { journal } from "~/journal/store"
import { useQuery } from "~/journal/query"
import { ComposePanel } from "~/compose/ComposePanel"
import { composing, startComposing, stopComposing, toggleComposing } from "~/compose/store"
import { narrow } from "~/lib/narrow"
import { t } from "~/i18n"

// The daily journal comes first because that is what the app is opened for;
// the statements are things you go and look at, not things you live in.
const NAV = [
  { href: "/", key: "nav.journal", Icon: ReceiptIcon, Explorer: JournalExplorer, writes: true },
  { href: "/balance-sheet", key: "nav.balanceSheet", Icon: ScaleIcon, Explorer: BalanceSheetExplorer, writes: false },
  { href: "/income-statement", key: "nav.incomeStatement", Icon: TrendingUpIcon, Explorer: IncomeStatementExplorer, writes: false },
  { href: "/accounts", key: "nav.accounts", Icon: WalletIcon, Explorer: AccountsExplorer, writes: false },
  { href: "/settings", key: "nav.settings", Icon: SettingsIcon, Explorer: SettingsExplorer, writes: false },
] as const

/**
 * The one place a panel's width is animated.
 *
 * The shell leaves this to whoever uses it, since a neighbour that redraws — a
 * canvas, a map — would flicker for the length of the slide. Nothing here does,
 * so both panels get the same short slide, and anyone who has asked for less
 * motion gets none.
 */
const SLIDE = "transition-[width] duration-150 ease-out motion-reduce:transition-none"

export function Layout(props: ParentProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useQuery()
  const [railExpanded, setRailExpanded] = createSignal(false)
  const [railVisible, setRailVisible] = createSignal(true)
  const [panelOpen, setPanelOpen] = createSignal(true)

  const chromeShowing = (): boolean => railVisible() || panelOpen()

  /**
   * The title bar's button works on the chrome as a whole, both rails at once,
   * so one press clears everything away from the books and the next brings it
   * all back.
   */
  const toggleChrome = (): void => {
    const bringBack = !chromeShowing()
    setRailVisible(bringBack)
    setPanelOpen(bringBack)
  }

  /**
   * Selecting a view opens the explorer beside it; selecting the view already
   * shown folds the explorer away, which is what the icon rail does in the
   * editor this shell is shaped after.
   *
   * The query travels along. It belongs to the books being looked at rather than
   * to the report looking at them, so changing report must not drop it.
   */
  const select = (href: string): void => {
    if (location.pathname === href) {
      setPanelOpen((open) => !open)
      return
    }
    setPanelOpen(true)
    navigate(href + location.search)
  }

  /**
   * Opening the composer on a narrow window folds the rails away first. There is
   * not room for both, and this reuses the folding already here rather than
   * bringing in a second kind of container for small screens.
   */
  const compose = (): void => {
    if (narrow()) {
      setRailVisible(false)
      setPanelOpen(false)
    }
    startComposing()
  }

  onMount(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        if (composing()) toggleComposing()
        else compose()
      }
    }
    window.addEventListener("keydown", onKey)
    onCleanup(() => window.removeEventListener("keydown", onKey))
  })

  /** The view being shown, which is what the explorer beside it belongs to. */
  const current = (): (typeof NAV)[number] =>
    NAV.find((entry) => entry.href === location.pathname) ?? NAV[0]

  const items = (): ActivityItem[] =>
    NAV.map((entry) => ({
      id: entry.href,
      label: t(entry.key),
      icon: <entry.Icon class="h-5 w-5" />,
      active: location.pathname === entry.href,
      onSelect: () => select(entry.href),
    }))

  return (
    <Shell
      titles={
        <TitlesBar
          left={
            <>
              <button
                type="button"
                onClick={toggleChrome}
                aria-label={chromeShowing() ? t("nav.hidePanels") : t("nav.showPanels")}
                title={chromeShowing() ? t("nav.hidePanels") : t("nav.showPanels")}
                class="inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <PanelLeftIcon class="h-4 w-4" />
              </button>
              <span class="px-1 font-semibold tracking-tight">{t("app.name")}</span>
            </>
          }
          right={
            <Show when={getOrUndefined(journal())}>
              {(open) => (
                <span class="whitespace-nowrap px-1 text-xs text-muted-foreground">
                  {open().source.label} · {t("journal.transactionCount", { count: open().summary.transactions })}
                </span>
              )}
            </Show>
          }
        >
          {/* One query for whichever report is open, the way the hledger
              command line takes one. */}
          <Show when={getOrUndefined(journal())}>
            <TextField class="w-full max-w-xl">
              <TextFieldInput
                type="text"
                placeholder={t("journal.queryPlaceholder")}
                class="h-6 border-0 bg-transparent px-2 text-[13px] shadow-none focus-visible:ring-0"
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
              />
            </TextField>
          </Show>
        </TitlesBar>
      }
      activity={
        <ActivityBar
          class={SLIDE}
          visible={railVisible()}
          items={items()}
          expanded={railExpanded()}
          onToggle={() => setRailExpanded((expanded) => !expanded)}
          // The trigger arrives already built, so Kobalte gets a wrapper to
          // attach its props and ref to. The wrapper has to be a real box:
          // display:contents would leave it nothing to measure, and the tooltip
          // would be placed at the origin and never notice the pointer leaving.
          renderTooltip={(label, trigger) => (
            <Tooltip placement="right" gutter={8}>
              <TooltipTrigger as="span" class="block w-full">
                {trigger}
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          )}
        />
      }
      panel={
        <SidePanel
          class={SLIDE}
          open={panelOpen()}
          header={
            <>
              <span>{t(current().key)}</span>
              <Show when={current().writes && getOrUndefined(journal()) !== undefined}>
                <button
                  type="button"
                  onClick={compose}
                  aria-label={t("compose.open")}
                  title={t("compose.open")}
                  class="inline-flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <PlusIcon class="h-4 w-4" />
                </button>
              </Show>
            </>
          }
        >
          <Dynamic component={current().Explorer} />
        </SidePanel>
      }
      aux={
        <AuxPanel
          class={SLIDE}
          initialWidth={420}
          minWidth={320}
          open={composing()}
          header={<span>{t("compose.title")}</span>}
          onClose={stopComposing}
        >
          <ComposePanel />
        </AuxPanel>
      }
    >
      <div class="p-4">{props.children}</div>
    </Shell>
  )
}
