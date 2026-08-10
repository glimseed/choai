// The hledger query, held in the URL.
//
// One query applies to whichever report is open, which is how hledger itself
// works: `hledger bal QUERY`, `hledger reg QUERY`. Keeping it in the URL rather
// than in a component means it survives navigation between reports, and a view
// of the books can be linked to or bookmarked.

import { useSearchParams } from "@solidjs/router"

export function useQuery(): [() => string, (next: string) => void] {
  const [params, setParams] = useSearchParams<{ q?: string }>()
  const query = (): string => params.q ?? ""
  const setQuery = (next: string): void => {
    setParams({ q: next === "" ? undefined : next }, { replace: true })
  }
  return [query, setQuery]
}

/** Build a query that narrows to one account. */
export const accountQuery = (account: string): string => `acct:${quote(account)}`

/** hledger splits query terms on spaces, so an account containing one has to be
 * quoted or it would be read as two terms. */
const quote = (value: string): string => (value.includes(" ") ? `"${value}"` : value)
