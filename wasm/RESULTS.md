# hledger on wasm32-wasi: results

**Verdict: GO.** Every gate passes, most of them by a wide margin. The
client-side WebAssembly route is viable, so the project can be a static-hosted
PWA with no backend.

Measured on Linux x86_64 with GHC 9.14.1.20260731 (ghc-wasm-meta, flavour 9.14),
cabal 3.14.2.0, wasm-opt 131, wasmtime 47.0.2, against hledger 1.52.1.

## Gates

| # | gate | budget | measured | |
|---|---|---:|---:|---|
| G1 | optimised `.wasm` | ≤ 23 MiB | **6.70 MiB** | PASS, 29% of budget (6.94 MiB worst case) |
| G2 | first-load transfer | ≤ 8 MiB | **1.68 MiB** brotli | PASS, 21% of budget |
| G3 | correctness | balances match | **exact** | PASS |
| G4 | speed | instantiate ≤ 2 s, 1000 txns ≤ 1 s | **12 ms / 346 ms** | PASS |
| G5 | upstream trackability | minimal, re-appliable | **0 lines of hledger changed** | PASS |

G1 is the one that decides the architecture: Cloudflare Pages refuses any single
asset over 25 MiB, and the shipped module comes in at a bit over a quarter of
the allowance.

## Size

The module a PWA would actually ship is `probe-reactor`. `floor` is the same
kind of module with no hledger in it, so the gap between the two is what hledger
itself costs; `probe-full` is the ceiling, described below.

| stage | floor | probe-reactor | probe-full (ceiling) |
|---|---:|---:|---:|
| A linked | 1,690,447 | 18,332,402 | 19,104,849 |
| C `llvm-strip --strip-all` | 1,543,696 | 16,501,994 | 17,210,944 |
| **D `wasm-opt -Oz`** | **948,113** | **7,022,792** | **7,279,742** |
| D, gzip -9 | 416,408 | 2,432,960 | 2,524,910 |
| **D, brotli -q11** | **335,067** | **1,761,115** | **1,818,088** |

In MiB, the shipped module is 6.70 raw and 1.68 over the wire, against a floor
of 0.90 raw and 0.32 over the wire. So the Haskell runtime is 0.90 MiB of it and
hledger adds 5.79 MiB.

Two things worth noting about the pipeline:

- `wasm-opt -Oz` more than halves the raw size (16.50 → 6.70 MiB) but barely
  moves the compressed size (1.87 → 1.68 MiB). Nearly all of what it removes was
  redundancy that brotli was already collapsing. It still matters, because the
  25 MiB Cloudflare limit and the browser's compile step both see the raw bytes.
- Stage B from the plan (`-split-sections` plus `--gc-sections`) was dropped: in
  wasm object files each function is already its own section and wasm-ld
  garbage-collects unreferenced ones by default, so there was nothing for it to
  do.

Stage E (`wizer` pre-initialisation) was not run — wizer is not part of the
ghc-wasm-meta bundle, and with instantiation already at 12 ms there is nothing
for it to fix.

### Where the size goes

Function-body bytes in the unstripped shipped module, attributed per package by
reading the wasm code and name sections directly (`scripts/attribute.mjs`):

| package | MiB | share |
|---|---:|---:|
| hledger-lib | 4.29 | 33.5% |
| (rts/C) | 3.00 | 23.4% |
| ghc-internal | 1.43 | 11.1% |
| regex-tdfa | 1.29 | 10.1% |
| encoding | 0.45 | 3.5% |
| emojis | 0.36 | 2.8% |
| text | 0.34 | 2.7% |
| time | 0.26 | 2.0% |
| containers | 0.21 | 1.7% |
| megaparsec | 0.18 | 1.4% |
| Glob | 0.16 | 1.2% |
| 33 others | 0.87 | 6.6% |

Two surprises are worth recording for later, if the budget ever tightens:
`regex-tdfa` alone is a tenth of the code, and `emojis` — pulled in transitively
for text width measurement — costs 0.36 MiB in an application that never renders
a terminal. Neither is worth acting on at 29% of budget.

GHC's wasm backend emits every basic block as a separate anonymous function, so
roughly two thirds of the module cannot be attributed by symbol name directly.
Those bodies are assigned to the last named symbol before them in code-section
order, which is where the code generator places them. The totals are therefore
close but not exact; the floor build is a useful check, since it attributes
cleanly to ghc-internal and the runtime and nothing else.

### The ceiling

The shipped figure is honest but incomplete on its own: the probe only calls the
journal reader and the balance report, so the linker discards the rest of
hledger. A real ledger UI grows into registers, budgets, valuation and CSV
import, and whatever it touches stops being discardable.

`probe-full` therefore references every report and every writer so nothing can
be collected. Optimised, it is 7,279,742 bytes against the shipped module's
7,022,792 — **3.7% larger**, or 6.94 MiB against 6.70 MiB. Using all of hledger
instead of a slice of it costs almost nothing, because the bulk of the module is
the parser, the data model and the runtime, all of which the balance report
already pulls in.

That is the number that makes the GO safe: 6.94 MiB is an upper bound, not a
starting point, and it is still under a third of the limit. The size budget
cannot be spent by the UI growing into the rest of hledger.

## Correctness

`fixtures/sample.journal` is small enough to check by hand. Under wasmtime:

```
assets:bank:checking  $2642.25
equity:opening        $-1000.00
expenses:food            $57.75
expenses:rent           $800.00
income:salary         $-2500.00
---
0
```

All five balances match the arithmetic written into the fixture's header, and
the report totals to zero. Chrome produced byte-identical output, as did the
1000-transaction journal (which also totals to zero).

## Speed

Chrome on the same machine, 1000 transactions (78 KB journal):

| | |
|---|---:|
| `WebAssembly.compileStreaming` | 44 ms |
| instantiate + `hs_init` | 12 ms |
| parse + balance, median of 5 | 346 ms |
| parse + balance, first (cold) call | 1145 ms |

Node driving the same module through the same WASI shim gave 285 ms, so the
figure is not an artefact of one host. The cold first call is JIT warm-up and is
paid once per page load.

A journal of 1000 transactions is a few years of personal bookkeeping. Scaling
the desktop numbers by the usual 4× for mid-range phones puts a full reparse at
somewhat over a second, and a PWA would not be reparsing from scratch on every
interaction anyway.

## Follow-up: where the time actually goes

The 346 ms figure above conflated two different costs, because the probe re-reads
and re-parses the journal on every call. The engine keeps the parsed journal, so
the two can be measured apart. On an idle machine, 1001 transactions:

| | |
|---|---:|
| load (parse), paid once per journal | **288 ms** |
| entries, 50 rows | **17 ms** |
| entries, 200 rows | 64 ms |
| register, 50 rows | 24 ms |
| balance sheet | **10 ms** |
| income statement | **12 ms** |
| balance | 17 ms |
| account list | 0.7 ms |
| entries, all 1001 rows (1.2 MB of JSON) | 306 ms |
| register, all rows (769 KB of JSON) | 219 ms |

**The reports are cheap; serialising them is not.** A balance sheet costs 10 ms,
while handing over every transaction costs 306 ms — and the difference tracks
output size, not computation. Windowing the row-per-item reports turns the main
screen from 306 ms into 17 ms.

So responsiveness is governed by parse-once plus paging, not by compiler flags.

### Optimisation levels, measured rather than assumed

The obvious idea — the module uses under a third of the size budget, so spend the
surplus on speed — was tested and does not pay.

| build | stripped size | parse + balance, 1000 txns |
|---|---:|---:|
| GHC `-O1` (default) | 16.50 MB | 269 ms |
| GHC `-O2` | 26.66 MB (**+62%**) | 258 ms (−4%) |

| wasm-opt level | size | parse + balance |
|---|---:|---:|
| none | 16.50 MB | 262 ms |
| `-O2` | 10.32 MB | 257 ms |
| `-O3` | 10.16 MB | 264 ms |
| **`-Oz`** | **7.02 MB** | 270 ms |

`-O2` costs 62% more bytes for 4% more speed. The wasm-opt levels are all within
noise of each other, so the smallest wins. **The original settings were already
the right ones**, and the size surplus has no better use than staying unspent.

A note for anyone changing `optimization` in `cabal.project`: doing so makes
cabal build into a parallel `opt/` tree without discarding the old one, and
building against the mixture produces misleading "No instance for ToJSON …"
errors for instances that plainly exist. Remove `dist-newstyle` after flipping
the flag.

## Cost against upstream

This is the gate that would have killed the approach quietly, so it is worth
being precise: **no hledger source file and no hledger cabal file was modified.**
`patches/` is empty.

| rung | used | what |
|---|---|---|
| 1. cabal constraints | yes | pin boot libraries to the ones the cross compiler ships |
| 2. shim package | yes, once | `terminal-size` |
| 3. cabal-file patch | no | |
| 4. hledger source patch | no | |

`terminal-size` cannot compile for wasm32-wasi: it asks the OS for window
dimensions via the `TIOCGWINSZ` ioctl, and wasi-libc has neither that ioctl nor
`struct winsize`. `shims/terminal-size` presents the same API and reports that no
terminal is attached. That is not a stub — it is the truthful answer in a browser,
and it is what the real package returns for a redirected stdout, so hledger
already handles it. About 30 lines.

Everything else — `hashtables`, `encoding`, `tasty`, `Glob`, `cassava`,
`megaparsec`, `aeson`, `regex-tdfa` — built for wasm32-wasi without intervention.
`process` and `unix`, which looked like the likeliest blockers, ship with the
cross compiler as boot libraries and linked without trouble.

### Verified against the next release

Claiming trackability is not the same as showing it. The identical setup was
pointed at hledger **1.99.3**, the next release line, via `cabal.project.next`:
it built with no additional changes and produced identical, correct output under
wasmtime.

Optimised it comes to 7,586,919 bytes (7.24 MiB, 1.81 MiB brotli) against
1.52.1's 7,007,715 — 8% larger, and still 31% of the budget. A release-over-
release growth of that size would take many years to threaten the limit, and the
shim and constraints carried over untouched.

### Worth sending upstream

1. **terminal-size**: a `wasm32-wasi` branch returning `Nothing` would remove the
   only shim this project needs.
2. **hledger**: `readJournal''` builds its `Handle` with `createPipe`, which WASI
   does not implement — confirmed at runtime as
   `createPipe: unsupported operation`. A Text-based reader path that does not go
   through a pipe would let browser hosts skip the virtual filesystem entirely.

## Consequences for the design

- **Journals must reach hledger as files, not as strings.** The Text entry point
  is unusable on WASI. This is not a workaround so much as the natural shape: the
  PWA fetches files from GitHub, writes them into an in-memory WASI filesystem,
  and hledger reads them exactly as it reads files on disk — which is also why
  hledger needs no modification.
- **The wasm module is a cache-once asset.** 1.68 MiB brotli, fetched on first
  visit and kept in Cache Storage.
- **hledger's own logic does the accounting.** No reimplementation, so hledger's
  semantics and future fixes come along for free.

## What this did not measure

- Only Chrome on desktop Linux. No mobile browser, no Safari.
- CSV and rules import are linked in and compile, but were not exercised.
- Multi-file journals with `include`, and anything touching real dates or market
  prices over the network.
- Memory ceilings for very large journals; 1000 transactions is small.
- hledger 1.52.1 and 1.99.3 only.

None of these affect the GO decision, since the ceiling measurement already
bounds the size and the failure modes above would be functional rather than
architectural.
