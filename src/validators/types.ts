/**
 * Workflow validator type definitions
 *
 * NOTE: This file now re-exports from tool-types.ts which uses proper
 * TypeScript inference and conditional types without 'any'
 */

// Re-export all types from tool-types for backward compatibility
export * from './tool-types.js';

// Legacy exports (deprecated, use tool-types.ts directly)
export type { Step, Workflow, ValidationError, ValidationContext, ValidationResult } from './tool-types.js';
