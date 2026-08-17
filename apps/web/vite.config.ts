import { defineConfig } from "vite"
import { fileURLToPath } from "node:url"
import solid from "vite-plugin-solid"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  server: {
    // Fixed rather than auto-assigned, so the address stays the same between
    // restarts. 8-3-9-6 is a Japanese number mnemonic: the digits are read
    // ha-soo-koo-roo, which is Haskell -- what does the work behind this app.
    port: 8396,
    strictPort: true,
  },
  preview: {
    port: 8396,
    strictPort: true,
  },
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    solid(),
    tailwindcss(),
    VitePWA({
      // A service worker that precaches ~7 MB is the right thing for someone
      // keeping books on a phone, and the wrong thing under a test, where it can
      // reload the page from under a run in progress.
      disable: process.env.CHOAI_TEST === "1",
      // What arrives waits rather than taking over: a reload takes a half-typed
      // entry, a conversation and every undecided proposal with it, and none of
      // those is written down anywhere else. The browser hands over when the
      // last window closes, so shutting the app and opening it again is an
      // update — and `lib/renewal.ts` is the other way, for asking outright.
      registerType: "prompt",
      // Registered there too, since that is where the asking happens.
      injectRegister: null,
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "choai",
        short_name: "choai",
        description: "Your hledger journal, in the browser",
        // From the icon: its navy for the browser's own furniture, and the
        // colour the app actually paints for the screen shown while it starts,
        // so opening it does not flash from black to white.
        theme_color: "#000031",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          // Android crops an icon to whatever shape it likes, so this one is
          // drawn small on a filled square and says it can take it.
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // The hledger engine is a single ~7 MB asset. Workbox silently skips
        // anything over 2 MiB by default, which would leave the app broken
        // offline with no error to explain why.
        maximumFileSizeToCacheInBytes: 24 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,png,wasm}"],
      },
    }),
  ],
  worker: {
    format: "es",
  },
})
