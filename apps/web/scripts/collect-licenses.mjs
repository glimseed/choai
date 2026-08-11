// Collect what has to be credited, and write it where the app can show it.
//
// Two halves ship in the browser and both carry other people's terms:
//
//   - the engine -- hledger and the Haskell libraries linked into the wasm
//     module, collected by wasm/scripts/collect-licenses.mjs when the engine is
//     rebuilt, since that needs the Haskell toolchain
//   - the web app -- the npm packages that end up in the bundle, plus the
//     components copied in from solid-ui
//
// The npm half is read here, from the lockfile and from the packages
// themselves: what is credited is then what is installed, not what someone
// remembered to write down. Development tools are left out; they build the app
// but no part of them is served.
//
// Run by `npm run dev` and `npm run build`.
//
//   node scripts/collect-licenses.mjs

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, "..")
const outPath = join(webRoot, "src/generated/licenses.json")

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"))
const readJsonOr = (path, fallback) => (existsSync(path) ? readJson(path) : fallback)

/**
 * The licence a package ships, as text.
 *
 * A package offered under a choice of licences ships one file per licence —
 * LICENSE-MIT beside LICENSE-APACHE — and all of them are what it grants, so
 * all of them are shown.
 */
const licenceTextIn = (dir) => {
  const named = readdirSync(dir)
    .filter((file) => /^(LICEN[CS]E|COPYING)([-.]|$)/i.test(file))
    .sort()
  if (named.length === 0) return undefined
  return named
    .map((file) => `${named.length > 1 ? `${file}\n\n` : ""}${readFileSync(join(dir, file), "utf8").trim()}`)
    .join("\n\n")
}

/**
 * Who holds the copyright.
 *
 * npm has no field for it — the line lives in the licence text, which is where
 * the permissive licences require it to be reproduced from — so the text is
 * read first and the author is only a fallback.
 */
const copyrightIn = (text, author) => {
  // A year or a (c) tells a notice apart from prose about notices, which is
  // what Apache-2.0 opens with and what a plain search for the word finds.
  const line = text?.split(/\r?\n/).find((each) => /^\s*copyright\b.*(\(c\)|©|\d{4})/i.test(each))
  if (line !== undefined) return line.trim()
  if (typeof author === "string") return author
  return author?.name
}

const homepageOf = (manifest) => {
  if (typeof manifest.homepage === "string") return manifest.homepage
  const repository = typeof manifest.repository === "string" ? manifest.repository : manifest.repository?.url
  return repository?.replace(/^git\+/, "").replace(/\.git$/, "")
}

const lock = readJson(join(webRoot, "package-lock.json"))

const npmPackages = Object.entries(lock.packages)
  .filter(([path, entry]) => path.startsWith("node_modules/") && !entry.dev && !entry.devOptional)
  .map(([path, entry]) => {
    const dir = join(webRoot, path)
    const manifest = readJsonOr(join(dir, "package.json"), {})
    const text = existsSync(dir) ? licenceTextIn(dir) : undefined
    return {
      name: manifest.name ?? path.replace(/^node_modules\//, ""),
      version: entry.version,
      origin: "npm",
      license: entry.license ?? manifest.license,
      copyright: copyrightIn(text, manifest.author),
      homepage: homepageOf(manifest),
      text,
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

const engine = readJsonOr(join(webRoot, "src/licenses/engine.json"), { packages: [] })
const vendored = readJsonOr(join(webRoot, "src/licenses/vendored.json"), []).map((entry) => ({
  ...entry,
  copyright: entry.copyright ?? copyrightIn(entry.text, undefined),
}))

const output = {
  collected: new Date().toISOString().slice(0, 10),
  hledgerRevision: engine.hledgerRevision,
  groups: [
    { id: "engine", packages: engine.packages },
    { id: "web", packages: [...vendored, ...npmPackages] },
  ],
}

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(output)}\n`)
const total = output.groups.reduce((count, group) => count + group.packages.length, 0)
console.log(`${total} packages -> ${outPath}`)
