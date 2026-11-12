import { App, Upload } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import { useSetAtom } from 'jotai'
import { ACCEPTED_FILE_TYPES, detectFileKind, type FileKind } from '../lib/fileKinds'
import { addFilesAtom } from '../state/files'

export function FileDropzone() {
  const addFiles = useSetAtom(addFilesAtom)
  const { message } = App.useApp()

  const reportUnsupported = (names: string[]) => {
    if (names.length > 0) message.error(`Skipped ${names.join(', ')}: only PDF and JPG files are supported`)
  }

  return (
    <Upload.Dragger
      multiple
      accept={ACCEPTED_FILE_TYPES}
      showUploadList={false}
      onDrop={(e) => {
        // antd silently discards dropped files that don't match `accept`, so name them here.
        reportUnsupported(Array.from(e.dataTransfer.files).filter((f) => !detectFileKind(f)).map((f) => f.name))
      }}
      beforeUpload={(file, batch) => {
        // antd calls this once per file, passing the whole drop/selection as `batch`.
        // Handle the batch once (on its first file) so it can be added in sorted order.
        if (file === batch[0]) {
          const supported: { file: File; kind: FileKind }[] = []
          const unsupported: string[] = []
          for (const f of batch) {
            const kind = detectFileKind(f)
            if (kind) supported.push({ file: f, kind })
            else unsupported.push(f.name)
          }
          addFiles(supported)
          reportUnsupported(unsupported)
        }
        // The list lives in jotai; tell antd not to track or upload the file.
        return Upload.LIST_IGNORE
      }}
    >
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">Click or drag PDF or JPG files here</p>
    </Upload.Dragger>
  )
}
