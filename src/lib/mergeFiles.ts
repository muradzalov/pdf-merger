import { PDFDocument } from 'pdf-lib'
import type { QueuedFile } from '../state/files'
import { addJpegPage } from './jpegPage'
import { rotatePage } from './rotatePage'

export interface MergeResult {
  /** The merged PDF, or null if no file could be read. */
  pdfBytes: Uint8Array | null
  failed: { name: string; reason: string }[]
}

/** Combines the files, in order, into one PDF. Files that fail are skipped and reported. */
export async function mergeFiles(files: QueuedFile[]): Promise<MergeResult> {
  const merged = await PDFDocument.create()
  const failed: MergeResult['failed'] = []

  for (const { file, kind, rotation } of files) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (kind === 'jpeg') await addJpegPage(merged, bytes, rotation)
      else await appendPdfPages(merged, bytes, rotation)
    } catch (err) {
      console.error(`Could not add ${file.name}`, err)
      failed.push({ name: file.name, reason: err instanceof Error ? err.message : String(err) })
    }
  }

  const pdfBytes = merged.getPageCount() > 0 ? await merged.save() : null
  return { pdfBytes, failed }
}

const ENCRYPTED_PDF_MESSAGE =
  'password-protected or restricted PDF. Open it and use Print → Save as PDF to make a copy that can be merged'

async function appendPdfPages(target: PDFDocument, bytes: Uint8Array, rotation: number) {
  let source: PDFDocument
  try {
    source = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false })
  } catch (err) {
    // Some encrypted PDFs (e.g. AES) can't even be parsed; say why instead of showing a parser error.
    if (/\/Encrypt\b/.test(new TextDecoder('latin1').decode(bytes))) throw new Error(ENCRYPTED_PDF_MESSAGE)
    throw err
  }
  // pdf-lib can't decrypt, and copying pages out of an encrypted PDF silently produces blank
  // pages. That includes "restricted" PDFs (e.g. bank statements) that open without a password.
  if (source.isEncrypted) throw new Error(ENCRYPTED_PDF_MESSAGE)

  const pages = await target.copyPages(source, source.getPageIndices())
  for (const page of pages) {
    rotatePage(page, rotation)
    target.addPage(page)
  }
}
