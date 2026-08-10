import { BalanceReportView } from "~/components/balance-report"

export default function BalanceSheet() {
  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted-foreground">
        What you own and owe, as of today. Assets, liabilities and equity, accumulated
        from the beginning of the journal.
      </p>
      <BalanceReportView kind="balancesheet" emptyMessage="No asset, liability or equity accounts." />
    </div>
  )
}
