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

From `apps/web`. There is no linter; `tsc` is the check that runs over everything.

```sh
bun install      # bun is the package manager and the script runner
bun run dev      # licences, then vite on :8396      bun run build   # + tsc -b
bunx tsc -b      # typecheck alone: src, vite.config, tests and e2e
bun run test     # bun test over tests/ — the pure functions only
bun run e2e      # playwright over e2e/ — drives window.choai, not the screen
bun scripts/vendor-ui.mjs <name>...    # re-fetch a solid-ui component
```

`playwright.config.ts` starts its own dev server with `CHOAI_TEST=1`, which
turns the service worker off: it precaches the ~7 MB engine and updates itself,
which is right on a phone and wrong under a test.

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
- **`hledger/turn.ts` is the one queue.** hledger holds a single parsed journal,
  so `ask` and every open wait their turn. A trial — read a candidate, then put
  the old one back — is one turn, which is why `openJournal` is left ungated and
  its callers take the turn instead. The worker takes its messages one at a time
  for the same reason.
- **`api/` is the app without a screen.** One table in `api/table.ts` yields all
  three faces: the typed `window.choai.report.balance(...)`, the by-name
  `call(name, args)`, and the manifest `describe()` — so none can drift from
  another. It sits strictly on `journal/store.ts`, `compose/commit.ts` and
  `hledger/client.ts`; nothing there reaches `lib/idb.ts` or the worker, no
  capability writes raw text or reads back a token, and answers are rebuilt in
  `api/answered.ts` rather than passed through, because what is published is a
  promise and hledger's floats are not part of it. `README.md` documents it.
- **`journal/proposals.ts` is the write path for anything without a screen.**
  Changes are trialled as one candidate (hledger re-reads the whole journal per
  open, so one call per change is two orders of magnitude of waiting), the files
  are derived from the items every time rather than stored, and `apply` compares
  every touched file to what it was before handing over — **with no `await` in
  between**, which is the only thing stopping a concurrent write from being
  replaced by text composed before it. A removal is an item like an addition, so
  a correction is one shown, atomic write; removals are applied bottom-up
  because every line taken out shifts the ones below it.
- **`ai/` sits on `api/` and nowhere else.** The tools are `describe()` filtered
  to `offered`, which is a fact of its own and not derivable from `writes`:
  `transaction.create` writes one entry nobody saw first and is withheld, while
  `proposal.apply` writes many and is offered, because they were shown.
- **`ai/talker.ts` is the seam between providers.** `loop.ts`, `prompt.ts` and
  the panels are written against it and against nobody's API; `anthropic.ts`,
  `gemini.ts` and `openai.ts` are each one provider's spelling of it,
  `openai-compatible.ts` is one spelling shared by everyone who answers to
  OpenAI's older chat-completions shape (DeepSeek, Qwen, OpenRouter — a
  hostname and a default apart), and `talkers.ts` is the table the settings
  picker and the per-provider key are read off. A turn's blocks stay opaque all the way through because all three
  keep things in a turn that must come back byte for byte. The host a key is
  sent to is a field on the talker, so a provider cannot be added without the
  page saying where what is typed will go. **A conversation belongs to one
  provider** — `ai/store.ts` starts again on a switch rather than handing one
  provider's blocks to another. Gemini takes only a subset of JSON Schema and
  refuses `additionalProperties`, so `gemini.ts` trims it on the way out; that
  is why the schema is not written twice. `ai/kept.ts` holds the key and names its
  only two permitted importers; nothing under `api/` may read it. A turn goes
  back to the model exactly as it arrived — thinking and tool blocks unedited —
  which is why `anthropic.ts` holds blocks opaque instead of parsing them into a
  union. Leave adaptive thinking on: with it off, a tool call is sometimes
  written out as ordinary text and silently runs nothing. OpenAI goes through
  the Responses API, whose conversation is one flat list of items with no roles
  at the top, and with `store: false` so nothing of the journal is kept at their
  end — which is also what makes reasoning items come back carrying their own
  encrypted contents, so they can be handed back.
- **What a model takes decides what is sent to it.** Anthropic answers the
  question in its listing, so `anthropic.ts` reads it per field — a model
  missing adaptive thinking is sent a budget instead, and one missing effort is
  sent none — and a field the listing does not answer is left unwritten rather
  than recorded as a no. Google and OpenAI answer nothing, so `gemini.ts` and
  `openai.ts` decide on the names and err towards leaving a model out — which is safe because the settings panel
  offers what they find as suggestions in a box you type in
  (`lib/ui/suggesting.tsx`), not as the whole of what can be said. A name missing
  from the list is an inconvenience, never a wall, and each talker carries a
  `modelsFrom` link to where its provider publishes the real answer. All three
  listings say how much a model will write, and no turn asks for more than that.
- **Attachments are read before they are sent.** A photograph is scaled to
  1568px and re-encoded (`ai/photo.ts`) — a phone writes 4000px and every model
  charges by area. A statement is parsed by `lib/csv.ts` only to know it is a
  table and how long; **the file's own text is what goes over**, because rows
  read out and written back is a chance to change somebody's figures on the way.
- **`lib/text.ts` decides a file's encoding rather than assuming it**, and is
  what every file read off the filesystem goes through — an attachment and a
  journal alike. Japanese banks and much of the accounting software here write
  Shift_JIS, and assuming UTF-8 does not fail: the commas and line endings
  survive, so it still parses, and the payees quietly become replacement
  characters. UTF-8 is tried strictly first because plenty of it decodes as
  Shift_JIS into nonsense, while almost no Shift_JIS is accidentally valid UTF-8.
- **`hledger/wire.ts` mirrors `Bindings.hs`** — `Request`, `Answer`, `Trouble`
  against its `Request` parser and `Failure` type. A new report means editing
  both. Shapes are hledger's own `ToJSON`, so they follow upstream.
- **The text is what is true.** `journal/store.ts` alone owns the open journal,
  and every write is offered to hledger first and kept only if it reads.
  `openBringingMissing` fetches `include`d files as hledger asks for them.
- **One line in the console, and no others.** `api/install.ts` says `window.choai`
  is there, because an agent driving a browser reads the console and sees
  nothing in the screens about it. Nothing else writes there — not hledger's own
  stdout, not what a model listing set aside — since a console with a running
  commentary in it has nowhere to put the one line meant to be read. An e2e test
  holds that count at one.
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
- **An update waits to be taken.** `registerType` is `prompt`, so a new service
  worker installs and stands by: the browser hands over when the last window on
  the old one closes, which makes shutting the app and opening it again an
  update. `lib/renewal.ts` is the only thing that reloads, and only when asked —
  a reload takes a half-typed entry, a conversation and every undecided proposal
  with it. It also does the asking, because a phone app is resumed rather than
  navigated to and a resume is not when a browser looks for a new worker.
- **The module is ~7 MB** against a 25 MiB Cloudflare limit, which is why
  `maximumFileSizeToCacheInBytes` is raised in `vite.config.ts`.
- **Money is never a float** — rendered from mantissa and scale in
  `hledger/amount.ts`; hledger's float field is left out of `Quantity`.

Commit subjects say what the app now does, not what was touched: "Let the journal
be edited as the text it is".

