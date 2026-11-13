import { atom } from 'jotai'
import { arrayMove } from '@dnd-kit/sortable'
import type { FileKind } from '../lib/fileKinds'
import type { PageOrientation } from '../lib/imagePage'
import { compareFileNames } from '../lib/fileOrder'

export type Rotation = 0 | 90 | 180 | 270

export interface QueuedFile {
  id: string
  file: File
  kind: FileKind
  /** Extra clockwise rotation applied to every page of this file. */
  rotation: Rotation
  /** For images: the page's shape (see PageOrientation). Ignored for PDFs. */
  pageOrientation: PageOrientation
}

/** The files to merge, in the order their pages will appear in the output PDF. */
export const filesAtom = atom<QueuedFile[]>([])

let nextId = 0

/**
 * Appends a batch of files (one drop or one file-picker selection), sorted by name.
 * Browsers hand dropped files over in no reliable order (Windows Explorer puts the file you
 * grabbed first), so sorting each batch makes adding files predictable.
 */
export const addFilesAtom = atom(null, (get, set, batch: { file: File; kind: FileKind }[]) => {
  const added = [...batch]
    .sort((a, b) => compareFileNames(a.file, b.file))
    .map(({ file, kind }): QueuedFile => ({ id: `file-${nextId++}`, file, kind, rotation: 0, pageOrientation: 'auto' }))
  set(filesAtom, [...get(filesAtom), ...added])
})

/** Sorts the whole list by file name. */
export const sortFilesAtom = atom(null, (get, set) => {
  set(filesAtom, [...get(filesAtom)].sort((a, b) => compareFileNames(a.file, b.file)))
})

export const removeFileAtom = atom(null, (get, set, id: string) => {
  set(filesAtom, get(filesAtom).filter((f) => f.id !== id))
})

export const rotateFileAtom = atom(null, (get, set, id: string) => {
  set(
    filesAtom,
    get(filesAtom).map((f) => (f.id === id ? { ...f, rotation: ((f.rotation + 90) % 360) as Rotation } : f)),
  )
})

export const setPageOrientationAtom = atom(
  null,
  (get, set, { id, pageOrientation }: { id: string; pageOrientation: PageOrientation }) => {
    set(filesAtom, get(filesAtom).map((f) => (f.id === id ? { ...f, pageOrientation } : f)))
  },
)

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
