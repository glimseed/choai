import { For, Show, createResource } from "solid-js"

import { query as runQuery } from "~/engine/client"
import { formatMixed, type BalanceReport, type MixedAmount, type ReportRow } from "~/engine/protocol"
import { info } from "~/lib/journal"
import { useQuery } from "~/lib/query"

/**
 * Renders any of hledger's balance reports.
 *
 * The balance sheet and the income statement are the same report with a
 * different account-type filter and accumulation, which is how hledger's own
 * commands are defined, so they share this component rather than duplicating it.
 */
export function BalanceReportView(props: {
  kind: "balancesheet" | "incomestatement" | "balance"
  /** Extra hledger query terms, eg a date range, added to the global query. */
  filter?: string
  emptyMessage: string
}) {
  const [globalQuery] = useQuery()

  const [report] = createResource(
    () =>
      info()
        ? { kind: props.kind, terms: [globalQuery(), props.filter ?? ""].filter(Boolean).join(" ") }
        : null,
    (key) => runQuery({ kind: key.kind, query: key.terms } as never) as Promise<BalanceReport>,
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
                  <For each={layout(data.prRows)}>
                    {(entry) => (
                      <Row
                        depth={entry.depth}
                        label={entry.label}
                        full={entry.full}
                        amount={entry.row.prrTotal}
                      />
                    )}
                  </For>
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

/**
 * Work out how each row sits in the tree.
 *
 * The report is a tree but each name arrives whole, so counting colons is not
 * enough: hledger elides a parent that has only one child, printing
 * `assets:bank:checking` as `bank:checking` one level in rather than `checking`
 * two levels in. Depth therefore comes from which ancestors are actually present
 * as rows, and the label is whatever the nearest present ancestor does not
 * already account for.
 */
function layout(rows: ReportRow[]): { row: ReportRow; depth: number; label: string; full: string }[] {
  const present = new Set(rows.map(nameOf).filter((n) => n !== ""))

  return rows.map((row) => {
    const full = nameOf(row)
    const parts = full.split(":")
    let parent = ""
    for (let cut = parts.length - 1; cut > 0; cut--) {
      const candidate = parts.slice(0, cut).join(":")
      if (present.has(candidate)) {
        parent = candidate
        break
      }
    }
    const ancestors = parent === "" ? [] : parent.split(":")
    return {
      row,
      depth: ancestors.length === 0 ? 0 : depthOf(parent, present) + 1,
      label: parent === "" ? full : full.slice(parent.length + 1),
      full,
    }
  })
}

const nameOf = (row: ReportRow): string => (typeof row.prrName === "string" ? row.prrName : "")

/** How far in a name sits, counting only ancestors that are rows in their own right. */
function depthOf(name: string, present: Set<string>): number {
  const parts = name.split(":")
  let depth = 0
  for (let cut = 1; cut < parts.length; cut++) {
    if (present.has(parts.slice(0, cut).join(":"))) depth++
  }
  return depth
}

function Row(props: { depth: number; label: string; full: string; amount: MixedAmount }) {
  return (
    <tr class="border-b border-border/50 last:border-0">
      <td class="py-1" style={{ "padding-left": `${props.depth * 1.25}rem` }}>
        <span class={props.depth === 0 ? "font-medium" : "text-muted-foreground"} title={props.full}>
          {props.label}
        </span>
      </td>
      <td class="py-1 text-right font-mono tabular-nums">{formatMixed(props.amount)}</td>
    </tr>
  )
}
