// Attribute wasm code size to the Haskell package each function came from.
//
// wabt is not available here (installing it needs root), so rather than shelling
// out to wasm-objdump this reads the two sections that carry the answer:
//
//   - the code section, where every function body is length-prefixed, so body
//     sizes are exact rather than estimated;
//   - the name section, which GHC leaves in place and which carries mangled
//     symbol names that start with the defining package.
//
// Run against an *unstripped* module; stripping removes the name section.
//
//   node attribute.mjs <module.wasm> [topN]

import { readFileSync } from "node:fs";

const [, , file, topArg] = process.argv;
if (!file) {
  console.error("usage: attribute.mjs <module.wasm> [topN]");
  process.exit(1);
}
const top = Number(topArg ?? 25);
const buf = readFileSync(file);

if (buf.readUInt32LE(0) !== 0x6d736100) throw new Error("not a wasm module");

let p = 8;
const u32 = () => {
  let result = 0;
  let shift = 0;
  for (;;) {
    const byte = buf[p++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return result >>> 0;
    shift += 7;
  }
};
const skip = (n) => {
  p += n;
};
const str = () => {
  const n = u32();
  const s = buf.toString("utf8", p, p + n);
  p += n;
  return s;
};

let importedFuncs = 0;
const bodySizes = []; // parallel to defined functions, in definition order
const names = new Map(); // function index -> name

while (p < buf.length) {
  const id = buf[p++];
  const size = u32();
  const end = p + size;

  if (id === 2) {
    // imports: only function imports shift the index space
    const count = u32();
    for (let i = 0; i < count; i++) {
      str(); // module
      str(); // field
      const kind = buf[p++];
      if (kind === 0) {
        u32();
        importedFuncs++;
      } else if (kind === 1) {
        skip(1);
        const flags = buf[p++];
        u32();
        if (flags & 1) u32();
      } else if (kind === 2) {
        const flags = buf[p++];
        u32();
        if (flags & 1) u32();
      } else if (kind === 3) {
        skip(1);
        skip(1);
      } else if (kind === 4) {
        u32();
        u32();
      }
    }
  } else if (id === 10) {
    const count = u32();
    for (let i = 0; i < count; i++) {
      const bodySize = u32();
      bodySizes.push(bodySize);
      p += bodySize;
    }
  } else if (id === 0) {
    const sectionName = str();
    if (sectionName === "name") {
      while (p < end) {
        const sub = buf[p++];
        const subSize = u32();
        const subEnd = p + subSize;
        if (sub === 1) {
          const count = u32();
          for (let i = 0; i < count; i++) names.set(u32(), str());
        }
        p = subEnd;
      }
    }
  }
  p = end;
}

// GHC mangles Haskell symbols as <package>_<Module>ziSub_<name>_entry, with the
// package part z-encoded (hledger-lib-1.52.1 -> hledgerzmlibzm1zi52zi1).
const decodeZ = (s) =>
  s.replace(/zm/g, "-").replace(/zi/g, ".").replace(/zu/g, "_").replace(/ZC/g, ":");

// Most of a GHC wasm module is not directly attributable: the code generator
// emits every Cmm basic block as its own function named _blk_cNNN, and local
// closures as sNNN_entry. Those carry no package in their name, but they are
// emitted contiguously right after the procedure they belong to, so the last
// named symbol seen in code-section order identifies them. That carry-forward
// is a heuristic, not ground truth -- it is why this script reports how much of
// the module it had to attribute that way.
// A Haskell symbol is <package>_<Module>_<name>_<suffix>, and the module part
// always carries "zi" -- the z-encoding of the dot in a module path. C and RTS
// symbols never do, which cleanly separates stg_MUT_ARR_PTRS_CLEAN_entry from
// ghczminternal_GHCziInternalziBase_foo_entry.
// Unit ids carry a version and cabal's build hash (or "-inplace" for a local
// package); neither adds anything to a size breakdown.
const clean = (pkg) =>
  pkg
    .replace(/-inplace$/, "")
    .replace(/-[0-9a-f]{4,}$/, "")
    .replace(/-[0-9][0-9.]*$/, "");

const HASKELL = /^([^_]+)_([A-Z][^_]*zi[^_]*)_/;
const JSFFI = /ZC0ZC(.+?)ZC/;
const LOCAL = /^(_blk_|[a-z][A-Za-z0-9]*_(entry|info)$)/;

const packageOf = (name) => {
  if (!name) return null;
  if (LOCAL.test(name)) return null;
  const hs = HASKELL.exec(name);
  if (hs) return clean(decodeZ(hs[1]));
  const js = JSFFI.exec(name);
  if (js) return clean(decodeZ(js[1]));
  return "(rts/C)";
};

const byPackage = new Map();
let total = 0;
let carried = 0;
let unattributed = 0;
let current = null;
for (let i = 0; i < bodySizes.length; i++) {
  const size = bodySizes[i];
  total += size;
  const own = packageOf(names.get(importedFuncs + i));
  if (own !== null) {
    current = own;
  } else {
    carried += size;
  }
  const key = current ?? "(unattributed)";
  if (current === null) unattributed += size;
  byPackage.set(key, (byPackage.get(key) ?? 0) + size);
}

const rows = [...byPackage.entries()].sort((a, b) => b[1] - a[1]);
const mib = (n) => (n / 1024 / 1024).toFixed(2);
const pct = (n) => ((n / total) * 100).toFixed(1);

console.log(`# code size by package: ${file}`);
console.log(`# ${bodySizes.length} functions, ${total} bytes of function bodies total`);
console.log("");
console.log("| package | bytes | MiB | share |");
console.log("|---|---:|---:|---:|");
for (const [pkg, size] of rows.slice(0, top)) {
  console.log(`| ${pkg} | ${size} | ${mib(size)} | ${pct(size)}% |`);
}
const rest = rows.slice(top).reduce((a, [, size]) => a + size, 0);
if (rest > 0) console.log(`| (${rows.length - top} more) | ${rest} | ${mib(rest)} | ${pct(rest)}% |`);
