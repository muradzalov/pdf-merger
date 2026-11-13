import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { App, Button, Flex, Space, Tooltip, Typography, Upload, theme } from 'antd'
import {
  CloseOutlined,
  ColumnWidthOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  InboxOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { downloadPdf, toPdfFileName } from '../lib/download'
import { ACCEPTED_FILE_TYPES, detectFileKind, FILE_KIND_LABEL } from '../lib/fileKinds'
import { ENCRYPTED_PDF_MESSAGE } from '../lib/loadPdf'
import { MAX_ZOOM, MIN_ZOOM } from './constants'
import { EditorToolbar } from './EditorToolbar'
import { exportEditedPdf } from './exportPdf'
import { openEditorDocument } from './pdfjs'
import { PdfPage } from './PdfPage'
import { annotationsAtom, editorDocumentAtom, setDocumentAtom, zoomAtom } from './state'
import type { EditorDocument } from './types'

/** The "Edit & sign" tab: a file picker, or the open document. */
export function EditorPage() {
  const doc = useAtomValue(editorDocumentAtom)
  return doc ? <DocumentView doc={doc} /> : <OpenFile />
}

function OpenFile() {
  const setDocument = useSetAtom(setDocumentAtom)
  const { message } = App.useApp()
  const [opening, setOpening] = useState(false)

  const open = async (file: File) => {
    const kind = detectFileKind(file)
    if (!kind) {
      message.error(`Can't open ${file.name}: only PDF, JPG and PNG files are supported`)
      return
    }
    setOpening(true)
    try {
      setDocument(await openEditorDocument(file, kind))
    } catch (err) {
      console.error(`Could not open ${file.name}`, err)
      const reason =
        err instanceof Error && err.message === ENCRYPTED_PDF_MESSAGE
          ? err.message
          : `the file is damaged or isn't a valid ${FILE_KIND_LABEL[kind]}`
      message.error({ content: `Can't open ${file.name}: ${reason}`, duration: 10 })
    } finally {
      setOpening(false)
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Upload.Dragger
        accept={ACCEPTED_FILE_TYPES}
        showUploadList={false}
        disabled={opening}
        onDrop={(e) => {
          // antd passes on only the first dropped file.
          if (e.dataTransfer.files.length > 1) message.info('You can edit one file at a time, so only the first one was opened')
        }}
        beforeUpload={(file) => {
          void open(file)
          // The document lives in jotai; tell antd not to track or upload the file.
          return Upload.LIST_IGNORE
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">{opening ? 'Opening…' : 'Click or drag a PDF or image here to fill it in or sign it'}</p>
        <p className="ant-upload-hint">Add text, draw, highlight or sign, then download the edited PDF.</p>
      </Upload.Dragger>
    </div>
  )
}

/** Widest the pages get with "Fit width", and the width of the header and toolbar above them. */
const COLUMN_WIDTH = 1100

function DocumentView({ doc }: { doc: EditorDocument }) {
  const { token } = theme.useToken()
  const columnRef = useRef<HTMLDivElement>(null)
  const setZoom = useSetAtom(zoomAtom)

  // Each document opens at 100%, or smaller if that's wider than the screen (e.g. on a phone).
  // A layout effect, so the pages' first render already uses this zoom.
  useLayoutEffect(() => {
    setZoom(clampZoom(Math.min(1, fitWidthZoom(doc, columnRef.current!))))
  }, [doc, setZoom])

  return (
    <div>
      {/* Stays at the top of the window while the pages scroll under it. */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: token.colorBgContainer }}>
        <div ref={columnRef} style={{ maxWidth: COLUMN_WIDTH, margin: '0 auto' }}>
          <DocumentHeader doc={doc} columnRef={columnRef} />
          <EditorToolbar />
        </div>
      </div>
      {/* Full width rather than COLUMN_WIDTH, so a zoomed-in page can use the whole window. */}
      <Flex vertical gap="middle" style={{ padding: `${token.padding}px 0` }}>
        {doc.pages.map((page, i) => (
          <PdfPage key={i} pdf={doc.pdf} page={page} pageIndex={i} />
        ))}
      </Flex>
    </div>
  )
}

const ZOOM_STEP = 0.25
const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
/** The zoom at which the widest page fills the column. */
const fitWidthZoom = (doc: EditorDocument, column: HTMLElement) =>
  column.clientWidth / Math.max(...doc.pages.map((page) => page.width))

/** File name, zoom, Close and Download. */
function DocumentHeader({ doc, columnRef }: { doc: EditorDocument; columnRef: RefObject<HTMLDivElement> }) {
  const [zoom, setZoom] = useAtom(zoomAtom)
  const annotations = useAtomValue(annotationsAtom)
  const setDocument = useSetAtom(setDocumentAtom)
  const { message, modal } = App.useApp()
  const { token } = theme.useToken()
  const [saving, setSaving] = useState(false)

  // The buttons step along the 25% grid, so after "Fit width" (say 137%) they go to 150% / 125%.
  const zoomIn = () => setZoom(clampZoom((Math.floor(zoom / ZOOM_STEP) + 1) * ZOOM_STEP))
  const zoomOut = () => setZoom(clampZoom((Math.ceil(zoom / ZOOM_STEP) - 1) * ZOOM_STEP))
  const fitWidth = () => setZoom(clampZoom(fitWidthZoom(doc, columnRef.current!)))

  const close = () => {
    if (annotations.length === 0) {
      setDocument(null)
      return
    }
    modal.confirm({
      title: 'Close this file?',
      content: 'Your edits will be lost. Download the PDF first to keep them.',
      okText: 'Close file',
      okButtonProps: { danger: true },
      onOk: () => setDocument(null),
    })
  }

  const download = async () => {
    setSaving(true)
    try {
      const bytes = await exportEditedPdf(doc, annotations)
      const fileName = toPdfFileName(`${doc.name.replace(/\.[^.]*$/, '')}-edited`)
      downloadPdf(bytes, fileName)
      message.success(`Downloaded ${fileName}`)
    } catch (err) {
      console.error('Saving the edited PDF failed', err)
      message.error({ content: `Couldn't save the PDF: ${err instanceof Error ? err.message : String(err)}`, duration: 10 })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Flex wrap align="center" justify="space-between" gap="small" style={{ padding: `${token.paddingXS}px 0` }}>
      <Flex align="center" gap="small" style={{ minWidth: 0, flex: '1 1 200px' }}>
        <FilePdfOutlined />
        <Typography.Text strong ellipsis={{ tooltip: doc.name }}>
          {doc.name}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap' }}>
          {doc.pages.length} page{doc.pages.length !== 1 ? 's' : ''}
        </Typography.Text>
      </Flex>

      <Flex wrap align="center" gap="small">
        <Space.Compact>
          <Tooltip title="Zoom out">
            <Button icon={<ZoomOutOutlined />} aria-label="Zoom out" disabled={zoom <= MIN_ZOOM} onClick={zoomOut} />
          </Tooltip>
          <Tooltip title="Actual size">
            <Button style={{ minWidth: 64 }} onClick={() => setZoom(1)}>
              {Math.round(zoom * 100)}%
            </Button>
          </Tooltip>
          <Tooltip title="Zoom in">
            <Button icon={<ZoomInOutlined />} aria-label="Zoom in" disabled={zoom >= MAX_ZOOM} onClick={zoomIn} />
          </Tooltip>
        </Space.Compact>
        <Tooltip title="Fit width">
          <Button icon={<ColumnWidthOutlined />} aria-label="Fit width" onClick={fitWidth} />
        </Tooltip>
        <Button icon={<CloseOutlined />} onClick={close}>
          Close
        </Button>
        <Button type="primary" icon={<DownloadOutlined />} loading={saving} onClick={download}>
          Download
        </Button>
      </Flex>
    </Flex>
  )
}
