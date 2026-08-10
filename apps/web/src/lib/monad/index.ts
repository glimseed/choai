/**
 * monad — the groundwork for writing in a functional style. Nothing throws:
 * calls return `Result<T,E>` / `Option<T>` and you branch on them exhaustively
 * with `match` (see `result`). Values that arrive at the boundary as `unknown`
 * are checked by `decode`, which turns them into Options and so lets them into
 * the typed world. Pure utilities, with no knowledge of any domain.
 */
export * from './result'
export * from './decode'
