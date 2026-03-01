import { BrowserWindow } from 'electron'

export interface LogEntry {
  timestamp: string
  level: 'info' | 'error' | 'warn'
  message: string
}

const MAX_ENTRIES = 500
const logs: LogEntry[] = []
let logWindow: BrowserWindow | null = null

function addEntry(level: LogEntry['level'], ...args: unknown[]) {
  const message = args.map(a => {
    if (a instanceof Error) return `${a.message}\n${a.stack}`
    if (typeof a === 'object') {
      try { return JSON.stringify(a, null, 2) } catch { return String(a) }
    }
    return String(a)
  }).join(' ')

  const entry: LogEntry = {
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    level,
    message,
  }

  logs.push(entry)
  if (logs.length > MAX_ENTRIES) logs.shift()

  // Send to log window if open
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.webContents.send('log-entry', entry)
  }
}

// Override console methods to capture logs
const originalLog = console.log.bind(console)
const originalError = console.error.bind(console)
const originalWarn = console.warn.bind(console)

export function initLogger(): void {
  console.log = (...args: unknown[]) => {
    originalLog(...args)
    addEntry('info', ...args)
  }
  console.error = (...args: unknown[]) => {
    originalError(...args)
    addEntry('error', ...args)
  }
  console.warn = (...args: unknown[]) => {
    originalWarn(...args)
    addEntry('warn', ...args)
  }
}

export function getLogs(): LogEntry[] {
  return logs
}

export function openLogWindow(): void {
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.focus()
    return
  }

  logWindow = new BrowserWindow({
    width: 600,
    height: 450,
    title: 'WhisperMe Log',
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
  })

  logWindow.loadFile(
    require('path').join(__dirname, '../../src/renderer/log.html')
  )

  logWindow.webContents.on('did-finish-load', () => {
    if (logWindow && !logWindow.isDestroyed()) {
      logWindow.webContents.send('log-history', logs)
    }
  })

  logWindow.on('closed', () => {
    logWindow = null
  })
}
