/** A position on a page, in page points (see types.ts). */
export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

/** A rectangle on a page, in page points. */
export type Box = Point & Size

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/** Where a pointer is on the page, in page points. `layer` is an element covering the page. */
export function pagePoint(e: { clientX: number; clientY: number }, layer: Element, zoom: number): Point {
  const rect = layer.getBoundingClientRect()
  return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom }
}

/** The rectangle with opposite corners a and b. */
export function boxBetween(a: Point, b: Point): Box {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  }
}
