export type FileKind = 'pdf' | 'jpeg'

/** Value for the file picker's `accept` attribute. */
export const ACCEPTED_FILE_TYPES = '.pdf,.jpg,.jpeg,application/pdf,image/jpeg'

/** Works out what a file is from its MIME type, falling back to its extension. */
export function detectFileKind(file: File): FileKind | null {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf'
  if (file.type === 'image/jpeg' || /\.(jpe?g|jfif)$/i.test(file.name)) return 'jpeg'
  return null
}
