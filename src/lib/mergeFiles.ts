import { PDFDocument } from 'pdf-lib'
import type { QueuedFile } from '../state/files'
import { addJpegPage } from './jpegPage'

export interface MergeResult {
  /** The merged PDF, or null if no file could be read. */
  pdfBytes: Uint8Array | null
  failed: { name: string; reason: string }[]
}

/** Combines the files, in order, into one PDF. Files that fail are skipped and reported. */
export async function mergeFiles(files: QueuedFile[]): Promise<MergeResult> {
  const merged = await PDFDocument.create()
  const failed: MergeResult['failed'] = []

  for (const { file, kind } of files) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (kind === 'jpeg') await addJpegPage(merged, bytes)
      else await appendPdfPages(merged, bytes)
    } catch (err) {
      console.error(`Could not add ${file.name}`, err)
      failed.push({ name: file.name, reason: err instanceof Error ? err.message : String(err) })
    }
  }

  const pdfBytes = merged.getPageCount() > 0 ? await merged.save() : null
  return { pdfBytes, failed }
}

async function appendPdfPages(target: PDFDocument, bytes: Uint8Array) {
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false })
  const pages = await target.copyPages(source, source.getPageIndices())
  pages.forEach((page) => target.addPage(page))
}
