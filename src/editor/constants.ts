// Shared look of annotations. The screen (AnnotationLayer) and the saved PDF (exportPdf) both read
// these, so what you see is what gets saved.

/** For text, freehand drawing and signatures. */
export const PEN_COLORS = [
  { name: 'Black', value: '#000000' },
  { name: 'Blue', value: '#1d39c4' },
  { name: 'Red', value: '#cf1322' },
] as const

export const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#ffe600' },
  { name: 'Green', value: '#52e052' },
  { name: 'Pink', value: '#ff66b3' },
  { name: 'Blue', value: '#4db8ff' },
] as const

/**
 * Highlights are drawn with this opacity AND multiply blending (CSS mix-blend-mode: multiply,
 * pdf-lib BlendMode.Multiply). Multiply keeps black text black; the opacity keeps the text visible
 * in the rare viewer that ignores blend modes.
 */
export const HIGHLIGHT_OPACITY = 0.5

/** Pen widths for the draw tool, in points. */
export const STROKE_WIDTHS = [
  { name: 'Thin', value: 1.5 },
  { name: 'Medium', value: 3 },
  { name: 'Thick', value: 6 },
] as const

/** Pen width used on the signature pad, in pad pixels (see SignaturePad). */
export const SIGNATURE_STROKE_WIDTH = 4

export const DEFAULT_FONT_SIZE = 12
export const MIN_FONT_SIZE = 6
export const MAX_FONT_SIZE = 72

/** Width a signature gets when it's first placed, in points (2.5 inches). */
export const DEFAULT_SIGNATURE_WIDTH = 180

export const MIN_ZOOM = 0.5
export const MAX_ZOOM = 3
