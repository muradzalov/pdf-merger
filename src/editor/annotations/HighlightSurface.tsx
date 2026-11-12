import { useRef, useState, type PointerEvent } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { addAnnotationAtom, highlightColorAtom, newAnnotationId, selectedAnnotationIdAtom, zoomAtom } from '../state'
import type { EditorPage } from '../types'
import { boxBetween, clamp, pagePoint, type Box, type Point } from './geometry'
import { MIN_HIGHLIGHT_SIZE, highlightStyle } from './HighlightBox'

/** The highlight tool, covering the page: drag a rectangle to highlight it. */
export function HighlightSurface({ pageIndex, page }: { pageIndex: number; page: EditorPage }) {
  const zoom = useAtomValue(zoomAtom)
  const color = useAtomValue(highlightColorAtom)
  const addAnnotation = useSetAtom(addAnnotationAtom)
  const setSelectedId = useSetAtom(selectedAnnotationIdAtom)
  // Where the drag started, in a ref so the handlers see it before React re-renders.
  const drag = useRef<{ pointerId: number; start: Point } | null>(null)
  const [preview, setPreview] = useState<Box | null>(null)

  const pointOnPage = (e: PointerEvent<HTMLDivElement>): Point => {
    const { x, y } = pagePoint(e, e.currentTarget, zoom)
    return { x: clamp(x, 0, page.width), y: clamp(y, 0, page.height) }
  }

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current || e.button !== 0) return
    // No text selection or focus change from the mouse events that would follow.
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const start = pointOnPage(e)
    drag.current = { pointerId: e.pointerId, start }
    setPreview(boxBetween(start, start))
  }

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== e.pointerId) return
    setPreview(boxBetween(drag.current.start, pointOnPage(e)))
  }

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (current?.pointerId !== e.pointerId) return
    drag.current = null
    setPreview(null)
    const box = boxBetween(current.start, pointOnPage(e))
    // A click or a tiny drag is most likely a mistake.
    if (box.width < MIN_HIGHLIGHT_SIZE || box.height < MIN_HIGHLIGHT_SIZE) return
    addAnnotation({ id: newAnnotationId(), type: 'highlight', pageIndex, color, ...box })
    // Adding selects the highlight; keep highlighting with nothing selected instead.
    setSelectedId(null)
  }

  const handlePointerCancel = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== e.pointerId) return
    drag.current = null
    setPreview(null)
  }

  return (
    <div
      // touch-action: none, so dragging a finger highlights instead of scrolling the page.
      style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: 'crosshair' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {preview && (
        <div
          style={{
            ...highlightStyle(color),
            position: 'absolute',
            left: preview.x * zoom,
            top: preview.y * zoom,
            width: preview.width * zoom,
            height: preview.height * zoom,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
