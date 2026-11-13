import { lazy, Suspense, useEffect, useState } from 'react'
import { App as AntApp, Button, Flex, Result, Spin, Tabs, Typography } from 'antd'
import { useAtomValue } from 'jotai'
import { FileDropzone } from './components/FileDropzone'
import { FileList } from './components/FileList'
import { MergeButton } from './components/MergeButton'
import { UpdatePrompt } from './components/UpdatePrompt'
import { annotationsAtom } from './editor/state'
import { filesAtom } from './state/files'

const { Title, Text } = Typography

// Loaded when the tab is first opened, so the Merge tab doesn't have to load pdf.js.
const EditorPage = lazy(() =>
  import('./editor/EditorPage').then(
    (module) => ({ default: module.EditorPage }),
    (err) => {
      console.error('Could not load the editor', err)
      return { default: EditorLoadFailed }
    },
  ),
)

/**
 * Shown if the editor's code can't be downloaded, e.g. the network dropped before the app was
 * cached, or a deploy replaced the files while this page was open and before the offline cache
 * was installed. Reloading fetches the current version.
 */
function EditorLoadFailed() {
  return (
    <Result
      status="warning"
      title="The editor couldn't be loaded"
      subTitle="Reload the page to try again."
      extra={
        <Button type="primary" onClick={() => window.location.reload()}>
          Reload
        </Button>
      }
    />
  )
}

function MergeTab() {
  const hasFiles = useAtomValue(filesAtom).length > 0

  return (
    <Flex vertical gap="large" style={{ maxWidth: 600, margin: '0 auto' }}>
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

/** Makes the browser ask before closing or reloading the page while the editor has edits, on either tab. */
function useWarnBeforeLeavingWithEdits() {
  const hasEdits = useAtomValue(annotationsAtom).length > 0

  useEffect(() => {
    if (!hasEdits) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasEdits])
}

function MainPage() {
  const [tab, setTab] = useState('merge')
  useWarnBeforeLeavingWithEdits()

  return (
    <div style={{ padding: '40px 20px' }}>
      {/* Centered, because the tabs below are different widths. */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <Title level={2}>Pagewright</Title>
        <Text type="secondary">
          Merge PDFs, scans and screenshots into one PDF, or fill in and sign a PDF. 100% local — your files never leave your computer.
        </Text>
      </div>

      <Tabs
        centered
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'merge', label: 'Merge' },
          { key: 'edit', label: 'Edit & sign' },
        ]}
      />

      {/* Only the active tab is mounted, so the editor's keyboard shortcuts are off on the Merge tab.
          Both tabs keep their files in jotai, so nothing is lost when switching. */}
      {tab === 'merge' ? (
        <MergeTab />
      ) : (
        <Suspense
          fallback={
            <Flex justify="center" style={{ padding: 48 }}>
              <Spin size="large" />
            </Flex>
          }
        >
          <EditorPage />
        </Suspense>
      )}
    </div>
  )
}

export default function App() {
  // antd's <App> provides the message and notification APIs to components via App.useApp().
  return (
    <AntApp>
      <UpdatePrompt />
      <MainPage />
    </AntApp>
  )
}
