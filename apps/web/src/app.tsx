import type { ParentProps } from "solid-js"
import { Show, createSignal, onCleanup, onMount } from "solid-js"
import { useLocation, useNavigate } from "@solidjs/router"
import { Dynamic } from "solid-js/web"
import { getOrUndefined } from "~/lib/monad"

import { ActivityBar, AuxPanel, Shell, SidePanel, TitlesBar, type ActivityItem } from "~/lib/solid-workbench-ui"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { Button } from "~/components/ui/button"
import { TextField, TextFieldInput } from "~/components/ui/text-field"
import { DownloadIcon, PanelLeftIcon, PlusIcon, ReceiptIcon, ScaleIcon, SettingsIcon, SquarePenIcon, TrendingUpIcon, WalletIcon } from "~/lib/ui/icons"
import { JournalExplorer } from "~/explorer/JournalExplorer"
import { BalanceSheetExplorer } from "~/explorer/BalanceSheetExplorer"
import { IncomeStatementExplorer } from "~/explorer/IncomeStatementExplorer"
import { AccountsExplorer } from "~/explorer/AccountsExplorer"
import { SettingsExplorer } from "~/explorer/SettingsExplorer"
import { journal, reopenKept } from "~/journal/store"
import { handOver } from "~/journal/handover"
import { useQuery } from "~/journal/query"
import { ComposePanel } from "~/compose/ComposePanel"
import { composing, startComposing, stopComposing, toggleComposing } from "~/compose/store"
import { narrow, viewportWidth } from "~/lib/narrow"
import { actionFor } from "~/lib/shortcuts"
import { ShortcutsHelp } from "~/components/shortcuts-help"
import { t } from "~/i18n"

// The daily journal comes first because that is what the app is opened for;
// the statements are things you go and look at, not things you live in.
const NAV = [
  { href: "/", key: "nav.journal", Icon: ReceiptIcon, Explorer: JournalExplorer, writes: true },
  { href: "/balance-sheet", key: "nav.balanceSheet", Icon: ScaleIcon, Explorer: BalanceSheetExplorer, writes: false },
  { href: "/income-statement", key: "nav.incomeStatement", Icon: TrendingUpIcon, Explorer: IncomeStatementExplorer, writes: false },
  { href: "/accounts", key: "nav.accounts", Icon: WalletIcon, Explorer: AccountsExplorer, writes: false },
] as const

// Settings are not one of the books, so they sit at the foot of the rail, apart
// from the four views and where the editor this shell is shaped after keeps
// them.
const FOOT = [
  { href: "/settings", key: "nav.settings", Icon: SettingsIcon, Explorer: SettingsExplorer, writes: false },
] as const

// Reached from the settings rather than from the rail, so it has no button of
// its own; `under` says which button stays lit while it is open.
const INNER = [
  {
    href: "/licenses",
    key: "licenses.title",
    Icon: SettingsIcon,
    Explorer: SettingsExplorer,
    writes: false,
    under: "/settings",
  },
  {
    href: "/source",
    key: "source.title",
    Icon: ReceiptIcon,
    Explorer: JournalExplorer,
    writes: false,
    under: "/",
  },
] as const

const VIEWS = [...NAV, ...FOOT, ...INNER]

type View = (typeof VIEWS)[number]

/** Which rail button a view belongs to, which is itself unless it says otherwise. */
const railOf = (view: View): string => ("under" in view ? view.under : view.href)

/**
 * The one place a panel's width is animated.
 *
 * The shell leaves this to whoever uses it, since a neighbour that redraws — a
 * canvas, a map — would flicker for the length of the slide. Nothing here does,
 * so both panels get the same short slide, and anyone who has asked for less
 * motion gets none.
 */
const SLIDE = "transition-[width] duration-150 ease-out motion-reduce:transition-none"

/**
 * No panel may be wider than the window.
 *
 * A panel that overflows has its far edge, and whatever sits on it, pushed off
 * screen — for the composer that is the button which closes it, leaving no way
 * back. Given as a function so it follows a window being resized.
 *
 * One pixel short of the window, because a panel lays out its splitter beside
 * itself and that line has to land somewhere.
 */
const withinWindow = (): number => Math.max(1, viewportWidth() - 1)

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
    void reopenKept()

    const onKey = (event: KeyboardEvent): void => {
      const action = actionFor(event)
      if (action === undefined) return
      event.preventDefault()
      if (action === "compose") composing() ? toggleComposing() : compose()
      if (action === "togglePanels") toggleChrome()
      if (action === "close") stopComposing()
    }
    window.addEventListener("keydown", onKey)
    onCleanup(() => window.removeEventListener("keydown", onKey))
  })

  /** The view being shown, which is what the explorer beside it belongs to. */
  const current = (): View => VIEWS.find((entry) => entry.href === location.pathname) ?? VIEWS[0]

  const buttonsFor = (entries: readonly View[]): ActivityItem[] =>
    entries.map((entry) => ({
      id: entry.href,
      label: t(entry.key),
      icon: <entry.Icon class="h-5 w-5" />,
      active: railOf(current()) === entry.href,
      onSelect: () => select(entry.href),
    }))

  return (
    <>
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
                {/* Room on a phone goes to the query box, not to a name the
                    reader already knows. */}
                <span class="hidden px-1 font-semibold tracking-tight sm:inline">{t("app.name")}</span>
              </>
            }
            center={
              // One query for whichever report is open, the way the hledger
              // command line takes one.
              <Show when={getOrUndefined(journal())}>
                <TextField class="w-full">
                  <TextFieldInput
                    type="search"
                    placeholder={t("journal.queryPlaceholder")}
                    class="h-6 rounded border-input bg-background px-2 text-[13px] shadow-none focus-visible:ring-1 focus-visible:ring-offset-0"
                    value={query()}
                    onInput={(e) => setQuery(e.currentTarget.value)}
                  />
                </TextField>
              </Show>
            }
            right={
              <Show when={getOrUndefined(journal())}>
                {(open) => (
                  <button
                    type="button"
                    onClick={() => void handOver(open().source)}
                    aria-label={t("journal.export")}
                    title={t("journal.export")}
                    class="inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <DownloadIcon class="h-4 w-4" />
                  </button>
                )}
              </Show>
            }
          />
        }
        activity={
          <ActivityBar
            class={SLIDE}
            visible={railVisible()}
            items={buttonsFor(NAV)}
            footer={buttonsFor(FOOT)}
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
            maxWidth={withinWindow}
            open={panelOpen()}
            header={
              <>
                <span>{t(current().key)}</span>
                {/* One group at the far end, so the two ways of writing sit
                    together rather than being spread across the heading. */}
                <div class="flex items-center gap-1">
                  <Show when={railOf(current()) === "/" && getOrUndefined(journal()) !== undefined}>
                    {/* The text behind the view being looked at, which is the
                        journal's own business rather than a view of its own. */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(location.pathname === "/source" ? "/" : "/source")}
                      aria-label={t("source.title")}
                      title={t("source.title")}
                      class="size-6 text-muted-foreground"
                      classList={{ "bg-accent text-foreground": location.pathname === "/source" }}
                    >
                      <SquarePenIcon />
                    </Button>
                  </Show>
                  <Show when={current().writes && getOrUndefined(journal()) !== undefined}>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={compose}
                      aria-label={t("compose.open")}
                      title={t("compose.open")}
                      class="size-6 text-muted-foreground"
                    >
                      {/* Left unsized: Button sets any icon inside it to 16px, and a
                          smaller box here would be overflowed rather than obeyed. */}
                      <PlusIcon />
                    </Button>
                  </Show>
                </div>
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
            maxWidth={withinWindow}
            open={composing()}
            header={<span>{t("compose.title")}</span>}
            onClose={stopComposing}
            closeLabel={t("compose.close")}
          >
            <ComposePanel />
          </AuxPanel>
        }
      >
        <div class="p-4">{props.children}</div>
      </Shell>
      {/* Outside the shell, since it belongs to the window rather than to any
          one region of it. */}
      <ShortcutsHelp />
    </>
  )
}
