import exifr from 'exifr'
import { degrees, type PDFDocument } from 'pdf-lib'

/** Resolution assumed when a JPEG doesn't record one: 1 pixel = 1 point. */
const DEFAULT_DPI = 72
/** Largest page side PDF viewers reliably accept, in points (200 inches). */
const MAX_PAGE_SIDE = 14400
/** EXIF Orientation value → clockwise page rotation that shows the image upright. */
const ROTATION_FOR_ORIENTATION: Record<number, number> = { 3: 180, 6: 90, 8: 270 }
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
 * Appends one page containing the JPEG to `pdf`.
 *
 * pdf-lib's embedJpg stores the JPEG bytes as-is (no decoding or re-compression),
 * so the PDF holds a bit-for-bit copy of the original image. The file's metadata is
 * only used to pick the page size (from the scan DPI) and page rotation.
 */
export async function addJpegPage(pdf: PDFDocument, bytes: Uint8Array): Promise<void> {
  const image = await pdf.embedJpg(bytes)
  const { dpiX, dpiY, orientation } = await readJpegMetadata(bytes)

  let width = (image.width / dpiX) * 72
  let height = (image.height / dpiY) * 72
  const shrink = Math.min(1, MAX_PAGE_SIDE / Math.max(width, height))
  width *= shrink
  height *= shrink

  const page = pdf.addPage([width, height])
  page.drawImage(image, { x: 0, y: 0, width, height })

  const rotation = ROTATION_FOR_ORIENTATION[orientation]
  if (rotation) page.setRotation(degrees(rotation))
}

async function readJpegMetadata(bytes: Uint8Array) {
  let meta: ExifrSegments | undefined
  try {
    meta = await exifr.parse(bytes, { jfif: true, mergeOutput: false, translateValues: false })
  } catch (err) {
    // Unreadable metadata only affects page size/rotation, never the image itself.
    console.warn('Could not read JPEG metadata; using defaults', err)
  }

  const [dpiX, dpiY] =
    dpiFrom(meta?.jfif, JFIF_UNIT_TO_DPI) ??
    dpiFrom({ ResolutionUnit: 2, ...meta?.ifd0 }, EXIF_UNIT_TO_DPI) ?? // EXIF defaults to inches
    [DEFAULT_DPI, DEFAULT_DPI]

  return { dpiX, dpiY, orientation: meta?.ifd0?.Orientation ?? 1 }
}

function dpiFrom(tags: ResolutionTags | undefined, unitToDpi: Record<number, number>): [number, number] | null {
  const factor = unitToDpi[tags?.ResolutionUnit ?? -1]
  if (!factor || !tags?.XResolution || !tags?.YResolution) return null
  const dpi: [number, number] = [tags.XResolution * factor, tags.YResolution * factor]
  // Ignore nonsense values (some software writes 1 DPI when it means "unknown").
  return dpi.every((d) => Number.isFinite(d) && d >= 10) ? dpi : null
}
