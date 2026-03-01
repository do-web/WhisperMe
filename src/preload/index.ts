import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('whisperme', {
  // Overlay
  onStateChanged: (callback: (state: string) => void) => {
    ipcRenderer.on('state-changed', (_event, state) => callback(state))
  },

  // Audio recording
  sendAudioData: (buffer: ArrayBuffer) => {
    ipcRenderer.send('audio-data', buffer)
  },
  onStartRecording: (callback: () => void) => {
    ipcRenderer.on('start-recording', () => callback())
  },
  onStopRecording: (callback: () => void) => {
    ipcRenderer.on('stop-recording', () => callback())
  },
  sendRecordingComplete: () => {
    ipcRenderer.send('recording-complete')
  },

  // External links
  openExternal: (url: string) => ipcRenderer.send('open-external', url),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke('save-settings', settings),
})
