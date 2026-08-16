# choai

A PWA for keeping [hledger](https://hledger.org/) journals in a GitHub repository.

The goal is a fully client-side application: the journal is parsed and reported
by hledger's own logic compiled to WebAssembly, served as static assets from
Cloudflare Pages, with no backend. That keeps the running cost near zero, which
is what makes it possible to offer the service free of charge and free of ads.

The UI is built with SolidJS, Solid Router, TailwindCSS and Kobalte. Components
adapted from solid-ui are vendored into the source tree rather than taken as a
runtime dependency.

## The name

Western bookkeeping reached Japan under a borrowed name. In 1873, Fukuzawa
Yukichi translated Bryant and Stratton's *Common School Book-keeping* and
published it as 帳合之法, *Chōai no Hō* — the method of chōai. He did not coin
the word for the occasion: chōai was already what the merchant houses called
the work of setting the books against what was there until the two agreed.
Double-entry arrived in the country under a name it found waiting for it,
imported whole rather than invented anew.

This is the same kind of carrying across. The accounting here is hledger's own,
compiled and brought into the browser intact, not reimplemented in it. So the
app is named for the crossing rather than for the cargo: **choai**.

## What it does

The journal is kept as the text file it is, and hledger itself -- compiled to
WebAssembly and running in a worker -- reads it and answers every question the
screens ask. Nothing is uploaded anywhere by the app.

- **Read**: the daily journal, the balance sheet, the income statement, and
  every account with its balance. One hledger query applies to whichever is
  open.
- **Write**: entries are composed beside the journal, with accounts suggested
  from what the books already contain -- by the same code `hledger add` uses --
  and a posting left blank for hledger to work out. Text is appended, never
  rewritten.
- **Edit**: the journal's own text, one file at a time. hledger reads it before
  it is kept, so text that will not parse never replaces text that does.
- **Keep**: the files stay on the device, one record per path, and the journal
  left open comes back on the next visit.
- **Take away**: the share sheet on a phone, a download elsewhere.
- **Ask**: questions in a sentence, answered by hledger. Attach a photograph of
  a receipt or a bank statement and get entries back, offered rather than
  written: what is confident is ticked, what is not is set aside with a reason,
  and nothing joins the journal until you press. The browser talks to the model
  directly with a key of your own -- Claude or Gemini -- and what it may call is
  the same table `window.choai` publishes, minus anything that could change the
  books without showing you first, and minus anything that leaves the device.
- **Sync**: a path in a GitHub repository, reached from the browser straight to
  api.github.com. Entries written in two places are laid one after the other;
  when the same part changed on both sides, nothing is merged and it says so.

## `window.choai`

Everything above is reachable without a screen. Opening the app puts a
`window.choai` in the page: the same core, answering a script, a test, or an
agent instead of a person.

```js
await window.choai.ready                                 // which journal is open, decided
window.choai.describe()                                  // every capability, with its JSON Schema
await window.choai.report.balance({ query: "date:lastmonth acct:expenses" })
await window.choai.call("journal.similar", { description: "Amazon" })
await window.choai.idle()                                // everything asked has been answered
```

`describe()` returns a manifest with a `version` that names this promise. Adding
a capability, or an argument that may be left out, leaves anything already
written against it working; taking one away, or narrowing one, does not, and
that is what the version moves for.

- **Two doors, one table.** `choai.report.balance(...)` is for names known when
  the code is written; `choai.call(name, args)` is for anything that read
  `describe()` and chose. Both are read off one table, so what a capability
  takes cannot drift from what it says it takes.
- **Nothing throws.** Every call answers `{ok: true, value}` or
  `{ok: false, error}`, and the error is a case with its particulars rather than
  a sentence — a missing field comes back with the path to it and the whole
  schema, so a correction can be made without asking again.
- **Figures are exact.** Amounts cross as a mantissa and a scale, with the same
  figure written out. hledger's floating-point copy is left behind.
- **Writing is two acts.** `transaction.propose` writes entries down without
  keeping them and says whether hledger read them; `proposal.apply` keeps them,
  or the ones named and no others. So a diff exists before anything is decided,
  a hundred entries with three doubtful ones is one glance and one press, and a
  proposal made against a journal that has since moved is refused rather than
  applied over the top of it.
- **What is deliberately absent.** No way to run code, no way to write a file as
  text, and no way to read back the tokens this app keeps. A capability names an
  act, and the acts are the ones the screens also perform — so an agent goes
  through the same door as a person, and hledger reads everything before it is
  kept.

Being reachable is the point: this is a local application with no server, and
what it can do it can be asked to do.

The feasibility spike that decided all this lives in [`wasm/`](wasm/); its
answer -- that hledger-lib can be compiled to `wasm32-wasi`, kept small enough
for a Cloudflare Pages asset, kept fast enough to be usable, and kept close
enough to upstream to follow future releases -- is recorded with its
measurements in `wasm/RESULTS.md`. See `wasm/README.md` for how to reproduce
them.

Not one line of hledger's source is modified. What we write is the binding that
exports its functions to JavaScript, in `wasm/hledger-wasm/src/Bindings.hs`.

## Two sites

- **`choai.dev`** — the app itself, from `apps/web/dist`.
- **`docs.choai.dev`** — the page that explains it, from `docs/dist`:
  a separate Astro project, English at the root and Japanese at `/ja/`. It loads
  no fonts, runs no scripts and tracks nobody, which is the same claim it makes
  on the app's behalf.

`scripts/build-site.sh` builds both locally.

Each is published on its own as a Cloudflare Worker serving static assets, built
from this repository on a push to `main`. What the directory is and how it is
served is in the `wrangler.jsonc` beside it; the rest lives in the dashboard,
where each of the two is configured the same way but for its own directory:

| | `choai` | `choai-docs` |
| --- | --- | --- |
| Root directory | `apps/web` | `docs` |
| Build command | `bun install && bun run build` | `bun install && bun run build` |
| Deploy command | `bunx wrangler deploy` | `bunx wrangler deploy` |
| `BUN_VERSION` | `1.3.14` | `1.3.14` |

No output directory is set in either, because `assets.directory` already says
it. Nothing else is needed: the engine is committed, so the build wants no
Haskell toolchain, and `docs` needs no `PUBLIC_APP` because a build that is not
a development one already points at the published app.

## License

GPL-3.0-or-later.

This is not a preference so much as a consequence: the application ships
hledger-lib compiled into its WebAssembly module, and hledger is
GPL-3.0-or-later, so the combined work is too. Publishing the source here is
what satisfies the corresponding-source obligation for the binary that browsers
download.

`apps/web/src/lib/solid-workbench-ui` is the author's own work under MIT, which
is compatible with the above and leaves it reusable outside this project.
Components under `apps/web/src/components/ui` are adapted from
[solid-ui](https://github.com/stefan-karger/solid-ui) (MIT). Icons are from
[lucide](https://lucide.dev) (ISC).
