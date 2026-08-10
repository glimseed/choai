import { Show, type JSX } from 'solid-js'

/**
 * A full-width top bar, strikingly short — VSCode's tab bar. Slots on the left
 * and right; the middle takes children, typically tabs, laid out with horizontal
 * scroll. Knows nothing about any domain.
 */
export function TitlesBar(props: { left?: JSX.Element; right?: JSX.Element; children?: JSX.Element }): JSX.Element {
  return (
    <div class="flex h-8 shrink-0 items-center gap-1 border-b border-border bg-card px-1.5 text-[13px]">
      <Show when={props.left}>
        <div class="flex shrink-0 items-center gap-1">{props.left}</div>
      </Show>
      <div class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">{props.children}</div>
      <Show when={props.right}>
        <div class="flex shrink-0 items-center gap-0.5">{props.right}</div>
      </Show>
    </div>
  )
}

/** The wheel (middle) button. Its default behaviour, autoscroll, has to be
 * suppressed at the moment it goes down. */
const MIDDLE_BUTTON = 1

/**
 * One tab in the top bar. Pass `onClose` and a ✕ appears, and **a middle click
 * closes it too** — that is what is expected of an editor tab, so this container
 * owns the ways of closing. Reordering is not here: what gets reordered, and
 * how, is the business of whoever knows what the tabs contain.
 */
export function Tab(props: { active?: boolean; onSelect?: () => void; onClose?: () => void; children: JSX.Element }): JSX.Element {
  const close = (e: Event): void => {
    e.stopPropagation()
    e.preventDefault()
    props.onClose?.()
  }
  return (
    <button
      type="button"
      onClick={() => props.onSelect?.()}
      // Suppress the middle button's default on pointerdown, then close on
      // auxclick — pressing alone should not close anything.
      onPointerDown={(e: PointerEvent) => e.button === MIDDLE_BUTTON && e.preventDefault()}
      onAuxClick={(e: MouseEvent) => e.button === MIDDLE_BUTTON && props.onClose && close(e)}
      class="inline-flex h-6 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      classList={{ 'bg-accent text-foreground': props.active }}
    >
      {props.children}
      <Show when={props.onClose}>
        <span
          role="button"
          tabindex={-1}
          aria-label="Close"
          title="Close"
          onClick={close}
          class="-mr-1 rounded px-1 leading-none hover:bg-accent hover:text-accent-foreground"
        >
          ✕
        </span>
      </Show>
    </button>
  )
}
