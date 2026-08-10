import type { JSX } from 'solid-js'
import xSvg from './x.svg?raw'
import plusSvg from './plus.svg?raw'

/**
 * Icons. The SVG bodies live beside this file as .svg files, drawn with
 * `currentColor` and sized `width/height=100%` so they inherit colour and fit
 * whatever box they are given. This module only pours them into a span and
 * makes them Solid components; size (h-4 w-4) and colour (text-*) are passed as
 * classes by the caller.
 */
export type IconProps = { class?: string }

const icon =
  (svg: string) =>
  (props: IconProps): JSX.Element =>
    (<span class={`inline-flex shrink-0 ${props.class ?? ''}`} aria-hidden="true" innerHTML={svg} />)

/** Dismiss or close. */
export const XIcon = icon(xSvg)
/** Add something new. */
export const PlusIcon = icon(plusSvg)
