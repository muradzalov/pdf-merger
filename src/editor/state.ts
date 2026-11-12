import { atom } from 'jotai'
import { DEFAULT_FONT_SIZE, HIGHLIGHT_COLORS, PEN_COLORS, STROKE_WIDTHS } from './constants'
import type { Annotation, EditorDocument, EditorTool, InkShape } from './types'

/** The open PDF, or null when nothing is open. Set it with setDocumentAtom. */
export const editorDocumentAtom = atom<EditorDocument | null>(null)

/** Everything the user added, on all pages. See types.ts for coordinates and stacking order. */
export const annotationsAtom = atom<Annotation[]>([])

export const selectedAnnotationIdAtom = atom<string | null>(null)

export const toolAtom = atom<EditorTool>('select')

/** 1 = 100%: one page point is one CSS pixel. */
export const zoomAtom = atom(1)

// Options for new annotations. The toolbar also applies them to the selected annotation.
export const penColorAtom = atom<string>(PEN_COLORS[0].value)
export const highlightColorAtom = atom<string>(HIGHLIGHT_COLORS[0].value)
export const fontSizeAtom = atom(DEFAULT_FONT_SIZE)
export const strokeWidthAtom = atom<number>(STROKE_WIDTHS[1].value)

/** A signature waiting to be placed: the next click on a page with the signature tool puts it there. */
export const pendingSignatureAtom = atom<InkShape | null>(null)

let nextId = 0
export const newAnnotationId = () => `annotation-${nextId++}`

/** Opens a document (or closes it, with null) and starts with a clean slate. */
export const setDocumentAtom = atom(null, (get, set, doc: EditorDocument | null) => {
  const previous = get(editorDocumentAtom)
  // Frees pdf.js's copy of the previous document (and its worker).
  if (previous && previous !== doc) void previous.pdf.loadingTask.destroy()
  set(editorDocumentAtom, doc)
  set(annotationsAtom, [])
  set(historyAtom, [])
  set(selectedAnnotationIdAtom, null)
  set(pendingSignatureAtom, null)
  set(toolAtom, 'select')
})

// ---- Changes and undo ----
// Undo restores snapshots of annotationsAtom. add/delete save one automatically. For changes made
// with updateAnnotationAtom (drag, resize, typing, toolbar options), call checkpointAtom once
// before the change: e.g. when a drag ends, or when a text box starts being edited.

const MAX_UNDO = 100
const historyAtom = atom<Annotation[][]>([])

export const canUndoAtom = atom((get) => get(historyAtom).length > 0)

export const checkpointAtom = atom(null, (get, set) => {
  set(historyAtom, [...get(historyAtom).slice(-(MAX_UNDO - 1)), get(annotationsAtom)])
})

export const undoAtom = atom(null, (get, set) => {
  const history = get(historyAtom)
  if (history.length === 0) return
  const restored = history[history.length - 1]
  set(historyAtom, history.slice(0, -1))
  set(annotationsAtom, restored)
  const selected = get(selectedAnnotationIdAtom)
  if (selected && !restored.some((a) => a.id === selected)) set(selectedAnnotationIdAtom, null)
})

/** Adds an annotation (undoable) and selects it. Create its id with newAnnotationId(). */
export const addAnnotationAtom = atom(null, (get, set, annotation: Annotation) => {
  set(checkpointAtom)
  set(annotationsAtom, [...get(annotationsAtom), annotation])
  set(selectedAnnotationIdAtom, annotation.id)
})

type ChangesFor<T> = T extends Annotation ? Partial<Omit<T, 'id' | 'type'>> : never
/** Fields of one annotation type to change, e.g. `{ x, y }` or `{ fontSize }`. */
export type AnnotationChanges = ChangesFor<Annotation>

/** Changes an annotation WITHOUT saving an undo step; call checkpointAtom first (see above). */
export const updateAnnotationAtom = atom(null, (get, set, { id, changes }: { id: string; changes: AnnotationChanges }) => {
  set(
    annotationsAtom,
    get(annotationsAtom).map((a) => (a.id === id ? ({ ...a, ...changes } as Annotation) : a)),
  )
})

/** Deletes an annotation (undoable). */
export const deleteAnnotationAtom = atom(null, (get, set, id: string) => {
  if (!get(annotationsAtom).some((a) => a.id === id)) return
  set(checkpointAtom)
  set(annotationsAtom, get(annotationsAtom).filter((a) => a.id !== id))
  if (get(selectedAnnotationIdAtom) === id) set(selectedAnnotationIdAtom, null)
})

/**
 * Deletes an annotation with no undo step, e.g. a text box left empty when editing ends (adding it
 * already saved a step, and undoing back to an empty box would be pointless).
 */
export const discardAnnotationAtom = atom(null, (get, set, id: string) => {
  const remaining = get(annotationsAtom).filter((a) => a.id !== id)
  set(annotationsAtom, remaining)
  if (get(selectedAnnotationIdAtom) === id) set(selectedAnnotationIdAtom, null)
  // If the last undo step is the state from just before this annotation was added, drop it too, so
  // clicking around with the text tool doesn't leave undo steps that do nothing.
  const history = get(historyAtom)
  const last = history[history.length - 1]
  if (last && last.length === remaining.length && last.every((a, i) => a === remaining[i])) {
    set(historyAtom, history.slice(0, -1))
  }
})
