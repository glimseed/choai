import type { ParentProps } from "solid-js"
import { Show, createSignal } from "solid-js"
import { useLocation, useNavigate } from "@solidjs/router"
import { getOrUndefined } from "~/lib/monad"

import { ActivityBar, Shell, SidePanel, TitlesBar, type ActivityItem } from "~/lib/solid-workbench-ui"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { TextField, TextFieldInput } from "~/components/ui/text-field"
import { PanelLeftIcon, ReceiptIcon, ScaleIcon, SettingsIcon, TrendingUpIcon, WalletIcon } from "~/lib/ui/icons"
import { AccountsPanel } from "~/components/accounts-panel"
import { journal } from "~/journal/store"
import { useQuery } from "~/journal/query"

// The daily journal comes first because that is what the app is opened for;
// the statements are things you go and look at, not things you live in.
const NAV = [
  { href: "/", label: "Journal", Icon: ReceiptIcon },
  { href: "/balance-sheet", label: "Balance sheet", Icon: ScaleIcon },
  { href: "/income-statement", label: "Income statement", Icon: TrendingUpIcon },
  { href: "/accounts", label: "Accounts", Icon: WalletIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
] as const

export function Layout(props: ParentProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useQuery()
  const [railExpanded, setRailExpanded] = createSignal(false)
  const [panelOpen, setPanelOpen] = createSignal(true)

  const items = (): ActivityItem[] =>
    NAV.map((entry) => ({
      id: entry.href,
      label: entry.label,
      icon: <entry.Icon class="h-5 w-5" />,
      active: location.pathname === entry.href,
      // Carry the query across. It belongs to the books being looked at, not to
      // the report looking at them, so switching reports must not drop it.
      onSelect: () => navigate(entry.href + location.search),
    }))

  return (
    <Shell
      titles={
        <TitlesBar
          left={
            <>
              <button
                type="button"
                onClick={() => setPanelOpen((open) => !open)}
                aria-label={panelOpen() ? "Hide accounts" : "Show accounts"}
                title={panelOpen() ? "Hide accounts" : "Show accounts"}
                class="inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <PanelLeftIcon class="h-4 w-4" />
              </button>
              <span class="px-1 font-semibold tracking-tight">hledger-pwa</span>
            </>
          }
          right={
            <Show when={getOrUndefined(journal())}>
              {(open) => (
                <span class="whitespace-nowrap px-1 text-xs text-muted-foreground">
                  {open().source.label} · {open().summary.transactions} txns
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
                placeholder="hledger query, eg  acct:food date:2026-02"
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
        <SidePanel open={panelOpen()} header={<span>Accounts</span>}>
          <AccountsPanel />
        </SidePanel>
      }
    >
      <div class="p-4">{props.children}</div>
    </Shell>
  )
}
