import { For, Show, createResource } from "solid-js"

import { query } from "~/engine/client"
import { formatMixed, type BalanceReport, type ReportRow } from "~/engine/protocol"
import { info } from "~/lib/journal"

/**
 * Renders any of hledger's balance reports.
 *
 * The balance sheet and the income statement are the same report with a
 * different account-type filter and accumulation, which is how hledger's own
 * commands are defined, so they share this component rather than duplicating it.
 */
export function BalanceReportView(props: {
  kind: "balancesheet" | "incomestatement" | "balance"
  /** Extra hledger query terms, eg a date range. */
  filter?: string
  emptyMessage: string
}) {
  const [report] = createResource(
    () => (info() ? { kind: props.kind, filter: props.filter ?? "" } : null),
    (key) => query({ kind: key.kind, query: key.filter } as never) as Promise<BalanceReport>,
  )

  return (
    <Show when={info()} fallback={<p class="text-sm text-muted-foreground">Open a journal first.</p>}>
      <Show when={report.error}>
        <p class="text-sm text-error-foreground">{String(report.error)}</p>
      </Show>
      <Show when={report()} keyed>
        {(data) => (
          <Show
            when={data.prRows.length > 0}
            fallback={<p class="text-sm text-muted-foreground">{props.emptyMessage}</p>}
          >
            <div class="max-w-2xl">
              <table class="w-full text-sm">
                <tbody>
                  <For each={data.prRows}>{(row) => <Row row={row} />}</For>
                </tbody>
                <tfoot>
                  <tr class="border-t font-medium">
                    <td class="py-2">Total</td>
                    <td class="py-2 text-right font-mono tabular-nums">
                      {formatMixed(data.prTotals.prrTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Show>
        )}
      </Show>
    </Show>
  )
}

function Row(props: { row: ReportRow }) {
  const depth = () => props.row.prrName?.depth ?? 0
  const name = () => props.row.prrName?.displayName ?? props.row.prrName?.fullName ?? ""

  return (
    <tr class="border-b border-border/50 last:border-0">
      <td class="py-1" style={{ "padding-left": `${depth() * 1.25}rem` }}>
        <span class={depth() === 0 ? "font-medium" : "text-muted-foreground"}>{name()}</span>
      </td>
      <td class="py-1 text-right font-mono tabular-nums">{formatMixed(props.row.prrTotal)}</td>
    </tr>
  )
}
