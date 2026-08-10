// Drive the reactor probe the way a browser would, and time it.
//
//   node bench.mjs <probe-reactor.wasm> <probe.jsffi.mjs> <journal> [runs]
//
// Uses the same WASI shim the browser page uses rather than node:wasi, so the
// numbers here and the numbers in the browser describe the same code path.

import { readFileSync } from "node:fs";
import { WASI, File, OpenFile, PreopenDirectory, ConsoleStdout } from "@bjorn3/browser_wasi_shim";

const [, , wasmPath, jsffiPath, journalPath, runsArg] = process.argv;
if (!wasmPath || !jsffiPath || !journalPath) {
  console.error("usage: bench.mjs <probe-reactor.wasm> <probe.jsffi.mjs> <journal> [runs]");
  process.exit(1);
}
const runs = Number(runsArg ?? 7);
const journal = readFileSync(journalPath, "utf8");

const ghcJsffi = (await import(new URL(jsffiPath, `file://${process.cwd()}/`).href)).default;

// The journal is handed to hledger through an in-memory filesystem. That is the
// shape the PWA would use too: files come from GitHub, land in a virtual FS, and
// hledger reads them exactly as it reads files on disk.
const makeFds = () => [
  new OpenFile(new File([])),
  ConsoleStdout.lineBuffered((line) => console.log(`[wasm stdout] ${line}`)),
  ConsoleStdout.lineBuffered((line) => console.log(`[wasm stderr] ${line}`)),
  new PreopenDirectory("/", new Map([["journal", new File(new TextEncoder().encode(journal))]])),
];

const t0 = performance.now();
const bytes = readFileSync(wasmPath);
const module = await WebAssembly.compile(bytes);
const tCompile = performance.now() - t0;

const t1 = performance.now();
const wasi = new WASI([], [], makeFds());
const exportsRef = {};
const instance = await WebAssembly.instantiate(module, {
  wasi_snapshot_preview1: wasi.wasiImport,
  ghc_wasm_jsffi: ghcJsffi(exportsRef),
});
Object.assign(exportsRef, instance.exports);
wasi.initialize(instance);
if (typeof instance.exports.hs_init === "function") instance.exports.hs_init(0, 0);
const tInstantiate = performance.now() - t1;

const available = Object.keys(instance.exports).filter((k) => typeof instance.exports[k] === "function");
if (!instance.exports.hledgerBalanceFromFile) {
  console.error("expected export hledgerBalanceFromFile; module exports:", available.join(", "));
  process.exit(1);
}

const time = async (label, fn) => {
  const samples = [];
  let last;
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    last = await fn();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  console.log(`${label}: median ${median.toFixed(1)} ms over ${runs} runs ` +
    `(min ${samples[0].toFixed(1)}, max ${samples[samples.length - 1].toFixed(1)})`);
  return last;
};

console.log(`compile:     ${tCompile.toFixed(1)} ms`);
console.log(`instantiate: ${tInstantiate.toFixed(1)} ms`);

const fromFile = await time("balance (from file)", () => instance.exports.hledgerBalanceFromFile("/journal"));

let fromText = null;
if (instance.exports.hledgerBalanceFromText) {
  try {
    fromText = await time("balance (from text)", () => instance.exports.hledgerBalanceFromText(journal));
  } catch (e) {
    console.log(`balance (from text): threw -- ${e}`);
  }
}

console.log("\n--- output (from file) ---");
console.log(fromFile);
if (fromText !== null) {
  console.log("--- output (from text) ---");
  console.log(fromText);
  console.log(`from-file and from-text agree: ${fromFile === fromText}`);
}
