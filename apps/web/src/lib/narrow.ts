import { createRoot, createSignal, type Accessor } from "solid-js"

/** Below this, there is not room for the rails and the work at the same time. */
const NARROW = "(max-width: 900px)"

/**
 * Whether the window is too narrow to keep everything on screen at once.
 *
 * A signal rather than a check, so a window being resized is noticed. Made
 * inside a root because it outlives any one screen and its listener has to
 * belong to something.
 */
export const narrow: Accessor<boolean> = createRoot(() => {
  const query = window.matchMedia(NARROW)
  const [is, set] = createSignal(query.matches)
  query.addEventListener("change", (event) => set(event.matches))
  return is
})
