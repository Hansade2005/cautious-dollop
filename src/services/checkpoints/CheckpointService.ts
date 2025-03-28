import * as vscode from 'vscode'
import { isWindows, isMacOS, normalizePath, handlePlatformSpecificIssues } from '../../shared/checkpoints'
import * as path from 'path'
import * as fs from 'fs'
import { TelemetryService } from '../telemetry/TelemetryService'

export class CheckpointService {
  private static instance: CheckpointService
  private isCheckpointInProgress = false
  private pendingCheckpoints: Set<string> = new Set()
  
  constructor(private context: vscode.ExtensionContext, private telemetry: TelemetryService) {}
  
  public static getInstance(context: vscode.ExtensionContext, telemetry: TelemetryService): CheckpointService {
    if (!CheckpointService.instance) {
      CheckpointService.instance = new CheckpointService(context, telemetry)
    }
    return CheckpointService.instance
  }
  
  public async createCheckpoint(taskId: string, workspaceRoot: string): Promise<string | undefined> {
    try {
      // Apply platform-specific optimizations
      handlePlatformSpecificIssues()
      
      // Normalize workspace path
      const normalizedPath = normalizePath(workspaceRoot)
      
      // Platform-specific pre-checkpoint checks
      await this.platformPreCheckpointChecks(normalizedPath)
      
      // Add to pending queue if another checkpoint is in progress
      if (this.isCheckpointInProgress) {
        this.pendingCheckpoints.add(taskId)
        console.log(`Checkpoint for task ${taskId} queued - another checkpoint is in progress`)
        return undefined
      }
      
      this.isCheckpointInProgress = true
      
      // Create checkpoint logic here (will depend on actual implementation)
      const commitHash = await this.executeCheckpoint(normalizedPath, taskId)
      
      // Report successful checkpoint creation
      this.telemetry.captureCheckpointCreated(taskId)
      
      this.isCheckpointInProgress = false
      
      // Process any queued checkpoints
      this.processPendingCheckpoints(normalizedPath)
      
      return commitHash
    } catch (error) {
      console.error(`Failed to create checkpoint for task ${taskId}:`, error)
      this.isCheckpointInProgress = false
      return undefined
    }
  }
  
  private async platformPreCheckpointChecks(workspacePath: string): Promise<void> {
    if (isWindows) {
      // Wait for Windows to release file locks
      await new Promise(resolve => setTimeout(resolve, 500))
    } else if (isMacOS) {
      // Ensure file system events are flushed on macOS
      await this.flushFileSystemEvents(workspacePath)
    }
  }
  
  private async flushFileSystemEvents(workspacePath: string): Promise<void> {
    // Touch a temp file to ensure all FS events are processed
    const tempFile = path.join(workspacePath, '.roo-checkpoint-sync')
    try {
      fs.writeFileSync(tempFile, Date.now().toString())
      await new Promise(resolve => setTimeout(resolve, 300))
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
    } catch (error) {
      console.log('Failed to flush file system events, continuing anyway', error)
    }
  }
  
  private async executeCheckpoint(workspacePath: string, taskId: string): Promise<string> {
    // Placeholder for actual checkpoint creation logic
    // This would interact with git or another versioning mechanism
    console.log(`Creating checkpoint for task ${taskId} in ${workspacePath}`)
    
    // Simulating a checkpoint creation with a random hash
    // Replace with actual implementation
    return Math.random().toString(36).substring(2, 15)
  }
  
  private async processPendingCheckpoints(workspacePath: string): Promise<void> {
    if (this.pendingCheckpoints.size > 0) {
      const nextTask = Array.from(this.pendingCheckpoints)[0]
      this.pendingCheckpoints.delete(nextTask)
      
      // Process the next checkpoint
      this.createCheckpoint(nextTask, workspacePath)
    }
  }
}
