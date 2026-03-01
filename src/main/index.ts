import { app, BrowserWindow } from 'electron'
import path from 'path'
import { createTray } from './tray'
import { createOverlay } from './overlay'
import { HotkeyBridge } from './hotkey-bridge'
import { AudioRecorderController } from './audio-recorder'
import { TranscriptionService } from './transcription'
import { TextInserter } from './text-inserter'
import { checkPermissions, checkPermissionsQuick } from './permissions'
import { initStore } from './store'
import { registerIpcHandlers } from './ipc-handlers'
import { MediaController } from './media-controller'
import { initLogger, openLogWindow } from './logger'

// Initialize logger before anything else
initLogger()

// No dock icon - hide as early as possible and again on ready
if (app.dock) app.dock.hide()

// Single instance
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

let settingsWindow: BrowserWindow | null = null
const hotkeyBridge = new HotkeyBridge()

function openSettings() {
  if (settingsWindow) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 420,
    height: 500,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'WhisperMe Settings',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  settingsWindow.loadFile(path.join(__dirname, '../../src/renderer/settings.html'))
  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

app.whenReady().then(async () => {
  const store = initStore()

  registerIpcHandlers(store)

  // First launch: full permission setup. After that: quick check only
  if (!store.get('setupComplete')) {
    await checkPermissions()
    store.set('setupComplete', true)
  } else {
    await checkPermissionsQuick()
  }

  // Open settings if no API key
  if (!store.get('openaiApiKey')) {
    openSettings()
  }

  const overlay = createOverlay()
  const tray = createTray(openSettings, openLogWindow)
  const recorder = new AudioRecorderController(overlay.getWindow())
  const transcription = new TranscriptionService(store)
  const inserter = new TextInserter()
  const media = new MediaController()

  let isRecording = false
  let isProcessing = false
  let didPauseMedia = false

  // Apply launch at login from stored setting
  app.setLoginItemSettings({ openAtLogin: !!store.get('launchAtLogin') })

  hotkeyBridge.on('key-down', async () => {
    if (isProcessing || isRecording) return
    if (!store.get('openaiApiKey')) {
      openSettings()
      return
    }
    console.log('[WhisperMe] Key down - start recording')
    isRecording = true

    // Pause media if enabled and currently playing
    didPauseMedia = false
    if (store.get('muteMediaWhileRecording')) {
      didPauseMedia = await media.pauseIfPlaying()
    }

    recorder.startRecording()
    overlay.show('recording')
    tray.setRecording(true)
  })

  hotkeyBridge.on('key-up', async () => {
    // Only process if we were actually recording
    if (!isRecording) return
    isRecording = false
    tray.setRecording(false)

    if (isProcessing) return
    isProcessing = true
    overlay.show('processing')
    console.log('[WhisperMe] Key up - stop recording, start processing')

    try {
      const audioBuffer = await recorder.stopRecording()
      console.log('[WhisperMe] Audio buffer size:', audioBuffer?.byteLength ?? 0)

      if (!audioBuffer || audioBuffer.byteLength < 1000) {
        console.log('[WhisperMe] Recording too short, ignoring')
        overlay.hide()
        isProcessing = false
        return
      }

      console.log('[WhisperMe] Sending to OpenAI...')
      const result = await transcription.process(audioBuffer)
      console.log('[WhisperMe] Result:', JSON.stringify(result).substring(0, 200))

      if (result.success && result.correctedText) {
        const inserted = await inserter.insertText(result.correctedText)
        overlay.show(inserted ? 'success' : 'clipboard')
      } else {
        console.error('[WhisperMe] Transcription error:', result.error)
        overlay.show('error')
      }
    } catch (error) {
      console.error('[WhisperMe] Error:', error)
      overlay.show('error')
    }

    // Resume media if we paused it
    if (didPauseMedia) {
      media.resume()
      didPauseMedia = false
    }

    setTimeout(() => {
      overlay.hide()
      isProcessing = false
    }, 2000)
  })

  const hotkeyKey = store.get('hotkeyKey') || 'FN'
  hotkeyBridge.start(hotkeyKey)
  console.log(`[WhisperMe] App ready. Hold ${hotkeyKey} to record.`)

  store.onDidChange('hotkeyKey', (newKey) => {
    if (newKey) hotkeyBridge.switchKey(newKey)
  })

})

app.on('will-quit', () => {
  hotkeyBridge.stop()
})

app.on('window-all-closed', () => {
  // Keep app running when all windows are closed
})
