import type { JSX } from "solid-js"

import { BalanceReportView } from "~/components/balance-report"
import { t } from "~/i18n"

export default function BalanceSheet(): JSX.Element {
  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted-foreground">{t("balanceSheet.lead")}</p>
      <BalanceReportView kind="balancesheet" nothingToShow={t("balanceSheet.empty")} />
    </div>
  )
}
