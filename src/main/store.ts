import Store from 'electron-store'
import { StoreSchema } from '../shared/types'

export function initStore(): Store<StoreSchema> {
  return new Store<StoreSchema>({
    schema: {
      openaiApiKey: { type: 'string', default: '' },
      language: { type: 'string', default: 'auto' },
      correctionEnabled: { type: 'boolean', default: true },
      launchAtLogin: { type: 'boolean', default: false },
      muteMediaWhileRecording: { type: 'boolean', default: false },
      hotkeyKey: { type: 'string', default: 'FN' },
      setupComplete: { type: 'boolean', default: false },
    },
    encryptionKey: 'whisperme-store-key',
  })
}
