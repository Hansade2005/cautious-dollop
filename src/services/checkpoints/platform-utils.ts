import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import * as childProcess from 'child_process';
import { promisify } from 'util';

const exec = promisify(childProcess.exec);

type ErrnoException = NodeJS.ErrnoException;

export interface PlatformUtils {
  normalizePath(inputPath: string): Promise<string>;
  getGitPath(): Promise<string>;
  ensureDirectoryAccess(dir: string): Promise<void>;
  safeRename(source: string, target: string): Promise<void>;
  getBranchName(taskId: string, existingBranches: string[]): string;
}

class WindowsPlatformUtils implements PlatformUtils {
  async normalizePath(inputPath: string): Promise<string> {
    return path.normalize(inputPath).split(path.sep).join('/');
  }

  async getGitPath(): Promise<string> {
    const possiblePaths = [
      'C:\\Program Files\\Git\\bin\\git.exe',
      'C:\\Program Files (x86)\\Git\\bin\\git.exe',
      path.join(process.env.USERPROFILE || '', 'scoop', 'shims', 'git.exe'),
      'C:\\ProgramData\\chocolatey\\bin\\git.exe'
    ];

    for (const gitPath of possiblePaths) {
      try {
        await fsPromises.access(gitPath, fs.constants.X_OK);
        return gitPath;
      } catch {
        continue;
      }
    }

    try {
      await exec('git --version');
      return 'git';
    } catch (err) {
      const error = err as childProcess.ExecException;
      throw new Error(`Git not found. Please install Git for Windows.\nError: ${error.message}`);
    }
  }

  async ensureDirectoryAccess(dir: string): Promise<void> {
    try {
      await fsPromises.access(dir, fs.constants.W_OK);
    } catch (err) {
      const error = err as ErrnoException;
      throw new Error(
        `Cannot access directory ${dir}. Please check permissions and antivirus settings.\nError: ${error.message}`
      );
    }
  }

  async safeRename(source: string, target: string): Promise<void> {
    const maxRetries = 3;
    const retryDelay = 100;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await fsPromises.rename(source, target);
        return;
      } catch (err) {
        const error = err as ErrnoException;
        if (error.code === 'EACCES' && attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        throw new Error(
          `Failed to rename ${source} to ${target}. File may be in use.\nError: ${error.message}`
        );
      }
    }
  }

  getBranchName(taskId: string, existingBranches: string[]): string {
    const base = `roo-${taskId.toLowerCase()}`;
    if (!existingBranches.includes(base)) {
      return base;
    }
    return `${base}-${Math.random().toString(36).slice(2, 7)}`;
  }
}

class MacPlatformUtils implements PlatformUtils {
  async normalizePath(inputPath: string): Promise<string> {
    return path.normalize(inputPath);
  }

  async getGitPath(): Promise<string> {
    try {
      await exec('git --version');
      return 'git';
    } catch (err) {
      const error = err as childProcess.ExecException;
      throw new Error(
        `Git not found. Please install Git via Homebrew or Xcode Command Line Tools.\nError: ${error.message}`
      );
    }
  }

  async ensureDirectoryAccess(dir: string): Promise<void> {
    try {
      await fsPromises.access(dir, fs.constants.W_OK);
    } catch (err) {
      const error = err as ErrnoException;
      if (dir.includes('Library') || dir.includes('Application Support')) {
        throw new Error(
          `macOS requires explicit permission to access ${dir}.\nPlease grant access in System Settings > Privacy & Security > Files and Folders.\nError: ${error.message}`
        );
      }
      throw error;
    }
  }

  async safeRename(source: string, target: string): Promise<void> {
    await fsPromises.rename(source, target);
  }

  getBranchName(taskId: string, existingBranches: string[]): string {
    const normalizedBranches = existingBranches.map(b => b.toLowerCase());
    const base = `roo-${taskId.toLowerCase()}`;
    
    if (!normalizedBranches.includes(base)) {
      return base;
    }

    return `${base}-${Date.now().toString(36)}`;
  }
}

class UnixPlatformUtils implements PlatformUtils {
  async normalizePath(inputPath: string): Promise<string> {
    return path.normalize(inputPath);
  }

  async getGitPath(): Promise<string> {
    try {
      await exec('git --version');
      return 'git';
    } catch (err) {
      const error = err as childProcess.ExecException;
      throw new Error(`Git not found. Please install Git using your package manager.\nError: ${error.message}`);
    }
  }

  async ensureDirectoryAccess(dir: string): Promise<void> {
    await fsPromises.access(dir, fs.constants.W_OK);
  }

  async safeRename(source: string, target: string): Promise<void> {
    await fsPromises.rename(source, target);
  }

  getBranchName(taskId: string, existingBranches: string[]): string {
    const base = `roo-${taskId}`;
    return existingBranches.includes(base) ? `${base}-${Date.now().toString(36)}` : base;
  }
}

export function getPlatformUtils(): PlatformUtils {
  if (process.platform === 'win32') {
    return new WindowsPlatformUtils();
  } else if (process.platform === 'darwin') {
    return new MacPlatformUtils();
  }
  return new UnixPlatformUtils();
}
