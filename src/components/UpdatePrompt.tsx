import { useEffect } from 'react'
import { App, Button } from 'antd'
import { useStore } from 'jotai'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { editorDocumentAtom } from '../editor/state'
import { filesAtom } from '../state/files'

/**
 * Switches to a newly deployed version.
 *
 * A new version never replaces the open page by itself while there's work on it: it waits, and
 * the user gets a Reload prompt. Until then the page keeps running the version it started with,
 * and that version's cached files stay available, so nothing breaks mid-task. With nothing in
 * progress there's nothing to lose, so it switches straight away. That way a plain refresh, or
 * coming back to the tab, brings in the new version.
 */
export function UpdatePrompt() {
  const store = useStore()
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // Browsers only check for a new version when the page loads. Also check whenever the user
      // comes back to the tab, so a tab left open picks up deploys.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {}) // e.g. offline
      })
    },
  })
  const { notification } = App.useApp()

  useEffect(() => {
    if (!needRefresh) return
    const inProgress = store.get(filesAtom).length > 0 || store.get(editorDocumentAtom) !== null
    if (!inProgress) {
      void updateServiceWorker(true)
      return
    }
    notification.info({
      key: 'app-update',
      message: 'A new version is available',
      description: 'Reload to use it. Download any edits first: reloading discards them.',
      actions: (
        <Button type="primary" size="small" onClick={() => void updateServiceWorker(true)}>
          Reload
        </Button>
      ),
      duration: 0,
    })
  }, [needRefresh, notification, store, updateServiceWorker])

  return null
}
