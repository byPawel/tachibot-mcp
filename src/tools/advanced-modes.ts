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
  description: `Evidence-based audit`,
  parameters: z.object({
    context: z.string(),
    evidenceRequired: z.boolean().optional()
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
  description: `Pre-commit validation`,
  parameters: z.object({
    context: z.string(),
    strict: z.boolean().optional(),
    checkSecurity: z.boolean().optional(),
    checkQuality: z.boolean().optional(),
    checkTests: z.boolean().optional()
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
  description: `Full codebase analysis with Gemini 2.5 Pro (1M tokens) and specialized verification.

Parameters:
- query (required): What to analyze in the codebase
- path (optional): Path to codebase
- depth (optional, default: normal): shallow|normal|deep
- focusAreas (optional): Specific areas to focus on`,
  parameters: z.object({
    query: z.string(),
    path: z.string().optional(),
    depth: z.enum(["shallow", "normal", "deep"]).optional(),
    focusAreas: z.array(z.string()).optional()
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
  description: `Code review`,
  parameters: z.object({
    code: z.string(),
    language: z.string().optional(),
    focusAreas: z.array(z.enum(['security', 'performance', 'readability', 'bugs', 'best-practices'])).optional(),
    severity: z.enum(['low', 'medium', 'high']).optional(),
    model: z.string().optional()
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
  description: `Documentation generation`,
  parameters: z.object({
    code: z.string(),
    style: z.enum(['narrative', 'technical', 'beginner-friendly', 'api-reference']).optional(),
    includeExamples: z.boolean().optional(),
    generateToc: z.boolean().optional(),
    format: z.enum(['markdown', 'html', 'plain']).optional()
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
  description: `Test suite design`,
  parameters: z.object({
    code: z.string(),
    testFramework: z.enum(['jest', 'mocha', 'vitest', 'cypress', 'playwright']).optional(),
    testTypes: z.array(z.enum(['unit', 'integration', 'e2e', 'performance', 'security'])).optional(),
    coverage: z.enum(['basic', 'thorough', 'comprehensive']).optional(),
    generateMocks: z.boolean().optional()
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