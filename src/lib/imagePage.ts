import exifr from 'exifr'
import type { PDFDocument } from 'pdf-lib'
import type { ImageKind } from './fileKinds'
import { rotatePage } from './rotatePage'

/**
 * Images without a real print resolution (screenshots, phone photos, which say 72 or 96 DPI or
 * nothing) get 1 pixel = 1 point, shrunk if needed to fit a Letter page (8.5 × 11 in) in the
 * image's own orientation. Otherwise a 12-megapixel phone photo would become a 56 × 42 inch page.
 */
const LETTER = { short: 612, long: 792 }
/** A recorded resolution at or below this is a screen default, not a scan resolution. */
const SCREEN_DPI = 96
/** Largest page side PDF viewers reliably accept, in points (200 inches). */
const MAX_PAGE_SIDE = 14400
/**
 * EXIF Orientation value → clockwise page rotation that shows the image upright.
 * The mirrored variants (2, 4, 5, 7) come out upright but still mirrored, because a page
 * rotation can't flip an image. Scanners and rear phone cameras don't produce them.
 */
const ROTATION_FOR_ORIENTATION: Record<number, number> = { 3: 180, 4: 180, 5: 90, 6: 90, 7: 270, 8: 270 }
/** Resolution unit → multiplier to get dots per inch. JFIF and EXIF number their units differently. */
const JFIF_UNIT_TO_DPI: Record<number, number> = { 1: 1, 2: 2.54 } // 0 means "aspect ratio only"
const EXIF_UNIT_TO_DPI: Record<number, number> = { 2: 1, 3: 2.54 } // 1 means "no unit"

interface ResolutionTags {
  XResolution?: number
  YResolution?: number
  ResolutionUnit?: number
}

/** The subset of exifr's output we use (with mergeOutput: false, translateValues: false). */
interface ExifrSegments {
  jfif?: ResolutionTags
  ifd0?: ResolutionTags & { Orientation?: number }
}

/**
 * Appends one page containing the image to `pdf`. Nothing is lost:
 * - a JPEG is stored as-is (pdf-lib's embedJpg keeps the original bytes, no re-compression);
 * - a PNG is decoded and stored losslessly (pdf-lib's embedPng), transparency included.
 * A JPEG's metadata picks the page size (from the scan DPI) and rotation (from EXIF).
 * `extraRotation` is the user's own clockwise rotation, applied on top of the EXIF one.
 */
export async function addImagePage(pdf: PDFDocument, bytes: Uint8Array, kind: ImageKind, extraRotation = 0) {
  const image = kind === 'jpeg' ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes)
  const { dpi, orientation } = kind === 'jpeg' ? await readJpegMetadata(bytes) : { dpi: null, orientation: 1 }
  const [width, height] = pageSize(image.width, image.height, dpi)

  const page = pdf.addPage([width, height])
  page.drawImage(image, { x: 0, y: 0, width, height })

  rotatePage(page, (ROTATION_FOR_ORIENTATION[orientation] ?? 0) + extraRotation)
}

/** Page size in points for an image of the given pixel size. */
function pageSize(pixelWidth: number, pixelHeight: number, dpi: [number, number] | null): [number, number] {
  let width: number
  let height: number
  if (dpi && Math.min(...dpi) > SCREEN_DPI) {
    // A scan: a 300 DPI letter-size scan becomes a letter-size page.
    width = (pixelWidth / dpi[0]) * 72
    height = (pixelHeight / dpi[1]) * 72
  } else {
    const [maxWidth, maxHeight] =
      pixelWidth > pixelHeight ? [LETTER.long, LETTER.short] : [LETTER.short, LETTER.long]
    const scale = Math.min(1, maxWidth / pixelWidth, maxHeight / pixelHeight)
    width = pixelWidth * scale
    height = pixelHeight * scale
  }
  const shrink = Math.min(1, MAX_PAGE_SIDE / Math.max(width, height))
  return [width * shrink, height * shrink]
}

async function readJpegMetadata(bytes: Uint8Array) {
  let meta: ExifrSegments | undefined
  try {
    meta = await exifr.parse(bytes, { jfif: true, mergeOutput: false, translateValues: false })
  } catch (err) {
    // Unreadable metadata only affects page size/rotation, never the image itself.
    console.warn('Could not read JPEG metadata; using defaults', err)
  }

  const dpi =
    dpiFrom(meta?.jfif, JFIF_UNIT_TO_DPI) ??
    dpiFrom({ ResolutionUnit: 2, ...meta?.ifd0 }, EXIF_UNIT_TO_DPI) // EXIF defaults to inches

  return { dpi, orientation: meta?.ifd0?.Orientation ?? 1 }
}

function dpiFrom(tags: ResolutionTags | undefined, unitToDpi: Record<number, number>): [number, number] | null {
  const factor = unitToDpi[tags?.ResolutionUnit ?? -1]
  if (!factor || !tags?.XResolution || !tags?.YResolution) return null
  const dpi: [number, number] = [tags.XResolution * factor, tags.YResolution * factor]
  // Ignore nonsense values (some software writes 1 DPI when it means "unknown").
  return dpi.every((d) => Number.isFinite(d) && d >= 10) ? dpi : null
}
