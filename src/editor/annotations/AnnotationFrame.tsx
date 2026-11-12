import type { CSSProperties, ReactNode } from 'react'
import { theme } from 'antd'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Rnd, type HandleClasses, type HandleComponent } from 'react-rnd'
import { checkpointAtom, selectedAnnotationIdAtom, updateAnnotationAtom, zoomAtom, type AnnotationChanges } from '../state'
import type { Box, Size } from './geometry'

// react-draggable listens to touchstart natively, before re-resizable's React handler sees it, so
// a touch on a handle would start a drag as well as the resize. Rnd's `cancel` excludes them.
const HANDLE_CLASS = 'annotation-resize-handle'
const handleClasses: HandleClasses = {
  top: HANDLE_CLASS,
  right: HANDLE_CLASS,
  bottom: HANDLE_CLASS,
  left: HANDLE_CLASS,
  topRight: HANDLE_CLASS,
  bottomRight: HANDLE_CLASS,
  bottomLeft: HANDLE_CLASS,
  topLeft: HANDLE_CLASS,
}
const CORNERS = { topRight: true, bottomRight: true, bottomLeft: true, topLeft: true }

/** A drag or resize that changes the box by less than this (CSS px) was just a click. */
const CLICK_TOLERANCE = 0.5

interface AnnotationFrameProps {
  id: string
  /** Position and size, in page points. */
  box: Box
  /** Can be dragged and, once selected, resized: the select tool. */
  movable: boolean
  /** False lets the pointer through to the page, for tools that don't act on this annotation. */
  interactive: boolean
  /** Corner handles only, and resizing keeps the width:height ratio. */
  keepAspectRatio?: boolean
  /** Resize limits, in page points. */
  minSize: Size
  maxSize?: Size
  /** What a resize changes. By default, the position and size. */
  resizeChanges?: (box: Box) => AnnotationChanges
  style?: CSSProperties
  children?: ReactNode
}

/**
 * Places an annotation on the page and moves and resizes it, with react-rnd. react-rnd works in CSS
 * px; the annotations are in page points, so everything is multiplied or divided by the zoom.
 */
export function AnnotationFrame({
  id,
  box,
  movable,
  interactive,
  keepAspectRatio = false,
  minSize,
  maxSize,
  resizeChanges = (next) => next,
  style,
  children,
}: AnnotationFrameProps) {
  const { token } = theme.useToken()
  const zoom = useAtomValue(zoomAtom)
  const [selectedId, setSelectedId] = useAtom(selectedAnnotationIdAtom)
  const checkpoint = useSetAtom(checkpointAtom)
  const updateAnnotation = useSetAtom(updateAnnotationAtom)
  const showSelection = movable && selectedId === id

  const commit = (changes: AnnotationChanges) => {
    checkpoint()
    updateAnnotation({ id, changes })
  }
  const differs = (a: number, b: number) => Math.abs(a - b) * zoom >= CLICK_TOLERANCE

  const handle = (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: 8,
        height: 8,
        margin: -4,
        boxSizing: 'border-box',
        background: token.colorPrimary,
        border: `1px solid ${token.colorBgContainer}`,
        borderRadius: 2,
      }}
    />
  )
  const handles: HandleComponent = {
    top: handle,
    right: handle,
    bottom: handle,
    left: handle,
    topRight: handle,
    bottomRight: handle,
    bottomLeft: handle,
    topLeft: handle,
  }

  return (
    <Rnd
      position={{ x: box.x * zoom, y: box.y * zoom }}
      size={{ width: box.width * zoom, height: box.height * zoom }}
      bounds="parent"
      disableDragging={!movable}
      enableResizing={showSelection ? (keepAspectRatio ? CORNERS : true) : false}
      // The exact ratio: Rnd's own (lockAspectRatio={true}) is measured from rounded pixel sizes.
      lockAspectRatio={keepAspectRatio ? box.width / box.height : false}
      minWidth={minSize.width * zoom}
      minHeight={minSize.height * zoom}
      maxWidth={maxSize && maxSize.width * zoom}
      maxHeight={maxSize && maxSize.height * zoom}
      cancel={`.${HANDLE_CLASS}`}
      resizeHandleClasses={handleClasses}
      resizeHandleComponent={handles}
      onDragStart={() => setSelectedId(id)}
      onDragStop={(_e, data) => {
        const x = data.x / zoom
        const y = data.y / zoom
        if (differs(x, box.x) || differs(y, box.y)) commit({ x, y })
      }}
      onResizeStop={(_e, _direction, element, _delta, position) => {
        // Measured, because `delta` is relative to a rounded size (and, when a handle is only
        // clicked, left over from the previous resize).
        const rect = element.getBoundingClientRect()
        const next = { x: position.x / zoom, y: position.y / zoom, width: rect.width / zoom, height: rect.height / zoom }
        const changed =
          differs(next.x, box.x) || differs(next.y, box.y) || differs(next.width, box.width) || differs(next.height, box.height)
        if (changed) commit(resizeChanges(next))
      }}
      style={{
        ...style,
        outline: showSelection ? `1px dashed ${token.colorPrimary}` : undefined,
        outlineOffset: 2,
        pointerEvents: interactive ? undefined : 'none',
        // A finger on a movable annotation drags or resizes it instead of scrolling the page.
        touchAction: movable ? 'none' : undefined,
      }}
    >
      {children}
    </Rnd>
  )
}
