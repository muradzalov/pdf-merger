import { useRef, useState, type PointerEvent } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { outlineToPath, strokeOutline, strokesToInk, type PenPoint, type PenStroke } from '../ink'
import {
  addAnnotationAtom,
  newAnnotationId,
  penColorAtom,
  selectedAnnotationIdAtom,
  strokeWidthAtom,
  zoomAtom,
} from '../state'
import type { EditorPage } from '../types'
import { clamp, pagePoint } from './geometry'

/**
 * The draw tool, covering the page (and its annotations, so you can draw over them). Each stroke
 * becomes its own ink annotation.
 */
export function DrawSurface({ pageIndex, page }: { pageIndex: number; page: EditorPage }) {
  const zoom = useAtomValue(zoomAtom)
  const color = useAtomValue(penColorAtom)
  const strokeWidth = useAtomValue(strokeWidthAtom)
  const addAnnotation = useSetAtom(addAnnotationAtom)
  const setSelectedId = useSetAtom(selectedAnnotationIdAtom)
  // The stroke being drawn lives in a ref, so pointerup sees every point even if React hasn't
  // re-rendered since the last pointermove. The state copy is for the preview.
  const drawing = useRef<{ pointerId: number; stroke: PenStroke } | null>(null)
  const [preview, setPreview] = useState<PenStroke | null>(null)

  const penPoints = (e: PointerEvent<HTMLDivElement>): PenPoint[] => {
    // A pen reports more positions than pointermove fires for; using them all draws a smoother line.
    const coalesced = e.type === 'pointermove' ? (e.nativeEvent.getCoalescedEvents?.() ?? []) : []
    return (coalesced.length > 0 ? coalesced : [e.nativeEvent]).map((event) => {
      const { x, y } = pagePoint(event, e.currentTarget, zoom)
      return {
        x: clamp(x, 0, page.width),
        y: clamp(y, 0, page.height),
        pressure: event.pointerType === 'pen' ? event.pressure : 0.5,
      }
    })
  }

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // One stroke at a time (ignore a second finger), and only with the main button.
    if (drawing.current || e.button !== 0) return
    // No text selection or focus change from the mouse events that would follow.
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = {
      pointerId: e.pointerId,
      stroke: { points: penPoints(e), simulatePressure: e.pointerType !== 'pen' },
    }
    setPreview(drawing.current.stroke)
  }

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const current = drawing.current
    if (current?.pointerId !== e.pointerId) return
    current.stroke = { ...current.stroke, points: [...current.stroke.points, ...penPoints(e)] }
    setPreview(current.stroke)
  }

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const current = drawing.current
    if (current?.pointerId !== e.pointerId) return
    drawing.current = null
    setPreview(null)
    const ink = strokesToInk([current.stroke], strokeWidth)
    if (!ink) return
    addAnnotation({
      id: newAnnotationId(),
      type: 'ink',
      pageIndex,
      color,
      x: ink.x,
      y: ink.y,
      width: ink.shape.viewBoxWidth,
      height: ink.shape.viewBoxHeight,
      ...ink.shape,
    })
    // Adding selects the stroke; keep drawing with nothing selected instead.
    setSelectedId(null)
  }

  const handlePointerCancel = (e: PointerEvent<HTMLDivElement>) => {
    if (drawing.current?.pointerId !== e.pointerId) return
    drawing.current = null
    setPreview(null)
  }

  return (
    <div
      // touch-action: none, so a finger or stylus draws instead of scrolling the page.
      style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: 'crosshair' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {preview && (
        <svg
          viewBox={`0 0 ${page.width} ${page.height}`}
          preserveAspectRatio="none"
          width="100%"
          height="100%"
          style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
        >
          <path d={outlineToPath(strokeOutline(preview, strokeWidth, false))} fill={color} />
        </svg>
      )}
    </div>
  )
}
