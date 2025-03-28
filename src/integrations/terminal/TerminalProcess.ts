import { EventEmitter } from "events";

export interface ExitCodeDetails {
  code: number;
  signal?: string;
}

export interface TerminalProcessResultPromise extends Promise<void> {
  process: TerminalProcess;
}

export class TerminalProcess extends EventEmitter {
  private terminal: any; // Reference to parent Terminal instance
  private unretrievedOutput: string = "";
  public command?: string;

  constructor(terminal: any) {
    super();
    this.terminal = terminal;
  }

  /**
   * Runs a command in the terminal
   */
  public run(command: string): void {
    if (this.terminal && this.terminal.terminal) {
      this.terminal.terminal.sendText(command);
      this.terminal.running = true;
    }
  }

  /**
   * Checks if there is unretrieved output
   */
  public hasUnretrievedOutput(): boolean {
    return this.unretrievedOutput.length > 0;
  }

  /**
   * Gets and clears unretrieved output
   */
  public getUnretrievedOutput(): string {
    const output = this.unretrievedOutput;
    this.unretrievedOutput = "";
    return output;
  }

  /**
   * Adds output to the unretrieved buffer
   */
  public addOutput(output: string): void {
    this.unretrievedOutput += output;
  }
}

/**
 * Merges a process with a promise for combined functionality
 */
export function mergePromise(process: TerminalProcess, promise: Promise<void>): TerminalProcessResultPromise {
  const resultPromise = promise as TerminalProcessResultPromise;
  resultPromise.process = process;
  return resultPromise;
}
