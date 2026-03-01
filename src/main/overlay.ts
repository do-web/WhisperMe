import { BrowserWindow, screen } from 'electron'
import path from 'path'
import { AppState, IPC_CHANNELS } from '../shared/types'

export interface OverlayController {
  show(state: AppState): void
  hide(): void
  getWindow(): BrowserWindow
}

export function createOverlay(): OverlayController {
  const win = new BrowserWindow({
    width: 320,
    height: 56,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    type: 'panel',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setIgnoreMouseEvents(true)
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const display = screen.getPrimaryDisplay()
  const x = Math.round(display.bounds.x + (display.bounds.width - 320) / 2)
  const y = display.bounds.y + display.bounds.height - 56 - 80
  win.setPosition(x, y)

  win.loadFile(path.join(__dirname, '../../src/renderer/index.html'))

  return {
    show(state: AppState) {
      win.webContents.send(IPC_CHANNELS.STATE_CHANGED, state)
      if (!win.isVisible()) {
        win.showInactive() // Show WITHOUT stealing focus
      }
    },
    hide() {
      win.hide()
    },
    getWindow() {
      return win
    },
  }
}
