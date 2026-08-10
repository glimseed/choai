#!/usr/bin/env bash
# Stage the built module and fixtures into web/ and serve them.
#
#   serve.sh [port]        # then open http://localhost:<port>/
#   .../?journal=large.journal   to run against the 1000-transaction fixture
#
# web/ holds only the harness in git; the wasm module, its JSFFI glue and the
# journals are copied in here so that nothing generated is tracked.
set -euo pipefail

WASM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WASM_DIR"
port="${1:-8731}"

for f in out/probe-reactor-D.wasm out/probe-reactor.jsffi.mjs; do
  [ -f "$f" ] || { echo "missing $f -- run scripts/build.sh first" >&2; exit 1; }
done

cp out/probe-reactor-D.wasm web/probe.wasm
cp out/probe-reactor.jsffi.mjs web/probe.jsffi.mjs
cp fixtures/sample.journal fixtures/large.journal web/

echo "serving http://localhost:$port/ (ctrl-c to stop)"
cd web && exec python3 -m http.server "$port"
