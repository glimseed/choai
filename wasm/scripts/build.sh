#!/usr/bin/env bash
# Build every probe, run the post-linker for the reactor modules, push each
# module through the size pipeline, and attribute the code size by package.
#
#   build.sh            # everything
#   build.sh probe-cli  # one target
set -euo pipefail

WASM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WASM_DIR"
# shellcheck disable=SC1091
. "$HOME/.ghc-wasm/env"

POST_LINK="$HOME/.ghc-wasm/wasm32-wasi-ghc/lib/post-link.mjs"
targets=("${@:-engine probe-cli probe-reactor floor}")
read -ra targets <<<"${targets[*]}"

mkdir -p out

# Changing optimisation level makes cabal write to a second location (…/opt/…)
# without removing the first, so more than one build of a target can exist at
# once. Take the most recently written rather than whichever find reaches first.
artifact() {
  find dist-newstyle -type f -path "*/x/$1/*/$1.wasm" -printf '%T@ %p\n' \
    | sort -rn | head -1 | cut -d' ' -f2-
}

for target in "${targets[@]}"; do
  echo "== $target"
  wasm32-wasi-cabal build "$target" 2>&1 | tail -3
  src="$(artifact "$target")"
  if [ -z "$src" ]; then
    echo "   no wasm produced for $target" >&2
    exit 1
  fi
  cp "$src" "out/$target.wasm"

  # The JSFFI glue is generated from the unstripped module, before the size
  # pipeline runs. The glue is a separate JS file, so optimising the wasm
  # afterwards cannot invalidate it.
  if [ "$target" != "probe-cli" ]; then
    node "$POST_LINK" -i "out/$target.wasm" -o "out/$target.jsffi.mjs"
  fi

  ./scripts/measure.sh "$target" "out/$target.wasm" | tee "out/$target.sizes.md"
  echo
  node scripts/attribute.mjs "out/$target-A.wasm" 20 > "out/$target.attribution.md"
  echo "   attribution -> out/$target.attribution.md"
  echo
done
