import { defineConfig } from "@playwright/test"

/**
 * The app is driven through `window.choai`, not through the screen.
 *
 * That is what the API is for: a test says what it wants done rather than where
 * to click, and there is nothing to wait for but `ready` and `idle`. Screens are
 * still worth a test where the screen is the subject.
 *
 * CHOAI_TEST turns the service worker off. It precaches the ~7 MB engine and
 * updates itself, which is right for someone keeping books on a phone and wrong
 * here, where it can reload the page from under a run.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  use: { baseURL: "http://localhost:8396" },
  webServer: {
    command: "CHOAI_TEST=1 bun run dev",
    url: "http://localhost:8396",
    reuseExistingServer: process.env.CI === undefined,
    timeout: 120_000,
  },
})
