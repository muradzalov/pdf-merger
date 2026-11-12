import { useEffect, useState } from 'react'
import { Alert, Button, Flex, Grid, InputNumber, Segmented, Space, Tooltip, theme } from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  FontSizeOutlined,
  HighlightOutlined,
  SelectOutlined,
  SignatureOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { ColorSwatches } from './ColorSwatches'
import { HIGHLIGHT_COLORS, MAX_FONT_SIZE, MIN_FONT_SIZE, PEN_COLORS, STROKE_WIDTHS } from './constants'
import { SignaturePad } from './SignaturePad'
import {
  annotationsAtom,
  canUndoAtom,
  checkpointAtom,
  deleteAnnotationAtom,
  fontSizeAtom,
  highlightColorAtom,
  penColorAtom,
  pendingSignatureAtom,
  selectedAnnotationIdAtom,
  strokeWidthAtom,
  toolAtom,
  undoAtom,
  updateAnnotationAtom,
} from './state'
import type { Annotation, EditorTool, InkShape } from './types'

const TOOLS: { value: EditorTool; label: string; hint: string; Icon: typeof SelectOutlined }[] = [
  { value: 'select', label: 'Select', hint: 'Select, move and resize', Icon: SelectOutlined },
  { value: 'text', label: 'Text', hint: 'Click the page to type', Icon: FontSizeOutlined },
  { value: 'draw', label: 'Draw', hint: 'Draw freehand', Icon: EditOutlined },
  { value: 'highlight', label: 'Highlight', hint: 'Drag over the page to highlight', Icon: HighlightOutlined },
  { value: 'signature', label: 'Signature', hint: 'Draw or reuse your signature', Icon: SignatureOutlined },
]

/** What each tool creates, i.e. whose options the toolbar shows while nothing is selected. */
const CREATES: Record<EditorTool, Annotation['type'] | null> = {
  select: null,
  text: 'text',
  draw: 'ink',
  highlight: 'highlight',
  signature: 'ink',
}

const selectedAnnotationAtom = atom((get) => {
  const id = get(selectedAnnotationIdAtom)
  return get(annotationsAtom).find((a) => a.id === id) ?? null
})

/** Escape, or Cancel on the signature hint: drop whatever is in progress. */
const backToSelectAtom = atom(null, (_get, set) => {
  set(pendingSignatureAtom, null)
  set(selectedAnnotationIdAtom, null)
  set(toolAtom, 'select')
})

/** Tool picker, options, undo/delete, keyboard shortcuts, and the signature pad. */
export function EditorToolbar() {
  const [tool, setTool] = useAtom(toolAtom)
  const [selectedId, setSelectedId] = useAtom(selectedAnnotationIdAtom)
  const [pendingSignature, setPendingSignature] = useAtom(pendingSignatureAtom)
  const canUndo = useAtomValue(canUndoAtom)
  const undo = useSetAtom(undoAtom)
  const deleteAnnotation = useSetAtom(deleteAnnotationAtom)
  const backToSelect = useSetAtom(backToSelectAtom)
  const [signaturePadOpen, setSignaturePadOpen] = useState(false)
  const { token } = theme.useToken()
  const screens = Grid.useBreakpoint()
  // On phones only the icons fit.
  const compact = !screens.sm

  const pickTool = (next: EditorTool) => {
    // The signature tool is armed by the pad, once there's a signature to place.
    if (next === 'signature') {
      setSignaturePadOpen(true)
      return
    }
    setTool(next)
    setPendingSignature(null)
    // Picking a tool to add something starts afresh: show that tool's options, not the selection's.
    if (next !== 'select') setSelectedId(null)
  }

  const handleUseSignature = (signature: InkShape) => {
    setSignaturePadOpen(false)
    setPendingSignature(signature)
    setTool('signature')
    setSelectedId(null)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (signaturePadOpen || isTypingTarget(e.target)) return

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z') {
        if (!canUndo) return
        e.preventDefault()
        undo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        deleteAnnotation(selectedId)
      } else if (e.key === 'Escape' && (pendingSignature || selectedId || tool !== 'select')) {
        e.preventDefault()
        backToSelect()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [signaturePadOpen, canUndo, selectedId, pendingSignature, tool, undo, deleteAnnotation, backToSelect])

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        // Above the pages and their annotations, below antd's popups and modals (1000+).
        zIndex: 100,
        background: token.colorBgContainer,
        padding: `${token.paddingXS}px 0`,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Flex wrap align="center" gap="small">
        <Segmented<EditorTool>
          aria-label="Tool"
          value={tool}
          onChange={pickTool}
          options={TOOLS.map(({ value, label, hint, Icon }) => ({
            value,
            label: (
              <Tooltip title={hint}>
                {compact ? (
                  // Without the text, the icon carries the tool's name for screen readers.
                  <Icon aria-label={label} />
                ) : (
                  <span>
                    <Icon aria-hidden /> {label}
                  </span>
                )}
              </Tooltip>
            ),
          }))}
        />

        <ToolOptions />

        <Space size={4} style={{ marginInlineStart: 'auto' }}>
          <Tooltip title="Undo (Ctrl+Z)">
            <Button icon={<UndoOutlined />} aria-label="Undo" disabled={!canUndo} onClick={() => undo()}>
              {!compact && 'Undo'}
            </Button>
          </Tooltip>
          <Tooltip title="Delete the selected item (Delete)">
            <Button
              danger
              icon={<DeleteOutlined />}
              aria-label="Delete"
              disabled={!selectedId}
              onClick={() => selectedId && deleteAnnotation(selectedId)}
            >
              {!compact && 'Delete'}
            </Button>
          </Tooltip>
        </Space>

        {pendingSignature && (
          <Alert
            type="info"
            showIcon
            message="Click on the page where the signature goes — Esc to cancel"
            action={
              <Button size="small" onClick={() => backToSelect()}>
                Cancel
              </Button>
            }
            // Floats just under the toolbar instead of taking a row, so the pages don't jump
            // down when it appears and back up the moment the signature is placed.
            style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: token.marginXS }}
          />
        )}
      </Flex>

      <SignaturePad
        open={signaturePadOpen}
        onCancel={() => setSignaturePadOpen(false)}
        onUse={handleUseSignature}
      />
    </div>
  )
}

/**
 * Options for the selected annotation or, with nothing selected, for what the current tool adds.
 * A change to the selection is also kept as the default for the next annotation.
 */
function ToolOptions() {
  const tool = useAtomValue(toolAtom)
  const selected = useAtomValue(selectedAnnotationAtom)
  const [penColor, setPenColor] = useAtom(penColorAtom)
  const [highlightColor, setHighlightColor] = useAtom(highlightColorAtom)
  const [fontSize, setFontSize] = useAtom(fontSizeAtom)
  const [strokeWidth, setStrokeWidth] = useAtom(strokeWidthAtom)
  const checkpoint = useSetAtom(checkpointAtom)
  const updateAnnotation = useSetAtom(updateAnnotationAtom)

  const kind = selected?.type ?? CREATES[tool]
  if (!kind) return null

  const changeColor = (color: string) => {
    if (kind === 'highlight') setHighlightColor(color)
    else setPenColor(color)
    if (selected && selected.color !== color) {
      checkpoint()
      updateAnnotation({ id: selected.id, changes: { color } })
    }
  }

  const changeFontSize = (size: number) => {
    setFontSize(size)
    if (selected?.type === 'text' && selected.fontSize !== size) {
      checkpoint()
      updateAnnotation({ id: selected.id, changes: { fontSize: size } })
    }
  }

  return (
    <Space size="middle" wrap>
      {kind === 'text' && (
        <Tooltip title="Font size">
          <InputNumber
            aria-label="Font size"
            prefix={<FontSizeOutlined />}
            min={MIN_FONT_SIZE}
            max={MAX_FONT_SIZE}
            value={selected?.type === 'text' ? selected.fontSize : fontSize}
            // null while the field is empty; it snaps back to the current size on blur.
            onChange={(size) => size !== null && changeFontSize(size)}
            style={{ width: 90 }}
          />
        </Tooltip>
      )}

      {kind === 'highlight' ? (
        <ColorSwatches
          label="Highlight color"
          colors={HIGHLIGHT_COLORS}
          value={selected?.color ?? highlightColor}
          onChange={changeColor}
        />
      ) : (
        <ColorSwatches label="Pen color" colors={PEN_COLORS} value={selected?.color ?? penColor} onChange={changeColor} />
      )}

      {/* A stroke's width is baked into its outline, so this only applies to new strokes. */}
      {kind === 'ink' && tool === 'draw' && (
        <Segmented<number>
          aria-label="Pen width"
          size="small"
          value={strokeWidth}
          onChange={setStrokeWidth}
          options={STROKE_WIDTHS.map(({ name, value }) => ({ label: name, value }))}
        />
      )}
    </Space>
  )
}

// Keys typed into a field (a text box being edited, the font size) belong to that field. Radio
// buttons and checkboxes keep the focus after a click (the tool picker's do), so they don't count.
function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLInputElement) return target.type !== 'radio' && target.type !== 'checkbox'
  return target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
}
