import { Button, List, Space, Typography } from 'antd'
import { DeleteOutlined, FileImageOutlined, FilePdfOutlined, HolderOutlined } from '@ant-design/icons'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useSetAtom } from 'jotai'
import { removeFileAtom, type QueuedFile } from '../state/files'

export function FileListItem({ queued }: { queued: QueuedFile }) {
  const removeFile = useSetAtom(removeFileAtom)
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: queued.id })
  const { file, kind } = queued

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <List.Item
        actions={[
          <Button key="delete" type="text" danger icon={<DeleteOutlined />} onClick={() => removeFile(queued.id)} />,
        ]}
      >
        <Space>
          <HolderOutlined style={{ cursor: 'grab' }} {...attributes} {...listeners} />
          {kind === 'jpeg' ? <FileImageOutlined /> : <FilePdfOutlined />}
          <Typography.Text>{file.name}</Typography.Text>
          <Typography.Text type="secondary">({(file.size / 1024).toFixed(1)} KB)</Typography.Text>
        </Space>
      </List.Item>
    </div>
  )
}
