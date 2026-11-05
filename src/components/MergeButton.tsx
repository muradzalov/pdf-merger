import { useState } from 'react'
import { App, Button } from 'antd'
import { MergeCellsOutlined } from '@ant-design/icons'
import { useAtomValue } from 'jotai'
import { downloadPdf } from '../lib/download'
import { mergeFiles } from '../lib/mergeFiles'
import { filesAtom } from '../state/files'

export function MergeButton() {
  const files = useAtomValue(filesAtom)
  const [merging, setMerging] = useState(false)
  const { message } = App.useApp()

  const handleMerge = async () => {
    setMerging(true)
    try {
      const { pdfBytes, failed } = await mergeFiles(files)
      if (!pdfBytes) {
        message.error('Nothing could be merged. All files failed to load.')
        return
      }

      downloadPdf(pdfBytes, 'merged.pdf')

      if (failed.length > 0) {
        message.warning({
          content: `Merged ${files.length - failed.length} of ${files.length}. Skipped: ${failed
            .map((f) => `${f.name} (${f.reason})`)
            .join(', ')}`,
          duration: 10,
        })
      } else {
        message.success('PDF merged and downloaded!')
      }
    } catch (err) {
      console.error('Merge failed', err)
      message.error(`Failed to merge: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setMerging(false)
    }
  }

  return (
    <Button type="primary" size="large" block icon={<MergeCellsOutlined />} loading={merging} onClick={handleMerge}>
      Merge & Download
    </Button>
  )
}
