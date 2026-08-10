// Separate the two costs the UI cares about.
//
//   node bench-bindings.mjs <hledger.wasm> <hledger.jsffi.mjs> <journal> [runs]
//
// The probe binaries re-read and re-parse the journal on every call, which
// conflates parsing with reporting. The bindings keep the parsed journal, so
// this measures them apart: how long loading costs once, and how long each
// report costs afterwards. That split decides whether the UI feels heavy only
// while opening a file, or on every navigation.

import { readFileSync } from "node:fs";
import {
  WASI,
  File,
  OpenFile,
  PreopenDirectory,
  ConsoleStdout,
} from "../web/node_modules/@bjorn3/browser_wasi_shim/dist/index.js";

const [, , wasmPath, jsffiPath, journalPath, runsArg] = process.argv;
if (!wasmPath || !jsffiPath || !journalPath) {
  console.error("usage: bench-bindings.mjs <hledger.wasm> <hledger.jsffi.mjs> <journal> [runs]");
  process.exit(1);
}
const runs = Number(runsArg ?? 7);
const journal = readFileSync(journalPath);
const ghcJsffi = (await import(new URL(jsffiPath, `file://${process.cwd()}/`).href)).default;

const module = await WebAssembly.compile(readFileSync(wasmPath));

const instantiate = async () => {
  const wasi = new WASI(
    [],
    [],
    [
      new OpenFile(new File([])),
      ConsoleStdout.lineBuffered((l) => console.log(`[stdout] ${l}`)),
      ConsoleStdout.lineBuffered((l) => console.log(`[stderr] ${l}`)),
      new PreopenDirectory("/", new Map([["journal", new File(journal)]])),
    ],
  );
  const exportsRef = {};
  const instance = await WebAssembly.instantiate(module, {
    wasi_snapshot_preview1: wasi.wasiImport,
    ghc_wasm_jsffi: ghcJsffi(exportsRef),
  });
  Object.assign(exportsRef, instance.exports);
  wasi.initialize(instance);
  if (typeof instance.exports.hs_init !== "function") {
    throw new Error("module does not export hs_init; relink with -optl-Wl,--export=hs_init");
  }
  instance.exports.hs_init(0, 0);
  return instance;
};

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const time = async (fn) => {
  const start = performance.now();
  const out = await fn();
  return [performance.now() - start, out];
};
const unwrap = (raw, label) => {
  const parsed = JSON.parse(raw);
  if (!parsed.ok) throw new Error(`${label} failed: ${parsed.error}`);
  return parsed.data;
};

// Loading is measured on a fresh instance each time: reloading into a warm one
// would measure something the user never experiences.
const loadTimes = [];
let instance;
for (let i = 0; i < runs; i++) {
  instance = await instantiate();
  const [ms, raw] = await time(() => instance.exports.hledgerLoad("/journal"));
  const info = unwrap(raw, "load");
  loadTimes.push(ms);
  if (i === 0) console.log(`loaded ${info.transactions} transactions, ${info.accounts.length} accounts\n`);
}

console.log(`load (parse):            median ${median(loadTimes).toFixed(1)} ms   <- paid once per journal`);
console.log("");

for (const request of [
  // What the UI actually asks for: one screenful.
  { kind: "entries", limit: 50 },
  { kind: "entries", limit: 200 },
  { kind: "register", query: "acct:expenses", limit: 50 },
  // The same reports unwindowed, to show what paging is buying.
  { kind: "entries" },
  { kind: "register", query: "acct:expenses" },
  // Aggregate reports return one row per account, so they need no paging.
  { kind: "balancesheet" },
  { kind: "incomestatement" },
  { kind: "balance" },
  { kind: "accounts" },
]) {
  const body = JSON.stringify(request);
  const samples = [];
  let size = 0;
  for (let i = 0; i < runs; i++) {
    const [ms, raw] = await time(() => instance.exports.hledgerQuery(body));
    unwrap(raw, request.kind);
    samples.push(ms);
    size = raw.length;
  }
  const label =
    request.kind +
    (request.query ? ` ${request.query}` : "") +
    (request.limit ? ` limit=${request.limit}` : " (all)");
  console.log(
    `query ${label.padEnd(28)} median ${median(samples).toFixed(1).padStart(7)} ms   ${(size / 1024).toFixed(0)} KB json`,
  );
}
