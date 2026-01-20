/**
 * Input Validation and Sanitization Utilities
 * Prevents prompt injection, XSS, and other security issues
 *
 * Security Model:
 * - User input is validated at MCP entry point (server.ts)
 * - Context-aware validation allows code patterns in appropriate contexts
 * - Defense in depth maintained - validation never fully skipped
 */

// Security constants
export const MAX_INPUT_LENGTH = 50000; // 50k chars max
export const MAX_PROMPT_LENGTH = 20000;
export const MAX_SYSTEM_PROMPT_LENGTH = 5000;

/**
 * Validation context determines which rules to apply
 * - 'user-input': Strict validation for direct user input
 * - 'code-analysis': Relaxed rules for code analysis (allows exec/eval patterns)
 * - 'llm-orchestration': Medium validation for LLM-to-LLM calls
 */
export type ValidationContext = 'user-input' | 'code-analysis' | 'llm-orchestration';

// Patterns always blocked (even in code analysis) - these are truly dangerous
const CRITICAL_PATTERNS = [
  /\x00/g,                        // Null byte injection - never legitimate
];

// Patterns blocked in user-input context but allowed in code contexts
const USER_INPUT_PATTERNS = [
  /<\s*script/gi,                 // XSS attempts - block in user input
  /\b(exec|eval)\s*\(/gi,         // Code execution - block in user input
  /;\s*(rm|del|format|drop\s+table)/gi,  // Command/SQL injection
];

// Legacy: Combined patterns for backward compatibility (default behavior)
const SUSPICIOUS_PATTERNS = [...CRITICAL_PATTERNS, ...USER_INPUT_PATTERNS];

/**
 * Sanitize user input - remove control characters and limit length
 */
export function sanitizeInput(input: string, maxLength: number = MAX_INPUT_LENGTH): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  // Remove control characters (except newlines, tabs)
  let sanitized = input.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }

  return sanitized;
}

/**
 * Get patterns to check based on validation context
 */
function getPatternsForContext(context: ValidationContext): RegExp[] {
  switch (context) {
    case 'code-analysis':
      // Only block critical patterns - code analysis needs exec/eval patterns
      return CRITICAL_PATTERNS;
    case 'llm-orchestration':
      // Block critical patterns - LLM-to-LLM content is semi-trusted
      // Note: XSS and code execution patterns allowed because LLMs discuss code
      return CRITICAL_PATTERNS;
    case 'user-input':
    default:
      // Full validation for direct user input
      return SUSPICIOUS_PATTERNS;
  }
}

/**
 * Validate and sanitize tool input
 * @param input - The input to validate
 * @param context - The validation context (default: 'user-input' for strict validation)
 */
export function validateToolInput(
  input: any,
  context: ValidationContext = 'user-input'
): { valid: boolean; sanitized?: any; error?: string } {
  try {
    if (typeof input === 'string') {
      // Check for empty input
      if (input.trim().length === 0) {
        return {
          valid: false,
          error: 'Input cannot be empty'
        };
      }

      // Check length before sanitization
      if (input.length > MAX_INPUT_LENGTH) {
        return {
          valid: false,
          error: `Input too long (max ${MAX_INPUT_LENGTH} characters)`
        };
      }

      // Check for suspicious patterns based on context
      const patterns = getPatternsForContext(context);
      for (const pattern of patterns) {
        if (pattern.test(input)) {
          return {
            valid: false,
            error: 'Input contains potentially malicious content'
          };
        }
      }

      return {
        valid: true,
        sanitized: sanitizeInput(input)
      };
    }

    if (typeof input === 'object' && input !== null) {
      // Recursively sanitize object properties with same context
      const sanitized: any = Array.isArray(input) ? [] : {};

      for (const [key, value] of Object.entries(input)) {
        if (typeof value === 'string') {
          const result = validateToolInput(value, context);
          if (!result.valid) return result;
          sanitized[key] = result.sanitized;
        } else if (typeof value === 'object') {
          const result = validateToolInput(value, context);
          if (!result.valid) return result;
          sanitized[key] = result.sanitized;
        } else {
          sanitized[key] = value;
        }
      }

      return { valid: true, sanitized };
    }

    return { valid: true, sanitized: input };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Validation error'
    };
  }
}

/**
 * Redact secrets from strings before logging
 */
export function sanitizeForLogging(text: string): string {
  let sanitized = text;

  // Redact API keys
  sanitized = sanitized.replace(/Bearer\s+[\w-]+/gi, 'Bearer [REDACTED]');
  sanitized = sanitized.replace(/sk-[\w-]+/g, 'sk-[REDACTED]');
  sanitized = sanitized.replace(/gsk_[\w-]+/g, 'gsk_[REDACTED]');

  // Redact environment variable values
  sanitized = sanitized.replace(/(API_KEY|TOKEN|SECRET)=[\w-]+/gi, '$1=[REDACTED]');

  // Redact potential tokens in errors
  sanitized = sanitized.replace(/["'][\w-]{32,}["']/g, '"[REDACTED]"');

  return sanitized;
}

/**
 * Validate model name to prevent injection
 */
export function validateModelName(model: string): boolean {
  // Allow only alphanumeric, hyphens, underscores, dots
  const validPattern = /^[a-zA-Z0-9._-]+$/;
  return validPattern.test(model) && model.length < 100;
}

/**
 * Sanitize error for safe logging
 */
export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return sanitizeForLogging(error.message);
  }
  return sanitizeForLogging(String(error));
}
