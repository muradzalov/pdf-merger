import { useEffect, useState } from 'react'
import { Alert, Button, Flex, Modal, Segmented, Spin, Tooltip, Typography, theme } from 'antd'
import { LeftOutlined, RightOutlined, RotateRightOutlined } from '@ant-design/icons'
import { useAtomValue, useSetAtom } from 'jotai'
import type { PageOrientation } from '../lib/imagePage'
import { mergeFiles } from '../lib/mergeFiles'
import { filesAtom, rotateFileAtom, setPageOrientationAtom } from '../state/files'

/** Grey space around the page in the preview. */
const PADDING = 16

interface RenderedPage {
  url: string
  width: number
  height: number
  pageCount: number
}

/**
 * Shows the page a file will become in the merged PDF. It's built with the merge code itself, so
 * what you see is exactly what you'll get, rotation and page shape included, and both can be
 * changed right here. Previous / Next (or the arrow keys) step through the list, e.g. to check a
 * batch of phone photos.
 */
export function PagePreview({ fileId, onChangeFile }: { fileId: string | null; onChangeFile: (id: string | null) => void }) {
  const files = useAtomValue(filesAtom)
  const rotateFile = useSetAtom(rotateFileAtom)
  const setPageOrientation = useSetAtom(setPageOrientationAtom)
  const { token } = theme.useToken()
  const index = files.findIndex((f) => f.id === fileId)
  const queued = index === -1 ? null : files[index]
  const previousId = index > 0 ? files[index - 1].id : null
  const nextId = index !== -1 && index < files.length - 1 ? files[index + 1].id : null

  // The page is drawn to fit this box, which stays the same size from file to file.
  const [box] = useState(() => ({
    width: Math.min(900, window.innerWidth - 96),
    height: Math.max(200, window.innerHeight - 300),
  }))
  const [page, setPage] = useState<RenderedPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Re-renders when the file, its rotation or its page shape changes (each makes a new object).
  useEffect(() => {
    if (!queued) return
    let cancelled = false
    setLoading(true)
    setError(null)
    const render = async () => {
      const { pdfBytes, failed } = await mergeFiles([queued])
      if (!pdfBytes) throw new Error(failed[0]?.reason ?? "the file couldn't be read")
      // pdf.js is only loaded when a preview is first opened.
      const { renderFirstPage } = await import('../editor/pdfjs')
      return renderFirstPage(pdfBytes, box.width - 2 * PADDING, box.height)
    }
    render()
      .then((rendered) => !cancelled && setPage(rendered))
      .catch((err) => {
        if (cancelled) return
        setPage(null)
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [queued, box])

  // ← / → step through the files (not while a control that uses the arrow keys has focus).
  useEffect(() => {
    if (!queued) return
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select')) return
      if (e.key === 'ArrowLeft' && previousId) onChangeFile(previousId)
      if (e.key === 'ArrowRight' && nextId) onChangeFile(nextId)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [queued, previousId, nextId, onChangeFile])

  return (
    <Modal
      open={queued !== null}
      onCancel={() => onChangeFile(null)}
      afterClose={() => setPage(null)}
      centered
      width={box.width + 48}
      title={
        queued && (
          <Typography.Text ellipsis style={{ maxWidth: box.width - 80 }}>
            {queued.file.name}{' '}
            <Typography.Text type="secondary">
              ({index + 1} of {files.length})
            </Typography.Text>
          </Typography.Text>
        )
      }
      footer={
        queued && (
          <Flex wrap gap="small" align="center" justify="space-between">
            <Flex gap="small">
              <Tooltip title="Previous (←)">
                <Button icon={<LeftOutlined />} aria-label="Previous file" disabled={!previousId} onClick={() => onChangeFile(previousId)} />
              </Tooltip>
              <Tooltip title="Next (→)">
                <Button icon={<RightOutlined />} aria-label="Next file" disabled={!nextId} onClick={() => onChangeFile(nextId)} />
              </Tooltip>
            </Flex>
            <Flex wrap gap="small" align="center">
              {queued.kind !== 'pdf' && (
                <Segmented<PageOrientation>
                  value={queued.pageOrientation}
                  onChange={(pageOrientation) => setPageOrientation({ id: queued.id, pageOrientation })}
                  options={[
                    { value: 'auto', label: 'Auto' },
                    { value: 'portrait', label: 'Portrait' },
                    { value: 'landscape', label: 'Landscape' },
                  ]}
                  aria-label="Page shape"
                />
              )}
              <Button icon={<RotateRightOutlined />} onClick={() => rotateFile(queued.id)}>
                Rotate
              </Button>
            </Flex>
            <Button type="primary" onClick={() => onChangeFile(null)}>
              Done
            </Button>
          </Flex>
        )
      }
    >
      <Spin spinning={loading}>
        <Flex
          vertical
          align="center"
          justify="center"
          gap="small"
          style={{ height: box.height + 2 * PADDING, background: token.colorFillTertiary, borderRadius: token.borderRadius }}
        >
          {error ? (
            <Alert type="error" showIcon message={`Can't preview this file: ${error}`} />
          ) : (
            page && (
              <img
                src={page.url}
                alt={`Preview of ${queued?.file.name ?? 'the page'}`}
                width={page.width}
                height={page.height}
                style={{ display: 'block', boxShadow: '0 1px 6px rgba(0, 0, 0, 0.3)', background: '#fff' }}
              />
            )
          )}
          {page && page.pageCount > 1 && (
            <Typography.Text type="secondary">
              Page 1 of {page.pageCount} (rotating turns all of them)
            </Typography.Text>
          )}
        </Flex>
      </Spin>
    </Modal>
  )
}
