import { createSignal, type Accessor } from 'solid-js'

/**
 * Which side of the handle the resized region sits on, i.e. the direction it
 * grows in. left = the handle is on its right edge, right = the handle is on its
 * left edge, top = the handle is along its bottom, bottom = along its top.
 */
export type ResizeSide = 'left' | 'right' | 'top' | 'bottom'

const isVertical = (side: ResizeSide): boolean => side === 'top' || side === 'bottom'

/** Dragging the handle away from the region makes it bigger. */
const growthFactor = (side: ResizeSide): number => (side === 'left' || side === 'top' ? 1 : -1)

/**
 * Hold a size in pixels and resize it within min..max as a pointer drags the
 * handle. Width for the horizontal sides, height for the vertical ones. Depends
 * on nothing but solid-js. Listeners are attached to the window only while
 * dragging, and removed on release.
 */
export function createResizable(opts: {
  initial: number
  min: number
  max: number
  side: ResizeSide
}): { size: Accessor<number>; dragging: Accessor<boolean>; onHandlePointerDown: (e: PointerEvent) => void } {
  const [size, setSize] = createSignal(opts.initial)
  const [dragging, setDragging] = createSignal(false)
  const vertical = isVertical(opts.side)
  const factor = growthFactor(opts.side)
  const positionOf = (e: PointerEvent): number => (vertical ? e.clientY : e.clientX)

  const onHandlePointerDown = (e: PointerEvent): void => {
    e.preventDefault()
    setDragging(true)
    const start = positionOf(e)
    const startSize = size()
    const onMove = (ev: PointerEvent): void => {
      const next = startSize + (positionOf(ev) - start) * factor
      setSize(Math.max(opts.min, Math.min(opts.max, next)))
    }
    const onUp = (): void => {
      setDragging(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = vertical ? 'row-resize' : 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return { size, dragging, onHandlePointerDown }
}
