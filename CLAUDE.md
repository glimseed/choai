# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# choai

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

## Commands

From `apps/web`. There is no linter and no test runner; `tsc` is the only check.

```sh
bun install      # bun is the package manager and the script runner
bun run dev      # licences, then vite on :8396      bun run build   # + tsc -b
bunx tsc -b      # typecheck alone
bun scripts/vendor-ui.mjs <name>...    # re-fetch a solid-ui component
```

The engine — `public/hledger.wasm` and the `src/hledger/ghc-jsffi.mjs` the worker
imports — is committed, so a fresh clone runs. It is the one wasm here that is
not a measurement, and it is checked in because rebuilding it needs the ghc-wasm
toolchain, which the machine that deploys will not have. Everything under
`wasm/out/` stays ignored. To move the engine to a new hledger:

```sh
../../wasm/scripts/build.sh hledger-bindings   # needs the ghc-wasm toolchain
bun scripts/sync-hledger.mjs                   # -> public/hledger.wasm, src/hledger/ghc-jsffi.mjs
```

Both land in the same commit as the `wasm/` source they came from, which is what
records which source the published binary was built from.

`wasm/README.md` has the rest (`setup.sh`, benching, `serve.sh`).

The page that explains the app is its own Astro project in `docs/`, beside the
app rather than inside it — where Vite keeps its own site. Its own dependencies,
nothing of the app's, two names, two deployments:

```sh
bun --cwd=docs run dev           # astro on :45720 (ASTRO in digits)
scripts/build-site.sh            # apps/web/dist and docs/dist, side by side
```

`choai.dev` serves `apps/web/dist`, `docs.choai.dev` serves `docs/dist`. Where
the app lives is `PUBLIC_APP` in `docs/.env`, so development links to a local
app rather than to the published one.

Each is published as a Cloudflare Worker serving static assets, built from
`main`. The `wrangler.jsonc` beside each directory says what is served and how;
what the dashboard is set to is in `README.md`. A `_redirects` cannot carry the
app's fallback — the reason is written where it is handled instead.

## Architecture

`wasm/` makes hledger reachable from JavaScript; `apps/web` is everything around
it. They meet only at the two files `sync-hledger.mjs` copies. `~` aliases `src/`.

- **The worker holds the journal.** `hledger/worker.ts` keeps one reactor
  instance alive across calls — parsing costs ~290 ms, queries 10–25 ms. Files go
  into a WASI `PreopenDirectory` rather than as strings, because hledger's text
  entry point needs `createPipe` and because `include` then resolves itself.
- **`hledger/client.ts` is the only way in**, answering `Result<T, Trouble>`;
  nothing throws or rejects, and a dead worker settles everyone stranded.
- **`hledger/wire.ts` mirrors `Bindings.hs`** — `Request`, `Answer`, `Trouble`
  against its `Request` parser and `Failure` type. A new report means editing
  both. Shapes are hledger's own `ToJSON`, so they follow upstream.
- **The text is what is true.** `journal/store.ts` alone owns the open journal,
  and every write is offered to hledger first and kept only if it reads.
  `openBringingMissing` fetches `include`d files as hledger asks for them.
- **`lib/idb.ts` is the whole database** — name, version, stores, migrations —
  because IndexedDB versions all of it at once.
- **`github/sync.ts`** appends local entries after remote ones when both texts
  still begin with what was last agreed, and otherwise reports `diverged`
  untouched. Straight to api.github.com; there is no backend anywhere.
- **`app.tsx`** wires `lib/solid-workbench-ui` (MIT, kept app-agnostic); its
  `NAV`/`FOOT`/`INNER` tables pair each route with its explorer, and one query in
  the URL is shared by every view.
- **`i18n/en.ts` is the type** every other dictionary is checked against, and
  `docs/src/words.ts` does the same for the landing page — which speaks to
  someone who has not opened the app, so it does not share the app's wording.
- **Generated or vendored, so don't hand-edit:** `src/generated/` (licences,
  rebuilt each dev/build), `src/components/ui/*` (solid-ui), `wasm/vendor/`.

## Constraints

- **GPL-3.0-or-later**, inherited by linking hledger-lib; publishing here is what
  satisfies it. Keep `lib/solid-workbench-ui` MIT and reusable.
- **`docs/` is GPL by choice and must stay separable.** It links against nothing
  of the app's — no shared config, no shared dependencies, no imports across the
  two — so the copyleft does not reach it on its own; it carries the same licence
  because that is what this project publishes under. It could still be lifted
  into a repository of its own without unpicking anything.
- **Upstream must stay followable.** Fix a wasm build failure as far from
  hledger's source as possible: `cabal.project` → `shims/` → a `.cabal` patch →
  its source last, recorded in `RESULTS.md`. Currently zero lines changed.
- **The module is ~7 MB** against a 25 MiB Cloudflare limit, which is why
  `maximumFileSizeToCacheInBytes` is raised in `vite.config.ts`.
- **Money is never a float** — rendered from mantissa and scale in
  `hledger/amount.ts`; hledger's float field is left out of `Quantity`.

Commit subjects say what the app now does, not what was touched: "Let the journal
be edited as the text it is".

