import { EventEmitter } from 'events'
import path from 'path'
import { app } from 'electron'

// macOS keyCode mapping (CGKeyCode)
const KEY_NAME_TO_CODE: Record<string, number> = {
  // F-keys
  'F1': 122, 'F2': 120, 'F3': 99, 'F4': 118,
  'F5': 96, 'F6': 97, 'F7': 98, 'F8': 100,
  'F9': 101, 'F10': 109, 'F11': 103, 'F12': 111,
  'F13': 105, 'F14': 107, 'F15': 113, 'F16': 106,
  'F17': 64, 'F18': 79, 'F19': 80, 'F20': 90,
  // Special keys
  'SPACE': 49, 'RETURN': 36, 'TAB': 48, 'ESCAPE': 53,
  'BACKSPACE': 51, 'DELETE': 117,
  'UP': 126, 'DOWN': 125, 'LEFT': 123, 'RIGHT': 124,
  'HOME': 115, 'END': 119, 'PAGEUP': 116, 'PAGEDOWN': 121,
  // Letters
  'A': 0, 'B': 11, 'C': 8, 'D': 2, 'E': 14, 'F': 3, 'G': 5,
  'H': 4, 'I': 34, 'J': 38, 'K': 40, 'L': 37, 'M': 46, 'N': 45,
  'O': 31, 'P': 35, 'Q': 12, 'R': 15, 'S': 1, 'T': 17, 'U': 32,
  'V': 9, 'W': 13, 'X': 7, 'Y': 16, 'Z': 6,
  // Numbers
  '0': 29, '1': 18, '2': 19, '3': 20, '4': 21,
  '5': 23, '6': 22, '7': 26, '8': 28, '9': 25,
  // Punctuation
  '-': 27, '=': 24, '[': 33, ']': 30, ';': 41,
  "'": 39, '`': 50, '\\': 42, ',': 43, '.': 47, '/': 44,
  // Modifiers (single-key use)
  'RIGHT SHIFT': 60, 'LEFT SHIFT': 56,
  'RIGHT CTRL': 62, 'LEFT CTRL': 59,
  'RIGHT ALT': 61, 'LEFT ALT': 58,
  'RIGHT CMD': 54, 'LEFT CMD': 55,
}

const MODIFIER_NAMES = ['CTRL', 'CMD', 'SHIFT', 'ALT'] as const

// Keys that can be used in combinations (non-modifier keys)
const COMBO_KEYS: Record<string, number> = {
  'F1': 122, 'F2': 120, 'F3': 99, 'F4': 118,
  'F5': 96, 'F6': 97, 'F7': 98, 'F8': 100,
  'F9': 101, 'F10': 109, 'F11': 103, 'F12': 111,
  'F13': 105, 'F14': 107, 'F15': 113, 'F16': 106,
  'F17': 64, 'F18': 79, 'F19': 80, 'F20': 90,
  'SPACE': 49, 'RETURN': 36, 'TAB': 48, 'ESCAPE': 53,
}

function loadAddon() {
  const addonPath = app.isPackaged
    ? path.join(process.resourcesPath, '..', 'build', 'Release', 'fn_monitor.node')
    : path.join(__dirname, '../../build/Release/fn_monitor.node')
  return require(addonPath)
}

/**
 * Convert a hotkey string like "FN", "F5", "CTRL+SPACE", "CMD+SHIFT+F5"
 * into the C++ addon mode string like "FN", "96", "CTRL+49", "CMD+SHIFT+96"
 */
function hotkeyToMode(hotkey: string): string {
  if (hotkey === 'FN') return 'FN'

  const parts = hotkey.split('+')
  const modifiers: string[] = []
  let keyName = ''

  for (const part of parts) {
    const upper = part.trim().toUpperCase()
    if (MODIFIER_NAMES.includes(upper as typeof MODIFIER_NAMES[number])) {
      modifiers.push(upper)
    } else {
      keyName = upper
    }
  }

  // Single key (no modifiers)
  const code = KEY_NAME_TO_CODE[keyName] ?? COMBO_KEYS[keyName]
  if (code === undefined) return 'FN' // Fallback

  if (modifiers.length === 0) {
    return String(code)
  }

  return [...modifiers, String(code)].join('+')
}

export function getAvailableKeys(): string[] {
  return Object.keys(COMBO_KEYS)
}

export function getAvailableModifiers(): string[] {
  return [...MODIFIER_NAMES]
}

export function getAvailableSingleKeys(): string[] {
  return ['FN', ...Object.keys(KEY_NAME_TO_CODE)]
}

export class HotkeyBridge extends EventEmitter {
  private addon: { start: (cb: (event: string) => void, mode?: string) => boolean; stop: () => void } | null = null
  private activeKey = 'FN'

  start(hotkeyKey = 'FN'): void {
    this.stop()
    this.activeKey = hotkeyKey

    try {
      this.addon = loadAddon()
      const mode = hotkeyToMode(hotkeyKey)

      this.addon!.start((event: string) => {
        console.log(`[HotkeyBridge] ${this.activeKey}: ${event}`)
        this.emit(event)
      }, mode)

      console.log(`[HotkeyBridge] CGEventTap active (${this.activeKey}, mode=${mode})`)
    } catch (error) {
      console.error('[HotkeyBridge] Failed to start:', error)
    }
  }

  switchKey(hotkeyKey: string): void {
    console.log(`[HotkeyBridge] Switching: ${this.activeKey} → ${hotkeyKey}`)
    this.start(hotkeyKey)
  }

  stop(): void {
    if (this.addon) {
      try { this.addon.stop() } catch { /* ignore */ }
      this.addon = null
    }
  }
}
