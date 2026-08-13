// @ts-check
import { defineConfig } from "astro/config"

/**
 * The site that explains the app, served on its own name.
 *
 * Separate from the app rather than a corner of it: it speaks to somebody who
 * has not opened the app, and it is plain static files that need none of the
 * app's code. Where the app itself lives is a build-time setting, so that
 * running this locally links to a local app rather than to the published one.
 */
export default defineConfig({
  site: "https://docs.hledger-pwa.app",
  // Both /ja and /ja/ answer. The pages are written to directories, so a host
  // serves either spelling, and refusing one of them locally only means a link
  // typed by hand fails on a laptop and works once published.
  trailingSlash: "ignore",
  build: { format: "directory" },
  // ASTRO in the digits its letters look like. Ports stop at 65535, so five of
  // them starting with a 4 is as much room as there is. The app next door plays
  // the same game in Japanese with 8396, for Haskell.
  server: { port: 45720, host: false },
})
