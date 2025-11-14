/**
 * Input Validation and Sanitization Utilities
 * Prevents prompt injection, XSS, and other security issues
 */

// Security constants
export const MAX_INPUT_LENGTH = 50000; // 50k chars max
export const MAX_PROMPT_LENGTH = 20000;
export const MAX_SYSTEM_PROMPT_LENGTH = 5000;

// Patterns to detect potential injection attempts
// NOTE: Role injection (user:/assistant:/system:) pattern removed due to false positives
// with legitimate LLM-generated content. For LLM-to-LLM calls, use skipValidation flag.
const SUSPICIOUS_PATTERNS = [
  /<\s*script/gi,                 // XSS attempts
  /\b(exec|eval|require)\s*\(/gi, // Code execution attempts (must be function calls)
  /;\s*(rm|del|format|drop\s+table)/gi,  // Command/SQL injection
  /\.\.\//g,                      // Path traversal
  /\x00/g,                        // Null byte injection
];

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
 * Validate and sanitize tool input
 */
export function validateToolInput(input: any): { valid: boolean; sanitized?: any; error?: string } {
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

      // Check for suspicious patterns
      for (const pattern of SUSPICIOUS_PATTERNS) {
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
      // Recursively sanitize object properties
      const sanitized: any = Array.isArray(input) ? [] : {};

      for (const [key, value] of Object.entries(input)) {
        if (typeof value === 'string') {
          const result = validateToolInput(value);
          if (!result.valid) return result;
          sanitized[key] = result.sanitized;
        } else if (typeof value === 'object') {
          const result = validateToolInput(value);
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
