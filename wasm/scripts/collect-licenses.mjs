// Collect the licence of every Haskell package that goes into the engine, and
// write it where the web app can display it.
//
// The engine is hledger compiled to WebAssembly, so what ships in the browser
// carries hledger's licence and that of every library linked into it. Nothing
// here is written by hand: the package list is cabal's own build plan, and each
// licence is read from the package itself.
//
// Three kinds of package appear in that plan:
//
//   - local     -- this repository and the vendored hledger source; the .cabal
//                  file sits on disk beside it
//   - hackage   -- downloaded as a tarball, which holds both the .cabal file
//                  and the licence text
//   - boot      -- shipped inside the wasm compiler; the installed package
//                  database records the licence and copyright
//
// It needs the toolchain and a completed build, so it is run when the engine is
// rebuilt rather than on every web build. Its output is committed.
//
//   node scripts/collect-licenses.mjs

import { execFileSync } from "node:child_process"
import { gunzipSync } from "node:zlib"
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const wasmRoot = resolve(here, "..")
const repoRoot = resolve(wasmRoot, "..")

const toolchain = process.env.GHC_WASM_HOME ?? join(process.env.HOME ?? "", ".ghc-wasm")
const planPath = join(wasmRoot, "dist-newstyle/cache/plan.json")
const hackageDir = join(toolchain, ".cabal/packages/hackage.haskell.org")
const packageDb = join(toolchain, "wasm32-wasi-ghc/lib/package.conf.d")
const outPath = join(repoRoot, "apps/web/src/licenses/engine.json")

const need = (path, what) => {
  if (!existsSync(path)) {
    console.error(`${what} not found at ${path}.`)
    console.error("Build the engine first (scripts/build.sh), or set GHC_WASM_HOME.")
    process.exit(1)
  }
  return path
}

/** A cabal field, which may be continued on following indented lines. */
const cabalField = (text, name) => {
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((line) => line.toLowerCase().startsWith(`${name}:`))
  if (start === -1) return undefined
  const first = lines[start].slice(name.length + 1).trim()
  const rest = []
  for (const line of lines.slice(start + 1)) {
    if (!/^\s/.test(line) || line.trim() === "") break
    rest.push(line.trim())
  }
  const value = [first, ...rest].filter((part) => part !== "").join(" ")
  return value === "" ? undefined : value
}

/**
 * The entries of a tar archive, as name and bytes.
 *
 * Hackage tarballs are plain ustar with short paths, so the header's name field
 * is enough and the prefix field can be ignored.
 */
function* tarEntries(buffer) {
  const BLOCK = 512
  for (let at = 0; at + BLOCK <= buffer.length; ) {
    const name = buffer.toString("utf8", at, at + 100).replace(/\0.*$/, "")
    if (name === "") return
    const size = parseInt(buffer.toString("ascii", at + 124, at + 136).replace(/\0.*$/, "").trim(), 8) || 0
    const body = buffer.subarray(at + BLOCK, at + BLOCK + size)
    yield { name, body }
    at += BLOCK + Math.ceil(size / BLOCK) * BLOCK
  }
}

/** The licence text a package ships, if it ships one. */
const licenceTextIn = (files) => {
  const named = Object.keys(files).find((name) => /^(LICEN[CS]E|COPYING)(\.|$)/i.test(basename(name)))
  return named === undefined ? undefined : files[named].toString("utf8").trim()
}

const fromHackage = (name, version) => {
  const tarball = join(hackageDir, name, version, `${name}-${version}.tar.gz`)
  if (!existsSync(tarball)) return undefined
  const files = {}
  for (const entry of tarEntries(gunzipSync(readFileSync(tarball)))) {
    const inside = entry.name.replace(/^[^/]+\//, "")
    if (inside.includes("/")) continue
    files[inside] = entry.body
  }
  const cabal = files[`${name}.cabal`]?.toString("utf8") ?? ""
  return {
    license: cabalField(cabal, "license"),
    copyright: cabalField(cabal, "copyright") ?? cabalField(cabal, "author"),
    homepage: cabalField(cabal, "homepage") ?? `https://hackage.haskell.org/package/${name}-${version}`,
    text: licenceTextIn(files),
  }
}

const fromLocalSource = (path) => {
  const dir = resolve(wasmRoot, path)
  if (!existsSync(dir)) return undefined
  const cabalName = readdirSync(dir).find((file) => file.endsWith(".cabal"))
  const cabal = cabalName === undefined ? "" : readFileSync(join(dir, cabalName), "utf8")
  // A repository tends to keep one licence file above its packages — hledger
  // does, and so does this one — so the way out is worth walking before giving
  // up on the package's own directory.
  const licenceFile = [dir, dirname(dir), repoRoot]
    .flatMap((where) => readdirSync(where).map((file) => join(where, file)))
    .find((file) => /^(LICEN[CS]E|COPYING)(\.|$)/i.test(basename(file)))
  return {
    license: cabalField(cabal, "license"),
    copyright: cabalField(cabal, "copyright") ?? cabalField(cabal, "author"),
    homepage: cabalField(cabal, "homepage"),
    text: licenceFile === undefined ? undefined : readFileSync(licenceFile, "utf8").trim(),
  }
}

/** Boot libraries are already installed, and the database holds their fields. */
const fromPackageDb = (id) => {
  const conf = join(packageDb, `${id}.conf`)
  if (!existsSync(conf)) return undefined
  const text = readFileSync(conf, "utf8")
  return {
    license: cabalField(text, "license"),
    copyright: cabalField(text, "copyright") ?? cabalField(text, "author"),
    homepage: cabalField(text, "homepage"),
    text: undefined,
  }
}

need(planPath, "cabal's build plan")
need(packageDb, "the wasm compiler's package database")

const plan = JSON.parse(readFileSync(planPath, "utf8"))

/**
 * Only what is linked into the engine.
 *
 * The build plan covers every component of every package in the project — test
 * suites, benchmarks, the earlier probes — and their dependencies are not in
 * the module that ships. Walking the executable's own dependencies gives the
 * packages that are actually in it, and nothing else.
 */
const linkedInto = (component) => {
  const byId = new Map(plan["install-plan"].map((unit) => [unit.id, unit]))
  const roots = plan["install-plan"].filter((unit) => unit["component-name"] === component)
  if (roots.length === 0) {
    console.error(`${component} is not in the build plan; build the engine first.`)
    process.exit(1)
  }
  const reached = new Set()
  const visit = (unit) => {
    if (unit === undefined || reached.has(unit.id)) return
    reached.add(unit.id)
    for (const id of unit.depends ?? []) visit(byId.get(id))
  }
  roots.forEach(visit)
  return [...reached].map((id) => byId.get(id))
}

const found = new Map()
for (const unit of linkedInto("exe:hledger-bindings")) {
  const key = `${unit["pkg-name"]}-${unit["pkg-version"]}`
  if (found.has(key)) continue
  const source = unit["pkg-src"]?.type
  const details =
    unit.type === "pre-existing"
      ? fromPackageDb(unit.id)
      : source === "local"
        ? fromLocalSource(unit["pkg-src"].path)
        : fromHackage(unit["pkg-name"], unit["pkg-version"])
  if (details === undefined) {
    console.warn(`no licence found for ${key} (${unit.type}/${source ?? "installed"})`)
    continue
  }
  found.set(key, {
    name: unit["pkg-name"],
    version: unit["pkg-version"],
    origin: unit.type === "pre-existing" ? "ghc" : source === "local" ? "local" : "hackage",
    ...details,
  })
}

/** The commit the vendored hledger source is at, when it is a checkout. */
const hledgerRevision = () => {
  const vendor = join(wasmRoot, "vendor/hledger")
  if (!existsSync(join(vendor, ".git"))) return undefined
  try {
    return execFileSync("git", ["-C", vendor, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim()
  } catch {
    return undefined
  }
}

// hledger first, with the rest of what is built from this repository, since
// that is what someone reading this page has come to find. The libraries behind
// it follow in a list that is only useful in alphabetical order.
const rank = (entry) => (entry.origin === "local" ? 0 : 1)
const packages = [...found.values()].sort(
  (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name),
)
const output = {
  collected: new Date().toISOString().slice(0, 10),
  hledgerRevision: hledgerRevision(),
  packages,
}

writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`)
const withText = packages.filter((entry) => entry.text !== undefined).length
console.log(`${packages.length} packages -> ${outPath} (${withText} with licence text)`)
