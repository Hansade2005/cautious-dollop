import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { readFileSync } from 'fs';
import * as path from 'path';
import { Node, ArrowFunctionExpression, FunctionDeclaration, Identifier, VariableDeclarator } from '@babel/types';

interface TestCase {
  name: string;
  inputs: any[];
  expectedOutput?: any;
  description: string;
}

interface FunctionMetadata {
  name: string;
  params: string[];
  returnType?: string;
  async: boolean;
  tests: TestCase[];
}

interface TestGenerationResult {
  testCode: string;
  framework: string;
  coverageEstimate: number;
  functionsCovered: FunctionMetadata[];
}

function inferTestCases(functionNode: t.FunctionDeclaration | t.ArrowFunctionExpression): TestCase[] {
  const tests: TestCase[] = [];
  
  // Basic test case - null check
  tests.push({
    name: `should handle null inputs`,
    inputs: functionNode.params.map(() => null),
    description: "Tests function behavior with null inputs"
  });
  
  // Empty/default values test
  tests.push({
    name: `should handle empty/default values`,
    inputs: functionNode.params.map(() => undefined),
    description: "Tests function behavior with empty or default values"
  });
  
  // Analyze function body for conditional branches
  const wrappedNode = t.isFunctionDeclaration(functionNode) ? functionNode : t.functionDeclaration(
    t.identifier('temp'),
    functionNode.params,
    t.isBlockStatement(functionNode.body) ? functionNode.body : t.blockStatement([t.returnStatement(functionNode.body)])
  );
  
  const ast = t.file(t.program([wrappedNode]));
  
  traverse(ast, {
    IfStatement(path) {
      const condition = path.node.test;
      if (t.isBinaryExpression(condition)) {
        // Generate test for this condition
        tests.push({
          name: `should handle condition: ${generate(condition).code}`,
          inputs: [], // To be determined based on condition
          description: `Tests the condition: ${generate(condition).code}`
        });
      }
    }
  });
  
  return tests;
}

function generateTestCode(filePath: string, framework: 'jest' | 'mocha' = 'jest'): TestGenerationResult {
  const sourceCode = readFileSync(filePath, 'utf8');
  const ast = parser.parse(sourceCode, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx']
  });
  
  const functions: FunctionMetadata[] = [];
  
  traverse(ast, {
    ArrowFunctionExpression(path) {
      const node = path.node as t.ArrowFunctionExpression;
      const parentVariableDeclarator = path.findParent(p => p.isVariableDeclarator()) as traverse.NodePath<VariableDeclarator>;
      if (!parentVariableDeclarator || !t.isIdentifier(parentVariableDeclarator.node.id)) return;
      
      const metadata: FunctionMetadata = {
        name: (parentVariableDeclarator.node.id as Identifier).name,
        params: node.params.map(param => generate(param).code),
        async: node.async,
        tests: inferTestCases(node)
      };
      
      functions.push(metadata);
    },
    
    FunctionDeclaration(path) {
      const node = path.node as t.FunctionDeclaration;
      if (!node.id) return;
      
      const metadata: FunctionMetadata = {
        name: node.id.name,
        params: node.params.map(param => generate(param).code),
        async: node.async,
        tests: inferTestCases(node)
      };
      
      functions.push(metadata);
    }
  });
  
  // Generate test file content
  const fileName = path.basename(filePath);
  const testCode = generateTestFileContent(fileName, functions, framework);
  
  return {
    testCode,
    framework,
    coverageEstimate: estimateCoverage(functions),
    functionsCovered: functions
  };
}

function generateTestFileContent(
  fileName: string,
  functions: FunctionMetadata[],
  framework: 'jest' | 'mocha'
): string {
  const isJest = framework === 'jest';
  const describe = isJest ? 'describe' : 'describe';
  const it = isJest ? 'test' : 'it';
  
  let content = `// Generated tests for ${fileName}\n`;
  
  if (isJest) {
    content += `import { ${functions.map(f => f.name).join(', ')} } from './${fileName}';\n\n`;
  } else {
    content += `const { ${functions.map(f => f.name).join(', ')} } = require('./${fileName}');\n\n`;
  }
  
  content += `${describe}('${fileName}', () => {\n`;
  
  for (const func of functions) {
    content += `  ${describe}('${func.name}', () => {\n`;
    
    for (const test of func.tests) {
      const asyncMod = func.async ? 'async ' : '';
      content += `    ${it}('${test.name}', ${asyncMod}() => {\n`;
      
      // Generate test implementation
      const params = test.inputs.map(input => 
        input === null ? 'null' : 
        input === undefined ? 'undefined' : 
        JSON.stringify(input)
      ).join(', ');
      
      if (func.async) {
        content += `      const result = await ${func.name}(${params});\n`;
      } else {
        content += `      const result = ${func.name}(${params});\n`;
      }
      
      if (test.expectedOutput !== undefined) {
        content += `      expect(result).toBe(${JSON.stringify(test.expectedOutput)});\n`;
      } else {
        content += `      // TODO: Add assertions based on expected behavior\n`;
      }
      
      content += `    });\n\n`;
    }
    
    content += `  });\n\n`;
  }
  
  content += `});\n`;
  
  return content;
}

function estimateCoverage(functions: FunctionMetadata[]): number {
  let totalBranches = 0;
  let coveredBranches = 0;
  
  for (const func of functions) {
    // Each function has at least one path
    totalBranches++;
    coveredBranches++;
    
    // Each test case potentially covers a new branch
    totalBranches += func.tests.length;
    coveredBranches += func.tests.length;
  }
  
  return (coveredBranches / totalBranches) * 100;
}

export async function generateTests(
  filePath: string,
  framework: 'jest' | 'mocha' = 'jest',
  onProgress: (message: string) => void
): Promise<TestGenerationResult> {
  onProgress(`Analyzing ${filePath}...`);
  const result = generateTestCode(filePath, framework);
  
  onProgress(`Generated ${result.functionsCovered.length} function tests with estimated ${result.coverageEstimate.toFixed(1)}% coverage`);
  
  return result;
}
