// Natural, case-insensitive order: "IMG_2.jpg" sorts before "IMG_10.jpg", "a.pdf" next to "A.pdf".
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

const withoutExtension = (name: string) => name.replace(/\.[^.]*$/, '')

/**
 * Orders files the way Windows Explorer does: by name without the extension first, so
 * "Scan.jpg" comes before "Scan (2).jpg", then by full name to break ties.
 */
export function compareFileNames(a: File, b: File): number {
  return collator.compare(withoutExtension(a.name), withoutExtension(b.name)) || collator.compare(a.name, b.name)
}
