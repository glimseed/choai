import type { JSX } from "solid-js"

import { TrialBalanceView } from "~/components/trial-balance"
import { t } from "~/i18n"

export default function TrialBalance(): JSX.Element {
  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted-foreground">{t("trialBalance.lead")}</p>
      <TrialBalanceView nothingToShow={t("trialBalance.empty")} />
    </div>
  )
}
