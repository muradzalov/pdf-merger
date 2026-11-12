import { useMemo } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { DrawSurface } from './annotations/DrawSurface'
import { clamp, pagePoint, type Point } from './annotations/geometry'
import { HighlightBox } from './annotations/HighlightBox'
import { HighlightSurface } from './annotations/HighlightSurface'
import { InkObject } from './annotations/InkObject'
import { SignatureSurface } from './annotations/SignatureSurface'
import { TextBox } from './annotations/TextBox'
import { startEditingAtom } from './annotations/textEditing'
import {
  addAnnotationAtom,
  annotationsAtom,
  editorDocumentAtom,
  fontSizeAtom,
  newAnnotationId,
  pendingSignatureAtom,
  penColorAtom,
  selectedAnnotationIdAtom,
  toolAtom,
  zoomAtom,
} from './state'
import { LINE_HEIGHT } from './textMetrics'

/**
 * Overlay for one page: shows that page's annotations and turns pointer input into new ones.
 * Rendered by PdfPage inside the page's `position: relative` box, sized page.width × page.height
 * times the zoom, after (on top of) the page canvas. Fills its parent (position absolute, inset 0).
 *
 * The select and text tools work on the layer and the annotations themselves. The draw, highlight
 * and signature tools put a surface over everything, which keeps their in-progress state (redrawn on
 * every pointer move) to this one page.
 */
export function AnnotationLayer({ pageIndex }: { pageIndex: number }) {
  const page = useAtomValue(editorDocumentAtom)?.pages[pageIndex]
  const allAnnotations = useAtomValue(annotationsAtom)
  const tool = useAtomValue(toolAtom)
  const zoom = useAtomValue(zoomAtom)
  const fontSize = useAtomValue(fontSizeAtom)
  const penColor = useAtomValue(penColorAtom)
  const pendingSignature = useAtomValue(pendingSignatureAtom)
  const setSelectedId = useSetAtom(selectedAnnotationIdAtom)
  const addAnnotation = useSetAtom(addAnnotationAtom)
  const startEditing = useSetAtom(startEditingAtom)

  const annotations = useMemo(() => {
    const onPage = allAnnotations.filter((a) => a.pageIndex === pageIndex)
    // Highlights under everything else (see types.ts).
    return [...onPage.filter((a) => a.type === 'highlight'), ...onPage.filter((a) => a.type !== 'highlight')]
  }, [allAnnotations, pageIndex])

  if (!page) return null

  const addTextBox = (point: Point) => {
    const id = newAnnotationId()
    const lineHeight = fontSize * LINE_HEIGHT
    addAnnotation({
      id,
      type: 'text',
      pageIndex,
      color: penColor,
      // The click becomes the start of the first line, vertically centered on it.
      x: clamp(point.x, 0, page.width - fontSize),
      y: clamp(point.y - lineHeight / 2, 0, page.height - lineHeight),
      text: '',
      fontSize,
    })
    startEditing({ id, isNew: true })
  }

  return (
    <div
      // No z-index, opacity, transform or isolation here: any of them would make this a stacking
      // context, and the highlights inside would then blend with nothing instead of the page canvas.
      style={{ position: 'absolute', inset: 0, cursor: tool === 'text' ? 'text' : undefined }}
      onPointerDown={(e) => {
        // A press on the page itself, not on an annotation.
        if (tool === 'select' && e.target === e.currentTarget) setSelectedId(null)
      }}
      onClick={(e) => {
        // On click rather than pointerdown: by now the press has moved focus away from the text box
        // being edited (ending it), and won't take it from the new box's textarea.
        if (tool === 'text' && e.target === e.currentTarget) addTextBox(pagePoint(e, e.currentTarget, zoom))
      }}
    >
      {annotations.map((a) =>
        a.type === 'text' ? (
          <TextBox key={a.id} annotation={a} />
        ) : a.type === 'ink' ? (
          <InkObject key={a.id} annotation={a} />
        ) : (
          <HighlightBox key={a.id} annotation={a} />
        ),
      )}
      {tool === 'draw' && <DrawSurface pageIndex={pageIndex} page={page} />}
      {tool === 'highlight' && <HighlightSurface pageIndex={pageIndex} page={page} />}
      {tool === 'signature' && pendingSignature && (
        <SignatureSurface pageIndex={pageIndex} page={page} signature={pendingSignature} />
      )}
    </div>
  )
}
