import { app, ipcMain, shell } from 'electron'
import Store from 'electron-store'
import { StoreSchema, IPC_CHANNELS } from '../shared/types'
import { getAvailableKeys, getAvailableModifiers, getAvailableSingleKeys } from './hotkey-bridge'

export function registerIpcHandlers(store: Store<StoreSchema>): void {
  ipcMain.on('open-external', (_event, url: string) => {
    if (url.startsWith('https://')) shell.openExternal(url)
  })

  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => ({
    language: store.get('language'),
    correctionEnabled: store.get('correctionEnabled'),
    launchAtLogin: store.get('launchAtLogin'),
    muteMediaWhileRecording: store.get('muteMediaWhileRecording'),
    hotkeyKey: store.get('hotkeyKey'),
    hasApiKey: !!store.get('openaiApiKey'),
    availableKeys: getAvailableSingleKeys(),
    comboKeys: getAvailableKeys(),
    modifiers: getAvailableModifiers(),
  }))

  ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, (_event, settings: Partial<StoreSchema>) => {
    for (const [key, value] of Object.entries(settings)) {
      store.set(key as keyof StoreSchema, value)
    }

    // Apply launch at login immediately
    if ('launchAtLogin' in settings) {
      app.setLoginItemSettings({ openAtLogin: !!settings.launchAtLogin })
    }

    return true
  })
}
