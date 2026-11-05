import { atom } from 'jotai'
import { arrayMove } from '@dnd-kit/sortable'
import type { FileKind } from '../lib/fileKinds'

export interface QueuedFile {
  id: string
  file: File
  kind: FileKind
}

/** The files to merge, in the order their pages will appear in the output PDF. */
export const filesAtom = atom<QueuedFile[]>([])

export const addFileAtom = atom(null, (get, set, queued: QueuedFile) => {
  set(filesAtom, [...get(filesAtom), queued])
})

export const removeFileAtom = atom(null, (get, set, id: string) => {
  set(filesAtom, get(filesAtom).filter((f) => f.id !== id))
})

export const clearFilesAtom = atom(null, (_get, set) => {
  set(filesAtom, [])
})

export const moveFileAtom = atom(null, (get, set, move: { fromId: string; toId: string }) => {
  const files = get(filesAtom)
  const from = files.findIndex((f) => f.id === move.fromId)
  const to = files.findIndex((f) => f.id === move.toId)
  if (from === -1 || to === -1) return
  set(filesAtom, arrayMove(files, from, to))
})
