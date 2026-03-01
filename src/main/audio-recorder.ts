import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../shared/types'

export class AudioRecorderController {
  private chunks: Buffer[] = []
  private overlayWindow: BrowserWindow

  constructor(overlayWindow: BrowserWindow) {
    this.overlayWindow = overlayWindow

    ipcMain.on(IPC_CHANNELS.AUDIO_DATA, (_event, data: ArrayBuffer) => {
      this.chunks.push(Buffer.from(data))
    })
  }

  startRecording(): void {
    this.chunks = []
    this.overlayWindow.webContents.send(IPC_CHANNELS.START_RECORDING)
  }

  stopRecording(): Promise<Buffer> {
    return new Promise((resolve) => {
      this.overlayWindow.webContents.send(IPC_CHANNELS.STOP_RECORDING)

      const onComplete = () => {
        const buffer = Buffer.concat(this.chunks)
        this.chunks = []
        resolve(buffer)
      }

      ipcMain.once(IPC_CHANNELS.RECORDING_COMPLETE, onComplete)

      // Timeout fallback
      setTimeout(() => {
        ipcMain.removeListener(IPC_CHANNELS.RECORDING_COMPLETE, onComplete)
        onComplete()
      }, 500)
    })
  }
}
