// Copy the built hledger engine into the app.
//
//   node scripts/sync-engine.mjs
//
// The wasm module and its generated JSFFI glue are build outputs of ../../wasm,
// not source, so they are not checked in. The wasm goes to public/ to be served
// as a plain asset (and precached by workbox); the glue is a JS module and goes
// into src/ to be bundled.

import { copyFile, mkdir } from "node:fs/promises";

const WASM_OUT = "../../wasm/out";
const copies = [
  [`${WASM_OUT}/engine-D.wasm`, "public/engine.wasm"],
  [`${WASM_OUT}/engine.jsffi.mjs`, "src/engine/ghc-jsffi.mjs"],
];

await mkdir("src/engine", { recursive: true });
for (const [from, to] of copies) {
  try {
    await copyFile(from, to);
    console.log(`${from} -> ${to}`);
  } catch (e) {
    console.error(`missing ${from}; run ../../wasm/scripts/build.sh engine first`);
    process.exitCode = 1;
  }
}
