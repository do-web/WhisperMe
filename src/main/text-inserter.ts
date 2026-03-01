import { exec } from 'child_process'
import { clipboard, Notification } from 'electron'
import { promisify } from 'util'

const execAsync = promisify(exec)

export class TextInserter {
  async insertText(text: string): Promise<boolean> {
    try {
      clipboard.writeText(text + ' ')

      await execAsync(
        `osascript -e 'tell application "System Events" to keystroke "v" using command down'`
      )

      // Text bleibt in der Zwischenablage
      return true
    } catch {
      // Fallback: keep text in clipboard + show notification
      clipboard.writeText(text + ' ')
      new Notification({
        title: 'WhisperMe',
        body: 'Text copied to clipboard (⌘V to paste)',
      }).show()
      return false
    }
  }
}
