import { PDFDocument } from 'pdf-lib'
// The legacy build: the default build of pdf.js 6 relies on JavaScript features only the newest
// browsers have (e.g. Map.getOrInsertComputed, Baseline 2026). This one includes polyfills, so it
// also runs in e.g. Safari 18 and Chrome 125.
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import type { FileKind, ImageKind } from '../lib/fileKinds'
import { addImagePage } from '../lib/imagePage'
import { loadUnencryptedPdf } from '../lib/loadPdf'
import type { EditorDocument, EditorPage, Matrix } from './types'

GlobalWorkerOptions.workerSrc = workerUrl

// pdf.js loads these on demand, by file name, from a folder URL. vite.config.ts (copyPdfjsAssets)
// copies them into the build; `npm run dev` serves them straight from node_modules.
const pdfjsAssets = import.meta.env.DEV ? '/node_modules/pdfjs-dist/' : `${import.meta.env.BASE_URL}pdfjs/`

/**
 * Reads a PDF or image file into an EditorDocument (an image becomes a one-page PDF).
 * Throws if the file is damaged, or is an encrypted PDF (with ENCRYPTED_PDF_MESSAGE).
 */
export async function openEditorDocument(file: File, kind: FileKind): Promise<EditorDocument> {
  const fileBytes = new Uint8Array(await file.arrayBuffer())
  let bytes: Uint8Array
  if (kind !== 'pdf') {
    bytes = await imageToPdf(fileBytes, kind)
  } else {
    // Refuse encrypted PDFs now, not after the user has annotated a file that can't be saved.
    await loadUnencryptedPdf(fileBytes)
    bytes = fileBytes
  }

  const loadingTask = getDocument({
    // A copy: pdf.js takes over (detaches) the buffer it's given, and `bytes` is needed for saving.
    data: bytes.slice(),
    // Decoders for JPEG 2000, JBIG2 and CCITT fax images. Scanned PDFs use them a lot; without
    // them those images are left out.
    wasmUrl: `${pdfjsAssets}wasm/`,
    // Fonts for PDFs that use a standard font without embedding it (see copyPdfjsAssets).
    standardFontDataUrl: `${pdfjsAssets}standard_fonts/`,
  })
  try {
    const pdf = await loadingTask.promise
    const pdfPages = await Promise.all(Array.from({ length: pdf.numPages }, (_, i) => pdf.getPage(i + 1)))
    const pages = pdfPages.map((page): EditorPage => {
      const { width, height, transform } = page.getViewport({ scale: 1 })
      return { width, height, transform: transform as Matrix }
    })
    return { name: file.name, bytes, pdf, pages }
  } catch (err) {
    void loadingTask.destroy()
    throw err
  }
}

/** The image as a one-page PDF, sized and rotated the same way the Merge tab does it. */
async function imageToPdf(imageBytes: Uint8Array, kind: ImageKind): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  await addImagePage(pdf, imageBytes, kind)
  return pdf.save()
}
