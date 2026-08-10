import { defineConfig } from "vite"
import { fileURLToPath } from "node:url"
import solid from "vite-plugin-solid"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    solid(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "ownhledger",
        short_name: "ownhledger",
        description: "Your hledger journal, in the browser",
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
        display: "standalone",
        start_url: "/",
      },
      workbox: {
        // The hledger engine is a single ~7 MB asset. Workbox silently skips
        // anything over 2 MiB by default, which would leave the app broken
        // offline with no error to explain why.
        maximumFileSizeToCacheInBytes: 24 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,wasm}"],
      },
    }),
  ],
  worker: {
    format: "es",
  },
})
