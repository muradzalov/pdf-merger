import { lazy, Suspense, useEffect, useState } from 'react'
import { App as AntApp, Button, Flex, Grid, Result, Spin, Tabs, Typography, theme } from 'antd'
import { useAtomValue } from 'jotai'
import { FileDropzone } from './components/FileDropzone'
import { FileList } from './components/FileList'
import { MergeButton } from './components/MergeButton'
import { UpdatePrompt } from './components/UpdatePrompt'
import { annotationsAtom } from './editor/state'
import { filesAtom } from './state/files'

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

/**
 * Fills the height it's given: the file list takes whatever is left between the drop area and the
 * output name, and scrolls inside itself, so Merge & Download is always in view.
 */
function MergeTab() {
  const hasFiles = useAtomValue(filesAtom).length > 0

  return (
    <Flex vertical gap="middle" style={{ maxWidth: 680, width: '100%', margin: '0 auto', flex: 1, minHeight: 0 }}>
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
  const { token } = theme.useToken()
  const screens = Grid.useBreakpoint()
  useWarnBeforeLeavingWithEdits()

  return (
    // Exactly the window's height (dvh: the visible height on phones, whose address bars come and
    // go). The page itself never scrolls; each tab scrolls its own list or pages.
    <Flex vertical style={{ height: '100dvh', overflow: 'hidden', background: token.colorBgContainer }}>
      <Flex
        align="center"
        gap="large"
        style={{ flexShrink: 0, padding: `0 ${token.padding}px`, borderBottom: `1px solid ${token.colorBorderSecondary}` }}
      >
        <Flex align="center" gap="small" style={{ flexShrink: 0 }}>
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={22} height={22} />
          <Typography.Text strong style={{ fontSize: 18 }}>
            Pagewright
          </Typography.Text>
        </Flex>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            { key: 'merge', label: 'Merge' },
            { key: 'edit', label: 'Edit & sign' },
          ]}
          tabBarStyle={{ margin: 0 }}
        />
        {screens.md && (
          <Typography.Text type="secondary" style={{ marginLeft: 'auto', fontSize: 12 }}>
            100% local — your files never leave your computer
          </Typography.Text>
        )}
      </Flex>

      {/* Only the active tab is mounted, so the editor's keyboard shortcuts are off on the Merge tab.
          Both tabs keep their files in jotai, so nothing is lost when switching. */}
      <Flex vertical style={{ flex: 1, minHeight: 0, padding: token.padding }}>
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
      </Flex>
    </Flex>
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
