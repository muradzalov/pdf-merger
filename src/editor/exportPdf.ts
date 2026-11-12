import {
  AnnotationFlags,
  BlendMode,
  PDFArray,
  PDFDict,
  type PDFDocument,
  type PDFFont,
  PDFName,
  PDFNumber,
  type PDFObject,
  type PDFPage,
  PDFRef,
  PDFStream,
  concatTransformationMatrix,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
  rgb,
} from 'pdf-lib'
import { loadUnencryptedPdf } from '../lib/loadPdf'
import { HIGHLIGHT_OPACITY } from './constants'
import { TEXT_FONT, layoutText, unsupportedCharacters } from './textMetrics'
import type { Annotation, EditorDocument, Matrix } from './types'

/** Writes the annotations into the PDF and returns the new PDF's bytes. */
export async function exportEditedPdf(
  doc: Pick<EditorDocument, 'bytes' | 'pages'>,
  annotations: Annotation[],
): Promise<Uint8Array> {
  checkCharacters(annotations)
  const pdf = await loadUnencryptedPdf(doc.bytes)
  if (annotations.length > 0) flattenFormFields(pdf)
  const font = await pdf.embedFont(TEXT_FONT)

  for (const [pageIndex, pageAnnotations] of groupByPage(annotations)) {
    const page = pdf.getPage(pageIndex)
    const { transform, height } = doc.pages[pageIndex]
    // pdf-lib wraps the page's existing content in q/Q before appending to it, so whatever state
    // that content leaves behind (an unbalanced cm, a fill color) doesn't reach this. Inside, one cm
    // lets everything below be drawn in page points with y up, as if the page had no /Rotate and
    // no crop box offset.
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...yUpPagePointsToUserSpace(transform, height)))
    for (const annotation of pageAnnotations) drawAnnotation(page, annotation, height, font)
    page.pushOperators(popGraphicsState())
  }

  // By default save() creates missing field appearances, which flattenFormFields already tried; if
  // that failed, trying again here would fail the whole export.
  return pdf.save({ updateFieldAppearances: false })
}

function checkCharacters(annotations: Annotation[]) {
  const unsupported = new Set<string>()
  for (const annotation of annotations) {
    if (annotation.type === 'text') unsupportedCharacters(annotation.text).forEach((char) => unsupported.add(char))
  }
  if (unsupported.size > 0) {
    // JSON.stringify makes invisible ones like a tab readable ("\t").
    const list = [...unsupported].map((char) => JSON.stringify(char)).join(', ')
    throw new Error(`The text contains characters that can't be saved in the PDF: ${list}. Remove them and try again.`)
  }
}

/** Annotations per page, in stacking order: highlights first, then the rest, each in array order. */
function groupByPage(annotations: Annotation[]): Map<number, Annotation[]> {
  const ordered = [
    ...annotations.filter((a) => a.type === 'highlight'),
    ...annotations.filter((a) => a.type !== 'highlight'),
  ]
  const byPage = new Map<number, Annotation[]>()
  for (const annotation of ordered) {
    const list = byPage.get(annotation.pageIndex) ?? []
    list.push(annotation)
    byPage.set(annotation.pageIndex, list)
  }
  return byPage
}

/**
 * The cm matrix that maps page points with y up, (x, height - y), to PDF user space: the inverse
 * of [the viewport transform, then flipping y].
 */
function yUpPagePointsToUserSpace(viewportTransform: Matrix, height: number): Matrix {
  const [a, b, c, d, e, f] = viewportTransform
  // The viewport transform followed by (x, y) -> (x, height - y).
  const [fa, fb, fc, fd, fe, ff] = [a, -b, c, -d, e, height - f]
  const det = fa * fd - fb * fc
  return [fd / det, -fb / det, -fc / det, fa / det, (fc * ff - fd * fe) / det, (fb * fe - fa * ff) / det]
}

/** Draws one annotation, in y-up page points (see yUpPagePointsToUserSpace). */
function drawAnnotation(page: PDFPage, annotation: Annotation, pageHeight: number, font: PDFFont) {
  const color = hexToRgb(annotation.color)

  switch (annotation.type) {
    case 'highlight':
      page.drawRectangle({
        x: annotation.x,
        y: pageHeight - annotation.y - annotation.height,
        width: annotation.width,
        height: annotation.height,
        color,
        opacity: HIGHLIGHT_OPACITY,
        blendMode: BlendMode.Multiply,
      })
      break

    case 'ink':
      // drawSvgPath flips the path's y-down coordinates itself, around the given (x, y).
      page.drawSvgPath(quadraticsToCubics(annotation.path), {
        x: annotation.x,
        y: pageHeight - annotation.y,
        scale: annotation.width / annotation.viewBoxWidth,
        color,
      })
      break

    case 'text': {
      const { lines, baselines } = layoutText(annotation.text, annotation.fontSize)
      lines.forEach((line, i) => {
        page.drawText(line, {
          x: annotation.x,
          y: pageHeight - annotation.y - baselines[i],
          size: annotation.fontSize,
          font,
          color,
        })
      })
      break
    }
  }
}

function hexToRgb(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`Unsupported color: ${hex}`)
  const channel = (start: number) => parseInt(hex.slice(start, start + 2), 16) / 255
  return rgb(channel(1), channel(3), channel(5))
}

/**
 * Rewrites an ink path's quadratic curves (Q) as the identical cubic ones (C). pdf-lib 1.17 draws Q
 * with PDF's `v` operator, which is a different curve: its strokes would come out slightly off from
 * the screen, by points on large curves. Ink paths contain only absolute M, Q and Z (see ink.ts).
 */
function quadraticsToCubics(path: string): string {
  const tokens = path.match(/[MQZ]|-?[\d.]+(?:e[-+]?\d+)?/gi) ?? []
  const next = () => Number(tokens.shift())
  const commands: string[] = []
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  while (tokens.length > 0) {
    const command = tokens.shift()
    if (command === 'M') {
      x = startX = next()
      y = startY = next()
      commands.push(`M ${x} ${y}`)
    } else if (command === 'Q') {
      const [cx, cy, endX, endY] = [next(), next(), next(), next()]
      // A quadratic's cubic control points are 2/3 of the way from each end to its control point.
      commands.push(
        `C ${x + (2 / 3) * (cx - x)} ${y + (2 / 3) * (cy - y)} ` +
          `${endX + (2 / 3) * (cx - endX)} ${endY + (2 / 3) * (cy - endY)} ${endX} ${endY}`,
      )
      x = endX
      y = endY
    } else if (command === 'Z') {
      commands.push('Z')
      x = startX
      y = startY
    } else {
      throw new Error(`Unexpected ink path command: ${command}`)
    }
  }
  return commands.join(' ')
}

/**
 * Form fields are widget annotations, which viewers draw on top of the page content, so a field with
 * a background would hide text typed over it. The editor shows them underneath (pdf.js paints them
 * into the page canvas), so draw them into the page content first, under the annotations, and remove
 * them. The fields stop being fillable.
 *
 * Not pdf-lib's form.flatten(): in 1.17 it ignores an appearance's BBox and Matrix (misplacing fields
 * on rotated pages), throws on a field without an appearance, draws hidden fields, and misses widgets
 * on pages copied without their form (as the merge does).
 */
function flattenFormFields(pdf: PDFDocument) {
  try {
    // A field with a value but no appearance would lose its value, so let pdf-lib create the missing
    // appearances (in Helvetica). It keeps existing ones, since no values were changed, so fields
    // filled in other apps look the same. (getForm() would add an empty form to a PDF without one.)
    if (pdf.catalog.getAcroForm()) pdf.getForm().updateFieldAppearances()

    const isWidget = (annot: PDFObject) =>
      pdf.context.lookupMaybe(annot, PDFDict)?.get(PDFName.of('Subtype')) === PDFName.of('Widget')
    for (const page of pdf.getPages()) {
      const annots = page.node.Annots()?.asArray() ?? []
      if (!annots.some(isWidget)) continue
      for (const widget of annots.filter(isWidget)) drawWidget(page, pdf.context.lookup(widget, PDFDict))
      page.node.set(PDFName.of('Annots'), pdf.context.obj(annots.filter((annot) => !isWidget(annot))))
    }
    pdf.catalog.delete(PDFName.of('AcroForm'))
  } catch (err) {
    // E.g. a value Helvetica can't encode. The form stays (at least partly) fillable.
    console.warn('Could not flatten the form fields, so they may cover annotations', err)
  }
}

/** Draws a widget's appearance into the page content where, and only if, pdf.js would draw it. */
function drawWidget(page: PDFPage, widget: PDFDict) {
  const context = widget.context
  const flags = widget.lookupMaybe(PDFName.of('F'), PDFNumber)?.asNumber() ?? 0
  if (flags & (AnnotationFlags.Hidden | AnnotationFlags.NoView)) return

  // Check boxes and radio buttons have an appearance per state; /AS names the one shown.
  let appearanceRef = widget.lookupMaybe(PDFName.of('AP'), PDFDict)?.get(PDFName.of('N'))
  const states = context.lookup(appearanceRef)
  if (states instanceof PDFDict) {
    const state = widget.lookupMaybe(PDFName.of('AS'), PDFName)
    appearanceRef = state && states.get(state)
  }
  const appearance = context.lookup(appearanceRef)
  if (!(appearanceRef instanceof PDFRef) || !(appearance instanceof PDFStream)) return

  // Like every viewer (PDF spec 12.5.5): the BBox, after the appearance's Matrix, is stretched over
  // the widget's Rect. Do applies the Matrix itself; this cm does the stretching.
  const numbers = (dict: PDFDict, key: string) =>
    dict.lookupMaybe(PDFName.of(key), PDFArray)?.asArray().map((n) => context.lookup(n, PDFNumber).asNumber())
  const rect = numbers(widget, 'Rect')
  const bbox = numbers(appearance.dict, 'BBox')
  if (!rect || !bbox) return
  const [a, b, c, d, e, f] = numbers(appearance.dict, 'Matrix') ?? [1, 0, 0, 1, 0, 0]
  const [bx0, by0, bx1, by1] = bbox
  const corners = [[bx0, by0], [bx1, by0], [bx0, by1], [bx1, by1]]
  const xs = corners.map(([x, y]) => a * x + c * y + e)
  const ys = corners.map(([x, y]) => b * x + d * y + f)
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  // The appearance is clipped to its BBox, so an empty one shows nothing.
  if (maxX <= minX || maxY <= minY) return
  const [rx0, ry0, rx1, ry1] = rect
  const [left, bottom] = [Math.min(rx0, rx1), Math.min(ry0, ry1)]
  const scaleX = Math.abs(rx1 - rx0) / (maxX - minX)
  const scaleY = Math.abs(ry1 - ry0) / (maxY - minY)
  const name = page.node.newXObject('FlatWidget', appearanceRef)
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(scaleX, 0, 0, scaleY, left - minX * scaleX, bottom - minY * scaleY),
    drawObject(name),
    popGraphicsState(),
  )
}
