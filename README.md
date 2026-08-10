# hledger-pwa

A PWA for keeping [hledger](https://hledger.org/) journals in a GitHub repository.

The goal is a fully client-side application: the journal is parsed and reported
by hledger's own logic compiled to WebAssembly, served as static assets from
Cloudflare Pages, with no backend. That keeps the running cost near zero, which
is what makes it possible to offer the service free of charge and free of ads.

The UI is built with SolidJS, Solid Router, TailwindCSS and Kobalte. Components
adapted from solid-ui are vendored into the source tree rather than taken as a
runtime dependency.

## Current phase: feasibility check

Before any UI work, we need to know whether the client-side WebAssembly approach
is viable at all. The spike lives in [`wasm/`](wasm/) and answers a single
question, recorded in `wasm/RESULTS.md`:

> Can hledger-lib be compiled to `wasm32-wasi`, kept small enough for a
> Cloudflare Pages asset, kept fast enough to be usable in a browser, and kept
> close enough to upstream that future hledger releases can be followed without
> maintaining a deep fork?

If the answer is no, the project changes direction to a server-side application
in the style of hledger-web instead.

See `wasm/README.md` for how to reproduce the measurements.

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
