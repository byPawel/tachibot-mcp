import { z } from "zod";
import { Auditor } from "../modes/auditor.js";
import { CommitGuardian } from "../modes/commit-guardian.js";
import { Architect } from "../modes/architect.js";
import { CodeReviewer } from "../modes/code-reviewer.js";
import { DocumentationWriter } from "../modes/documentation-writer.js";
import { TestArchitect } from "../modes/test-architect.js";
// Workflow tools removed - using workflow-runner.ts instead

const auditor = new Auditor();
const commitGuardian = new CommitGuardian();
const architect = new Architect();
const codeReviewer = new CodeReviewer();
const documentationWriter = new DocumentationWriter();
const testArchitect = new TestArchitect();

// Auditor Tool
export const auditorTool = {
  name: "auditor",
  description: "Evidence-based audit. Put the CONTEXT in the 'context' parameter.",
  parameters: z.object({
    context: z.string().describe("What to audit (REQUIRED - put your audit request here)"),
    evidenceRequired: z.boolean().optional().describe("Require evidence for claims")
  }),
  execute: async (args: any, { log }: any) => {
    log.info("Starting audit");
    
    const result = await auditor.audit(args.context, {
      evidenceRequired: args.evidenceRequired
    });
    
    log.info("Audit complete", {
      verified: result.verificationStatus.verified,
      disputed: result.verificationStatus.disputed
    });
    
    return result.synthesis;
  }
};

// Commit Guardian Tool
export const commitGuardianTool = {
  name: "commit_guardian",
  description: "Pre-commit validation. Put the CONTEXT in the 'context' parameter.",
  parameters: z.object({
    context: z.string().describe("Code changes to validate (REQUIRED - put your diff/changes here)"),
    strict: z.boolean().optional().describe("Use strict validation rules"),
    checkSecurity: z.boolean().optional().describe("Check for security issues"),
    checkQuality: z.boolean().optional().describe("Check code quality"),
    checkTests: z.boolean().optional().describe("Check test coverage")
  }),
  execute: async (args: any, { log }: any) => {
    log.info("Validating commit");
    
    const result = await commitGuardian.validate(args.context, {
      strict: args.strict,
      checkSecurity: args.checkSecurity,
      checkQuality: args.checkQuality,
      checkTests: args.checkTests
    });
    
    log.info("Validation complete", {
      passed: result.passed,
      score: result.score,
      blockers: result.blockers.length
    });
    
    return result.summary;
  }
};

// Architect Tool
export const architectTool = {
  name: "architect",
  description: "Full codebase analysis. Put your QUERY in the 'query' parameter.",
  parameters: z.object({
    query: z.string().describe("What to analyze in the codebase (REQUIRED - put your question here)"),
    path: z.string().optional().describe("Path to the codebase to analyze"),
    depth: z.enum(["shallow", "normal", "deep"])
      .optional()
      .describe("Analysis depth - must be one of: shallow, normal, deep"),
    focusAreas: z.array(z.string()).optional().describe("Specific areas to focus on")
  }),
  execute: async (args: any, { log }: any) => {
    log.info("Starting architecture analysis", {
      depth: args.depth || "normal",
      path: args.path
    });
    
    const result = await architect.analyze(args.query, {
      path: args.path,
      depth: args.depth,
      focusAreas: args.focusAreas
    });
    
    log.info("Architecture analysis complete", {
      hotspots: result.hotspots.length,
      recommendations: result.recommendations.length,
      tokensUsed: result.tokensUsed,
      cost: result.cost
    });
    
    return result.synthesis;
  }
};

// Workflow tools removed - handled by workflow-runner.ts

// Code Reviewer Tool
export const codeReviewerTool = {
  name: "code_reviewer",
  description: "Code review. Put the CODE in the 'code' parameter, NOT in 'focusAreas' or 'severity'.",
  parameters: z.object({
    code: z.string().describe("The actual source code to review (REQUIRED - put your code here)"),
    language: z.string().optional().describe("Programming language (e.g., 'typescript', 'python')"),
    focusAreas: z.array(z.enum(['security', 'performance', 'readability', 'bugs', 'best-practices']))
      .optional()
      .describe("Focus areas - array of: security, performance, readability, bugs, best-practices"),
    severity: z.enum(['low', 'medium', 'high'])
      .optional()
      .describe("Minimum severity to report - must be one of: low, medium, high"),
    model: z.string().optional().describe("Model to use for review")
  }),
  execute: async (args: any, { log }: any) => {
    log.info("Starting code review", { 
      language: args.language || 'auto-detect',
      focusAreas: args.focusAreas || 'all'
    });
    
    const result = await codeReviewer.review(args.code, {
      language: args.language,
      focusAreas: args.focusAreas,
      severity: args.severity,
      model: args.model
    });
    
    log.info("Code review complete", {
      issuesFound: result.issues.length,
      suggestions: result.suggestions.length,
      maintainabilityScore: result.metrics.maintainabilityScore
    });
    
    return result.synthesis;
  }
};

// Documentation Writer Tool
export const documentationWriterTool = {
  name: "documentation_writer",
  description: "Documentation generation. Put the CODE in the 'code' parameter.",
  parameters: z.object({
    code: z.string().describe("The source code to document (REQUIRED - put your code here)"),
    style: z.enum(['narrative', 'technical', 'beginner-friendly', 'api-reference'])
      .optional()
      .describe("Documentation style - must be one of: narrative, technical, beginner-friendly, api-reference"),
    includeExamples: z.boolean().optional().describe("Include usage examples"),
    generateToc: z.boolean().optional().describe("Generate table of contents"),
    format: z.enum(['markdown', 'html', 'plain'])
      .optional()
      .describe("Output format - must be one of: markdown, html, plain")
  }),
  execute: async (args: any, { log }: any) => {
    log.info("Generating documentation", {
      style: args.style || 'narrative',
      format: args.format || 'markdown'
    });
    
    const result = await documentationWriter.generateDocs(args.code, {
      style: args.style,
      includeExamples: args.includeExamples,
      generateToc: args.generateToc,
      format: args.format
    });
    
    log.info("Documentation generation complete", {
      readmeLength: result.readme.split('\n').length,
      apiDocs: result.apiDocs.length,
      inlineComments: result.inlineComments.length,
      hasNarrativeDoc: !!result.narrativeDoc
    });
    
    return result.synthesis;
  }
};

// Test Architect Tool
export const testArchitectTool = {
  name: "test_architect",
  description: "Test suite design. Put the CODE in the 'code' parameter.",
  parameters: z.object({
    code: z.string().describe("The source code to create tests for (REQUIRED - put your code here)"),
    testFramework: z.enum(['jest', 'mocha', 'vitest', 'cypress', 'playwright'])
      .optional()
      .describe("Test framework - must be one of: jest, mocha, vitest, cypress, playwright"),
    testTypes: z.array(z.enum(['unit', 'integration', 'e2e', 'performance', 'security']))
      .optional()
      .describe("Types of tests - array of: unit, integration, e2e, performance, security"),
    coverage: z.enum(['basic', 'thorough', 'comprehensive'])
      .optional()
      .describe("Coverage level - must be one of: basic, thorough, comprehensive"),
    generateMocks: z.boolean().optional().describe("Generate mock implementations")
  }),
  execute: async (args: any, { log }: any) => {
    log.info("Architecting test suite", {
      framework: args.testFramework || 'jest',
      testTypes: args.testTypes || ['unit', 'integration', 'e2e'],
      coverage: args.coverage || 'thorough'
    });
    
    const result = await testArchitect.architectTests(args.code, {
      testFramework: args.testFramework,
      testTypes: args.testTypes,
      coverage: args.coverage,
      generateMocks: args.generateMocks
    });
    
    log.info("Test architecture complete", {
      totalTests: result.testSuite.totalTests,
      testFiles: result.testFiles.length,
      mockFiles: result.mockFiles.length,
      estimatedCoverage: result.testSuite.estimatedCoverage,
      edgeCases: result.edgeCases.length
    });
    
    return result.synthesis;
  }
};

export function getAllAdvancedTools() {
  // Scout, Verifier, Challenger have been migrated to system workflows
  // See workflows/system/ for the new YAML-based implementations
  return [];
}

// Check if advanced modes are available (always true for now)
export function areAdvancedModesAvailable(): boolean {
  return true;
}