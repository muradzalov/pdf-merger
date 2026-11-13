export type FileKind = 'pdf' | 'jpeg' | 'png'
export type ImageKind = Exclude<FileKind, 'pdf'>

/** For messages, e.g. "isn't a valid JPG". */
export const FILE_KIND_LABEL: Record<FileKind, string> = { pdf: 'PDF', jpeg: 'JPG', png: 'PNG' }

/**
 * Value for the file picker's `accept` attribute. antd also uses it to filter dropped
 * files, so keep it in sync with detectFileKind below.
 */
export const ACCEPTED_FILE_TYPES = '.pdf,.jpg,.jpeg,.jfif,.png,application/pdf,image/jpeg,image/png'

/** Works out what a file is from its MIME type, falling back to its extension. */
export function detectFileKind(file: File): FileKind | null {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf'
  if (file.type === 'image/jpeg' || /\.(jpe?g|jfif)$/i.test(file.name)) return 'jpeg'
  if (file.type === 'image/png' || /\.png$/i.test(file.name)) return 'png'
  return null
}
