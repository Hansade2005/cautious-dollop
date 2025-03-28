import { CheckpointStorage, isCheckpointStorage } from "../schemas"
import * as os from 'os'

export { type CheckpointStorage, isCheckpointStorage }

// Platform detection
export const isWindows = os.platform() === 'win32'
export const isMacOS = os.platform() === 'darwin'
export const isLinux = os.platform() === 'linux'

// Normalize paths for cross-platform compatibility
export function normalizePath(path: string): string {
  // Ensure consistent path separators
  return path.replace(/\\/g, '/')
}

// Handle platform-specific issues when creating checkpoints
export function handlePlatformSpecificIssues(): void {
  if (isWindows) {
    // Increase retry count and timeouts for Windows
    process.env.GIT_CHECKPOINT_RETRY_COUNT = '3'
    process.env.GIT_CHECKPOINT_TIMEOUT = '5000'
  } else if (isMacOS) {
    // Ensure macOS file events have completed before checkpoint
    process.env.GIT_CHECKPOINT_DELAY = '300'
  }
}
