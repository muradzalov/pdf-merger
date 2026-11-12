import { memo, type CSSProperties } from 'react'
import { useAtomValue } from 'jotai'
import { HIGHLIGHT_OPACITY } from '../constants'
import { toolAtom } from '../state'
import type { HighlightAnnotation } from '../types'
import { AnnotationFrame } from './AnnotationFrame'

/** Highlights smaller than this, in points, in either direction, aren't made (or resized to). */
export const MIN_HIGHLIGHT_SIZE = 4

/**
 * The look of a highlight, for an element whose parent isn't a stacking context: multiply only
 * blends with what's in the same stacking context (here, the page canvas).
 *
 * The opacity goes in the background color rather than `opacity`, so that the selection outline and
 * resize handles (children of the same element) stay fully opaque.
 */
export function highlightStyle(color: string): CSSProperties {
  const rgb = parseInt(color.slice(1), 16)
  return {
    backgroundColor: `rgba(${rgb >> 16}, ${(rgb >> 8) & 255}, ${rgb & 255}, ${HIGHLIGHT_OPACITY})`,
    mixBlendMode: 'multiply',
  }
}

export const HighlightBox = memo(function HighlightBox({ annotation }: { annotation: HighlightAnnotation }) {
  const selectTool = useAtomValue(toolAtom) === 'select'

  return (
    <AnnotationFrame
      id={annotation.id}
      box={annotation}
      movable={selectTool}
      interactive={selectTool}
      minSize={{ width: MIN_HIGHLIGHT_SIZE, height: MIN_HIGHLIGHT_SIZE }}
      // On the Rnd element itself: it has a transform, which isolates its children from the page.
      style={highlightStyle(annotation.color)}
    />
  )
})
