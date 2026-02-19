export interface CodeReviewOptions {
  model?: string;
  maxTokens?: number;
  focusAreas?: ('security' | 'performance' | 'readability' | 'bugs' | 'best-practices')[];
  language?: string;
  severity?: 'low' | 'medium' | 'high';
}

export interface CodeReviewResult {
  issues: CodeIssue[];
  suggestions: CodeSuggestion[];
  metrics: CodeMetrics;
  socraticQuestions: string[];
  synthesis: string;
}

export interface CodeIssue {
  id: string;
  line?: number;
  type: 'security' | 'performance' | 'readability' | 'bug' | 'style' | 'architecture';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  codeSnippet?: string;
  suggestion?: string;
  reasoning: string;
}

export interface CodeSuggestion {
  id: string;
  type: 'refactor' | 'optimize' | 'simplify' | 'modernize';
  title: string;
  description: string;
  beforeCode?: string;
  afterCode?: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'minimal' | 'moderate' | 'significant';
}

export interface CodeMetrics {
  linesOfCode: number;
  complexity: 'low' | 'medium' | 'high';
  maintainabilityScore: number;
  testCoverage?: number;
  duplicateLines: number;
  technicalDebt: 'low' | 'medium' | 'high';
}

export class CodeReviewer {
  private defaultModel = 'gemini-3.1-pro-preview';
  private defaultMaxTokens = 4000;
  private defaultFocusAreas: CodeReviewOptions['focusAreas'] = [
    'security', 'performance', 'readability', 'bugs', 'best-practices'
  ];

  async review(code: string, options: CodeReviewOptions = {}): Promise<CodeReviewResult> {
    const model = options.model || this.defaultModel;
    const maxTokens = options.maxTokens || this.defaultMaxTokens;
    const focusAreas = options.focusAreas || this.defaultFocusAreas;
    const language = options.language || this.detectLanguage(code);

    // Analyze code structure and extract basic metrics
    const metrics = await this.calculateMetrics(code);
    
    // Identify issues based on focus areas
    const issues = await this.identifyIssues(code, focusAreas || [], language, model);
    
    // Generate improvement suggestions
    const suggestions = await this.generateSuggestions(code, issues, language, model);
    
    // Generate Socratic questions for learning
    const socraticQuestions = await this.generateSocraticQuestions(code, issues, language);
    
    // Synthesize findings
    const synthesis = this.synthesizeReview(issues, suggestions, metrics, socraticQuestions);

    return {
      issues,
      suggestions,
      metrics,
      socraticQuestions,
      synthesis
    };
  }

  private detectLanguage(code: string): string {
    // Simple language detection based on patterns
    if (code.includes('import ') && code.includes('from ')) return 'typescript';
    if (code.includes('function ') || code.includes('const ') || code.includes('let ')) return 'javascript';
    if (code.includes('def ') && code.includes(':')) return 'python';
    if (code.includes('public class ') || code.includes('private ')) return 'java';
    if (code.includes('#include') || code.includes('int main')) return 'cpp';
    if (code.includes('fn ') && code.includes('->')) return 'rust';
    if (code.includes('package ') && code.includes('func ')) return 'go';
    return 'unknown';
  }

  private async calculateMetrics(code: string): Promise<CodeMetrics> {
    const lines = code.split('\n');
    const linesOfCode = lines.filter(line => 
      line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('*')
    ).length;

    // Basic complexity analysis
    const complexityIndicators = [
      'if', 'else', 'for', 'while', 'switch', 'case', 'try', 'catch', '?'
    ];
    
    const complexityCount = complexityIndicators.reduce((count, indicator) => {
      const matches = code.split(indicator).length - 1;
      return count + matches;
    }, 0);

    const complexity = complexityCount > 20 ? 'high' : 
                     complexityCount > 8 ? 'medium' : 'low';

    // Duplicate line detection (simplified)
    const lineMap = new Map<string, number>();
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.length > 10) {
        lineMap.set(trimmed, (lineMap.get(trimmed) || 0) + 1);
      }
    });
    
    const duplicateLines = Array.from(lineMap.values()).reduce((sum, count) => 
      sum + (count > 1 ? count - 1 : 0), 0
    );

    // Maintainability score (0-100)
    let maintainabilityScore = 100;
    maintainabilityScore -= Math.min(30, linesOfCode / 10); // Penalize long files
    maintainabilityScore -= Math.min(20, complexityCount * 2); // Penalize complexity
    maintainabilityScore -= Math.min(15, duplicateLines * 3); // Penalize duplication
    maintainabilityScore = Math.max(0, maintainabilityScore);

    const technicalDebt = maintainabilityScore < 50 ? 'high' : 
                         maintainabilityScore < 75 ? 'medium' : 'low';

    return {
      linesOfCode,
      complexity,
      maintainabilityScore,
      duplicateLines,
      technicalDebt
    };
  }

  private async identifyIssues(
    code: string, 
    focusAreas: string[], 
    language: string, 
    model: string
  ): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];
    let issueId = 1;

    // Security issues
    if (focusAreas.includes('security')) {
      const securityPatterns = [
        { pattern: /eval\s*\(/, title: 'Dangerous eval() usage', severity: 'critical' as const },
        { pattern: /document\.write\s*\(/, title: 'XSS vulnerability with document.write', severity: 'high' as const },
        { pattern: /innerHTML\s*=/, title: 'Potential XSS via innerHTML', severity: 'medium' as const },
        { pattern: /password.*=.*['"][^'"]*['"]/, title: 'Hardcoded password', severity: 'critical' as const },
        { pattern: /api[_-]?key.*=.*['"][^'"]*['"]/, title: 'Hardcoded API key', severity: 'high' as const }
      ];

      securityPatterns.forEach(({ pattern, title, severity }) => {
        const matches = code.match(new RegExp(pattern.source, 'gi'));
        if (matches) {
          issues.push({
            id: `issue-${issueId++}`,
            type: 'security',
            severity,
            title,
            description: `Found ${matches.length} instance(s) of ${title.toLowerCase()}`,
            reasoning: 'Security vulnerabilities can lead to data breaches and system compromises',
            suggestion: this.getSecuritySuggestion(pattern.source)
          });
        }
      });
    }

    // Performance issues
    if (focusAreas.includes('performance')) {
      const performancePatterns = [
        { pattern: /for\s*\([^)]*\.length[^)]*\)/, title: 'Array length calculated in loop', severity: 'medium' as const },
        { pattern: /document\.getElementById.*loop/s, title: 'DOM query in loop', severity: 'high' as const },
        { pattern: /\+\s*=['"].*['"]/, title: 'String concatenation in loop', severity: 'medium' as const }
      ];

      performancePatterns.forEach(({ pattern, title, severity }) => {
        if (pattern.test(code)) {
          issues.push({
            id: `issue-${issueId++}`,
            type: 'performance',
            severity,
            title,
            description: `Performance issue detected: ${title}`,
            reasoning: 'This pattern can cause performance bottlenecks in large datasets',
            suggestion: this.getPerformanceSuggestion(title)
          });
        }
      });
    }

    // Readability issues
    if (focusAreas.includes('readability')) {
      const lines = code.split('\n');
      const longLines = lines.filter(line => line.length > 120);
      if (longLines.length > 0) {
        issues.push({
          id: `issue-${issueId++}`,
          type: 'readability',
          severity: 'low',
          title: `Long lines detected (${longLines.length})`,
          description: 'Lines longer than 120 characters reduce readability',
          reasoning: 'Shorter lines are easier to read and understand',
          suggestion: 'Break long lines into multiple lines or extract complex expressions'
        });
      }

      // Deep nesting detection
      const maxNesting = this.calculateMaxNesting(code);
      if (maxNesting > 4) {
        issues.push({
          id: `issue-${issueId++}`,
          type: 'readability',
          severity: maxNesting > 6 ? 'high' : 'medium',
          title: `Deep nesting detected (${maxNesting} levels)`,
          description: 'Deeply nested code is harder to understand and maintain',
          reasoning: 'Excessive nesting increases cognitive load',
          suggestion: 'Extract nested logic into separate functions or use early returns'
        });
      }
    }

    // Bug patterns
    if (focusAreas.includes('bugs')) {
      const bugPatterns = [
        { pattern: /==\s*null(?!\s*\|\||&&)/, title: 'Loose equality with null', severity: 'medium' as const },
        { pattern: /if\s*\([^)]*=\s*[^=]/, title: 'Assignment in if condition', severity: 'high' as const },
        { pattern: /catch\s*\([^)]*\)\s*\{\s*\}/, title: 'Empty catch block', severity: 'medium' as const }
      ];

      bugPatterns.forEach(({ pattern, title, severity }) => {
        if (pattern.test(code)) {
          issues.push({
            id: `issue-${issueId++}`,
            type: 'bug',
            severity,
            title,
            description: `Potential bug pattern: ${title}`,
            reasoning: 'This pattern often leads to unexpected behavior',
            suggestion: this.getBugSuggestion(title)
          });
        }
      });
    }

    return issues;
  }

  private calculateMaxNesting(code: string): number {
    let maxNesting = 0;
    let currentNesting = 0;
    const lines = code.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      const openBraces = (trimmed.match(/\{/g) || []).length;
      const closeBraces = (trimmed.match(/\}/g) || []).length;
      
      currentNesting += openBraces - closeBraces;
      maxNesting = Math.max(maxNesting, currentNesting);
    }

    return maxNesting;
  }

  private getSecuritySuggestion(pattern: string): string {
    const suggestions: { [key: string]: string } = {
      'eval': 'Use JSON.parse() for data parsing or safer alternatives to eval()',
      'document.write': 'Use DOM manipulation methods like createElement() and appendChild()',
      'innerHTML': 'Use textContent or create elements safely with createElement()',
      'password': 'Use environment variables or secure configuration management',
      'api[_-]?key': 'Store API keys in environment variables or secure vaults'
    };

    for (const [key, suggestion] of Object.entries(suggestions)) {
      if (pattern.includes(key)) return suggestion;
    }

    return 'Review security implications and use safer alternatives';
  }

  private getPerformanceSuggestion(title: string): string {
    if (title.includes('Array length')) {
      return 'Cache array length: const len = array.length; for (let i = 0; i < len; i++)';
    }
    if (title.includes('DOM query')) {
      return 'Cache DOM elements outside loops or use more efficient selectors';
    }
    if (title.includes('String concatenation')) {
      return 'Use array.join() or template literals for multiple concatenations';
    }
    return 'Consider optimizing this pattern for better performance';
  }

  private getBugSuggestion(title: string): string {
    if (title.includes('Loose equality')) {
      return 'Use strict equality (=== or !==) instead of loose equality';
    }
    if (title.includes('Assignment in if')) {
      return 'Use === for comparison or move assignment outside if condition';
    }
    if (title.includes('Empty catch')) {
      return 'Handle errors appropriately or at least log them for debugging';
    }
    return 'Review this pattern to prevent potential bugs';
  }

  private async generateSuggestions(
    code: string, 
    issues: CodeIssue[], 
    language: string, 
    model: string
  ): Promise<CodeSuggestion[]> {
    const suggestions: CodeSuggestion[] = [];
    let suggestionId = 1;

    // Generate refactoring suggestions for high complexity
    const lines = code.split('\n');
    if (lines.length > 100) {
      suggestions.push({
        id: `suggestion-${suggestionId++}`,
        type: 'refactor',
        title: 'Extract functions from large file',
        description: 'This file is quite large. Consider breaking it into smaller, focused modules.',
        impact: 'high',
        effort: 'moderate'
      });
    }

    // Suggest modern language features
    if (language === 'javascript' || language === 'typescript') {
      if (code.includes('var ')) {
        suggestions.push({
          id: `suggestion-${suggestionId++}`,
          type: 'modernize',
          title: 'Replace var with const/let',
          description: 'Use const for immutable values and let for mutable ones.',
          beforeCode: 'var name = "value";',
          afterCode: 'const name = "value";',
          impact: 'medium',
          effort: 'minimal'
        });
      }

      if (code.includes('function(')) {
        suggestions.push({
          id: `suggestion-${suggestionId++}`,
          type: 'modernize',
          title: 'Consider arrow functions',
          description: 'Arrow functions provide cleaner syntax for simple functions.',
          beforeCode: 'array.map(function(item) { return item.name; })',
          afterCode: 'array.map(item => item.name)',
          impact: 'low',
          effort: 'minimal'
        });
      }
    }

    // Generate suggestions based on critical issues
    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    criticalIssues.forEach(issue => {
      suggestions.push({
        id: `suggestion-${suggestionId++}`,
        type: 'refactor',
        title: `Fix critical issue: ${issue.title}`,
        description: `Address the critical ${issue.type} issue found in the code.`,
        impact: 'high',
        effort: 'moderate'
      });
    });

    return suggestions;
  }

  private async generateSocraticQuestions(
    code: string, 
    issues: CodeIssue[], 
    language: string
  ): Promise<string[]> {
    const questions: string[] = [];

    // Questions based on code structure
    const lines = code.split('\n').filter(line => line.trim()).length;
    if (lines > 50) {
      questions.push('What would happen if this file grew to 1000 lines? How would you maintain it?');
    }

    // Questions based on complexity
    const complexityIssues = issues.filter(issue => issue.type === 'readability');
    if (complexityIssues.length > 0) {
      questions.push('Why is simple code often better than clever code?');
      questions.push('How would a new team member understand this code in 6 months?');
    }

    // Questions based on security
    const securityIssues = issues.filter(issue => issue.type === 'security');
    if (securityIssues.length > 0) {
      questions.push('What could an attacker do if they could control the input to this function?');
      questions.push('How would you protect sensitive data in this implementation?');
    }

    // Questions based on performance
    const performanceIssues = issues.filter(issue => issue.type === 'performance');
    if (performanceIssues.length > 0) {
      questions.push('What happens to performance when the data size increases by 100x?');
      questions.push('Where would you expect bottlenecks to appear under load?');
    }

    // General architectural questions
    questions.push('What assumptions is this code making about its environment?');
    questions.push('How would you test the edge cases in this implementation?');
    questions.push('What would break if the requirements changed slightly?');

    return questions.slice(0, 5); // Limit to 5 questions
  }

  private synthesizeReview(
    issues: CodeIssue[], 
    suggestions: CodeSuggestion[], 
    metrics: CodeMetrics,
    socraticQuestions: string[]
  ): string {
    let synthesis = `## Code Review Summary\n\n`;

    // Overview
    synthesis += `**Code Metrics:**\n`;
    synthesis += `- Lines of Code: ${metrics.linesOfCode}\n`;
    synthesis += `- Complexity: ${metrics.complexity}\n`;
    synthesis += `- Maintainability Score: ${metrics.maintainabilityScore}/100\n`;
    synthesis += `- Technical Debt: ${metrics.technicalDebt}\n\n`;

    // Issues breakdown
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const highIssues = issues.filter(i => i.severity === 'high');
    const mediumIssues = issues.filter(i => i.severity === 'medium');

    if (criticalIssues.length > 0) {
      synthesis += `🚨 **Critical Issues (${criticalIssues.length}):** Immediate attention required\n`;
      criticalIssues.forEach(issue => {
        synthesis += `- ${issue.title}: ${issue.description}\n`;
      });
      synthesis += '\n';
    }

    if (highIssues.length > 0) {
      synthesis += `⚠️ **High Priority Issues (${highIssues.length}):** Should be addressed soon\n`;
      highIssues.slice(0, 3).forEach(issue => {
        synthesis += `- ${issue.title}\n`;
      });
      synthesis += '\n';
    }

    // Top suggestions
    const highImpactSuggestions = suggestions.filter(s => s.impact === 'high');
    if (highImpactSuggestions.length > 0) {
      synthesis += `💡 **Top Improvement Suggestions:**\n`;
      highImpactSuggestions.slice(0, 3).forEach(suggestion => {
        synthesis += `- ${suggestion.title} (${suggestion.effort} effort, ${suggestion.impact} impact)\n`;
      });
      synthesis += '\n';
    }

    // Learning opportunities
    if (socraticQuestions.length > 0) {
      synthesis += `🤔 **Questions to Consider:**\n`;
      socraticQuestions.slice(0, 3).forEach(question => {
        synthesis += `- ${question}\n`;
      });
      synthesis += '\n';
    }

    // Overall assessment
    let overallScore = 'Good';
    if (criticalIssues.length > 0 || metrics.maintainabilityScore < 50) {
      overallScore = 'Needs Improvement';
    } else if (metrics.maintainabilityScore > 80 && highIssues.length === 0) {
      overallScore = 'Excellent';
    }

    synthesis += `**Overall Assessment:** ${overallScore}\n`;
    synthesis += `**Total Issues Found:** ${issues.length} (${criticalIssues.length} critical, ${highIssues.length} high, ${mediumIssues.length} medium)\n`;
    synthesis += `**Improvement Suggestions:** ${suggestions.length}\n`;

    return synthesis;
  }
}