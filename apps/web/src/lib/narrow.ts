import { createRoot, createSignal, type Accessor } from "solid-js"

/** Below this, there is not room for the rails and the work at the same time. */
const NARROW = 900

/**
 * How wide the window is, and whether that is too narrow to keep everything on
 * screen at once.
 *
 * Signals rather than checks, so a window being resized is noticed. Made inside
 * a root because they outlive any one screen and their listener has to belong to
 * something.
 */
const viewport = createRoot(() => {
  const [width, setWidth] = createSignal(window.innerWidth)
  window.addEventListener("resize", () => setWidth(window.innerWidth))
  return width
})

export const viewportWidth: Accessor<number> = viewport

export const narrow = (): boolean => viewportWidth() <= NARROW
