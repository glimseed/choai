import { Show, type JSX } from "solid-js"

import type { Trouble } from "~/hledger/wire"

/**
 * Says what went wrong, in words chosen here rather than passed up from below.
 *
 * hledger's own detail is worth showing when it names a line of the journal, but
 * it belongs behind a heading that says which kind of trouble this is, so the
 * reader knows whether to fix their books, their query, or their expectations.
 */
export function TroubleNote(props: { trouble: Trouble }): JSX.Element {
  return (
    <div class="rounded-md border border-error bg-error/40 px-3 py-2 text-sm">
      <p class="font-medium">{headline(props.trouble)}</p>
      <Show when={detailOf(props.trouble)}>
        {(detail) => (
          <pre class="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
            {detail()}
          </pre>
        )}
      </Show>
    </div>
  )
}

const headline = (trouble: Trouble): string => {
  switch (trouble.kind) {
    case "no-journal":
      return "No journal is open yet."
    case "file-missing":
      return `${trouble.path} is not among the files given.`
    case "read-failed":
      return "This journal could not be read."
    case "malformed-request":
      return "hledger did not understand that."
    case "unknown-report":
      return `There is no ${trouble.report} report.`
    case "missing-transaction":
      return "No transaction was given to write."
    case "crashed":
      return "hledger stopped part way through."
    case "unreachable":
      return "hledger could not be reached."
    case "unreadable-answer":
      return "hledger answered with something unreadable."
  }
}

const detailOf = (trouble: Trouble): string | undefined => {
  switch (trouble.kind) {
    case "read-failed":
    case "malformed-request":
    case "crashed":
    case "unreachable":
    case "unreadable-answer":
      return trouble.detail
    default:
      return undefined
  }
}
