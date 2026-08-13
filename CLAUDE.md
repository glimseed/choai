# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Commands

From `apps/web`. There is no linter and no test runner; `tsc` is the only check.

```sh
npm run dev      # licences, then vite on :8396      npm run build   # + tsc -b
npx tsc -b       # typecheck alone
node scripts/vendor-ui.mjs <name>...   # re-fetch a solid-ui component
```

The engine is a build output of `wasm/`, gitignored, and `src/hledger/ghc-jsffi.mjs`
is imported by the worker — so a fresh clone cannot even start until:

```sh
../../wasm/scripts/build.sh hledger-bindings   # needs the ghc-wasm toolchain
node scripts/sync-hledger.mjs                  # -> public/hledger.wasm, src/hledger/ghc-jsffi.mjs
```

`wasm/README.md` has the rest (`setup.sh`, benching, `serve.sh`).

The page that explains the app is its own Astro project in `apps/docs`, with its
own dependencies and nothing of the app's. Two names, two deployments:

```sh
npm --prefix apps/docs run dev   # astro on :45720 (ASTRO in digits)
scripts/build-site.sh            # apps/web/dist and apps/docs/dist, side by side
```

`hledger-pwa.app` serves `apps/web/dist`, `docs.hledger-pwa.app` serves
`apps/docs/dist`. Where the app lives is `PUBLIC_APP` in `apps/docs/.env`, so
development links to a local app rather than to the published one.

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
  `apps/docs/src/words.ts` does the same for the landing page — which speaks to
  someone who has not opened the app, so it does not share the app's wording.
- **Generated or vendored, so don't hand-edit:** `src/generated/` (licences,
  rebuilt each dev/build), `src/components/ui/*` (solid-ui), `wasm/vendor/`.

## Constraints

- **GPL-3.0-or-later**, inherited by linking hledger-lib; publishing here is what
  satisfies it. Keep `lib/solid-workbench-ui` MIT and reusable.
- **Upstream must stay followable.** Fix a wasm build failure as far from
  hledger's source as possible: `cabal.project` → `shims/` → a `.cabal` patch →
  its source last, recorded in `RESULTS.md`. Currently zero lines changed.
- **The module is ~7 MB** against a 25 MiB Cloudflare limit, which is why
  `maximumFileSizeToCacheInBytes` is raised in `vite.config.ts`.
- **Money is never a float** — rendered from mantissa and scale in
  `hledger/amount.ts`; hledger's float field is left out of `Quantity`.

Commit subjects say what the app now does, not what was touched: "Let the journal
be edited as the text it is".

