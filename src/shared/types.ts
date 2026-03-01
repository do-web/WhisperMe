export interface FnKeyEvent {
  type: 'fn-down' | 'fn-up'
  timestamp: number
}

export type AppState = 'idle' | 'recording' | 'processing' | 'inserting' | 'success' | 'clipboard' | 'error'

export interface StoreSchema {
  openaiApiKey: string
  language: string
  correctionEnabled: boolean
  launchAtLogin: boolean
  muteMediaWhileRecording: boolean
  hotkeyKey: string
  setupComplete: boolean
}

export const IPC_CHANNELS = {
  FN_KEY_DOWN: 'fn-key-down',
  FN_KEY_UP: 'fn-key-up',
  STATE_CHANGED: 'state-changed',
  START_RECORDING: 'start-recording',
  STOP_RECORDING: 'stop-recording',
  AUDIO_DATA: 'audio-data',
  RECORDING_COMPLETE: 'recording-complete',
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',
} as const

export interface TranscriptionResult {
  rawText: string
  correctedText: string
  success: boolean
  error?: string
}
