import { StandardFontEmbedder, StandardFonts } from 'pdf-lib'

/*
 * Text annotations are saved with Helvetica, one of the standard PDF fonts every viewer has, so no
 * font file needs embedding. On screen they're shown in Helvetica or Arial (Arial has the same
 * character widths) and positioned with layoutText(), which the export uses too, so the text lands
 * in the PDF where it was on screen.
 *
 * Limitation: Helvetica only covers Western European characters (WinAnsi). Check text with
 * unsupportedCharacters() and tell the user instead of letting the export fail.
 */

export const TEXT_FONT = StandardFonts.Helvetica
/** For CSS. Also set `font-kerning: none`: pdf-lib doesn't kern, so the browser shouldn't either. */
export const TEXT_FONT_FAMILY = 'Helvetica, Arial, sans-serif'
/** Distance between baselines, as a multiple of the font size. */
export const LINE_HEIGHT = 1.2

// pdf-lib's own metrics for Helvetica. Measuring needs no PDF document. (The cast: pdf-lib's
// StandardFonts and the FontNames type this takes are the same strings, typed separately.)
const helvetica = StandardFontEmbedder.for(TEXT_FONT as unknown as Parameters<typeof StandardFontEmbedder.for>[0])
// Helvetica's ascender and descender, as fractions of the font size. heightOfFontAtSize(1) is
// ascender + descender (0.925); without the descender it's the ascender alone (0.718).
const ASCENT = helvetica.heightOfFontAtSize(1, { descender: false })
const DESCENT = helvetica.heightOfFontAtSize(1) - ASCENT

function isSupported(char: string): boolean {
  try {
    helvetica.encodeText(char)
    return true
  } catch {
    return false
  }
}

/** Characters in `text` that can't be saved with Helvetica, e.g. emoji, Cyrillic, 'ş', 'ə'. */
export function unsupportedCharacters(text: string): string[] {
  const unsupported = new Set<string>()
  for (const char of text) {
    if (char !== '\n' && !isSupported(char)) unsupported.add(char)
  }
  return [...unsupported]
}

/** Width of one line in points, without kerning (matching how pdf-lib's drawText writes it). */
export function lineWidth(line: string, fontSize: number): number {
  let width = 0
  for (const char of line) {
    // Unsupported characters can't be measured; they count as zero width.
    if (isSupported(char)) width += helvetica.widthOfTextAtSize(char, fontSize)
  }
  return width
}

export interface TextLayout {
  lines: string[]
  /** Box size in points: the longest line, and lines × line height. */
  width: number
  height: number
  /** Each line's baseline, in points from the top of the box. */
  baselines: number[]
}

/**
 * Lays out a text annotation. Each line gets a box LINE_HEIGHT × fontSize tall, with the glyphs
 * (ascent + descent) centered in it, like CSS line-height does.
 */
export function layoutText(text: string, fontSize: number): TextLayout {
  const lines = text.split('\n')
  const lineHeight = fontSize * LINE_HEIGHT
  const firstBaseline = (lineHeight - (ASCENT + DESCENT) * fontSize) / 2 + ASCENT * fontSize
  return {
    lines,
    width: Math.max(...lines.map((line) => lineWidth(line, fontSize))),
    height: lines.length * lineHeight,
    baselines: lines.map((_, i) => firstBaseline + i * lineHeight),
  }
}
