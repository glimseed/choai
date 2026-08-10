#!/usr/bin/env bash
# Run a linked wasm module through the size-reduction pipeline and report what
# each stage bought, uncompressed and compressed.
#
#   measure.sh <label> <module.wasm>
#
# Stages are cumulative:
#   A  as the linker produced it
#   C  llvm-strip --strip-all
#   D  wasm-opt -Oz
#
# Stage B from the plan (-split-sections plus --gc-sections) is absent on
# purpose: wasm object files already place each function in its own section and
# wasm-ld garbage-collects unreferenced ones by default, so there is nothing for
# it to do here. Stage names are kept aligned with the plan rather than renamed.
#
# Outputs go next to the input as <label>-<stage>.wasm so attribution can be run
# against the unstripped stage A afterwards.
set -euo pipefail

# Sourced here rather than left to the caller so the script works standalone,
# not only when build.sh has already set the environment up.
# shellcheck disable=SC1091
. "$HOME/.ghc-wasm/env"

label="${1:?usage: measure.sh <label> <module.wasm>}"
input="${2:?usage: measure.sh <label> <module.wasm>}"
outdir="$(dirname "$input")"
strip="$HOME/.ghc-wasm/wasi-sdk/bin/llvm-strip"

cp "$input" "$outdir/$label-A.wasm"
"$strip" --strip-all -o "$outdir/$label-C.wasm" "$outdir/$label-A.wasm"
wasm-opt -Oz --strip-debug --strip-dwarf --strip-producers \
  "$outdir/$label-C.wasm" -o "$outdir/$label-D.wasm"

printf '| %s | raw | gzip -9 | brotli -q11 |\n' "$label"
printf -- '|---|---:|---:|---:|\n'
for stage in A C D; do
  f="$outdir/$label-$stage.wasm"
  raw=$(stat -c%s "$f")
  gz=$(gzip -9 -c "$f" | wc -c)
  br=$(brotli -q 11 -c "$f" | wc -c)
  case $stage in
    A) desc="A linked" ;;
    C) desc="C strip-all" ;;
    D) desc="D wasm-opt -Oz" ;;
  esac
  printf '| %s | %s | %s | %s |\n' "$desc" "$raw" "$gz" "$br"
done
