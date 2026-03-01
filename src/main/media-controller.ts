import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export class MediaController {
  private previousVolume = -1

  /**
   * Mutes system audio by setting volume to 0. Stores previous volume to restore later.
   */
  async pauseIfPlaying(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        `/usr/bin/osascript -e 'output volume of (get volume settings)'`
      )
      this.previousVolume = parseInt(stdout.trim(), 10)
      console.log('[MediaController] Previous volume:', this.previousVolume)

      if (this.previousVolume > 0) {
        await execAsync(`/usr/bin/osascript -e 'set volume output volume 0'`)
        console.log('[MediaController] Volume set to 0')
        return true
      }

      console.log('[MediaController] Already at 0, skipping')
      return false
    } catch (error) {
      console.error('[MediaController] Failed to mute:', error)
      return false
    }
  }

  /**
   * Restores system audio to previous volume.
   */
  async resume(): Promise<void> {
    try {
      if (this.previousVolume > 0) {
        await execAsync(`/usr/bin/osascript -e 'set volume output volume ${this.previousVolume}'`)
        console.log('[MediaController] Volume restored to', this.previousVolume)
      }
      this.previousVolume = -1
    } catch (error) {
      console.error('[MediaController] Failed to restore volume:', error)
    }
  }
}
