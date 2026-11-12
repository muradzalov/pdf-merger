import { getStroke } from 'perfect-freehand'
import type { InkShape } from './types'

/*
 * Pen strokes, shared by the draw tool and the signature pad.
 *
 * perfect-freehand turns the points of a stroke into the OUTLINE of a smooth, variable-width line
 * (wider where the stylus pressed harder). We fill that outline as an SVG path, which looks the
 * same on screen and in the saved PDF (pdf-lib's drawSvgPath).
 */

export interface PenPoint {
  x: number
  y: number
  /** 0–1, from PointerEvent.pressure. */
  pressure: number
}

export interface PenStroke {
  points: PenPoint[]
  /**
   * Only pens/styluses report real pressure. For a mouse or finger, perfect-freehand fakes it from
   * the drawing speed instead. Use: `pointerType !== 'pen'`.
   */
  simulatePressure: boolean
}

/** The outline polygon of one stroke. `size` is the pen width, in the same units as the points. */
export function strokeOutline(stroke: PenStroke, size: number, complete = true): [number, number][] {
  return getStroke(
    stroke.points.map((p) => [p.x, p.y, p.pressure]),
    {
      size,
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: stroke.simulatePressure,
      // false while the stroke is still being drawn (live preview), true once the pen lifts.
      last: complete,
    },
  ) as [number, number][]
}

const round = (n: number) => Math.round(n * 100) / 100

/**
 * A closed SVG path through an outline polygon, smoothed with quadratic curves through the
 * midpoints. Uses only absolute M, Q and Z commands, which pdf-lib's drawSvgPath understands.
 */
export function outlineToPath(outline: [number, number][]): string {
  if (outline.length < 2) return ''
  const mid = (i: number) => {
    const [x0, y0] = outline[i % outline.length]
    const [x1, y1] = outline[(i + 1) % outline.length]
    return [round((x0 + x1) / 2), round((y0 + y1) / 2)]
  }
  const [startX, startY] = mid(0)
  const commands = [`M ${startX} ${startY}`]
  for (let i = 1; i <= outline.length; i++) {
    const [cx, cy] = outline[i % outline.length]
    const [x, y] = mid(i)
    commands.push(`Q ${round(cx)} ${round(cy)} ${x} ${y}`)
  }
  commands.push('Z')
  return commands.join(' ')
}

/**
 * Turns strokes into one InkShape whose viewBox tightly fits them, plus where that box's top-left
 * corner was in the strokes' coordinates. Returns null if there's nothing to draw.
 */
export function strokesToInk(strokes: PenStroke[], size: number): { x: number; y: number; shape: InkShape } | null {
  const outlines = strokes.map((stroke) => strokeOutline(stroke, size)).filter((o) => o.length >= 2)
  if (outlines.length === 0) return null

  const xs = outlines.flat().map(([x]) => x)
  const ys = outlines.flat().map(([, y]) => y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const path = outlines
    .map((outline) => outlineToPath(outline.map(([x, y]) => [x - minX, y - minY])))
    .join(' ')
  return {
    x: minX,
    y: minY,
    shape: {
      path,
      viewBoxWidth: Math.max(round(Math.max(...xs) - minX), 1),
      viewBoxHeight: Math.max(round(Math.max(...ys) - minY), 1),
    },
  }
}
