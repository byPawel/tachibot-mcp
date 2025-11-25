/**
 * Tool type system using TypeScript's infer and conditional types
 * NO 'any' - uses 'unknown' where type is truly unknown
 */

import { z } from 'zod';

// ============================================================================
// UTILITY TYPES - Generic type helpers without 'any'
// ============================================================================

/**
 * Extract return type from function without using 'any'
 * Usage: ReturnType<typeof myFunction>
 */
export type SafeReturnType<T extends (...args: never[]) => unknown> =
  T extends (...args: never[]) => infer R ? R : never;

/**
 * Extract parameters type from function without using 'any'
 */
export type SafeParameters<T extends (...args: never[]) => unknown> =
  T extends (...args: infer P) => unknown ? P : never;

/**
 * Infer Zod schema type
 */
export type InferZodSchema<T> = T extends z.ZodType<infer U> ? U : never;

/**
 * Extract tool input type from tool definition
 */
export type InferToolInput<T> = T extends { parameters: z.ZodType<infer U> }
  ? U
  : Record<string, unknown>; // Fallback for tools without schema

/**
 * Extract tool output type from execute function
 */
export type InferToolOutput<T> = T extends { execute: (...args: never[]) => infer R }
  ? R extends Promise<infer U> ? U : R
  : string; // Default: tools return strings

// ============================================================================
// TOOL REGISTRY - Single source of truth for all tools
// ============================================================================

/**
 * Known tool names - this is the ONLY place we list tools
 * Validators check against this list
 */
export const KNOWN_TOOLS = [
  // Core
  'think',
  'focus',

  // Perplexity
  'perplexity_ask',
  'perplexity_reason',
  'perplexity_research',
  'perplexity_code_search',

  // Grok
  'grok_reason',
  'grok_code',
  'grok_debug',
  'grok_brainstorm',
  'grok_search',
  'grok_heavy',

  // OpenAI
  'openai_brainstorm',
  'openai_analyze',
  'openai_reason',
  'gpt5',
  'gpt5_mini',
  'gpt5_nano',

  // Gemini
  'gemini_query',
  'gemini_brainstorm',
  'gemini_analyze_code',
  'gemini_analyze_text',

  // Qwen
  'qwen_coder',
  'qwq_reason',

  // Advanced modes
  'verifier',
  'challenger',
  'scout',
  'auditor',
  'architect',
  'commit_guardian',

  // Meta tools
  'code_reviewer',
  'test_architect',
  'documentation_writer',

  // Workflow
  'workflow',
  'pingpong',
] as const;

/**
 * Tool name type - only valid tool names allowed
 */
export type ToolName = typeof KNOWN_TOOLS[number];

/**
 * Type guard to check if string is a valid tool name
 */
export function isValidToolName(name: string): name is ToolName {
  return (KNOWN_TOOLS as readonly string[]).includes(name);
}

// ============================================================================
// TOOL INPUT TYPE MAPPINGS
// These map tool names to their expected input structures
// ============================================================================

/**
 * Generic tool input - for tools without specific schemas
 * Extends Record<string, unknown> for structural compatibility with Step.input
 */
export interface GenericToolInput extends Record<string, unknown> {
  prompt?: string;
  query?: string;
  problem?: string;
  text?: string;
  code?: string;
  requirements?: string;
  content?: string;
  message?: string;
  context?: string;
}

/**
 * Qwen Coder specific input
 * Extends Record<string, unknown> for structural compatibility with Step.input
 */
export interface QwenCoderInput extends Record<string, unknown> {
  task: "generate" | "review" | "optimize" | "debug" | "refactor" | "explain";
  requirements: string;
  code?: string;
  language?: string;
  useFree?: boolean;
}

/**
 * Perplexity Ask input
 * Extends Record<string, unknown> for structural compatibility with Step.input
 */
export interface PerplexityAskInput extends Record<string, unknown> {
  query: string;
  searchDomain?: string;
  searchRecency?: string;
}

/**
 * Verifier input
 * Extends Record<string, unknown> for structural compatibility with Step.input
 */
export interface VerifierInput extends Record<string, unknown> {
  query: string;
  variant?: "quick_verify" | "deep_verify" | "consensus";
}

/**
 * Map tool names to their input types
 * This is conditional type magic - TypeScript narrows based on tool name!
 */
export type ToolInputType<T extends string> =
  T extends "qwen_coder" ? QwenCoderInput :
  T extends "perplexity_ask" ? PerplexityAskInput :
  T extends "verifier" ? VerifierInput :
  // Add more specific mappings as needed
  GenericToolInput; // Fallback

// ============================================================================
// STEP TYPE WITH DISCRIMINATED UNION
// ============================================================================

/**
 * Base step properties shared by all steps
 * Step NAME can be anything - free naming!
 */
interface BaseStep {
  name: string; // Can be "round1-grok" or "banana-step" or ANYTHING
  tool: string; // Must be from KNOWN_TOOLS
  output?: {
    variable?: string;
  };
  saveToFile?: boolean;
  loadFiles?: string[];
  dependsOn?: string[];
  when?: string;
  condition?: {
    if?: string;
    skip?: boolean;
  };
  parallel?: boolean;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

/**
 * Typed step with tool-specific input
 * Uses conditional types to provide correct input type based on tool
 */
export interface TypedStep<T extends ToolName = ToolName> extends BaseStep {
  tool: T;
  input?: ToolInputType<T>;
}

/**
 * Generic step for when we don't know the tool at compile time
 */
export interface Step extends BaseStep {
  tool: string;
  input?: Record<string, unknown>;
}

/**
 * Type guard to narrow Step to TypedStep<T>
 */
export function isTypedStep<T extends ToolName>(
  step: Step,
  toolName: T
): step is TypedStep<T> {
  return step.tool === toolName;
}

// ============================================================================
// WORKFLOW TYPES
// ============================================================================

export interface Workflow {
  name: string;
  description?: string;
  version?: string;
  steps: Step[];
  variables?: Record<string, string | number | boolean>;
  settings?: {
    optimization?: {
      enabled?: boolean;
      cacheResults?: boolean;
      compressPrompts?: boolean;
      smartRouting?: boolean;
    };
  };
  output?: {
    format?: string;
    saveToFile?: string | boolean;
    truncateSteps?: boolean;
  };
}

// ============================================================================
// INTERPOLATION REFERENCE TYPES
// ============================================================================

/**
 * Valid interpolation reference patterns
 */
export type InterpolationReference =
  | `\${${string}}`           // ${variable}
  | `\${${string}.output}`    // ${step.output}
  | `\${${string}.${string}}`; // ${step.property}

/**
 * Extract step name from interpolation reference
 */
export type ExtractStepName<T extends string> =
  T extends `\${${infer S}.${string}}` ? S :
  T extends `\${${infer S}}` ? S :
  never;

// ============================================================================
// VALIDATION CONTEXT TYPES
// ============================================================================

export interface ValidationError {
  type: 'syntax' | 'interpolation' | 'tool' | 'dependency' | 'output-usage' | 'redundancy';
  severity: 'error' | 'warning' | 'info';
  message: string;
  path: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface ValidationContext {
  workflow: Workflow;
  allKnownTools: Set<string>;
  enabledTools: Set<string>;
  sourceMap: Map<string, { line: number; column: number }>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all step names from workflow (for interpolation validation)
 */
export function getStepNames(workflow: Workflow): Set<string> {
  return new Set(workflow.steps.map(s => s.name));
}

/**
 * Check if a reference is a step name or variable
 */
export function isStepReference(
  reference: string,
  stepNames: Set<string>
): boolean {
  // Remove .output suffix if present
  const baseName = reference.includes('.')
    ? reference.split('.')[0]
    : reference;

  return stepNames.has(baseName);
}

/**
 * Extract all interpolation references from a string
 */
export function extractInterpolations(text: string): string[] {
  const regex = /\$\{([^}]+)\}/g;
  const matches = text.matchAll(regex);
  return Array.from(matches, m => m[1]);
}
