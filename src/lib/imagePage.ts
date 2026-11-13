import exifr from 'exifr'
import type { PDFDocument } from 'pdf-lib'
import type { ImageKind } from './fileKinds'
import { rotatePage } from './rotatePage'

/**
 * Images without a real print resolution (screenshots, phone photos, which say 72 or 96 DPI or
 * nothing) go on a Letter page (8.5 × 11 in) turned to match the image, scaled to fit inside a
 * half-inch margin and centered, like printing a photo. So every page comes out the same size,
 * whatever the image's pixel size.
 */
const LETTER = { short: 612, long: 792 }
const MARGIN = 36
/**
 * The page shape for an image. 'auto': Letter in the image's own orientation (or, for a scan, the
 * scanned paper's size). 'portrait' / 'landscape': a Letter page in that orientation, whatever the
 * image, with the image fitted inside it. Unlike rotating, this never turns the image itself.
 */
export type PageOrientation = 'auto' | 'portrait' | 'landscape'

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
 * `pageOrientation` is the shape the page should have as the image is seen (after EXIF rotation).
 */
export async function addImagePage(
  pdf: PDFDocument,
  bytes: Uint8Array,
  kind: ImageKind,
  extraRotation = 0,
  pageOrientation: PageOrientation = 'auto',
) {
  const image = kind === 'jpeg' ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes)
  const { dpi, orientation } = kind === 'jpeg' ? await readJpegMetadata(bytes) : { dpi: null, orientation: 1 }
  const exifRotation = ROTATION_FOR_ORIENTATION[orientation] ?? 0
  // The page is laid out as the image is stored, then turned by the EXIF rotation. A quarter turn
  // (a phone photo taken upright) swaps portrait and landscape, so ask for the opposite here.
  const storedOrientation =
    exifRotation % 180 === 0 || pageOrientation === 'auto'
      ? pageOrientation
      : pageOrientation === 'portrait'
        ? 'landscape'
        : 'portrait'
  const { pageWidth, pageHeight, x, y, width, height } = layout(image.width, image.height, dpi, storedOrientation)

  const page = pdf.addPage([pageWidth, pageHeight])
  page.drawImage(image, { x, y, width, height })

  rotatePage(page, exifRotation + extraRotation)
}

/** The page size, and where the image goes on it, in points. */
function layout(pixelWidth: number, pixelHeight: number, dpi: [number, number] | null, orientation: PageOrientation) {
  if (orientation === 'auto' && dpi && Math.min(...dpi) > SCREEN_DPI) {
    // A scan: the page is the scanned paper's size (a 300 DPI letter scan becomes a letter page),
    // and the image fills it. It's already a page, so no margin.
    const shrink = Math.min(1, MAX_PAGE_SIDE / (Math.max(pixelWidth / dpi[0], pixelHeight / dpi[1]) * 72))
    const width = (pixelWidth / dpi[0]) * 72 * shrink
    const height = (pixelHeight / dpi[1]) * 72 * shrink
    return { pageWidth: width, pageHeight: height, x: 0, y: 0, width, height }
  }

  const landscape = orientation === 'auto' ? pixelWidth > pixelHeight : orientation === 'landscape'
  const [pageWidth, pageHeight] = landscape ? [LETTER.long, LETTER.short] : [LETTER.short, LETTER.long]
  // Scaled up or down to fit. Only the size it's shown at changes; the pixels are stored as-is.
  const scale = Math.min((pageWidth - 2 * MARGIN) / pixelWidth, (pageHeight - 2 * MARGIN) / pixelHeight)
  const width = pixelWidth * scale
  const height = pixelHeight * scale
  return { pageWidth, pageHeight, x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height }
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
