import { useEffect } from 'react'
import { App, Button } from 'antd'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Offers a reload when a new version has been deployed. The new version only takes over when the
 * user clicks Reload (or after every tab of the app is closed). Until then the open page keeps
 * running the version it started with, and that version's cached files stay available, so
 * opening the editor right after a deploy can't fail on a file the new version deleted.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  const { notification } = App.useApp()

  useEffect(() => {
    if (!needRefresh) return
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
  }, [needRefresh, notification, updateServiceWorker])

  return null
}
