import { TerminalProcess, ExitCodeDetails } from '../TerminalProcess';
import { execSync } from "child_process"
import { Terminal } from "../Terminal"
import * as vscode from "vscode"

// Mock vscode.Terminal for testing
const mockTerminal = {
	name: "Test Terminal",
	processId: Promise.resolve(123),
	creationOptions: {},
	exitStatus: undefined,
	state: { isInteractedWith: true },
	dispose: jest.fn(),
	hide: jest.fn(),
	show: jest.fn(),
	sendText: jest.fn(),
} as unknown as vscode.Terminal

describe('TerminalProcess.interpretExitCode', () => {
	it('should handle normal exit code 0', () => {
		const result = TerminalProcess.interpretExitCode(0);
		expect(result).toEqual({
			exitCode: 0,
			signalName: undefined,
			coreDumpPossible: undefined
		});
	});

	it('should handle non-zero exit code', () => {
		const result = TerminalProcess.interpretExitCode(1);
		expect(result).toEqual({
			exitCode: 1,
			signalName: undefined,
			coreDumpPossible: undefined
		});
	});

	it('should handle signal termination', () => {
		const result = TerminalProcess.interpretExitCode(0, 'SIGTERM');
		expect(result).toEqual({
			exitCode: 0,
			signalName: 'SIGTERM',
			coreDumpPossible: undefined
		});
	});

	it('should handle core dump possibility', () => {
		const result = TerminalProcess.interpretExitCode(0, 'SIGSEGV', true);
		expect(result).toEqual({
			exitCode: 0,
			signalName: 'SIGSEGV',
			coreDumpPossible: true
		});
	});

	it('should handle all parameters', () => {
		const result = TerminalProcess.interpretExitCode(1, 'SIGABRT', true);
		expect(result).toEqual({
			exitCode: 1,
			signalName: 'SIGABRT',
			coreDumpPossible: true
		});
	});
});

describe("TerminalProcess.interpretExitCode with real commands", () => {
	it("should correctly interpret exit code 0 from successful command", () => {
		try {
			// Run a command that should succeed
			execSync("echo test", { stdio: "ignore" })
			// If we get here, the command succeeded with exit code 0
			const result = TerminalProcess.interpretExitCode(0)
			expect(result).toEqual({ exitCode: 0 })
		} catch (error: any) {
			// This should not happen for a successful command
			fail("Command should have succeeded: " + error.message)
		}
	})

	it("should correctly interpret exit code 1 from failed command", () => {
		try {
			// Run a command that should fail with exit code 1 or 2
			execSync("ls /nonexistent_directory", { stdio: "ignore" })
			fail("Command should have failed")
		} catch (error: any) {
			// Verify the exit code is what we expect (can be 1 or 2 depending on the system)
			expect(error.status).toBeGreaterThan(0)
			expect(error.status).toBeLessThan(128) // Not a signal
			const result = TerminalProcess.interpretExitCode(error.status)
			expect(result).toEqual({ exitCode: error.status })
		}
	})

	it("should correctly interpret exit code from command with custom exit code", () => {
		try {
			// Run a command that exits with a specific code
			execSync("exit 42", { stdio: "ignore" })
			fail("Command should have exited with code 42")
		} catch (error: any) {
			expect(error.status).toBe(42)
			const result = TerminalProcess.interpretExitCode(error.status)
			expect(result).toEqual({ exitCode: 42 })
		}
	})

	// Test signal interpretation directly without relying on actual process termination
	it("should correctly interpret signal termination codes", () => {
		// Test SIGTERM (signal 15)
		const sigtermExitCode = 128 + 15
		const sigtermResult = TerminalProcess.interpretExitCode(sigtermExitCode)
		expect(sigtermResult.signal).toBe(15)
		expect(sigtermResult.signalName).toBe("SIGTERM")
		expect(sigtermResult.coreDumpPossible).toBe(false)

		// Test SIGSEGV (signal 11)
		const sigsegvExitCode = 128 + 11
		const sigsegvResult = TerminalProcess.interpretExitCode(sigsegvExitCode)
		expect(sigsegvResult.signal).toBe(11)
		expect(sigsegvResult.signalName).toBe("SIGSEGV")
		expect(sigsegvResult.coreDumpPossible).toBe(true)

		// Test SIGINT (signal 2)
		const sigintExitCode = 128 + 2
		const sigintResult = TerminalProcess.interpretExitCode(sigintExitCode)
		expect(sigintResult.signal).toBe(2)
		expect(sigintResult.signalName).toBe("SIGINT")
		expect(sigintResult.coreDumpPossible).toBe(false)
	})
})
