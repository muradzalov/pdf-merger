import { useEffect, useState, type CSSProperties } from 'react'
import { Button, Flex, List, Select, Tag, Tooltip, Typography, theme } from 'antd'
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
import type { PageOrientation } from '../lib/imagePage'
import { removeFileAtom, rotateFileAtom, setPageOrientationAtom, type QueuedFile } from '../state/files'

const PAGE_ORIENTATION_OPTIONS: { value: PageOrientation; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
]

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

export function FileListItem({ queued, onPreview }: { queued: QueuedFile; onPreview: () => void }) {
  const removeFile = useSetAtom(removeFileAtom)
  const rotateFile = useSetAtom(rotateFileAtom)
  const setPageOrientation = useSetAtom(setPageOrientationAtom)
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
        styles={{ actions: { marginInlineStart: token.marginSM } }}
        actions={[
          ...(kind !== 'pdf'
            ? [
                <Tooltip key="orientation" title="Page shape for this image">
                  <Select<PageOrientation>
                    size="small"
                    value={queued.pageOrientation}
                    onChange={(pageOrientation) => setPageOrientation({ id: queued.id, pageOrientation })}
                    options={PAGE_ORIENTATION_OPTIONS}
                    aria-label={`Page orientation for ${file.name}`}
                    style={{ width: 104 }}
                  />
                </Tooltip>,
              ]
            : []),
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
        <Flex align="center" gap="small" style={{ flex: 1, minWidth: 0 }}>
          {/* touch-action: none lets touchscreens drag the handle instead of scrolling the page */}
          <HolderOutlined style={{ cursor: 'grab', touchAction: 'none' }} {...attributes} {...listeners} />
          {/* Thumbnail and name together open the preview. */}
          <Tooltip title="Preview" mouseEnterDelay={0.6}>
            <button
              type="button"
              onClick={onPreview}
              aria-label={`Preview ${file.name}`}
              style={{
                all: 'unset',
                flex: 1,
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                gap: token.marginXS,
                cursor: 'zoom-in',
              }}
            >
              {kind === 'pdf' ? (
                <FilePdfOutlined style={{ fontSize: 24, color: token.colorError, width: 32, flexShrink: 0 }} />
              ) : (
                <ImageThumbnail file={file} rotation={rotation} />
              )}
              <span style={{ minWidth: 0 }}>
                <Typography.Text ellipsis style={{ display: 'block' }}>
                  {file.name}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {formatSize(file.size)}
                </Typography.Text>
              </span>
            </button>
          </Tooltip>
          {rotation !== 0 && <Tag color="blue">↻ {rotation}°</Tag>}
        </Flex>
      </List.Item>
    </div>
  )
}

/** A small preview, so pasted screenshots ("Pasted image 1.png", ...) can be told apart. */
function ImageThumbnail({ file, rotation }: { file: File; rotation: number }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  if (!url) return <FileImageOutlined style={{ fontSize: 24, width: 32, flexShrink: 0 }} />
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      // Shows the image turned the way the Rotate button will turn its page.
      style={{
        width: 32,
        height: 32,
        flexShrink: 0,
        objectFit: 'cover',
        borderRadius: 4,
        transform: `rotate(${rotation}deg)`,
        display: 'block',
      }}
    />
  )
}
