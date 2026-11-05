import { App, Upload } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import { useSetAtom } from 'jotai'
import { ACCEPTED_FILE_TYPES, detectFileKind } from '../lib/fileKinds'
import { addFileAtom } from '../state/files'

export function FileDropzone() {
  const addFile = useSetAtom(addFileAtom)
  const { message } = App.useApp()

  return (
    <Upload.Dragger
      multiple
      accept={ACCEPTED_FILE_TYPES}
      showUploadList={false}
      beforeUpload={(file) => {
        const kind = detectFileKind(file)
        if (kind) addFile({ id: file.uid, file, kind })
        else message.error(`${file.name} is not a PDF or JPG file`)
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
