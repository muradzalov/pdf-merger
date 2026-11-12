import { atom } from 'jotai'
import {
  annotationsAtom,
  checkpointAtom,
  discardAnnotationAtom,
  selectedAnnotationIdAtom,
  updateAnnotationAtom,
} from '../state'

interface TextEditing {
  id: string
  /**
   * Whether the next change still has to save an undo step. Saving it on the first change (not when
   * editing starts) gives one undo step per editing session, and none if nothing was typed.
   */
  needsCheckpoint: boolean
}

/** The text box being typed in, if any. One at a time, across all pages. */
export const editingTextAtom = atom<TextEditing | null>(null)

/**
 * Starts typing in a text box (and selects it). `isNew`: the box was just added, so adding it
 * already saved its undo step.
 */
export const startEditingAtom = atom(null, (get, set, { id, isNew }: { id: string; isNew: boolean }) => {
  const current = get(editingTextAtom)
  if (current?.id === id) return
  // Normally the previous box's textarea has already lost focus and stopped; this is a fallback.
  if (current) set(stopEditingAtom, current.id)
  set(editingTextAtom, { id, needsCheckpoint: !isNew })
  set(selectedAnnotationIdAtom, id)
})

/** Changes the text of the box being edited. */
export const editTextAtom = atom(null, (get, set, { id, text }: { id: string; text: string }) => {
  const editing = get(editingTextAtom)
  if (editing?.id !== id) return
  if (editing.needsCheckpoint) {
    set(checkpointAtom)
    set(editingTextAtom, { id, needsCheckpoint: false })
  }
  set(updateAnnotationAtom, { id, changes: { text } })
})

/** Stops typing in a box. A box left empty is removed. */
export const stopEditingAtom = atom(null, (get, set, id: string) => {
  // A late blur from a box that's no longer the one being edited must not stop the current one.
  if (get(editingTextAtom)?.id !== id) return
  set(editingTextAtom, null)
  const annotation = get(annotationsAtom).find((a) => a.id === id)
  if (annotation?.type === 'text' && annotation.text.trim() === '') set(discardAnnotationAtom, id)
})
