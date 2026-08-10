// Browser side of the probe. Deliberately mirrors scripts/bench.mjs so that a
// mismatch between the two would show up as differing output rather than being
// hidden behind two different loaders.

import {
  WASI,
  File,
  OpenFile,
  PreopenDirectory,
  ConsoleStdout,
} from "./node_modules/@bjorn3/browser_wasi_shim/dist/index.js";
import ghcJsffi from "./probe.jsffi.mjs";

const logEl = document.getElementById("log");
let buffer = "";
const log = (line, cls) => {
  buffer += line + "\n";
  logEl.textContent = buffer;
  if (cls) console.log(`[${cls}] ${line}`);
  else console.log(line);
};

try {
  const journal = await (await fetch("./sample.journal")).text();

  const t0 = performance.now();
  const module = await WebAssembly.compileStreaming(fetch("./probe.wasm"));
  log(`compile:     ${(performance.now() - t0).toFixed(1)} ms`);

  const t1 = performance.now();
  const wasi = new WASI(
    [],
    [],
    [
      new OpenFile(new File([])),
      ConsoleStdout.lineBuffered((l) => console.log(`[wasm stdout] ${l}`)),
      ConsoleStdout.lineBuffered((l) => console.log(`[wasm stderr] ${l}`)),
      new PreopenDirectory(
        "/",
        new Map([["journal", new File(new TextEncoder().encode(journal))]]),
      ),
    ],
  );
  const exportsRef = {};
  const instance = await WebAssembly.instantiate(module, {
    wasi_snapshot_preview1: wasi.wasiImport,
    ghc_wasm_jsffi: ghcJsffi(exportsRef),
  });
  Object.assign(exportsRef, instance.exports);
  wasi.initialize(instance);
  if (typeof instance.exports.hs_init === "function") instance.exports.hs_init(0, 0);
  log(`instantiate: ${(performance.now() - t1).toFixed(1)} ms`);

  const t2 = performance.now();
  const out = await instance.exports.hledgerBalanceFromFile("/journal");
  log(`balance:     ${(performance.now() - t2).toFixed(1)} ms`);
  log("");
  log("--- balance report ---");
  log(out);

  // The CLI probe under wasmtime is the reference. Publishing the result on the
  // window lets the driving script compare the two without scraping the DOM.
  window.__probeResult = { ok: true, output: out };
  log(out.includes("error:") || out.includes("exception:") ? "FAILED" : "OK", "result");
} catch (e) {
  window.__probeResult = { ok: false, error: String(e) };
  log(`FAILED: ${e}\n${e.stack ?? ""}`, "result");
}
