import { systemPreferences, dialog, shell } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * Opens the specific System Settings pane on macOS Ventura+
 */
function openSystemSettings(pane: string): void {
  shell.openExternal(`x-apple.systempreferences:com.apple.preference.security?${pane}`)
}

/**
 * Configures FN key to "do nothing" so WhisperMe can capture it.
 * AppleFnUsageType: 0 = do nothing, 1 = change input, 2 = dictation, 3 = emoji
 */
async function configureFnKey(): Promise<void> {
  try {
    const { stdout } = await execAsync(
      'defaults read com.apple.HIToolbox AppleFnUsageType 2>/dev/null || echo "3"'
    )
    const currentValue = parseInt(stdout.trim(), 10)

    if (currentValue !== 0) {
      await execAsync('defaults write com.apple.HIToolbox AppleFnUsageType -int 0')
    }
  } catch {
    // Non-critical – FN events might still work
  }
}

/**
 * Waits until accessibility is granted, checking every 2 seconds.
 * Opens System Settings automatically.
 */
async function waitForAccessibility(): Promise<void> {
  if (systemPreferences.isTrustedAccessibilityClient(false)) return

  // Trigger the system prompt that adds us to the list
  systemPreferences.isTrustedAccessibilityClient(true)

  // Open the exact settings pane
  openSystemSettings('Privacy_Accessibility')

  await dialog.showMessageBox({
    type: 'info',
    title: 'Accessibility',
    message: 'WhisperMe needs Accessibility access.',
    detail:
      'System Settings has been opened.\nPlease enable WhisperMe in the list and click "Done".',
    buttons: ['Done'],
  })

  // Poll until granted (max 60s)
  let attempts = 0
  while (!systemPreferences.isTrustedAccessibilityClient(false) && attempts < 30) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    attempts++
  }

  if (!systemPreferences.isTrustedAccessibilityClient(false)) {
    await dialog.showMessageBox({
      type: 'warning',
      title: 'Permission missing',
      message:
        'Accessibility access was not granted. Text insertion will only work via clipboard.',
      buttons: ['OK'],
    })
  }
}

/**
 * Requests Input Monitoring permission by opening System Settings.
 */
async function requestInputMonitoring(): Promise<void> {
  openSystemSettings('Privacy_ListenEvent')

  await dialog.showMessageBox({
    type: 'info',
    title: 'Input Monitoring',
    message: 'WhisperMe needs Input Monitoring for the FN key.',
    detail:
      'System Settings has been opened.\nPlease enable WhisperMe in the list and click "Done".',
    buttons: ['Done'],
  })
}

export async function checkPermissions(): Promise<void> {
  // 1. FN key config – fully automatic, no user action needed
  await configureFnKey()

  // 2. Microphone – shows native system dialog, user just clicks "Allow"
  const micStatus = systemPreferences.getMediaAccessStatus('microphone')
  if (micStatus !== 'granted') {
    const granted = await systemPreferences.askForMediaAccess('microphone')
    if (!granted) {
      openSystemSettings('Privacy_Microphone')
      await dialog.showMessageBox({
        type: 'warning',
        title: 'Microphone',
        message: 'Please allow WhisperMe microphone access in the opened settings.',
        buttons: ['Done'],
      })
    }
  }

  // 3. Accessibility – opens settings, polls until granted
  await waitForAccessibility()

  // 4. Input Monitoring – opens settings (no API to check status)
  await requestInputMonitoring()
}

/**
 * Lightweight check for subsequent launches (skip Input Monitoring prompt).
 * Only re-prompts for missing critical permissions.
 */
export async function checkPermissionsQuick(): Promise<void> {
  const micStatus = systemPreferences.getMediaAccessStatus('microphone')
  if (micStatus !== 'granted') {
    await systemPreferences.askForMediaAccess('microphone')
  }

  if (!systemPreferences.isTrustedAccessibilityClient(false)) {
    await waitForAccessibility()
  }
}
