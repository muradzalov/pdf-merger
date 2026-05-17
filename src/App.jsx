import { useState, useCallback } from 'react'
import { Button, Upload, List, Typography, Space, message, App as AntApp } from 'antd'
import { UploadOutlined, DeleteOutlined, MergeCellsOutlined, HolderOutlined } from '@ant-design/icons'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PDFDocument } from 'pdf-lib'

const { Title, Text } = Typography

function SortableItem({ file, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: file.uid })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <List.Item
        actions={[
          <Button
            key="delete"
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onRemove(file.uid)}
          />,
        ]}
      >
        <Space>
          <HolderOutlined style={{ cursor: 'grab' }} {...attributes} {...listeners} />
          <Text>{file.name}</Text>
          <Text type="secondary">({(file.size / 1024).toFixed(1)} KB)</Text>
        </Space>
      </List.Item>
    </div>
  )
}

function PdfMerger() {
  const [files, setFiles] = useState([])
  const [merging, setMerging] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleBeforeUpload = useCallback((file) => {
    if (file.type !== 'application/pdf') {
      messageApi.error(`${file.name} is not a PDF file`)
      return Upload.LIST_IGNORE
    }
    setFiles((prev) => [...prev, file])
    return false
  }, [messageApi])

  const handleRemove = useCallback((uid) => {
    setFiles((prev) => prev.filter((f) => f.uid !== uid))
  }, [])

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event
    if (active.id !== over?.id) {
      setFiles((prev) => {
        const oldIndex = prev.findIndex((f) => f.uid === active.id)
        const newIndex = prev.findIndex((f) => f.uid === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }, [])

  const handleMerge = async () => {
    if (files.length < 2) {
      messageApi.warning('Add at least 2 PDF files to merge')
      return
    }

    setMerging(true)
    const failed = []
    try {
      const mergedPdf = await PDFDocument.create()

      for (const file of files) {
        try {
          const arrayBuffer = await file.arrayBuffer()
          const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true, throwOnInvalidObject: false })
          const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
          pages.forEach((page) => mergedPdf.addPage(page))
        } catch (err) {
          failed.push({ name: file.name, reason: err.message })
        }
      }

      if (mergedPdf.getPageCount() === 0) {
        messageApi.error('No PDFs could be merged. All files failed to load.')
        return
      }

      const mergedBytes = await mergedPdf.save()
      const blob = new Blob([mergedBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'merged.pdf'
      link.click()
      URL.revokeObjectURL(url)

      if (failed.length > 0) {
        messageApi.warning({
          content: `Merged ${files.length - failed.length} of ${files.length}. Skipped: ${failed.map((f) => f.name).join(', ')}`,
          duration: 10,
        })
      } else {
        messageApi.success('PDF merged and downloaded!')
      }
    } catch (err) {
      messageApi.error('Failed to merge PDFs: ' + err.message)
    } finally {
      setMerging(false)
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 20px' }}>
      {contextHolder}
      <Title level={2}>PDF Merger</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        100% local — your files never leave your computer.
      </Text>

      <Upload.Dragger
        multiple
        accept=".pdf"
        beforeUpload={handleBeforeUpload}
        showUploadList={false}
        fileList={[]}
      >
        <p><UploadOutlined style={{ fontSize: 24 }} /></p>
        <p>Click or drag PDF files here</p>
      </Upload.Dragger>

      {files.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Text strong>{files.length} file{files.length !== 1 ? 's' : ''} — drag to reorder</Text>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={files.map((f) => f.uid)} strategy={verticalListSortingStrategy}>
              <List
                bordered
                style={{ marginTop: 8 }}
                dataSource={files}
                renderItem={(file) => (
                  <SortableItem key={file.uid} file={file} onRemove={handleRemove} />
                )}
              />
            </SortableContext>
          </DndContext>

          <Button
            type="primary"
            icon={<MergeCellsOutlined />}
            size="large"
            loading={merging}
            onClick={handleMerge}
            style={{ marginTop: 16, width: '100%' }}
          >
            Merge & Download
          </Button>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <AntApp>
      <PdfMerger />
    </AntApp>
  )
}
