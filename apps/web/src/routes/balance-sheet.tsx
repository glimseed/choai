import type { JSX } from "solid-js"

import { BalanceReportView } from "~/components/balance-report"

export default function BalanceSheet(): JSX.Element {
  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted-foreground">
        What you own and owe, as of today. Assets, liabilities and equity, accumulated
        from the beginning of the journal.
      </p>
      <BalanceReportView kind="balancesheet" nothingToShow="No asset, liability or equity accounts." />
    </div>
  )
}
