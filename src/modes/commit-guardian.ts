export interface CommitGuardianOptions {
  model?: string;
  maxTokens?: number;
  strict?: boolean;
  checkSecurity?: boolean;
  checkQuality?: boolean;
  checkTests?: boolean;
}

export interface ValidationResult {
  passed: boolean;
  score: number;
  checks: Check[];
  blockers: Issue[];
  warnings: Issue[];
  suggestions: string[];
  readyToCommit: boolean;
  summary: string;
}

export interface Check {
  name: string;
  category: 'security' | 'quality' | 'tests' | 'dependencies' | 'configuration';
  passed: boolean;
  severity: 'info' | 'warning' | 'error' | 'blocker';
  details: string;
  affectedFiles?: string[];
}

export interface Issue {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  file?: string;
  line?: number;
  description: string;
  suggestion?: string;
}

export class CommitGuardian {
  private defaultModel = 'gemini-3.1-pro-preview';
  private defaultMaxTokens = 5000;
  
  private securityPatterns = [
    { pattern: /api[_-]?key/i, type: 'api_key' },
    { pattern: /password\s*=\s*["'][^"']+["']/i, type: 'hardcoded_password' },
    { pattern: /token\s*=\s*["'][^"']+["']/i, type: 'hardcoded_token' },
    { pattern: /secret\s*=\s*["'][^"']+["']/i, type: 'hardcoded_secret' },
    { pattern: /private[_-]?key/i, type: 'private_key' },
    { pattern: /eval\s*\(/i, type: 'dangerous_eval' },
    { pattern: /exec\s*\(/i, type: 'dangerous_exec' },
    { pattern: /innerHTML\s*=/i, type: 'xss_risk' },
    { pattern: /TODO\s*:?\s*security/i, type: 'security_todo' }
  ];
  
  private qualityPatterns = [
    { pattern: /console\.(log|error|warn|debug)/i, type: 'console_log' },
    { pattern: /debugger/i, type: 'debugger_statement' },
    { pattern: /TODO|FIXME|HACK|XXX/i, type: 'todo_comment' },
    { pattern: /^\s*\/\/.*$/gm, type: 'commented_code', count: true },
    { pattern: /\t/, type: 'mixed_indentation' },
    { pattern: /\s+$/gm, type: 'trailing_whitespace' }
  ];

  async validate(context: any, options: CommitGuardianOptions = {}): Promise<ValidationResult> {
    const model = options.model || this.defaultModel;
    const maxTokens = options.maxTokens || this.defaultMaxTokens;
    const strict = options.strict !== false;
    
    const checks: Check[] = [];
    const blockers: Issue[] = [];
    const warnings: Issue[] = [];
    const suggestions: string[] = [];
    
    // Run security checks
    if (options.checkSecurity !== false) {
      const securityCheck = await this.runSecurityChecks(context, model, maxTokens * 0.4);
      checks.push(...securityCheck.checks);
      blockers.push(...securityCheck.blockers);
      warnings.push(...securityCheck.warnings);
    }
    
    // Run quality checks
    if (options.checkQuality !== false) {
      const qualityCheck = await this.runQualityChecks(context, model, maxTokens * 0.3);
      checks.push(...qualityCheck.checks);
      if (strict) {
        blockers.push(...qualityCheck.blockers);
      } else {
        warnings.push(...qualityCheck.blockers);
      }
      warnings.push(...qualityCheck.warnings);
    }
    
    // Run test checks
    if (options.checkTests !== false) {
      const testCheck = await this.runTestChecks(context, maxTokens * 0.2);
      checks.push(...testCheck.checks);
      warnings.push(...testCheck.warnings);
    }
    
    // Check dependencies
    const depCheck = await this.checkDependencies(context, maxTokens * 0.1);
    checks.push(...depCheck.checks);
    warnings.push(...depCheck.warnings);
    
    // Generate suggestions
    suggestions.push(...this.generateSuggestions(checks, blockers, warnings));
    
    // Calculate overall score
    const score = this.calculateScore(checks, blockers, warnings);
    const passed = blockers.length === 0 && score >= (strict ? 80 : 60);
    const readyToCommit = passed && blockers.length === 0;
    
    // Generate summary
    const summary = this.generateSummary(checks, blockers, warnings, score, readyToCommit);
    
    return {
      passed,
      score,
      checks,
      blockers,
      warnings,
      suggestions,
      readyToCommit,
      summary
    };
  }

  private async runSecurityChecks(
    context: any,
    model: string,
    maxTokens: number
  ): Promise<{ checks: Check[]; blockers: Issue[]; warnings: Issue[] }> {
    const checks: Check[] = [];
    const blockers: Issue[] = [];
    const warnings: Issue[] = [];
    
    const files = this.extractFiles(context);
    
    for (const file of files) {
      const content = file.content || '';
      
      // Check for security patterns
      for (const { pattern, type } of this.securityPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          const severity = this.getSecuritySeverity(type);
          const issue: Issue = {
            type,
            severity,
            file: file.path,
            description: `Found ${type.replace(/_/g, ' ')}: ${matches[0].substring(0, 50)}...`,
            suggestion: this.getSecuritySuggestion(type)
          };
          
          if (severity === 'critical') {
            blockers.push(issue);
          } else {
            warnings.push(issue);
          }
          
          checks.push({
            name: `Security: ${type}`,
            category: 'security',
            passed: false,
            severity: severity === 'critical' ? 'blocker' : 'error',
            details: issue.description,
            affectedFiles: [file.path]
          });
        }
      }
    }
    
    // If no security issues found
    if (checks.length === 0) {
      checks.push({
        name: 'Security Check',
        category: 'security',
        passed: true,
        severity: 'info',
        details: 'No security vulnerabilities detected'
      });
    }
    
    return { checks, blockers, warnings };
  }

  private async runQualityChecks(
    context: any,
    model: string,
    maxTokens: number
  ): Promise<{ checks: Check[]; blockers: Issue[]; warnings: Issue[] }> {
    const checks: Check[] = [];
    const blockers: Issue[] = [];
    const warnings: Issue[] = [];
    
    const files = this.extractFiles(context);
    let totalIssues = 0;
    
    for (const file of files) {
      const content = file.content || '';
      
      // Check for quality patterns
      for (const { pattern, type, count } of this.qualityPatterns) {
        const matches = content.match(pattern);
        if (matches && matches.length > 0) {
          const issueCount = count ? matches.length : 1;
          totalIssues += issueCount;
          
          const severity = this.getQualitySeverity(type, issueCount);
          const issue: Issue = {
            type,
            severity,
            file: file.path,
            description: `Found ${issueCount} instance(s) of ${type.replace(/_/g, ' ')}`,
            suggestion: this.getQualitySuggestion(type)
          };
          
          if (type === 'console_log' || type === 'debugger_statement') {
            blockers.push(issue);
          } else {
            warnings.push(issue);
          }
        }
      }
      
      // Check code complexity
      const complexity = this.calculateComplexity(content);
      if (complexity > 10) {
        warnings.push({
          type: 'high_complexity',
          severity: 'medium',
          file: file.path,
          description: `High cyclomatic complexity: ${complexity}`,
          suggestion: 'Consider refactoring to reduce complexity'
        });
      }
    }
    
    checks.push({
      name: 'Code Quality',
      category: 'quality',
      passed: totalIssues === 0,
      severity: totalIssues > 10 ? 'error' : totalIssues > 0 ? 'warning' : 'info',
      details: `Found ${totalIssues} quality issues`,
      affectedFiles: files.map(f => f.path)
    });
    
    return { checks, blockers, warnings };
  }

  private async runTestChecks(
    context: any,
    maxTokens: number
  ): Promise<{ checks: Check[]; warnings: Issue[] }> {
    const checks: Check[] = [];
    const warnings: Issue[] = [];
    
    const files = this.extractFiles(context);
    const testFiles = files.filter(f => 
      f.path.includes('.test.') || 
      f.path.includes('.spec.') ||
      f.path.includes('__tests__')
    );
    
    const modifiedSourceFiles = files.filter(f => 
      !f.path.includes('.test.') && 
      !f.path.includes('.spec.') &&
      (f.path.endsWith('.ts') || f.path.endsWith('.js') || f.path.endsWith('.tsx') || f.path.endsWith('.jsx'))
    );
    
    // Check test coverage
    if (modifiedSourceFiles.length > 0 && testFiles.length === 0) {
      warnings.push({
        type: 'missing_tests',
        severity: 'medium',
        description: 'Source files modified but no test files included',
        suggestion: 'Consider adding or updating tests for the modified code'
      });
      
      checks.push({
        name: 'Test Coverage',
        category: 'tests',
        passed: false,
        severity: 'warning',
        details: 'No test files found for modified source files'
      });
    } else if (testFiles.length > 0) {
      checks.push({
        name: 'Test Coverage',
        category: 'tests',
        passed: true,
        severity: 'info',
        details: `Found ${testFiles.length} test file(s)`
      });
    }
    
    // Check for skipped tests
    for (const file of testFiles) {
      const content = file.content || '';
      if (content.includes('.skip(') || content.includes('.only(')) {
        warnings.push({
          type: 'test_modifiers',
          severity: 'medium',
          file: file.path,
          description: 'Found .skip() or .only() in tests',
          suggestion: 'Remove .skip() and .only() before committing'
        });
      }
    }
    
    return { checks, warnings };
  }

  private async checkDependencies(
    context: any,
    maxTokens: number
  ): Promise<{ checks: Check[]; warnings: Issue[] }> {
    const checks: Check[] = [];
    const warnings: Issue[] = [];
    
    const files = this.extractFiles(context);
    const packageFiles = files.filter(f => f.path.includes('package.json'));
    
    for (const file of packageFiles) {
      const content = file.content || '';
      try {
        const pkg = JSON.parse(content);
        
        // Check for missing dependencies
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        const hasVulnerableDeps = this.checkVulnerableDependencies(deps);
        
        if (hasVulnerableDeps.length > 0) {
          warnings.push({
            type: 'vulnerable_dependencies',
            severity: 'high',
            file: file.path,
            description: `Found potentially vulnerable dependencies: ${hasVulnerableDeps.join(', ')}`,
            suggestion: 'Update dependencies to latest secure versions'
          });
        }
        
        checks.push({
          name: 'Dependency Check',
          category: 'dependencies',
          passed: hasVulnerableDeps.length === 0,
          severity: hasVulnerableDeps.length > 0 ? 'warning' : 'info',
          details: hasVulnerableDeps.length > 0 ? 
            `${hasVulnerableDeps.length} vulnerable dependencies` : 
            'All dependencies appear secure',
          affectedFiles: [file.path]
        });
      } catch (e) {
        // Not a valid JSON
      }
    }
    
    return { checks, warnings };
  }

  private checkVulnerableDependencies(deps: Record<string, string>): string[] {
    const vulnerable: string[] = [];
    
    // Simple check for known vulnerable versions (would use actual vulnerability DB)
    const knownVulnerable: Record<string, (version: string) => boolean> = {
      'lodash': (version: string) => version.includes('4.17.11'),
      'axios': (version: string) => version.includes('0.21.0'),
      'minimist': (version: string) => version.includes('1.2.5')
    };
    
    for (const [name, version] of Object.entries(deps)) {
      if (knownVulnerable[name] && knownVulnerable[name](version)) {
        vulnerable.push(name);
      }
    }
    
    return vulnerable;
  }

  private generateSuggestions(
    checks: Check[],
    blockers: Issue[],
    warnings: Issue[]
  ): string[] {
    const suggestions: string[] = [];
    
    if (blockers.length > 0) {
      suggestions.push(`Fix ${blockers.length} blocking issue(s) before committing`);
    }
    
    const securityIssues = blockers.concat(warnings).filter(i => 
      i.type.includes('key') || i.type.includes('password') || i.type.includes('secret')
    );
    if (securityIssues.length > 0) {
      suggestions.push('Use environment variables for sensitive data');
      suggestions.push('Add sensitive files to .gitignore');
    }
    
    const qualityIssues = warnings.filter(i => 
      i.type.includes('console') || i.type.includes('debugger')
    );
    if (qualityIssues.length > 0) {
      suggestions.push('Remove debugging statements before committing');
    }
    
    const testIssues = checks.filter(c => c.category === 'tests' && !c.passed);
    if (testIssues.length > 0) {
      suggestions.push('Add tests for modified code');
      suggestions.push('Run test suite to ensure all tests pass');
    }
    
    if (warnings.filter(w => w.type === 'high_complexity').length > 0) {
      suggestions.push('Consider refactoring complex functions');
    }
    
    return suggestions;
  }

  private calculateScore(
    checks: Check[],
    blockers: Issue[],
    warnings: Issue[]
  ): number {
    let score = 100;
    
    // Deduct for blockers
    score -= blockers.length * 20;
    
    // Deduct for warnings
    score -= warnings.length * 5;
    
    // Deduct for failed checks
    const failedChecks = checks.filter(c => !c.passed);
    score -= failedChecks.length * 10;
    
    return Math.max(0, Math.min(100, score));
  }

  private generateSummary(
    checks: Check[],
    blockers: Issue[],
    warnings: Issue[],
    score: number,
    readyToCommit: boolean
  ): string {
    let summary = '';
    
    if (readyToCommit) {
      summary = `✅ **Ready to commit!** Score: ${score}/100\n\n`;
      summary += 'All checks passed. Your code is ready for commit.';
    } else if (blockers.length > 0) {
      summary = `🚫 **Commit blocked!** Score: ${score}/100\n\n`;
      summary += `Found ${blockers.length} blocking issue(s):\n`;
      blockers.forEach(b => {
        summary += `- ${b.description}\n`;
      });
    } else {
      summary = `⚠️ **Review recommended** Score: ${score}/100\n\n`;
      summary += `Found ${warnings.length} warning(s). Consider addressing these before committing:\n`;
      warnings.slice(0, 5).forEach(w => {
        summary += `- ${w.description}\n`;
      });
    }
    
    summary += `\n\n**Checks Summary:**\n`;
    summary += `- Security: ${checks.filter(c => c.category === 'security' && c.passed).length}/${checks.filter(c => c.category === 'security').length} passed\n`;
    summary += `- Quality: ${checks.filter(c => c.category === 'quality' && c.passed).length}/${checks.filter(c => c.category === 'quality').length} passed\n`;
    summary += `- Tests: ${checks.filter(c => c.category === 'tests' && c.passed).length}/${checks.filter(c => c.category === 'tests').length} passed\n`;
    
    return summary;
  }

  private extractFiles(context: any): { path: string; content: string }[] {
    // Simulated file extraction
    if (typeof context === 'string') {
      return [{ path: 'unknown', content: context }];
    }
    
    if (context.files) {
      return context.files;
    }
    
    if (context.changes) {
      return context.changes.map((c: any) => ({ path: c.file, content: c.content }));
    }
    
    return [];
  }

  private getSecuritySeverity(type: string): 'low' | 'medium' | 'high' | 'critical' {
    const critical = ['api_key', 'private_key', 'hardcoded_password', 'hardcoded_token'];
    const high = ['hardcoded_secret', 'dangerous_eval', 'dangerous_exec'];
    const medium = ['xss_risk'];
    
    if (critical.includes(type)) return 'critical';
    if (high.includes(type)) return 'high';
    if (medium.includes(type)) return 'medium';
    return 'low';
  }

  private getQualitySeverity(type: string, count: number): 'low' | 'medium' | 'high' | 'critical' {
    if (type === 'console_log' || type === 'debugger_statement') {
      return count > 5 ? 'high' : 'medium';
    }
    if (type === 'commented_code' && count > 50) {
      return 'medium';
    }
    return 'low';
  }

  private getSecuritySuggestion(type: string): string {
    const suggestions: Record<string, string> = {
      'api_key': 'Store API keys in environment variables',
      'hardcoded_password': 'Never hardcode passwords. Use secure credential management',
      'hardcoded_token': 'Store tokens in environment variables or secure storage',
      'hardcoded_secret': 'Use environment variables for secrets',
      'private_key': 'Never commit private keys. Use secure key management',
      'dangerous_eval': 'Avoid eval(). Use safer alternatives',
      'dangerous_exec': 'Avoid exec(). Use safer alternatives',
      'xss_risk': 'Sanitize HTML content to prevent XSS',
      'security_todo': 'Address security TODOs before committing'
    };
    return suggestions[type] || 'Review and fix security issue';
  }

  private getQualitySuggestion(type: string): string {
    const suggestions: Record<string, string> = {
      'console_log': 'Remove console.log statements',
      'debugger_statement': 'Remove debugger statements',
      'todo_comment': 'Address or document TODOs',
      'commented_code': 'Remove commented-out code',
      'mixed_indentation': 'Use consistent indentation (spaces or tabs)',
      'trailing_whitespace': 'Remove trailing whitespace'
    };
    return suggestions[type] || 'Improve code quality';
  }

  private calculateComplexity(code: string): number {
    // Simple cyclomatic complexity calculation
    let complexity = 1;
    
    const patterns = [
      /if\s*\(/g,
      /else\s+if\s*\(/g,
      /for\s*\(/g,
      /while\s*\(/g,
      /case\s+/g,
      /catch\s*\(/g,
      /\?\s*.*\s*:/g  // ternary
    ];
    
    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
  }
}