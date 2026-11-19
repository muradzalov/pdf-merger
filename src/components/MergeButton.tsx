import { useState } from 'react'
import { App, Button, Flex, Input } from 'antd'
import { FileTextOutlined, MergeCellsOutlined } from '@ant-design/icons'
import { useAtomValue } from 'jotai'
import { downloadPdf, toPdfFileName } from '../lib/download'
import { mergeFiles } from '../lib/mergeFiles'
import { filesAtom } from '../state/files'

/** The output file name field and the Merge & Download button. */
export function MergeButton() {
  const files = useAtomValue(filesAtom)
  const [fileName, setFileName] = useState('merged')
  const [merging, setMerging] = useState(false)
  const { message } = App.useApp()

  const handleMerge = async () => {
    if (merging) return // Enter in the name field can fire while a merge is running
    setMerging(true)
    try {
      const { pdfBytes, failed } = await mergeFiles(files)
      if (!pdfBytes) {
        message.error({
          content: `Nothing could be merged. ${failed.map((f) => `${f.name}: ${f.reason}`).join('; ')}`,
          duration: 10,
        })
        return
      }

      const outputName = toPdfFileName(fileName)
      downloadPdf(pdfBytes, outputName)

      if (failed.length > 0) {
        message.warning({
          content: `Merged ${files.length - failed.length} of ${files.length} into ${outputName}. Skipped: ${failed
            .map((f) => `${f.name} (${f.reason})`)
            .join(', ')}`,
          duration: 10,
        })
      } else {
        message.success(`Merged and downloaded ${outputName}`)
      }
    } catch (err) {
      console.error('Merge failed', err)
      message.error(`Failed to merge: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setMerging(false)
    }
  }

  return (
    // One row, pinned under the list.
    <Flex gap="small" wrap style={{ flexShrink: 0 }}>
      <Input
        size="large"
        style={{ flex: 1, minWidth: 180 }}
        prefix={<FileTextOutlined />}
        suffix=".pdf"
        placeholder="merged"
        aria-label="Output file name"
        value={fileName}
        onChange={(e) => setFileName(e.target.value)}
        onPressEnter={handleMerge}
      />
      <Button type="primary" size="large" icon={<MergeCellsOutlined />} loading={merging} onClick={handleMerge}>
        Merge & Download
      </Button>
    </Flex>
  )
}
