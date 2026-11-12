import { memo } from 'react'
import { useAtomValue } from 'jotai'
import { toolAtom } from '../state'
import type { InkAnnotation, InkShape } from '../types'
import { AnnotationFrame } from './AnnotationFrame'

/** How small ink can be resized: its longer side, in points. */
const MIN_INK_SIZE = 8

/** Pen strokes, stretched to fill their container. */
export function InkSvg({ shape, color }: { shape: InkShape; color: string }) {
  return (
    <svg
      viewBox={`0 0 ${shape.viewBoxWidth} ${shape.viewBoxHeight}`}
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <path d={shape.path} fill={color} />
    </svg>
  )
}

/** A freehand drawing or a signature. */
export const InkObject = memo(function InkObject({ annotation }: { annotation: InkAnnotation }) {
  const selectTool = useAtomValue(toolAtom) === 'select'
  const { width, height, viewBoxWidth, viewBoxHeight } = annotation
  const minScale = Math.min(1, MIN_INK_SIZE / Math.max(width, height))

  return (
    <AnnotationFrame
      id={annotation.id}
      box={annotation}
      movable={selectTool}
      interactive={selectTool}
      keepAspectRatio
      minSize={{ width: width * minScale, height: height * minScale }}
      // Height from width, so width / viewBoxWidth stays exactly height / viewBoxHeight (types.ts).
      resizeChanges={(next) => ({ ...next, height: (next.width * viewBoxHeight) / viewBoxWidth })}
    >
      <InkSvg shape={annotation} color={annotation.color} />
    </AnnotationFrame>
  )
})
