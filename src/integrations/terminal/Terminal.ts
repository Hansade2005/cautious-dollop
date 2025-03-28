import * as vscode from "vscode"
import pWaitFor from "p-wait-for"
import { ExitCodeDetails, mergePromise, TerminalProcess, TerminalProcessResultPromise } from "./TerminalProcess"
import { truncateOutput, applyRunLengthEncoding } from "../misc/extract-text"
import { ShellManager } from "../../services/shell-manager"

// Export timeout constant
export const TERMINAL_SHELL_INTEGRATION_TIMEOUT = 10000;

export class Terminal {
private static shellManager = ShellManager.getInstance();
private static shellIntegrationTimeout: number = TERMINAL_SHELL_INTEGRATION_TIMEOUT;

public static getShellIntegrationTimeout(): number {
    return Terminal.shellIntegrationTimeout;
}

public static setShellIntegrationTimeout(timeout: number): void {
    Terminal.shellIntegrationTimeout = timeout;
}

public terminal: vscode.Terminal
public busy: boolean
public id: number
public running: boolean
private streamClosed: boolean
public process?: TerminalProcess
public taskId?: string
public cmdCounter: number = 0
public completedProcesses: TerminalProcess[] = []
private initialCwd: string

constructor(id: number, terminal: vscode.Terminal, cwd: string) {
this.id = id
this.busy = false
this.running = false
this.streamClosed = false
this.initialCwd = cwd
this.terminal = terminal

// Set shell integration timeout based on platform
Terminal.shellIntegrationTimeout = Terminal.shellManager.getShellIntegrationTimeout();
}

/**
 * Gets the current working directory from shell integration or falls back to initial cwd
 * @returns The current working directory
 */
public getCurrentWorkingDirectory(): string {
if (this.terminal.shellIntegration?.cwd) {
return this.terminal.shellIntegration.cwd.fsPath
} else {
return this.initialCwd
}
}

/**
 * Checks if the stream is closed
 */
public isStreamClosed(): boolean {
return this.streamClosed
}

/**
 * Sets the active stream for this terminal and notifies the process
 */
public setActiveStream(stream: AsyncIterable<string> | undefined): void {
if (stream) {
if (!this.process) {
this.running = false
console.warn(
`[Terminal ${this.id}] process is undefined, so cannot set terminal stream (probably user-initiated non-Roo command)`,
)
return
}

this.streamClosed = false
this.process.emit("stream_available", stream)
} else {
this.streamClosed = true
}
}

/**
 * Handles shell execution completion for this terminal
 */
public shellExecutionComplete(exitDetails: ExitCodeDetails): void {
this.busy = false

if (this.process) {
if (this.process.hasUnretrievedOutput()) {
this.completedProcesses.unshift(this.process)
}

this.process.emit("shell_execution_complete", exitDetails)
this.process = undefined
}
}

/**
 * Gets the last executed command
 */
public getLastCommand(): string {
if (this.process) {
return this.process.command || ""
} else if (this.completedProcesses.length > 0) {
return this.completedProcesses[0].command || ""
}
return ""
}

/**
 * Cleans the process queue
 */
public cleanCompletedProcessQueue(): void {
this.completedProcesses = this.completedProcesses.filter((process) => process.hasUnretrievedOutput())
}

/**
 * Gets all processes with unretrieved output
 */
public getProcessesWithOutput(): TerminalProcess[] {
this.cleanCompletedProcessQueue()
return [...this.completedProcesses]
}

/**
 * Gets all unretrieved output from both active and completed processes
 */
public getUnretrievedOutput(): string {
let output = ""

for (const process of this.completedProcesses) {
const processOutput = process.getUnretrievedOutput()
if (processOutput) {
output += processOutput
}
}

const activeOutput = this.process?.getUnretrievedOutput()
if (activeOutput) {
output += activeOutput
}

this.cleanCompletedProcessQueue()

return output
}

public runCommand(command: string): TerminalProcessResultPromise {
this.busy = true

const process = new TerminalProcess(this)
process.command = Terminal.shellManager.normalizeCommand(command)
this.process = process

const promise = new Promise<void>((resolve, reject) => {
process.once("continue", () => resolve())
process.once("error", (error) => {
console.error(`[Terminal ${this.id}] error:`, error)
reject(error)
})

pWaitFor(() => this.terminal.shellIntegration !== undefined, { 
timeout: Terminal.shellIntegrationTimeout 
})
.then(() => {
process.run(process.command!)
})
.catch(() => {
console.log(`[Terminal ${this.id}] Shell integration not available. Command execution aborted.`)
process.emit(
"no_shell_integration",
"Shell integration initialization sequence '\]633;A' was not received within timeout. Shell integration has been disabled for this terminal instance.",
)
})
})

return mergePromise(process, promise)
}

/**
 * Gets the terminal contents
 */
public static async getTerminalContents(commands = -1): Promise<string> {
const tempCopyBuffer = await vscode.env.clipboard.readText()

try {
if (commands < 0) {
await vscode.commands.executeCommand("workbench.action.terminal.selectAll")
} else {
for (let i = 0; i < commands; i++) {
await vscode.commands.executeCommand("workbench.action.terminal.selectToPreviousCommand")
}
}

await vscode.commands.executeCommand("workbench.action.terminal.copySelection")
await vscode.commands.executeCommand("workbench.action.terminal.clearSelection")

let terminalContents = (await vscode.env.clipboard.readText()).trim()
await vscode.env.clipboard.writeText(tempCopyBuffer)

if (tempCopyBuffer === terminalContents) {
return ""
}

const lines = terminalContents.split(/\r?\n/)
const lastLine = lines.pop()?.trim()
if (lastLine) {
let i = lines.length - 1
while (i >= 0 && !lines[i].trim().startsWith(lastLine)) {
i--
}
terminalContents = lines.slice(Math.max(i, 0)).join("\n")
}

return terminalContents
} catch (error) {
await vscode.env.clipboard.writeText(tempCopyBuffer)
throw error
}
}

/**
 * Compresses terminal output
 */
public static compressTerminalOutput(input: string, lineLimit: number): string {
return truncateOutput(applyRunLengthEncoding(input), lineLimit)
}
}
