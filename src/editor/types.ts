import type { PDFDocumentProxy } from 'pdfjs-dist'

/*
 * Edits the user places on a PDF in the editor.
 *
 * All positions and sizes are in PAGE POINTS: the page as it is displayed (after its /Rotate),
 * at 100% zoom, with the origin at the page's top-left corner and y pointing down.
 * 1 page point = 1 PDF point = 1/72 inch. Multiply by the zoom to get CSS pixels.
 *
 * Stacking order, on screen and in the saved PDF: highlights first (in array order), then
 * everything else in array order (so later annotations are on top).
 */

interface AnnotationBase {
  id: string
  /** 0-based index of the page the annotation is on. */
  pageIndex: number
  /** CSS hex color, e.g. '#000000'. */
  color: string
}

/**
 * Typed text, written with Helvetica (see textMetrics.ts). No wrapping: lines are separated by
 * '\n', and the box size follows the text (layoutText gives its width and height).
 */
export interface TextAnnotation extends AnnotationBase {
  type: 'text'
  /** Top-left corner of the text box. */
  x: number
  y: number
  text: string
  /** In points. */
  fontSize: number
}

/**
 * Pen strokes: freehand drawing or a placed signature. The strokes are one filled SVG path (the
 * outlines perfect-freehand produces, see ink.ts) in their own coordinate box of
 * viewBoxWidth x viewBoxHeight, drawn stretched into the box (x, y, width, height).
 * Resizing keeps the aspect ratio, so width / viewBoxWidth === height / viewBoxHeight.
 */
export interface InkAnnotation extends AnnotationBase {
  type: 'ink'
  x: number
  y: number
  width: number
  height: number
  /** Absolute M / Q / Z commands only, in viewBox coordinates (y down). */
  path: string
  viewBoxWidth: number
  viewBoxHeight: number
}

/** A translucent rectangle multiplied over the page, so the text underneath stays readable. */
export interface HighlightAnnotation extends AnnotationBase {
  type: 'highlight'
  x: number
  y: number
  width: number
  height: number
}

export type Annotation = TextAnnotation | InkAnnotation | HighlightAnnotation

/** Pen strokes not yet placed on a page, e.g. a signature from the signature pad. */
export type InkShape = Pick<InkAnnotation, 'path' | 'viewBoxWidth' | 'viewBoxHeight'>

/**
 * select:    click to select, drag to move, handles to resize
 * text:      click an empty spot to add a text box, click a text box to edit it
 * draw:      freehand pen (each stroke becomes one ink annotation)
 * highlight: drag a rectangle
 * signature: click to place pendingSignatureAtom
 */
export type EditorTool = 'select' | 'text' | 'draw' | 'highlight' | 'signature'

export type Matrix = [number, number, number, number, number, number]

export interface EditorPage {
  /** Displayed size in page points (after /Rotate, at 100% zoom). */
  width: number
  height: number
  /**
   * pdf.js `page.getViewport({ scale: 1 }).transform`: maps PDF user-space coordinates to page
   * points. It accounts for /Rotate and the crop box offset. exportPdf inverts it to write the
   * annotations back into the PDF.
   */
  transform: Matrix
}

export interface EditorDocument {
  /** Name of the file that was opened, e.g. "form.pdf" or "scan.jpg". */
  name: string
  /**
   * The PDF's bytes, kept for exporting with pdf-lib (a JPG is converted to a one-page PDF when
   * opened). Never give this array to pdf.js directly: pdf.js detaches the buffer it's given, so
   * pass it a copy (`bytes.slice()`).
   */
  bytes: Uint8Array
  /** pdf.js document, for rendering. */
  pdf: PDFDocumentProxy
  pages: EditorPage[]
}
