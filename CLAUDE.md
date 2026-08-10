# hledger-pwa

A PWA for keeping hledger journals in a GitHub repository. The accounting is done
by hledger itself — hledger-lib compiled to WebAssembly — and the code in this
repository carries its input and output, and the screens around it.

## How to write here

Even where the shape of the work is imperative, write it with functions wherever
functions will do.

- **Write functionally as a matter of course.** Pure functions, immutability,
  composition, exhaustive matching. Not as a technique being applied, just as how
  the code is written. Anything that can fail returns `Result<T, E>` rather than
  throwing. Branches are exhausted through discriminated unions. Avoid `throw`,
  avoid mutation, avoid a `let` that exists to be assigned once and forgotten;
  build from small pure functions composed together. Do not write comments
  announcing that something is functional — that is assumed. SolidJS signals and
  derivations are the vessels effects live in, but the logic inside them stays
  pure. **Where the effect is itself the subject — time, timers, subscriptions —
  shut it inside a vessel as a state machine.**

- **Do not flatten a failure into a string meant for display.** Carry what
  happened; let the screen decide the wording. Returning a string leaves the
  caller with nothing to do but print the sentence it was handed — it cannot,
  say, keep the input around for this one reason and not others.

- **`null` and `undefined`.** `undefined` is the default: absence that arose on
  its own. No value, not yet initialised, not found, omitted — all `undefined`.
  **`null` is for when a developer meant to put it there**, so a `null` in the
  code is always a statement of intent. A `null` arriving from a boundary — the
  DOM, a regular expression, localStorage, someone else's JSON — is turned into
  `undefined` at that boundary before it travels inward. **The same going out:**
  a field that is not being touched is omitted, not set to `null`. When in doubt,
  `undefined`.

- **Comments are JSDoc and GoDoc only.** Not inline inside a function body.
  Intent is carried by descriptive names and by breaking work into small
  functions — names growing somewhat longer for that reason is fine, though
  length is not itself the goal. **Write above a declaration only when the "why"
  cannot be said in the code.**

- **Keep scope small, always.** In English, written on the assumption it will be
  grown.
