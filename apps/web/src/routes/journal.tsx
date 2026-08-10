import { For, Show, createResource, createSignal } from "solid-js"

import { query } from "~/engine/client"
import { formatMixed, type Transaction } from "~/engine/protocol"
import { error, info, loading, openDemo, openLocalFiles, source } from "~/lib/journal"
import { Button } from "~/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { TextField, TextFieldInput } from "~/components/ui/text-field"

const PAGE = 50

export default function Journal() {
  const [filter, setFilter] = createSignal("")
  const [offset, setOffset] = createSignal(0)

  // Re-runs when the journal changes or the query does. The engine keeps the
  // parsed journal, so these are the cheap calls, not the expensive one.
  const [page] = createResource(
    () => (info() ? { q: filter(), offset: offset(), n: info()!.transactions } : null),
    (key) => query({ kind: "entries", query: key.q, limit: PAGE, offset: key.offset }),
  )

  return (
    <div class="flex flex-col gap-4">
      <Show when={info()} fallback={<Welcome />}>
        <div class="flex flex-wrap items-center gap-3">
          <TextField class="min-w-64 flex-1">
            <TextFieldInput
              type="text"
              placeholder="hledger query, eg  acct:food date:2026-02"
              value={filter()}
              onInput={(e) => {
                setOffset(0)
                setFilter(e.currentTarget.value)
              }}
            />
          </TextField>
          <span class="text-sm text-muted-foreground">
            {source()?.label} · {info()!.transactions} transactions
          </span>
        </div>

        <Show when={page.error}>
          <p class="text-sm text-error-foreground">{String(page.error)}</p>
        </Show>

        <Show when={page()} keyed>
          {(result) => (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-28">Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Postings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <For each={result.items}>{(txn) => <Entry txn={txn} />}</For>
                </TableBody>
              </Table>

              <div class="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {result.total === 0
                    ? "nothing matches"
                    : `${result.offset + 1}–${Math.min(result.offset + PAGE, result.total)} of ${result.total}`}
                </span>
                <span class="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={result.offset === 0}
                    onClick={() => setOffset(Math.max(0, offset() - PAGE))}
                  >
                    Newer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={result.offset + PAGE >= result.total}
                    onClick={() => setOffset(offset() + PAGE)}
                  >
                    Older
                  </Button>
                </span>
              </div>
            </>
          )}
        </Show>
      </Show>
    </div>
  )
}

function Entry(props: { txn: Transaction }) {
  return (
    <TableRow>
      <TableCell class="align-top font-mono text-xs">{props.txn.tdate}</TableCell>
      <TableCell class="align-top font-medium">{props.txn.tdescription}</TableCell>
      <TableCell class="align-top">
        <For each={props.txn.tpostings}>
          {(posting) => (
            <div class="flex justify-between gap-6 py-0.5">
              <span class="text-muted-foreground">{posting.paccount}</span>
              <span class="font-mono tabular-nums">{formatMixed(posting.pamount)}</span>
            </div>
          )}
        </For>
      </TableCell>
    </TableRow>
  )
}

function Welcome() {
  let input!: HTMLInputElement

  return (
    <div class="mx-auto flex max-w-md flex-col items-start gap-4 py-16">
      <div>
        <h2 class="text-lg font-semibold">No journal open</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Everything runs here in the browser — hledger itself, compiled to WebAssembly.
          Nothing you open is uploaded anywhere.
        </p>
      </div>

      <div class="flex gap-2">
        <Button onClick={() => input.click()} disabled={loading()}>
          Open journal files
        </Button>
        <Button variant="outline" onClick={() => openDemo()} disabled={loading()}>
          Try the demo
        </Button>
      </div>

      <input
        ref={input}
        type="file"
        class="hidden"
        multiple
        accept=".journal,.hledger,.ledger,.txt"
        onChange={(e) => {
          const files = e.currentTarget.files
          if (files && files.length > 0) void openLocalFiles(files)
        }}
      />

      <Show when={loading()}>
        <p class="text-sm text-muted-foreground">Starting the engine…</p>
      </Show>
      <Show when={error()}>
        <p class="text-sm text-error-foreground">{error()}</p>
      </Show>
    </div>
  )
}
