// @ts-check
import { defineConfig } from "astro/config"

/**
 * The landing page, served under /lp of the same site as the app.
 *
 * Static and on its own: it says what the app is to somebody who has not opened
 * it, which is a different job from the app's own screens and does not need any
 * of the app's code. Sharing a site is what lets it link straight to `/` and to
 * the licence page.
 */
export default defineConfig({
  // ASTRO with the digits that look like its letters: 4-5-7-2-0. Ports stop at
  // 65535, so five of them starting with a 4 is as much room as there is. The
  // app next door plays the same game in Japanese with 8396, for Haskell.
  server: { port: 45720, host: false },
  base: "/lp",
  trailingSlash: "always",
  build: { format: "directory" },
})
