import {
  useState,
  type CSSProperties,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from 'react'
import { Button, Checkbox, Flex, Modal, Space, Typography, theme } from 'antd'
import { ClearOutlined, UndoOutlined } from '@ant-design/icons'
import { useAtom } from 'jotai'
import { ColorSwatches } from './ColorSwatches'
import { PEN_COLORS, SIGNATURE_STROKE_WIDTH } from './constants'
import { outlineToPath, strokeOutline, strokesToInk, type PenPoint, type PenStroke } from './ink'
import { forgetSignature, loadSignature, saveSignature } from './savedSignature'
import { penColorAtom } from './state'
import type { InkShape } from './types'

// The drawing area's size in pad pixels, the units strokes are recorded in. On narrow screens the
// area is drawn smaller, and pointer positions are scaled back into these units.
const PAD_WIDTH = 560
const PAD_HEIGHT = 200
const BASELINE_Y = 150
const MARGIN = 24

interface SignaturePadProps {
  open: boolean
  onCancel: () => void
  /** Called with the chosen signature; the caller closes the pad. */
  onUse: (signature: InkShape) => void
}

/** A modal to draw a signature, or to reuse the one remembered in this browser. */
export function SignaturePad({ open, onCancel, onUse }: SignaturePadProps) {
  const [penColor, setPenColor] = useAtom(penColorAtom)
  const [saved, setSaved] = useState(loadSignature)
  // With a saved signature the pad offers it first; this switches to drawing a new one instead.
  const [drawingNew, setDrawingNew] = useState(false)
  const [strokes, setStrokes] = useState<PenStroke[]>([])
  const [remember, setRemember] = useState(true)
  const showSaved = saved !== null && !drawingNew

  const handleUseDrawn = () => {
    const ink = strokesToInk(strokes, SIGNATURE_STROKE_WIDTH)
    if (!ink) return
    if (remember) saveSignature(ink.shape)
    onUse(ink.shape)
  }

  const handleForget = () => {
    forgetSignature()
    setSaved(null)
  }

  const colorPicker = <ColorSwatches label="Signature color" colors={PEN_COLORS} value={penColor} onChange={setPenColor} />

  return (
    <Modal
      open={open}
      title={showSaved ? 'Your signature' : 'Draw your signature'}
      // Fits the drawing area at full size next to the modal's 24px padding.
      width={PAD_WIDTH + 48}
      centered
      // Don't lose a drawn signature to a stray click outside the pad.
      maskClosable={strokes.length === 0}
      onCancel={onCancel}
      // Start fresh next time, offering the signature that's now saved (if saving worked). Waiting
      // until it's closed keeps the content from changing while it fades out.
      afterOpenChange={(isOpen) => {
        if (!isOpen) {
          setSaved(loadSignature())
          setStrokes([])
          setDrawingNew(false)
        }
      }}
      footer={
        showSaved
          ? [
              <Button key="new" onClick={() => setDrawingNew(true)}>
                Draw a new one
              </Button>,
              <Button key="use" type="primary" onClick={() => onUse(saved)}>
                Use this signature
              </Button>,
            ]
          : [
              <Button key="cancel" onClick={onCancel}>
                Cancel
              </Button>,
              <Button key="use" type="primary" disabled={strokes.length === 0} onClick={handleUseDrawn}>
                Use signature
              </Button>,
            ]
      }
    >
      {showSaved ? (
        <Flex vertical gap="small">
          <SavedSignature signature={saved} color={penColor} />
          <Flex justify="space-between" align="center" wrap gap="small">
            {colorPicker}
            <Space size={0}>
              <Typography.Text type="secondary">Saved in this browser only</Typography.Text>
              <Button type="link" danger size="small" onClick={handleForget}>
                Forget it
              </Button>
            </Space>
          </Flex>
        </Flex>
      ) : (
        <Flex vertical gap="small">
          <DrawingArea strokes={strokes} setStrokes={setStrokes} color={penColor} />
          <Flex justify="space-between" align="center" wrap gap="small">
            {colorPicker}
            <Space size={0}>
              <Button
                type="text"
                size="small"
                icon={<UndoOutlined />}
                disabled={strokes.length === 0}
                onClick={() => setStrokes((s) => s.slice(0, -1))}
              >
                Undo stroke
              </Button>
              <Button
                type="text"
                size="small"
                icon={<ClearOutlined />}
                disabled={strokes.length === 0}
                onClick={() => setStrokes([])}
              >
                Clear
              </Button>
            </Space>
          </Flex>
          <div>
            <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)}>
              Remember this signature on this device
            </Checkbox>
            <Typography.Text type="secondary">(stored only in this browser)</Typography.Text>
          </div>
        </Flex>
      )}
    </Modal>
  )
}

/** The bordered box both the drawing area and the saved signature are shown in. */
function usePadStyle(): CSSProperties {
  const { token } = theme.useToken()
  return {
    display: 'block',
    width: '100%',
    aspectRatio: `${PAD_WIDTH} / ${PAD_HEIGHT}`,
    background: token.colorFillAlter,
    // An outline rather than a border: a border would shift the drawing area off the box that
    // pointer positions are measured against.
    outline: `1px dashed ${token.colorBorder}`,
    borderRadius: token.borderRadiusLG,
  }
}

function SavedSignature({ signature, color }: { signature: InkShape; color: string }) {
  const padStyle = usePadStyle()
  return (
    <svg viewBox={`0 0 ${PAD_WIDTH} ${PAD_HEIGHT}`} style={padStyle} role="img" aria-label="Your saved signature">
      {/* Scaled to fit the box, keeping its proportions (the nested svg's default preserveAspectRatio). */}
      <svg
        x={MARGIN}
        y={MARGIN}
        width={PAD_WIDTH - 2 * MARGIN}
        height={PAD_HEIGHT - 2 * MARGIN}
        viewBox={`0 0 ${signature.viewBoxWidth} ${signature.viewBoxHeight}`}
      >
        <path d={signature.path} fill={color} />
      </svg>
    </svg>
  )
}

interface DrawingAreaProps {
  strokes: PenStroke[]
  setStrokes: Dispatch<SetStateAction<PenStroke[]>>
  color: string
}

function DrawingArea({ strokes, setStrokes, color }: DrawingAreaProps) {
  const { token } = theme.useToken()
  const padStyle = usePadStyle()
  // The pointer drawing the current stroke, or null between strokes.
  const [pointerId, setPointerId] = useState<number | null>(null)

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    // One stroke at a time (ignore a second finger), and only with the main button.
    if (pointerId !== null || e.button !== 0) return
    // Keeps the moves coming to the pad even when the pointer leaves it mid-stroke.
    e.currentTarget.setPointerCapture(e.pointerId)
    setPointerId(e.pointerId)
    const stroke: PenStroke = {
      points: [toPadPoint(e.currentTarget.getBoundingClientRect(), e.nativeEvent)],
      simulatePressure: e.pointerType !== 'pen',
    }
    setStrokes((s) => [...s, stroke])
  }

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerId !== pointerId) return
    // Browsers report one move per frame; the coalesced events in between keep fast strokes smooth.
    const coalesced = e.nativeEvent.getCoalescedEvents?.() ?? []
    const events = coalesced.length > 0 ? coalesced : [e.nativeEvent]
    const rect = e.currentTarget.getBoundingClientRect()
    const points = events.map((event) => toPadPoint(rect, event))
    setStrokes((s) => {
      const last = s[s.length - 1]
      if (!last) return s // cleared mid-stroke
      return [...s.slice(0, -1), { ...last, points: [...last.points, ...points] }]
    })
  }

  const handlePointerEnd = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerId === pointerId) setPointerId(null)
  }

  return (
    <svg
      viewBox={`0 0 ${PAD_WIDTH} ${PAD_HEIGHT}`}
      role="img"
      aria-label="Signature drawing area"
      // touch-action: none lets a finger or pen draw instead of scrolling the page.
      style={{ ...padStyle, touchAction: 'none', cursor: 'crosshair', userSelect: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {/* "Sign here" guide; only the strokes are used. */}
      <line
        x1={MARGIN}
        y1={BASELINE_Y}
        x2={PAD_WIDTH - MARGIN}
        y2={BASELINE_Y}
        stroke={token.colorBorder}
        strokeWidth={1.5}
      />
      <text x={MARGIN} y={BASELINE_Y - 10} fontSize={22} fill={token.colorTextQuaternary}>
        ×
      </text>
      {strokes.length === 0 && (
        <text x={PAD_WIDTH / 2} y={BASELINE_Y - 50} fontSize={16} textAnchor="middle" fill={token.colorTextQuaternary}>
          Sign here
        </text>
      )}
      {strokes.map((stroke, i) => {
        const complete = pointerId === null || i < strokes.length - 1
        return <path key={i} d={outlineToPath(strokeOutline(stroke, SIGNATURE_STROKE_WIDTH, complete))} fill={color} />
      })}
    </svg>
  )
}

/**
 * A pointer position in pad pixels. The drawing area can be shown smaller than PAD_WIDTH (narrow
 * screens, the modal's zoom-in animation), so this scales by its on-screen box, `rect`.
 */
function toPadPoint(rect: DOMRect, e: PointerEvent): PenPoint {
  const x = ((e.clientX - rect.left) / rect.width) * PAD_WIDTH
  const y = ((e.clientY - rect.top) / rect.height) * PAD_HEIGHT
  return {
    // Kept inside the pad, so the signature that's used is the one that's visible.
    x: Math.min(Math.max(x, 0), PAD_WIDTH),
    y: Math.min(Math.max(y, 0), PAD_HEIGHT),
    // Only a pen reports real pressure; for the rest it's simulated (see PenStroke).
    pressure: e.pointerType === 'pen' ? e.pressure : 0.5,
  }
}
