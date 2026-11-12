import type { InkShape } from './types'

// The signature stays in this browser's localStorage, like everything else in the app it never
// leaves the device. Storage can be blocked (private windows, site settings) or full, so every
// access is wrapped: without storage the signature pad still works, it just can't remember.
const STORAGE_KEY = 'pdf-merger:signature'

/** The remembered signature, or null if there's none or it can't be read. */
export function loadSignature(): InkShape | null {
  try {
    const json = localStorage.getItem(STORAGE_KEY)
    if (!json) return null
    const value: unknown = JSON.parse(json)
    return isInkShape(value) ? value : null
  } catch (err) {
    console.warn('Could not read the saved signature', err)
    return null
  }
}

export function saveSignature({ path, viewBoxWidth, viewBoxHeight }: InkShape) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ path, viewBoxWidth, viewBoxHeight }))
  } catch (err) {
    console.warn('Could not save the signature', err)
  }
}

export function forgetSignature() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn('Could not remove the saved signature', err)
  }
}

// Whatever is stored ends up in an SVG path and in the exported PDF, so don't trust it blindly.
function isInkShape(value: unknown): value is InkShape {
  if (typeof value !== 'object' || value === null) return false
  const { path, viewBoxWidth, viewBoxHeight } = value as Record<string, unknown>
  return (
    typeof path === 'string' &&
    path.length > 0 &&
    typeof viewBoxWidth === 'number' &&
    viewBoxWidth > 0 &&
    typeof viewBoxHeight === 'number' &&
    viewBoxHeight > 0
  )
}
