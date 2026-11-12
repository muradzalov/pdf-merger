import { PDFDocument } from 'pdf-lib'

export const ENCRYPTED_PDF_MESSAGE =
  'password-protected or restricted PDF. Open it and use Print → Save as PDF to make a copy that can be merged or edited'

/**
 * Loads a PDF with pdf-lib, refusing encrypted ones. pdf-lib can't decrypt, and copying or editing
 * pages of an encrypted PDF silently produces blank pages. That includes "restricted" PDFs (e.g.
 * bank statements) that open without a password.
 */
export async function loadUnencryptedPdf(bytes: Uint8Array): Promise<PDFDocument> {
  let pdf: PDFDocument
  try {
    pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false })
  } catch (err) {
    // Some encrypted PDFs (e.g. AES) can't even be parsed; say why instead of showing a parser error.
    if (/\/Encrypt\b/.test(new TextDecoder('latin1').decode(bytes))) throw new Error(ENCRYPTED_PDF_MESSAGE)
    throw err
  }
  if (pdf.isEncrypted) throw new Error(ENCRYPTED_PDF_MESSAGE)
  return pdf
}
