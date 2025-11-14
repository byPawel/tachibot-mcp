export interface TestArchitectOptions {
  model?: string;
  maxTokens?: number;
  testFramework?: 'jest' | 'mocha' | 'vitest' | 'cypress' | 'playwright';
  testTypes?: ('unit' | 'integration' | 'e2e' | 'performance' | 'security')[];
  coverage?: 'basic' | 'thorough' | 'comprehensive';
  generateMocks?: boolean;
}

export interface TestArchitectResult {
  testSuite: TestSuite;
  testFiles: TestFile[];
  mockFiles: MockFile[];
  testConfig: TestConfiguration;
  edgeCases: EdgeCase[];
  synthesis: string;
}

export interface TestSuite {
  name: string;
  description: string;
  framework: string;
  totalTests: number;
  testCategories: TestCategory[];
  setupRequirements: string[];
  estimatedCoverage: number;
}

export interface TestFile {
  fileName: string;
  testType: 'unit' | 'integration' | 'e2e' | 'performance' | 'security';
  tests: Test[];
  imports: string[];
  setup: string;
  teardown: string;
  content: string;
}

export interface Test {
  name: string;
  description: string;
  type: 'positive' | 'negative' | 'edge' | 'performance' | 'security';
  priority: 'low' | 'medium' | 'high' | 'critical';
  code: string;
  assertions: string[];
  mocks?: string[];
}

export interface MockFile {
  fileName: string;
  mockType: 'service' | 'api' | 'database' | 'filesystem' | 'external';
  content: string;
  description: string;
}

export interface TestConfiguration {
  framework: string;
  configFile: string;
  scripts: { [key: string]: string };
  dependencies: string[];
  coverage: TestCoverageConfig;
}

export interface TestCoverageConfig {
  threshold: number;
  reports: string[];
  directories: string[];
  excludes: string[];
}

export interface EdgeCase {
  scenario: string;
  input: any;
  expectedOutput: any;
  description: string;
  severity: 'low' | 'medium' | 'high';
  testCode: string;
}

export interface TestCategory {
  name: string;
  testCount: number;
  priority: 'low' | 'medium' | 'high';
  description: string;
}

export class TestArchitect {
  private defaultModel = 'qwen3-coder-480b'; // Best for code generation
  private defaultMaxTokens = 4000;
  private defaultFramework: TestArchitectOptions['testFramework'] = 'jest';
  private defaultTestTypes: TestArchitectOptions['testTypes'] = ['unit', 'integration', 'e2e'];

  async architectTests(code: string, options: TestArchitectOptions = {}): Promise<TestArchitectResult> {
    const model = options.model || this.defaultModel;
    const framework = options.testFramework || this.defaultFramework;
    const testTypes = options.testTypes || this.defaultTestTypes;
    const coverage = options.coverage || 'thorough';
    const generateMocks = options.generateMocks !== false; // default true
    
    // Type assertions to help TypeScript understand these won't be undefined
    const safeFramework = framework as string;
    const safeTestTypes = testTypes as string[];
    const safeCoverage = coverage as string;

    // Analyze code structure
    const codeStructure = await this.analyzeCodeForTesting(code);
    
    // Design test suite architecture
    const testSuite = await this.designTestSuite(codeStructure, safeFramework, safeCoverage);
    
    // Generate test files
    const testFiles = await this.generateTestFiles(codeStructure, safeFramework, safeTestTypes);
    
    // Generate edge cases
    const edgeCases = await this.generateEdgeCases(codeStructure);
    
    // Generate mocks if requested
    const mockFiles = generateMocks ? await this.generateMockFiles(codeStructure, safeFramework) : [];
    
    // Generate test configuration
    const testConfig = await this.generateTestConfiguration(safeFramework, testSuite, safeCoverage);
    
    // Create synthesis
    const synthesis = this.synthesizeTestArchitecture(
      testSuite, testFiles, mockFiles, testConfig, edgeCases
    );

    return {
      testSuite,
      testFiles,
      mockFiles,
      testConfig,
      edgeCases,
      synthesis
    };
  }

  private async analyzeCodeForTesting(code: string): Promise<any> {
    const structure = {
      functions: this.extractTestableFunction(code),
      classes: this.extractTestableClasses(code),
      exports: this.extractExports(code),
      dependencies: this.extractDependencies(code),
      asyncOperations: this.findAsyncOperations(code),
      errorHandling: this.findErrorHandling(code),
      complexity: this.assessTestingComplexity(code),
      riskAreas: this.identifyRiskAreas(code)
    };

    return structure;
  }

  private extractTestableFunction(code: string): any[] {
    const functions: any[] = [];
    const functionPatterns = [
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*\{/g,
      /(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>\s*/g
    ];

    functionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const [, name, params] = match;
        const funcBody = this.extractFunctionBody(code, match.index);
        
        functions.push({
          name,
          parameters: this.parseParameters(params),
          isAsync: match[0].includes('async'),
          isExported: match[0].includes('export'),
          complexity: this.calculateFunctionComplexity(funcBody),
          hasErrorHandling: funcBody.includes('try') || funcBody.includes('catch'),
          body: funcBody,
          testPriority: this.calculateTestPriority(name, funcBody)
        });
      }
    });

    return functions;
  }

  private extractFunctionBody(code: string, startIndex: number): string {
    let braceCount = 0;
    let startBrace = -1;
    
    for (let i = startIndex; i < code.length; i++) {
      if (code[i] === '{') {
        if (startBrace === -1) startBrace = i;
        braceCount++;
      } else if (code[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          return code.substring(startBrace, i + 1);
        }
      }
    }
    
    return '';
  }

  private calculateFunctionComplexity(body: string): 'low' | 'medium' | 'high' {
    const complexityIndicators = ['if', 'for', 'while', 'switch', 'try', '?'];
    const count = complexityIndicators.reduce((sum, indicator) => 
      sum + (body.split(indicator).length - 1), 0
    );
    
    return count > 8 ? 'high' : count > 3 ? 'medium' : 'low';
  }

  private calculateTestPriority(name: string, body: string): 'low' | 'medium' | 'high' | 'critical' {
    // Critical: Security, authentication, payment, data validation
    const criticalKeywords = ['auth', 'login', 'password', 'validate', 'security', 'payment', 'encrypt'];
    if (criticalKeywords.some(keyword => name.toLowerCase().includes(keyword))) {
      return 'critical';
    }

    // High: Error handling, async operations, external APIs
    if (body.includes('throw') || body.includes('await') || body.includes('fetch') || body.includes('axios')) {
      return 'high';
    }

    // Medium: Business logic, calculations, transformations
    if (name.includes('calculate') || name.includes('process') || name.includes('transform')) {
      return 'medium';
    }

    return 'low';
  }

  private extractTestableClasses(code: string): any[] {
    const classes: any[] = [];
    const classPattern = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{([^}]+)\}/g;
    
    let match;
    while ((match = classPattern.exec(code)) !== null) {
      const [, name, extends_, body] = match;
      const methods = this.extractClassMethods(body);
      
      classes.push({
        name,
        extends: extends_,
        methods,
        isExported: match[0].includes('export'),
        testPriority: methods.some((m: any) => m.testPriority === 'critical') ? 'critical' : 'high'
      });
    }

    return classes;
  }

  private extractClassMethods(body: string): any[] {
    const methods: any[] = [];
    const methodPattern = /(async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*\{/g;
    
    let match;
    while ((match = methodPattern.exec(body)) !== null) {
      const [, async, name, params, returnType] = match;
      methods.push({
        name,
        isAsync: !!async,
        parameters: this.parseParameters(params),
        returnType,
        testPriority: this.calculateTestPriority(name, body)
      });
    }

    return methods;
  }

  private extractExports(code: string): string[] {
    const exports: string[] = [];
    const patterns = [
      /export\s+(?:default\s+)?(?:class|function|const)\s+(\w+)/g,
      /export\s*\{\s*([^}]+)\s*\}/g
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        if (match[1].includes(',')) {
          // Handle multiple exports: export { a, b, c }
          match[1].split(',').forEach(name => exports.push(name.trim()));
        } else {
          exports.push(match[1]);
        }
      }
    });

    return exports;
  }

  private extractDependencies(code: string): any[] {
    const dependencies: any[] = [];
    const importPattern = /import\s+(?:\{([^}]+)\}|\*\s+as\s+(\w+)|(\w+))?\s+from\s+['"]([^'"]+)['"]/g;
    
    let match;
    while ((match = importPattern.exec(code)) !== null) {
      const [, named, namespace, default_, module] = match;
      dependencies.push({
        module,
        imports: named ? named.split(',').map(s => s.trim()) : namespace ? [namespace] : [default_],
        type: this.categorizeImport(module)
      });
    }

    return dependencies;
  }

  private categorizeImport(module: string): 'external' | 'internal' | 'builtin' {
    if (module.startsWith('./') || module.startsWith('../')) return 'internal';
    if (['fs', 'path', 'http', 'crypto', 'util'].includes(module)) return 'builtin';
    return 'external';
  }

  private findAsyncOperations(code: string): any[] {
    const asyncOps: any[] = [];
    const patterns = [
      { pattern: /await\s+([^;\n]+)/g, type: 'await' },
      { pattern: /\.then\s*\(/g, type: 'promise' },
      { pattern: /new\s+Promise/g, type: 'promise-constructor' },
      { pattern: /setTimeout|setInterval/g, type: 'timer' }
    ];

    patterns.forEach(({ pattern, type }) => {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        asyncOps.push({
          type,
          code: match[0],
          line: this.getLineNumber(code, match.index)
        });
      }
    });

    return asyncOps;
  }

  private findErrorHandling(code: string): any[] {
    const errorHandling: any[] = [];
    const patterns = [
      { pattern: /try\s*\{[^}]*\}\s*catch/g, type: 'try-catch' },
      { pattern: /throw\s+new\s+Error/g, type: 'throw' },
      { pattern: /\.catch\s*\(/g, type: 'promise-catch' }
    ];

    patterns.forEach(({ pattern, type }) => {
      const matches = code.match(pattern) || [];
      errorHandling.push({
        type,
        count: matches.length
      });
    });

    return errorHandling;
  }

  private identifyRiskAreas(code: string): string[] {
    const risks: string[] = [];
    
    if (code.includes('eval(')) risks.push('Code injection risk (eval)');
    if (code.includes('innerHTML')) risks.push('XSS risk (innerHTML)');
    if (code.includes('JSON.parse') && !code.includes('try')) risks.push('JSON parsing without error handling');
    if (code.includes('parseInt') && !code.includes('10')) risks.push('parseInt without radix');
    if (code.includes('== null') || code.includes('!= null')) risks.push('Loose equality with null');
    
    return risks;
  }

  private getLineNumber(code: string, index: number): number {
    return code.substring(0, index).split('\n').length;
  }

  private parseParameters(paramString: string): any[] {
    if (!paramString.trim()) return [];
    
    return paramString.split(',').map(param => {
      const trimmed = param.trim();
      const [nameAndType] = trimmed.split('=');
      const [name, type] = nameAndType.includes(':') 
        ? nameAndType.split(':').map(s => s.trim())
        : [nameAndType.trim(), 'any'];
      
      return { name, type: type || 'any' };
    });
  }

  private assessTestingComplexity(code: string): 'low' | 'medium' | 'high' {
    const lines = code.split('\n').length;
    const functions = (code.match(/function|=>/g) || []).length;
    const asyncOps = (code.match(/await|\.then/g) || []).length;
    const complexity = lines + functions * 5 + asyncOps * 3;
    
    return complexity > 300 ? 'high' : complexity > 100 ? 'medium' : 'low';
  }

  private async designTestSuite(structure: any, framework: string, coverage: string): Promise<TestSuite> {
    const totalFunctions = structure.functions.length;
    const totalClasses = structure.classes.length;
    const criticalItems = [...structure.functions, ...structure.classes]
      .filter(item => item.testPriority === 'critical').length;

    const testMultiplier = coverage === 'basic' ? 2 : coverage === 'thorough' ? 4 : 6;
    const totalTests = (totalFunctions + totalClasses * 3) * testMultiplier + structure.edgeCases?.length || 0;

    const testCategories: TestCategory[] = [
      {
        name: 'Unit Tests',
        testCount: totalFunctions * testMultiplier,
        priority: 'high',
        description: 'Individual function and method testing'
      },
      {
        name: 'Integration Tests',
        testCount: Math.ceil(totalTests * 0.3),
        priority: 'medium',
        description: 'Component interaction testing'
      },
      {
        name: 'Edge Cases',
        testCount: structure.riskAreas.length * 2,
        priority: 'high',
        description: 'Boundary and error condition testing'
      }
    ];

    if (criticalItems > 0) {
      testCategories.push({
        name: 'Security Tests',
        testCount: criticalItems * 3,
        priority: 'high',
        description: 'Security and validation testing'
      });
    }

    return {
      name: `${framework.charAt(0).toUpperCase() + framework.slice(1)} Test Suite`,
      description: `Comprehensive test suite with ${coverage} coverage`,
      framework,
      totalTests,
      testCategories,
      setupRequirements: this.generateSetupRequirements(structure, framework),
      estimatedCoverage: coverage === 'basic' ? 70 : coverage === 'thorough' ? 85 : 95
    };
  }

  private generateSetupRequirements(structure: any, framework: string): string[] {
    const requirements: string[] = [
      `Install ${framework} and related dependencies`,
      'Configure test scripts in package.json'
    ];

    if (structure.asyncOperations.length > 0) {
      requirements.push('Setup async testing utilities');
    }

    if (structure.dependencies.some((d: any) => d.type === 'external')) {
      requirements.push('Configure mocking for external dependencies');
    }

    if (structure.riskAreas.length > 0) {
      requirements.push('Setup security testing tools');
    }

    return requirements;
  }

  private async generateTestFiles(structure: any, framework: string, testTypes: string[]): Promise<TestFile[]> {
    const testFiles: TestFile[] = [];

    // Generate unit test files
    if (testTypes.includes('unit')) {
      structure.functions.forEach((func: any) => {
        testFiles.push({
          fileName: `${func.name}.test.${framework === 'jest' ? 'js' : 'ts'}`,
          testType: 'unit',
          tests: this.generateUnitTests(func, framework),
          imports: this.generateTestImports(func, framework),
          setup: this.generateTestSetup(func, framework),
          teardown: this.generateTestTeardown(func, framework),
          content: this.generateTestFileContent(func, framework, 'unit')
        });
      });
    }

    // Generate integration test files
    if (testTypes.includes('integration')) {
      const integrationFile: TestFile = {
        fileName: `integration.test.${framework === 'jest' ? 'js' : 'ts'}`,
        testType: 'integration',
        tests: this.generateIntegrationTests(structure, framework),
        imports: [`import { ${structure.exports.join(', ')} } from '../src/index'`],
        setup: 'beforeAll(() => { /* Setup test environment */ });',
        teardown: 'afterAll(() => { /* Cleanup test environment */ });',
        content: this.generateIntegrationTestContent(structure, framework)
      };
      testFiles.push(integrationFile);
    }

    // Generate E2E test files
    if (testTypes.includes('e2e')) {
      testFiles.push({
        fileName: `e2e.test.${framework === 'playwright' ? 'ts' : 'js'}`,
        testType: 'e2e',
        tests: this.generateE2ETests(structure, framework),
        imports: this.generateE2EImports(framework),
        setup: 'beforeEach(() => { /* Setup browser */ });',
        teardown: 'afterEach(() => { /* Cleanup browser */ });',
        content: this.generateE2ETestContent(structure, framework)
      });
    }

    return testFiles;
  }

  private generateUnitTests(func: any, framework: string): Test[] {
    const tests: Test[] = [];

    // Happy path test
    tests.push({
      name: `should ${func.name} successfully with valid input`,
      description: `Test ${func.name} with expected input parameters`,
      type: 'positive',
      priority: func.testPriority,
      code: this.generateHappyPathTest(func, framework),
      assertions: [`expect(result).toBeDefined()`, `expect(result).not.toBeNull()`],
      mocks: func.isAsync ? ['mockExternalService'] : undefined
    });

    // Error handling test
    if (func.hasErrorHandling) {
      tests.push({
        name: `should handle errors in ${func.name}`,
        description: `Test error handling in ${func.name}`,
        type: 'negative',
        priority: 'high',
        code: this.generateErrorTest(func, framework),
        assertions: [`expect(() => ${func.name}(invalidInput)).toThrow()`],
      });
    }

    // Edge cases
    if (func.parameters.length > 0) {
      tests.push({
        name: `should handle edge cases in ${func.name}`,
        description: `Test boundary conditions for ${func.name}`,
        type: 'edge',
        priority: 'medium',
        code: this.generateEdgeCaseTest(func, framework),
        assertions: [`expect(result).toBeValid()`],
      });
    }

    return tests;
  }

  private generateHappyPathTest(func: any, framework: string): string {
    const params = func.parameters.map((p: any) => this.generateTestValue(p.type)).join(', ');
    const asyncPrefix = func.isAsync ? 'await ' : '';
    
    return `
test('should ${func.name} successfully with valid input', ${func.isAsync ? 'async ' : ''}() => {
  ${func.isAsync ? '// Setup mocks if needed' : ''}
  const result = ${asyncPrefix}${func.name}(${params});
  expect(result).toBeDefined();
  ${this.generateAdditionalAssertions(func)}
});`;
  }

  private generateErrorTest(func: any, framework: string): string {
    return `
test('should handle errors in ${func.name}', ${func.isAsync ? 'async ' : ''}() => {
  ${func.isAsync ? 'await expect(' : 'expect(() =>'}${func.name}(null)${func.isAsync ? ').rejects.toThrow()' : ').toThrow()'};
});`;
  }

  private generateEdgeCaseTest(func: any, framework: string): string {
    const edgeParams = func.parameters.map((p: any) => this.generateEdgeValue(p.type)).join(', ');
    
    return `
test('should handle edge cases in ${func.name}', ${func.isAsync ? 'async ' : ''}() => {
  const result = ${func.isAsync ? 'await ' : ''}${func.name}(${edgeParams});
  expect(result).toBeValid(); // Replace with appropriate assertion
});`;
  }

  private generateTestValue(type: string): string {
    const typeMap: { [key: string]: string } = {
      'string': '"test"',
      'number': '42',
      'boolean': 'true',
      'object': '{}',
      'array': '[]',
      'undefined': 'undefined',
      'null': 'null'
    };
    
    return typeMap[type.toLowerCase()] || '{}';
  }

  private generateEdgeValue(type: string): string {
    const edgeMap: { [key: string]: string } = {
      'string': '""', // empty string
      'number': '0',
      'boolean': 'false',
      'object': 'null',
      'array': '[]'
    };
    
    return edgeMap[type.toLowerCase()] || 'null';
  }

  private generateAdditionalAssertions(func: any): string {
    if (func.name.toLowerCase().includes('calculate')) {
      return 'expect(typeof result).toBe("number");';
    }
    if (func.name.toLowerCase().includes('validate')) {
      return 'expect(typeof result).toBe("boolean");';
    }
    return '// Add specific assertions based on function behavior';
  }

  private generateTestImports(func: any, framework: string): string[] {
    const imports = [`import { ${func.name} } from '../src/index'`];
    
    if (framework === 'jest') {
      imports.push("import { jest } from '@jest/globals'");
    }
    
    if (func.isAsync) {
      imports.push("// Import mocking utilities if needed");
    }
    
    return imports;
  }

  private generateTestSetup(func: any, framework: string): string {
    if (func.isAsync) {
      return `beforeEach(() => {
  // Setup mocks and test environment
  jest.clearAllMocks();
});`;
    }
    
    return 'beforeEach(() => { /* Setup if needed */ });';
  }

  private generateTestTeardown(func: any, framework: string): string {
    if (func.isAsync) {
      return `afterEach(() => {
  // Cleanup mocks and resources
  jest.restoreAllMocks();
});`;
    }
    
    return 'afterEach(() => { /* Cleanup if needed */ });';
  }

  private generateTestFileContent(func: any, framework: string, testType: string): string {
    const imports = this.generateTestImports(func, framework).join('\n');
    const setup = this.generateTestSetup(func, framework);
    const teardown = this.generateTestTeardown(func, framework);
    const tests = this.generateUnitTests(func, framework);
    
    return `${imports}

describe('${func.name}', () => {
  ${setup}
  
  ${teardown}
  
  ${tests.map(test => test.code).join('\n  ')}
});`;
  }

  private generateIntegrationTests(structure: any, framework: string): Test[] {
    const tests: Test[] = [];
    
    // Test component interactions
    tests.push({
      name: 'should integrate components correctly',
      description: 'Test integration between multiple components',
      type: 'positive',
      priority: 'high',
      code: this.generateComponentIntegrationTest(structure, framework),
      assertions: ['expect(result).toBeDefined()']
    });
    
    return tests;
  }

  private generateComponentIntegrationTest(structure: any, framework: string): string {
    const mainFunctions = structure.functions.slice(0, 2);
    
    return `
test('should integrate components correctly', async () => {
  // Test integration between ${mainFunctions.map((f: any) => f.name).join(' and ')}
  ${mainFunctions.map((f: any) => 
    `const ${f.name}Result = await ${f.name}(${this.generateTestValue('any')});`
  ).join('\n  ')}
  
  // Assert integration works
  ${mainFunctions.map((f: any) => 
    `expect(${f.name}Result).toBeDefined();`
  ).join('\n  ')}
});`;
  }

  private generateIntegrationTestContent(structure: any, framework: string): string {
    const tests = this.generateIntegrationTests(structure, framework);
    
    return `import { ${structure.exports.join(', ')} } from '../src/index';

describe('Integration Tests', () => {
  beforeAll(() => {
    // Setup integration test environment
  });
  
  afterAll(() => {
    // Cleanup integration test environment
  });
  
  ${tests.map(test => test.code).join('\n  ')}
});`;
  }

  private generateE2ETests(structure: any, framework: string): Test[] {
    // Basic E2E test structure
    return [{
      name: 'should work end-to-end',
      description: 'Complete user workflow test',
      type: 'positive',
      priority: 'medium',
      code: this.generateE2ETestCode(structure, framework),
      assertions: ['expect(page).toContainText("success")']
    }];
  }

  private generateE2ETestCode(structure: any, framework: string): string {
    if (framework === 'playwright') {
      return `
test('should work end-to-end', async ({ page }) => {
  await page.goto('/');
  // Add E2E test steps here
  await expect(page).toHaveTitle(/Expected Title/);
});`;
    }
    
    return `
test('should work end-to-end', async () => {
  // E2E test implementation
  expect(true).toBe(true); // Replace with actual test
});`;
  }

  private generateE2EImports(framework: string): string[] {
    if (framework === 'playwright') {
      return ["import { test, expect } from '@playwright/test'"];
    }
    return ["// Import E2E testing framework"];
  }

  private generateE2ETestContent(structure: any, framework: string): string {
    const imports = this.generateE2EImports(framework).join('\n');
    const tests = this.generateE2ETests(structure, framework);
    
    return `${imports}

describe('E2E Tests', () => {
  ${tests.map(test => test.code).join('\n  ')}
});`;
  }

  private async generateEdgeCases(structure: any): Promise<EdgeCase[]> {
    const edgeCases: EdgeCase[] = [];
    
    structure.functions.forEach((func: any) => {
      func.parameters.forEach((param: any) => {
        edgeCases.push({
          scenario: `${func.name} with ${param.type} boundary values`,
          input: this.generateBoundaryInput(param.type),
          expectedOutput: 'Should handle gracefully',
          description: `Test ${func.name} with edge case input for ${param.name}`,
          severity: param.type === 'string' ? 'medium' : 'high',
          testCode: this.generateEdgeCaseTestCode(func, param)
        });
      });
    });
    
    return edgeCases.slice(0, 10); // Limit to prevent overflow
  }

  private generateBoundaryInput(type: string): any {
    const boundaries: { [key: string]: any } = {
      'string': ['', 'a'.repeat(1000), 'special chars: !@#$%^&*()'],
      'number': [0, -1, Number.MAX_VALUE, Number.MIN_VALUE, NaN, Infinity],
      'array': [[], new Array(1000).fill(0)],
      'object': [{}, null, undefined]
    };
    
    return boundaries[type.toLowerCase()] || null;
  }

  private generateEdgeCaseTestCode(func: any, param: any): string {
    const boundaryValues = this.generateBoundaryInput(param.type);
    
    return `
test('should handle ${param.name} boundary values', () => {
  const boundaryValues = ${JSON.stringify(boundaryValues)};
  boundaryValues.forEach(value => {
    expect(() => ${func.name}(value)).not.toThrow();
  });
});`;
  }

  private async generateMockFiles(structure: any, framework: string): Promise<MockFile[]> {
    const mocks: MockFile[] = [];
    
    // Generate service mocks
    const externalDeps = structure.dependencies.filter((d: any) => d.type === 'external');
    externalDeps.forEach((dep: any) => {
      mocks.push({
        fileName: `__mocks__/${dep.module}.js`,
        mockType: 'service',
        content: this.generateServiceMock(dep, framework),
        description: `Mock for ${dep.module} service`
      });
    });
    
    // Generate API mocks
    const asyncOps = structure.asyncOperations.filter((op: any) => op.type === 'await');
    if (asyncOps.length > 0) {
      mocks.push({
        fileName: '__mocks__/api.js',
        mockType: 'api',
        content: this.generateApiMock(framework),
        description: 'Mock for API calls'
      });
    }
    
    return mocks;
  }

  private generateServiceMock(dependency: any, framework: string): string {
    return `// Mock for ${dependency.module}
export default {
  ${dependency.imports.map((imp: string) => `
  ${imp}: jest.fn(() => Promise.resolve('mocked-${imp}'))`).join(',\n')}
};`;
  }

  private generateApiMock(framework: string): string {
    return `// API Mock
export const mockApi = {
  get: jest.fn(() => Promise.resolve({ data: 'mocked-data' })),
  post: jest.fn(() => Promise.resolve({ data: 'created' })),
  put: jest.fn(() => Promise.resolve({ data: 'updated' })),
  delete: jest.fn(() => Promise.resolve({ data: 'deleted' }))
};`;
  }

  private async generateTestConfiguration(framework: string, testSuite: TestSuite, coverage: string): Promise<TestConfiguration> {
    const configs: { [key: string]: any } = {
      jest: {
        configFile: `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: ['**/__tests__/**/*.(ts|js)', '**/*.(test|spec).(ts|js)'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};`,
        scripts: {
          'test': 'jest',
          'test:watch': 'jest --watch',
          'test:coverage': 'jest --coverage'
        },
        dependencies: ['jest', '@types/jest', 'ts-jest']
      },
      vitest: {
        configFile: `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html']
    }
  }
});`,
        scripts: {
          'test': 'vitest run',
          'test:watch': 'vitest',
          'test:coverage': 'vitest run --coverage'
        },
        dependencies: ['vitest', '@vitest/ui', 'c8']
      }
    };

    const config = configs[framework] || configs.jest;
    const coverageThreshold = coverage === 'basic' ? 70 : coverage === 'thorough' ? 85 : 95;

    return {
      framework,
      configFile: config.configFile,
      scripts: config.scripts,
      dependencies: config.dependencies,
      coverage: {
        threshold: coverageThreshold,
        reports: ['text', 'lcov', 'html'],
        directories: ['src/'],
        excludes: ['node_modules/', 'dist/', '*.d.ts']
      }
    };
  }

  private synthesizeTestArchitecture(
    testSuite: TestSuite,
    testFiles: TestFile[],
    mockFiles: MockFile[],
    testConfig: TestConfiguration,
    edgeCases: EdgeCase[]
  ): string {
    let synthesis = `## Test Architecture Summary\n\n`;

    // Test Suite Overview
    synthesis += `**Test Suite: ${testSuite.name}**\n`;
    synthesis += `- Framework: ${testSuite.framework}\n`;
    synthesis += `- Total Tests: ${testSuite.totalTests}\n`;
    synthesis += `- Estimated Coverage: ${testSuite.estimatedCoverage}%\n`;
    synthesis += `- Test Categories: ${testSuite.testCategories.length}\n\n`;

    // Test Categories
    synthesis += `**Test Categories:**\n`;
    testSuite.testCategories.forEach(category => {
      synthesis += `- ${category.name}: ${category.testCount} tests (${category.priority} priority)\n`;
    });
    synthesis += '\n';

    // Generated Files
    synthesis += `**Generated Files:**\n`;
    synthesis += `- Test Files: ${testFiles.length}\n`;
    testFiles.forEach(file => {
      synthesis += `  - ${file.fileName} (${file.testType}, ${file.tests.length} tests)\n`;
    });

    if (mockFiles.length > 0) {
      synthesis += `- Mock Files: ${mockFiles.length}\n`;
      mockFiles.forEach(mock => {
        synthesis += `  - ${mock.fileName} (${mock.mockType})\n`;
      });
    }
    synthesis += '\n';

    // Edge Cases
    const criticalEdgeCases = edgeCases.filter(e => e.severity === 'high').length;
    if (criticalEdgeCases > 0) {
      synthesis += `**Critical Edge Cases: ${criticalEdgeCases}**\n`;
      edgeCases.filter(e => e.severity === 'high').slice(0, 3).forEach(edge => {
        synthesis += `- ${edge.scenario}\n`;
      });
      synthesis += '\n';
    }

    // Setup Instructions
    synthesis += `**Setup Instructions:**\n`;
    testSuite.setupRequirements.forEach(req => {
      synthesis += `1. ${req}\n`;
    });
    
    synthesis += `\n**Next Steps:**\n`;
    synthesis += `1. Install dependencies: ${testConfig.dependencies.join(', ')}\n`;
    synthesis += `2. Add test scripts to package.json\n`;
    synthesis += `3. Create ${testConfig.framework} configuration file\n`;
    synthesis += `4. Run tests to establish baseline\n`;
    synthesis += `5. Integrate with CI/CD pipeline\n`;

    return synthesis;
  }
}