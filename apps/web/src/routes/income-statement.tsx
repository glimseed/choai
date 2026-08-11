import { For, createSignal, type JSX } from "solid-js"

import { BalanceReportView } from "~/components/balance-report"
import { DeclareTypes } from "~/components/declare-types"
import { Button } from "~/components/ui/button"
import { t } from "~/i18n"

/** Periods are hledger query terms, so hledger decides what they mean. */
const PERIODS = [
  { key: "incomeStatement.thisMonth", term: "date:thismonth" },
  { key: "incomeStatement.thisYear", term: "date:thisyear" },
  { key: "incomeStatement.lastYear", term: "date:lastyear" },
  { key: "incomeStatement.allTime", term: "" },
] as const

export default function IncomeStatement(): JSX.Element {
  const [period, setPeriod] = createSignal<string>("")

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted-foreground">{t("incomeStatement.lead")}</p>

      <div class="flex flex-wrap gap-2">
        <For each={PERIODS}>
          {(option) => (
            <Button
              variant={period() === option.term ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(option.term)}
            >
              {t(option.key)}
            </Button>
          )}
        </For>
      </div>

      <DeclareTypes />
      <BalanceReportView
        kind="incomestatement"
        narrowing={period()}
        nothingToShow={t("incomeStatement.empty")}
      />
    </div>
  )
}
