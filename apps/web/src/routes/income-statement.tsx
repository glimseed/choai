import { For, createSignal, type JSX } from "solid-js"

import { BalanceReportView } from "~/components/balance-report"
import { Button } from "~/components/ui/button"

/** Periods are hledger query terms, so hledger decides what they mean. */
const PERIODS = [
  { label: "This month", term: "date:thismonth" },
  { label: "This year", term: "date:thisyear" },
  { label: "Last year", term: "date:lastyear" },
  { label: "All time", term: "" },
] as const

export default function IncomeStatement(): JSX.Element {
  const [period, setPeriod] = createSignal<string>("")

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted-foreground">
        What came in and what went out over a period. Revenue and expenses, as a change
        rather than a running balance.
      </p>

      <div class="flex flex-wrap gap-2">
        <For each={PERIODS}>
          {(option) => (
            <Button
              variant={period() === option.term ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(option.term)}
            >
              {option.label}
            </Button>
          )}
        </For>
      </div>

      <BalanceReportView
        kind="incomestatement"
        narrowing={period()}
        nothingToShow="Nothing in this period."
      />
    </div>
  )
}
