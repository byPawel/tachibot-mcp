/**
 * Tool registry validator - validates tool names against enabled tools
 */

import { ValidationError, ValidationContext } from './types.js';

export class ToolRegistryValidator {
  validate(context: ValidationContext): ValidationError[] {
    const errors: ValidationError[] = [];

    context.workflow.steps.forEach((step, index) => {
      // Check if tool exists in all known tools
      const isKnownTool = context.allKnownTools.has(step.tool);
      const isEnabled = context.enabledTools.has(step.tool);

      if (!isKnownTool) {
        // Unknown tool (misspelled or doesn't exist) → ERROR
        errors.push({
          type: 'tool',
          severity: 'error',
          message: `Tool '${step.tool}' does not exist`,
          path: `$.steps[${index}].tool`,
          suggestion: this.suggestSimilarTool(step.tool, context.allKnownTools)
        });
      } else if (!isEnabled) {
        // Known tool but disabled → WARNING
        errors.push({
          type: 'tool',
          severity: 'warning',
          message: `Tool '${step.tool}' is disabled in tools.config.json`,
          path: `$.steps[${index}].tool`,
          suggestion: `Enable '${step.tool}' in your tools.config.json or active profile`
        });
      }

      // Validate tool name format
      if (step.tool && !this.isValidToolName(step.tool)) {
        errors.push({
          type: 'tool',
          severity: 'warning',
          message: `Tool name '${step.tool}' has unusual format`,
          path: `$.steps[${index}].tool`,
          suggestion: 'Tool names should use snake_case or be known MCP tools'
        });
      }
    });

    return errors;
  }

  /**
   * Check if tool name follows valid conventions
   */
  private isValidToolName(toolName: string): boolean {
    // Valid formats:
    // - snake_case: my_tool
    // - Known tool patterns: focus, scout, verifier, etc.
    return /^[a-z][a-z0-9_]*$/.test(toolName);
  }

  /**
   * Check if this is a known tool name (might be disabled)
   */
  private isKnownToolName(toolName: string): boolean {
    const knownTools = [
      // Core
      'think', 'focus', 'nextThought',
      // Perplexity
      'perplexity_ask', 'perplexity_reason', 'perplexity_research',
      // Grok
      'grok_reason', 'grok_code', 'grok_debug', 'grok_architect', 'grok_brainstorm', 'grok_search',
      // OpenAI
      'openai_compare', 'openai_brainstorm', 'openai_gpt5_reason', 'openai_code_review', 'openai_explain',
      // Gemini
      'gemini_brainstorm', 'gemini_analyze_code', 'gemini_analyze_text',
      // Qwen
      'qwen_coder',
      // Advanced modes
      'verifier', 'scout', 'challenger', 'hunter',
      // Workflow
      'workflow', 'list_workflows', 'create_workflow', 'visualize_workflow',
      // Collaborative
      'pingpong', 'qwen_competitive'
    ];

    return knownTools.includes(toolName);
  }

  /**
   * Suggest a similar tool name using Levenshtein distance
   */
  private suggestSimilarTool(toolName: string, enabledTools: Set<string>): string {
    const suggestions: Array<{ tool: string; distance: number }> = [];

    for (const tool of enabledTools) {
      const distance = this.levenshteinDistance(toolName, tool);
      if (distance <= 3) { // Only suggest if reasonably close
        suggestions.push({ tool, distance });
      }
    }

    if (suggestions.length === 0) {
      return 'Check tools.config.json for available tools';
    }

    suggestions.sort((a, b) => a.distance - b.distance);
    const topSuggestions = suggestions.slice(0, 3).map(s => s.tool);

    return `Did you mean: ${topSuggestions.join(', ')}?`;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}
