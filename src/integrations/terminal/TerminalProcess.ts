import { EventEmitter } from 'events';

declare interface TerminalEvents {
  'continue': () => void;
  'error': (error: unknown) => void;
  'stream_available': (stream: AsyncIterable<string>) => void;
  'shell_execution_complete': (details: ExitCodeDetails) => void;
  'no_shell_integration': (message: string) => void;
  'line': (line: string) => void;
  'completed': (output?: string) => void;
  [key: string]: (...args: any[]) => void; // Allow any string events for backward compatibility
}

export interface ExitCodeDetails {
  exitCode: number;
  signalName?: string;
  coreDumpPossible?: boolean;
  signal?: number;
}

export interface TerminalProcessResultPromise extends Promise<void> {
  process: TerminalProcess;
  continue: () => TerminalProcessResultPromise;
  on: (event: string | keyof TerminalEvents, listener: (...args: any[]) => void) => TerminalProcessResultPromise;
  once: (event: string | keyof TerminalEvents, listener: (...args: any[]) => void) => TerminalProcessResultPromise;
  then: <TResult1 = void, TResult2 = never>(
    onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) => Promise<TResult1 | TResult2>;
  catch: <TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ) => Promise<void | TResult>;
  finally: (onfinally?: (() => void) | null) => Promise<void>;
}

export class TerminalProcess extends EventEmitter {
  // Add strongly typed event methods
  public emit<K extends keyof TerminalEvents>(event: K, ...args: Parameters<TerminalEvents[K]>): boolean {
    return super.emit(event, ...args);
  }

  public on<K extends keyof TerminalEvents>(event: K, listener: TerminalEvents[K]): this {
    return super.on(event, listener);
  }

  public once<K extends keyof TerminalEvents>(event: K, listener: TerminalEvents[K]): this {
    return super.once(event, listener);
  }

  // Static methods
  public static interpretExitCode(code: number, signal?: string, coreDumpPossible?: boolean): ExitCodeDetails {
    return {
      exitCode: code,
      signalName: signal,
      coreDumpPossible: coreDumpPossible
    };
  }

  // Instance properties
  private terminal: any; // Reference to parent Terminal instance
  private unretrievedOutput: string = "";
  public command?: string;
  public isHot: boolean = false;
  public fullOutput: string[] = [];
  public lastRetrievedIndex: number = 0;
  public isListening: boolean = false;

  // Instance methods
  public continue(): void {
    this.emit('continue');
  }

  public getFullOutput(): string[] {
    return this.fullOutput;
  }

  public getLastRetrievedIndex(): number {
    return this.lastRetrievedIndex;
  }

  public setLastRetrievedIndex(index: number): void {
    this.lastRetrievedIndex = index;
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  public setIsListening(value: boolean): void {
    this.isListening = value;
  }

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
  
  // Add event handling methods that delegate to the process
  resultPromise.continue = () => {
    process.continue();
    return resultPromise;
  };

  resultPromise.on = ((event: string | keyof TerminalEvents, listener: (...args: any[]) => void) => {
    process.on(event, listener);
    return resultPromise;
  }) as any;

  resultPromise.once = ((event: string | keyof TerminalEvents, listener: (...args: any[]) => void) => {
    process.once(event, listener);
    return resultPromise;
  }) as any;

  // Implement Promise interface methods
  resultPromise.then = promise.then.bind(promise);
  resultPromise.catch = promise.catch.bind(promise);
  resultPromise.finally = promise.finally.bind(promise);

  return resultPromise;
}
