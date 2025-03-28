import * as os from 'os';
import * as vscode from 'vscode';

interface ShellConfig {
  shell: string;
  args?: string[];
  env?: { [key: string]: string };
  useWslIfAvailable?: boolean; // For Windows systems with WSL
}

export class ShellManager {
  private static instance: ShellManager;
  
  private constructor() {}
  
  public static getInstance(): ShellManager {
    if (!ShellManager.instance) {
      ShellManager.instance = new ShellManager();
    }
    return ShellManager.instance;
  }
  
  public getDefaultShellConfig(): ShellConfig {
    const platform = os.platform();
    
    switch (platform) {
      case 'win32':
        // Use PowerShell by default on Windows
        return {
          shell: 'powershell.exe',
          args: ['-NoLogo'], // Prevent startup message
          env: {
            // Ensure consistent encoding
            POWERSHELL_TELEMETRY_OPTOUT: '1',
            // Force UTF-8
            PYTHONIOENCODING: 'utf-8',
            LANG: 'en_US.UTF-8'
          }
        };
        
      case 'darwin':
        // Use default shell on macOS (usually zsh)
        const macShell = process.env.SHELL || '/bin/zsh';
        return {
          shell: macShell,
          env: {
            LANG: 'en_US.UTF-8',
            TERM: 'xterm-256color'
          }
        };
        
      default:
        // Linux and others - use system default
        const defaultShell = process.env.SHELL || '/bin/bash';
        return {
          shell: defaultShell,
          env: {
            LANG: 'en_US.UTF-8',
            TERM: 'xterm-256color'
          }
        };
    }
  }
  
  public createTerminal(name: string): vscode.Terminal {
    const config = this.getDefaultShellConfig();
    
    // Create terminal with platform-specific configuration
    return vscode.window.createTerminal({
      name,
      shellPath: config.shell,
      shellArgs: config.args,
      env: config.env,
    });
  }
  
  public normalizeCommand(command: string): string {
    const platform = os.platform();
    
    if (platform === 'win32') {
      // PowerShell specific adjustments
      // Escape special characters and handle path separators
      return command
        .replace(/\\/g, '\\\\')    // Escape backslashes
        .replace(/"/g, '\\"')      // Escape quotes
        .replace(/\$/g, '`$')      // Escape PowerShell variables
        .replace(/\n/g, '; ');     // Convert newlines to command separator
    }
    
    // For Unix-like systems, minimal normalization needed
    return command.replace(/\n/g, ' && ');
  }
  
  public getShellIntegrationTimeout(): number {
    const platform = os.platform();
    
    // PowerShell on Windows needs more time for integration
    if (platform === 'win32') {
      return 8000; // 8 seconds
    }
    
    // Default timeout for other platforms
    return 5000; // 5 seconds
  }
  
  public async killProcess(terminal: vscode.Terminal): Promise<void> {
    const platform = os.platform();
    
    if (platform === 'win32') {
      // PowerShell kill command
      await terminal.sendText('Stop-Process -Id $PID -Force');
    } else {
      // Unix-like systems
      await terminal.sendText('\x03'); // Send SIGINT (Ctrl+C)
    }
  }
  
  public getWorkingDirectoryCommand(): string {
    const platform = os.platform();
    
    if (platform === 'win32') {
      return '$PWD.Path'; // PowerShell
    } else {
      return 'pwd'; // Unix-like
    }
  }
}
