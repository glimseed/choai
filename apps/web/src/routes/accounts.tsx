import type { JSX } from "solid-js"

import { BalanceReportView } from "~/components/balance-report"

export default function Accounts(): JSX.Element {
  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted-foreground">Every account in the journal, with its balance.</p>
      <BalanceReportView kind="balance" nothingToShow="No accounts yet." />
    </div>
  )
}
