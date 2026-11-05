import { App as AntApp, Flex, Typography } from 'antd'
import { useAtomValue } from 'jotai'
import { FileDropzone } from './components/FileDropzone'
import { FileList } from './components/FileList'
import { MergeButton } from './components/MergeButton'
import { filesAtom } from './state/files'

const { Title, Text } = Typography

function MergerPage() {
  const hasFiles = useAtomValue(filesAtom).length > 0

  return (
    <Flex vertical gap="large" style={{ maxWidth: 600, margin: '40px auto', padding: '0 20px' }}>
      <div>
        <Title level={2}>PDF Merger</Title>
        <Text type="secondary">
          Combine PDFs and JPG scans into one PDF. 100% local — your files never leave your computer.
        </Text>
      </div>

      <FileDropzone />

      {hasFiles && (
        <>
          <FileList />
          <MergeButton />
        </>
      )}
    </Flex>
  )
}

export default function App() {
  // antd's <App> provides the message API to components via App.useApp().
  return (
    <AntApp>
      <MergerPage />
    </AntApp>
  )
}
