import { For, Show, createResource, type JSX } from "solid-js"

import { ask } from "~/hledger/client"
import { formatMixed } from "~/hledger/amount"
import type { BalanceReport, MixedAmount } from "~/hledger/wire"
import { journal } from "~/journal/store"
import { useQuery } from "~/journal/query"
import { linesOf, type Line } from "~/reports/tree"
import { getOrUndefined, matchResource } from "~/lib/monad"
import { TroubleNote } from "./trouble-note"

/**
 * Any of hledger's balance reports.
 *
 * The balance sheet and the income statement are one report under a different
 * account-type filter and accumulation, which is how hledger's own commands are
 * defined, so they share this rather than being written twice.
 */
type Kind = "balancesheet" | "incomestatement" | "balance"

export function BalanceReportView(props: {
  kind: Kind
  /** Query terms of the screen's own, added to the one in the title bar. */
  narrowing?: string
  nothingToShow: string
}): JSX.Element {
  const [query] = useQuery()

  const [report] = createResource(
    () => (getOrUndefined(journal()) === undefined ? undefined : terms(query(), props.narrowing)),
    (asked) => askFor(props.kind, asked),
  )

  return (
    <Show when={getOrUndefined(journal())} fallback={<NeedsAJournal />}>
      {matchResource(report(), {
        Loading: () => <Waiting />,
        Err: (trouble) => <TroubleNote trouble={trouble} />,
        Ok: (data) => <Rows report={data} nothingToShow={props.nothingToShow} />,
      })}
    </Show>
  )
}

/** Each branch narrows the kind to a literal, which is what gives the answer its type. */
const askFor = (kind: Kind, query: string) => {
  switch (kind) {
    case "balancesheet":
      return ask({ kind, query })
    case "incomestatement":
      return ask({ kind, query })
    case "balance":
      return ask({ kind, query })
  }
}

const terms = (query: string, narrowing: string | undefined): string =>
  [query, narrowing].filter((part) => part !== undefined && part !== "").join(" ")

function Rows(props: { report: BalanceReport; nothingToShow: string }): JSX.Element {
  return (
    <Show
      when={props.report.prRows.length > 0}
      fallback={<p class="text-sm text-muted-foreground">{props.nothingToShow}</p>}
    >
      <div class="max-w-2xl">
        <table class="w-full text-sm">
          <tbody>
            <For each={linesOf(props.report.prRows)}>{(line) => <AccountRow line={line} />}</For>
          </tbody>
          <tfoot>
            <tr class="border-t font-medium">
              <td class="py-2">Total</td>
              <Amount value={props.report.prTotals.prrTotal} class="py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
    </Show>
  )
}

function AccountRow(props: { line: Line }): JSX.Element {
  return (
    <tr class="border-b border-border/50 last:border-0">
      <td class="py-1" style={{ "padding-left": `${props.line.depth * 1.25}rem` }}>
        <span
          class={props.line.depth === 0 ? "font-medium" : "text-muted-foreground"}
          title={props.line.account}
        >
          {props.line.label}
        </span>
      </td>
      <Amount value={props.line.amount} class="py-1" />
    </tr>
  )
}

function Amount(props: { value: MixedAmount; class: string }): JSX.Element {
  return <td class={`text-right font-mono tabular-nums ${props.class}`}>{formatMixed(props.value)}</td>
}

const NeedsAJournal = (): JSX.Element => (
  <p class="text-sm text-muted-foreground">Open a journal first.</p>
)

const Waiting = (): JSX.Element => <p class="text-sm text-muted-foreground">Working…</p>
