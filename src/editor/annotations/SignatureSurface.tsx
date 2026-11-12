import { useState, type MouseEvent } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { DEFAULT_SIGNATURE_WIDTH } from '../constants'
import { addAnnotationAtom, newAnnotationId, pendingSignatureAtom, penColorAtom, toolAtom, zoomAtom } from '../state'
import type { EditorPage, InkShape } from '../types'
import { clamp, pagePoint, type Box, type Point } from './geometry'
import { InkSvg } from './InkObject'

/**
 * Where a signature placed at `center` goes: DEFAULT_SIGNATURE_WIDTH wide (smaller if the page is),
 * centered on the click, and kept inside the page.
 */
function signatureBox(signature: InkShape, center: Point, page: EditorPage): Box {
  const scale = Math.min(
    DEFAULT_SIGNATURE_WIDTH / signature.viewBoxWidth,
    page.width / signature.viewBoxWidth,
    page.height / signature.viewBoxHeight,
  )
  const width = signature.viewBoxWidth * scale
  const height = signature.viewBoxHeight * scale
  return {
    x: clamp(center.x - width / 2, 0, page.width - width),
    y: clamp(center.y - height / 2, 0, page.height - height),
    width,
    height,
  }
}

/** The signature tool, covering the page: a click places the pending signature. */
export function SignatureSurface({ pageIndex, page, signature }: { pageIndex: number; page: EditorPage; signature: InkShape }) {
  const zoom = useAtomValue(zoomAtom)
  const color = useAtomValue(penColorAtom)
  const addAnnotation = useSetAtom(addAnnotationAtom)
  const setPendingSignature = useSetAtom(pendingSignatureAtom)
  const setTool = useSetAtom(toolAtom)
  // A preview following the pointer. Not for touch, which has no hover.
  const [ghost, setGhost] = useState<Box | null>(null)

  const boxAt = (e: MouseEvent<HTMLDivElement>) => signatureBox(signature, pagePoint(e, e.currentTarget, zoom), page)

  const place = (e: MouseEvent<HTMLDivElement>) => {
    addAnnotation({
      id: newAnnotationId(),
      type: 'ink',
      pageIndex,
      color,
      ...boxAt(e),
      path: signature.path,
      viewBoxWidth: signature.viewBoxWidth,
      viewBoxHeight: signature.viewBoxHeight,
    })
    setPendingSignature(null)
    // Adding selected it, so it's ready to be moved or resized.
    setTool('select')
  }

  return (
    <div
      style={{ position: 'absolute', inset: 0, cursor: 'crosshair' }}
      onPointerMove={(e) => setGhost(e.pointerType === 'touch' ? null : boxAt(e))}
      onPointerLeave={() => setGhost(null)}
      onClick={place}
    >
      {ghost && (
        <div
          style={{
            position: 'absolute',
            left: ghost.x * zoom,
            top: ghost.y * zoom,
            width: ghost.width * zoom,
            height: ghost.height * zoom,
            opacity: 0.5,
            pointerEvents: 'none',
          }}
        >
          <InkSvg shape={signature} color={color} />
        </div>
      )}
    </div>
  )
}
