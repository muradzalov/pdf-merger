/** Saves the bytes as a PDF through the browser's normal download flow. */
export function downloadPdf(bytes: Uint8Array, filename: string) {
  // pdf-lib always returns ArrayBuffer-backed bytes, but its types don't say so (TS 5.7+ is strict about this).
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // Give the browser time to start the download before releasing the memory.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
