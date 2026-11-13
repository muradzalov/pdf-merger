import { useEffect } from 'react'
import { App, Upload } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import { useSetAtom, useStore } from 'jotai'
import { ACCEPTED_FILE_TYPES, detectFileKind, type FileKind } from '../lib/fileKinds'
import { addFilesAtom, filesAtom } from '../state/files'

export function FileDropzone() {
  const addFiles = useSetAtom(addFilesAtom)
  const store = useStore()
  const { message } = App.useApp()

  /** Adds one drop, file-picker selection or paste, and names the files that aren't supported. */
  const addBatch = (files: File[]) => {
    const supported: { file: File; kind: FileKind }[] = []
    const unsupported: string[] = []
    for (const file of files) {
      const kind = detectFileKind(file)
      if (kind) supported.push({ file, kind })
      else unsupported.push(file.name)
    }
    addFiles(supported)
    if (unsupported.length > 0) {
      message.error(`Skipped ${unsupported.join(', ')}: only PDF, JPG and PNG files are supported`)
    }
    return supported.length
  }

  // Ctrl+V anywhere on the Merge tab adds what's on the clipboard: a screenshot, an image copied
  // from a web page or document, or files copied in File Explorer.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const data = e.clipboardData
      const files = Array.from(data?.files ?? [])
      if (files.length === 0) return
      // Pasting into a text box (e.g. the output file name) pastes the text as usual. Copying from
      // Word or Excel puts both text and a picture of it on the clipboard; the text is meant there.
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea') && data?.types.includes('text/plain')) return

      e.preventDefault()
      const taken = store.get(filesAtom).map((queued) => queued.file.name)
      const added = addBatch(files.map((file) => withPastedName(file, taken)))
      if (added > 0) message.success(added === 1 ? 'Added the pasted image' : `Added ${added} pasted files`)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // No dependency list: re-attached after every render, so it always uses the current addBatch.
  })

  return (
    <Upload.Dragger
      multiple
      accept={ACCEPTED_FILE_TYPES}
      showUploadList={false}
      onDrop={(e) => {
        // antd silently discards dropped files that don't match `accept`, so name them here.
        const rejected = Array.from(e.dataTransfer.files).filter((f) => !detectFileKind(f))
        if (rejected.length > 0) {
          message.error(`Skipped ${rejected.map((f) => f.name).join(', ')}: only PDF, JPG and PNG files are supported`)
        }
      }}
      beforeUpload={(file, batch) => {
        // antd calls this once per file, passing the whole drop/selection as `batch`.
        // Handle the batch once (on its first file) so it can be added in sorted order.
        if (file === batch[0]) addBatch(batch)
        // The list lives in jotai; tell antd not to track or upload the file.
        return Upload.LIST_IGNORE
      }}
    >
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">Click or drag PDF, JPG or PNG files here</p>
      <p className="ant-upload-hint">Or paste screenshots and copied images with Ctrl+V</p>
    </Upload.Dragger>
  )
}

/**
 * Browsers name every pasted screenshot or copied image "image.png". Number them instead
 * ("Pasted image 1.png", "Pasted image 2.png", ...) so they can be told apart and keep their paste
 * order when sorted. Files copied in File Explorer keep their own names.
 */
function withPastedName(file: File, takenNames: string[]): File {
  if (!/^image\.\w+$/i.test(file.name)) return file
  const extension = file.name.slice(file.name.lastIndexOf('.'))
  let n = 1
  while (takenNames.includes(`Pasted image ${n}${extension}`)) n++
  const name = `Pasted image ${n}${extension}`
  takenNames.push(name)
  return new File([file], name, { type: file.type, lastModified: file.lastModified })
}
