import { degrees, type PDFPage } from 'pdf-lib'

/** Adds a clockwise rotation on top of whatever rotation the page already has. */
export function rotatePage(page: PDFPage, clockwise: number) {
  if (clockwise % 360 === 0) return
  // Normalize to 0-359; some PDFs store negative /Rotate values.
  const total = (((page.getRotation().angle + clockwise) % 360) + 360) % 360
  page.setRotation(degrees(total))
}
