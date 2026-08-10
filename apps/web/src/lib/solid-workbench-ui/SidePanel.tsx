import { Show, type JSX } from 'solid-js'
import { createResizable } from './resize'
import { Splitter } from './Splitter'

/**
 * The list panel beside the activity bar — VSCode's explorer. It owns its own
 * width and stretches by dragging the Splitter on its right edge, so it is
 * self-contained. Takes a header and children. With open=false it folds to zero
 * width; open by default.
 *
 * The width is deliberately not animated. Put something like a WebGL map beside
 * it and every width change triggers a resize that clears the drawing buffer,
 * which reads as flickering for the whole length of the animation.
 */
export function SidePanel(props: {
  header?: JSX.Element
  children?: JSX.Element
  initialWidth?: number
  minWidth?: number
  maxWidth?: number
  open?: boolean
}): JSX.Element {
  const { size: width, onHandlePointerDown } = createResizable({
    initial: props.initialWidth ?? 260,
    min: props.minWidth ?? 168,
    max: props.maxWidth ?? 520,
    side: 'left',
  })
  const isOpen = (): boolean => props.open ?? true
  return (
    <div
      class="flex shrink-0 overflow-hidden"
      style={{ width: isOpen() ? `${width() + 1}px` : '0px' }}
      aria-hidden={!isOpen()}
    >
      <div class="flex shrink-0" style={{ width: `${width() + 1}px` }}>
        <aside class="flex min-w-0 flex-1 flex-col bg-card">
          <Show when={props.header}>
            <div class="flex h-8 shrink-0 items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {props.header}
            </div>
          </Show>
          <div class="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">{props.children}</div>
        </aside>
        <Splitter onPointerDown={onHandlePointerDown} />
      </div>
    </div>
  )
}
