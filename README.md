# hledger-pwa

A PWA for keeping [hledger](https://hledger.org/) journals in a GitHub repository.

The goal is a fully client-side application: the journal is parsed and reported
by hledger's own logic compiled to WebAssembly, served as static assets from
Cloudflare Pages, with no backend. That keeps the running cost near zero, which
is what makes it possible to offer the service free of charge and free of ads.

The UI is built with SolidJS, Solid Router, TailwindCSS and Kobalte. Components
adapted from solid-ui are vendored into the source tree rather than taken as a
runtime dependency.

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
- **Sync**: a path in a GitHub repository, reached from the browser straight to
  api.github.com. Entries written in two places are laid one after the other;
  when the same part changed on both sides, nothing is merged and it says so.

The feasibility spike that decided all this lives in [`wasm/`](wasm/); its
answer -- that hledger-lib can be compiled to `wasm32-wasi`, kept small enough
for a Cloudflare Pages asset, kept fast enough to be usable, and kept close
enough to upstream to follow future releases -- is recorded with its
measurements in `wasm/RESULTS.md`. See `wasm/README.md` for how to reproduce
them.

Not one line of hledger's source is modified. What we write is the binding that
exports its functions to JavaScript, in `wasm/hledger-wasm/src/Bindings.hs`.

## The landing page

`apps/lp` is a separate Astro project, built to `/lp` of the same site so that it
can link straight to the app and to its licence page. English at `/lp/`, Japanese
at `/lp/ja/`. It loads no fonts, no scripts and no analytics — the same claim the
page itself makes about the app.

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
