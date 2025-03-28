import { ToolArgs } from "./types"
import { generateTests } from "../../../services/test-generator"
import * as vscode from "vscode"

export function getGenerateTestsDescription(args: ToolArgs): string | undefined {
  return `## generate_tests
Description: Automatically generates unit tests for source code files. The tool analyzes the code structure, identifies functions and their behaviors, and creates comprehensive test suites. Features:
- Supports JavaScript/TypeScript code
- Generates tests for both functions and arrow functions
- Handles async functions
- Creates test cases for different code paths
- Supports Jest and Mocha frameworks

Parameters:
- path: (required) Path to the source file to generate tests for
- framework: (optional) Testing framework to use ('jest' or 'mocha', default: 'jest')

Usage:
<generate_tests>
<path>src/utils/auth.ts</path>
<framework>jest</framework>
</generate_tests>

The tool will:
1. Analyze the source code
2. Extract function signatures and behavior
3. Generate appropriate test cases
4. Write tests to a matching test file (e.g., auth.test.ts)
5. Show progress and coverage estimates`
}

interface GenerateTestsResult {
  type: "success" | "error";
  message: string;
  details?: {
    testFile: string;
    coverageEstimate: number;
    functionsTested: number;
  };
}

export async function handleGenerateTests(
  path: string,
  framework: 'jest' | 'mocha' = 'jest'
): Promise<GenerateTestsResult> {
  const progressOptions: vscode.ProgressOptions = {
    location: vscode.ProgressLocation.Notification,
    title: "Generating Tests",
    cancellable: true
  };

  return await vscode.window.withProgress(
    progressOptions,
    async (
      progress: vscode.Progress<{ message?: string }>,
      token: vscode.CancellationToken
    ): Promise<GenerateTestsResult> => {
      try {
        const result = await generateTests(path, framework, message => {
          progress.report({ message });
        });

        // Determine test file path
        const testFile = path.replace(/\.(js|ts|jsx|tsx)$/, `.test.$1`);

        // Write test file
        await vscode.workspace.fs.writeFile(
          vscode.Uri.file(testFile),
          Buffer.from(result.testCode, 'utf8')
        );

        return {
          type: "success",
          message: `Generated tests with ${result.coverageEstimate.toFixed(1)}% estimated coverage`,
          details: {
            testFile,
            coverageEstimate: result.coverageEstimate,
            functionsTested: result.functionsCovered.length
          }
        };

      } catch (error) {
        console.error("Test generation error:", error);
        return {
          type: "error",
          message: `Failed to generate tests: ${(error as Error).message}`
        };
      }
    }
  );
}
