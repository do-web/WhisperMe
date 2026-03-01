import { Tray, Menu, app } from 'electron'
import path from 'path'

export interface TrayController {
  setRecording(active: boolean): void
  destroy(): void
}

export function createTray(onOpenSettings: () => void, onOpenLog: () => void): TrayController {
  const assetsPath = path.join(__dirname, '../../assets')

  const iconPath = path.join(assetsPath, 'trayTemplate.png')
  const recordingIconPath = path.join(assetsPath, 'tray-recording.png')

  const tray = new Tray(iconPath)
  tray.setToolTip('WhisperMe')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'WhisperMe v1.0.0', enabled: false },
    { type: 'separator' },
    { label: 'Settings...', click: onOpenSettings },
    { label: 'Show Log...', click: onOpenLog },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])
  tray.setContextMenu(contextMenu)

  return {
    setRecording(active: boolean) {
      tray.setImage(active ? recordingIconPath : iconPath)
    },
    destroy() {
      tray.destroy()
    },
  }
}
