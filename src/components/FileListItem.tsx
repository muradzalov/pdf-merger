import type { CSSProperties } from 'react'
import { Button, List, Space, Tag, Tooltip, Typography, theme } from 'antd'
import {
  DeleteOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  HolderOutlined,
  RotateRightOutlined,
} from '@ant-design/icons'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useSetAtom } from 'jotai'
import { removeFileAtom, rotateFileAtom, type QueuedFile } from '../state/files'

export function FileListItem({ queued }: { queued: QueuedFile }) {
  const removeFile = useSetAtom(removeFileAtom)
  const rotateFile = useSetAtom(rotateFileAtom)
  const { token } = theme.useToken()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: queued.id })
  const { file, kind, rotation } = queued

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Keep the dragged row above its neighbours and opaque, so they don't show through it.
    position: 'relative',
    zIndex: isDragging ? 1 : undefined,
    background: isDragging ? token.colorBgContainer : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <List.Item
        actions={[
          <Tooltip key="rotate" title="Rotate 90° clockwise">
            <Button
              type="text"
              icon={<RotateRightOutlined />}
              aria-label={`Rotate ${file.name}`}
              onClick={() => rotateFile(queued.id)}
            />
          </Tooltip>,
          <Button
            key="delete"
            type="text"
            danger
            icon={<DeleteOutlined />}
            aria-label={`Remove ${file.name}`}
            onClick={() => removeFile(queued.id)}
          />,
        ]}
      >
        <Space>
          {/* touch-action: none lets touchscreens drag the handle instead of scrolling the page */}
          <HolderOutlined style={{ cursor: 'grab', touchAction: 'none' }} {...attributes} {...listeners} />
          {kind === 'jpeg' ? <FileImageOutlined /> : <FilePdfOutlined />}
          <Typography.Text>{file.name}</Typography.Text>
          <Typography.Text type="secondary">({(file.size / 1024).toFixed(1)} KB)</Typography.Text>
          {rotation !== 0 && <Tag color="blue">↻ {rotation}°</Tag>}
        </Space>
      </List.Item>
    </div>
  )
}
