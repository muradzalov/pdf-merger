import { memo, useMemo, useState, type CSSProperties } from 'react'
import { Tooltip, theme } from 'antd'
import { useAtomValue, useSetAtom } from 'jotai'
import { MAX_FONT_SIZE, MIN_FONT_SIZE } from '../constants'
import { toolAtom, zoomAtom } from '../state'
import { LINE_HEIGHT, TEXT_FONT_FAMILY, layoutText, unsupportedCharacters } from '../textMetrics'
import type { TextAnnotation } from '../types'
import { AnnotationFrame } from './AnnotationFrame'
import { clamp } from './geometry'
import { editTextAtom, editingTextAtom, startEditingAtom, stopEditingAtom } from './textEditing'

/** Minimum box width, as a multiple of the font size, so an empty box can still be clicked. */
const MIN_WIDTH_EM = 0.5

// pdf-lib draws glyph by glyph, with no kerning or ligatures; the browser must do the same to match.
const plainGlyphs: CSSProperties = { fontKerning: 'none', fontVariantLigatures: 'none' }

/*
 * A textarea can't be told where its baselines go: CSS centers the font's own ascent + descent in
 * each line, and those of the font the browser picks (e.g. Arial) differ from the Helvetica metrics
 * layoutText uses. Measure where CSS puts the first baseline, and shift the textarea by the
 * difference, so the text doesn't move when editing starts or ends. In em.
 */
const TEXTAREA_SHIFT = (() => {
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return 0
  context.font = `100px ${TEXT_FONT_FAMILY}`
  const { fontBoundingBoxAscent: ascent, fontBoundingBoxDescent: descent } = context.measureText('x')
  // Browsers that don't report the font's ascent leave the textarea where it is.
  if (!ascent) return 0
  const cssBaseline = ((LINE_HEIGHT * 100 - ascent - descent) / 2 + ascent) / 100
  return layoutText('', 1).baselines[0] - cssBaseline
})()

export const TextBox = memo(function TextBox({ annotation }: { annotation: TextAnnotation }) {
  const { id, text, fontSize, color } = annotation
  const { token } = theme.useToken()
  const tool = useAtomValue(toolAtom)
  const zoom = useAtomValue(zoomAtom)
  const editing = useAtomValue(editingTextAtom)?.id === id
  const startEditing = useSetAtom(startEditingAtom)
  const stopEditing = useSetAtom(stopEditingAtom)
  const editText = useSetAtom(editTextAtom)
  const [hovered, setHovered] = useState(false)

  const layout = useMemo(() => layoutText(text, fontSize), [text, fontSize])
  const unsupported = useMemo(() => unsupportedCharacters(text), [text])
  const warning = unsupported.length > 0 ? `These characters can't be saved: ${unsupported.join(' ')}` : null
  const box = { x: annotation.x, y: annotation.y, width: Math.max(layout.width, fontSize * MIN_WIDTH_EM), height: layout.height }
  // The box always fits the text, so resizing it scales the font, within the font size limits.
  const boxAtFontSize = (size: number) => ({ width: (box.width * size) / fontSize, height: (box.height * size) / fontSize })
  const fontPx = fontSize * zoom

  const edit = () => startEditing({ id, isNew: false })

  return (
    <AnnotationFrame
      id={id}
      box={box}
      movable={tool === 'select' && !editing}
      interactive={tool === 'select' || tool === 'text'}
      keepAspectRatio
      minSize={boxAtFontSize(MIN_FONT_SIZE)}
      maxSize={boxAtFontSize(MAX_FONT_SIZE)}
      resizeChanges={(next) => ({
        x: next.x,
        y: next.y,
        // Rounded to 0.1 pt, so the toolbar shows a tidy font size.
        fontSize: clamp(Math.round(((fontSize * next.height) / box.height) * 10) / 10, MIN_FONT_SIZE, MAX_FONT_SIZE),
      })}
    >
      <Tooltip title={warning} open={warning !== null && (editing || hovered)} onOpenChange={setHovered}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            cursor: tool === 'text' ? 'text' : undefined,
            outline: warning
              ? `1px solid ${token.colorError}`
              : editing
                ? `1px dashed ${token.colorPrimary}`
                : undefined,
            outlineOffset: 2,
          }}
          onClick={tool === 'text' ? edit : undefined}
          onDoubleClick={tool === 'select' && !editing ? edit : undefined}
        >
          {editing ? (
            <textarea
              aria-label="Text"
              autoFocus
              value={text}
              wrap="off"
              spellCheck={false}
              onChange={(e) => editText({ id, text: e.target.value })}
              // Caret at the end, ready to add to the text.
              onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
              onBlur={() => stopEditing(id)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') e.currentTarget.blur()
              }}
              style={{
                ...plainGlyphs,
                position: 'absolute',
                left: 0,
                top: TEXTAREA_SHIFT * fontPx,
                // An em bigger than the text, so the caret and the next character or line fit before
                // the box grows; otherwise the textarea would scroll its text out of place.
                width: box.width * zoom + fontPx,
                height: box.height * zoom + fontPx,
                margin: 0,
                padding: 0,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                resize: 'none',
                overflow: 'hidden',
                whiteSpace: 'pre',
                fontFamily: TEXT_FONT_FAMILY,
                fontSize: fontPx,
                fontWeight: 'normal',
                fontStyle: 'normal',
                letterSpacing: 'normal',
                lineHeight: LINE_HEIGHT,
                color,
              }}
            />
          ) : (
            // In page points, scaled to the box; so the text also scales live while it's resized.
            <svg
              viewBox={`0 0 ${box.width} ${box.height}`}
              width="100%"
              height="100%"
              // Keeps runs of spaces, as the saved PDF will.
              xmlSpace="preserve"
              style={{ display: 'block', overflow: 'visible', userSelect: 'none' }}
            >
              {layout.lines.map((line, i) => (
                <text
                  key={i}
                  x={0}
                  y={layout.baselines[i]}
                  fill={color}
                  fontFamily={TEXT_FONT_FAMILY}
                  fontSize={fontSize}
                  style={plainGlyphs}
                >
                  {line}
                </text>
              ))}
            </svg>
          )}
        </div>
      </Tooltip>
    </AnnotationFrame>
  )
})
