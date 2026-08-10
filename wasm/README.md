# hledger on wasm32-wasi: feasibility spike

Answers one question, in `RESULTS.md`: can hledger's own logic run in a browser,
small enough for a Cloudflare Pages asset, fast enough to be usable, and close
enough to upstream that future hledger releases can be followed without keeping
a fork?

Nothing here is production code. Every binary exists to be measured.

## Reproducing

```sh
./scripts/setup.sh     # toolchain + hledger sources (multi-GB, 15-30 min)
./scripts/build.sh     # build, optimise, measure, attribute
```

`setup.sh` is idempotent and skips whatever is already in place. Both scripts
source `~/.ghc-wasm/env` themselves.

Verification:

```sh
# correctness under a wasm runtime
wasmtime run --dir fixtures::/f out/probe-cli.wasm /f/sample.journal

# speed, driven through the same WASI shim the browser page uses
node scripts/bench.mjs out/probe-reactor-D.wasm out/probe-reactor.jsffi.mjs \
  fixtures/large.journal

# in an actual browser
./scripts/serve.sh          # then open http://localhost:8731/
                            # ?journal=large.journal for the 1000-txn fixture
```

## Layout

| path | what it is |
|---|---|
| `hledger-wasm/src/Probe.hs` | the measured slice: journal in, balance report out |
| `hledger-wasm/src/MainCli.hs` | WASI command probe, run under wasmtime |
| `hledger-wasm/src/MainReactor.hs` | reactor module, the shape a PWA would ship |
| `hledger-wasm/src/Floor.hs` | same shape, no hledger — the size floor |
| `shims/` | replacements for packages that cannot build for wasm32-wasi |
| `patches/` | last-resort edits to hledger itself |
| `cabal.project` | everything needed to build hledger for wasm, kept out of `vendor/` |
| `scripts/attribute.mjs` | per-package code size, read out of the wasm binary directly |
| `web/` | browser harness |
| `vendor/`, `out/` | fetched and generated, not tracked |

## Why there is a floor build

A number for the probe alone cannot be acted on. If the module is too big, the
next move depends entirely on whether the weight is hledger or the Haskell
runtime underneath it, and those point at opposite decisions. `Floor.hs` is a
reactor module of the same shape with no hledger in it, so every probe
measurement can be read as floor plus hledger.

## Keeping upstream reachable

Following hledger releases is a hard requirement, so `vendor/` is treated as
read-only and fixes are applied as far away from it as possible:

1. constraints in `cabal.project`
2. a shim package under `shims/` shadowing the Hackage one
3. a patch to a `.cabal` file only
4. a patch to hledger's source — recorded, and counted against the goal

`RESULTS.md` records which rung each fix landed on.
