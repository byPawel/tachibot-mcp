export interface AuditorOptions {
  model?: string;
  maxTokens?: number;
  evidenceRequired?: boolean;
  includeReferences?: boolean;
}

export interface AuditResult {
  claims: AuditedClaim[];
  evidence: Evidence[];
  assumptions: Assumption[];
  gaps: InformationGap[];
  verificationStatus: VerificationStatus;
  synthesis: string;
}

export interface AuditedClaim {
  id: string;
  statement: string;
  type: 'fact' | 'opinion' | 'assumption' | 'conclusion';
  verificationStatus: 'verified' | 'unverified' | 'disputed' | 'insufficient_evidence';
  confidence: number;
  evidence: string[];
  contradictions?: string[];
}

export interface Evidence {
  id: string;
  source: string;
  type: 'documentation' | 'code' | 'external' | 'test' | 'comment';
  content: string;
  reliability: number;
  supportsClaims: string[];
  contradictsClaims?: string[];
}

export interface Assumption {
  id: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  needsValidation: boolean;
  validationMethod?: string;
  impact: string;
}

export interface InformationGap {
  area: string;
  description: string;
  severity: 'minor' | 'moderate' | 'critical';
  suggestedAction: string;
  requiredEvidence: string[];
}

export interface VerificationStatus {
  totalClaims: number;
  verified: number;
  unverified: number;
  disputed: number;
  confidenceScore: number;
  completeness: number;
}

export class Auditor {
  private defaultModel = 'perplexity-sonar-pro';
  private defaultMaxTokens = 5000;

  async audit(context: any, options: AuditorOptions = {}): Promise<AuditResult> {
    const model = options.model || this.defaultModel;
    const maxTokens = options.maxTokens || this.defaultMaxTokens;
    const evidenceRequired = options.evidenceRequired !== false;
    
    // Extract claims from context
    const claims = await this.extractClaims(context, maxTokens * 0.2);
    
    // Gather evidence
    const evidence = await this.gatherEvidence(
      claims,
      model,
      maxTokens * 0.4,
      evidenceRequired
    );
    
    // Identify assumptions
    const assumptions = this.identifyAssumptions(claims, evidence);
    
    // Find information gaps
    const gaps = this.findInformationGaps(claims, evidence, assumptions);
    
    // Verify claims with evidence
    const auditedClaims = await this.verifyClaims(
      claims,
      evidence,
      model,
      maxTokens * 0.3
    );
    
    // Calculate verification status
    const verificationStatus = this.calculateVerificationStatus(auditedClaims);
    
    // Generate synthesis
    const synthesis = await this.generateSynthesis(
      auditedClaims,
      evidence,
      assumptions,
      gaps,
      verificationStatus,
      maxTokens * 0.1
    );
    
    return {
      claims: auditedClaims,
      evidence,
      assumptions,
      gaps,
      verificationStatus,
      synthesis
    };
  }

  private async extractClaims(context: any, maxTokens: number): Promise<AuditedClaim[]> {
    const text = this.contextToText(context);
    const claims: AuditedClaim[] = [];
    
    // Parse context for statements that need verification
    const statements = this.parseStatements(text);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const type = this.classifyStatement(statement);
      
      claims.push({
        id: `claim-${i}`,
        statement,
        type,
        verificationStatus: 'unverified',
        confidence: 0,
        evidence: []
      });
    }
    
    return claims;
  }

  private parseStatements(text: string): string[] {
    // Extract meaningful statements
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    // Filter for statements that make claims
    return sentences.filter(s => {
      const lower = s.toLowerCase();
      return (
        lower.includes('is') ||
        lower.includes('will') ||
        lower.includes('should') ||
        lower.includes('must') ||
        lower.includes('always') ||
        lower.includes('never') ||
        lower.includes('because') ||
        lower.includes('therefore')
      );
    });
  }

  private classifyStatement(statement: string): AuditedClaim['type'] {
    const lower = statement.toLowerCase();
    
    if (lower.includes('assume') || lower.includes('probably') || lower.includes('likely')) {
      return 'assumption';
    }
    if (lower.includes('believe') || lower.includes('think') || lower.includes('feel')) {
      return 'opinion';
    }
    if (lower.includes('therefore') || lower.includes('thus') || lower.includes('so')) {
      return 'conclusion';
    }
    return 'fact';
  }

  private async gatherEvidence(
    claims: AuditedClaim[],
    model: string,
    maxTokens: number,
    required: boolean
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];
    
    if (!required) {
      return evidence;
    }
    
    // Query for evidence using Perplexity for web search
    const searchPrompt = this.buildEvidenceSearchPrompt(claims);
    const searchResults = await this.searchForEvidence(model, searchPrompt, maxTokens);
    
    // Parse search results into evidence
    const parsedEvidence = this.parseSearchResults(searchResults, claims);
    evidence.push(...parsedEvidence);
    
    // Look for code-based evidence
    const codeEvidence = await this.findCodeEvidence(claims);
    evidence.push(...codeEvidence);
    
    // Check documentation
    const docEvidence = await this.findDocumentationEvidence(claims);
    evidence.push(...docEvidence);
    
    return evidence;
  }

  private buildEvidenceSearchPrompt(claims: AuditedClaim[]): string {
    let prompt = 'Find evidence to verify or refute the following claims:\n\n';
    
    claims.slice(0, 5).forEach(claim => {
      prompt += `- ${claim.statement}\n`;
    });
    
    prompt += '\nProvide specific facts, citations, and sources.';
    return prompt;
  }

  private async searchForEvidence(model: string, prompt: string, maxTokens: number): Promise<any> {
    // Simulated search - would use actual Perplexity API
    return {
      results: [
        {
          claim: 'claim-0',
          evidence: 'According to documentation...',
          source: 'https://docs.example.com',
          confidence: 0.8
        }
      ]
    };
  }

  private parseSearchResults(results: any, claims: AuditedClaim[]): Evidence[] {
    const evidence: Evidence[] = [];
    
    if (results.results) {
      results.results.forEach((result: any, index: number) => {
        evidence.push({
          id: `evidence-web-${index}`,
          source: result.source || 'web search',
          type: 'external',
          content: result.evidence || result.content || '',
          reliability: result.confidence || 0.5,
          supportsClaims: [result.claim]
        });
      });
    }
    
    return evidence;
  }

  private async findCodeEvidence(claims: AuditedClaim[]): Promise<Evidence[]> {
    const evidence: Evidence[] = [];
    
    // Simulated code evidence finding
    evidence.push({
      id: 'evidence-code-1',
      source: 'src/auth/validator.ts:45',
      type: 'code',
      content: 'if (!token || token.expired) { throw new Error("Invalid token"); }',
      reliability: 0.9,
      supportsClaims: ['claim-0']
    });
    
    return evidence;
  }

  private async findDocumentationEvidence(claims: AuditedClaim[]): Promise<Evidence[]> {
    const evidence: Evidence[] = [];
    
    // Simulated documentation evidence
    evidence.push({
      id: 'evidence-doc-1',
      source: 'README.md',
      type: 'documentation',
      content: 'The system uses JWT tokens for authentication',
      reliability: 0.7,
      supportsClaims: ['claim-1']
    });
    
    return evidence;
  }

  private identifyAssumptions(claims: AuditedClaim[], evidence: Evidence[]): Assumption[] {
    const assumptions: Assumption[] = [];
    
    // Find claims without sufficient evidence
    for (const claim of claims) {
      if (claim.type === 'assumption' || claim.evidence.length === 0) {
        const supportingEvidence = evidence.filter(e => 
          e.supportsClaims.includes(claim.id)
        );
        
        if (supportingEvidence.length === 0) {
          assumptions.push({
            id: `assumption-${assumptions.length}`,
            description: claim.statement,
            risk: this.assessAssumptionRisk(claim),
            needsValidation: true,
            validationMethod: this.suggestValidationMethod(claim),
            impact: this.assessImpact(claim)
          });
        }
      }
    }
    
    return assumptions;
  }

  private assessAssumptionRisk(claim: AuditedClaim): 'low' | 'medium' | 'high' {
    const criticalKeywords = ['security', 'authentication', 'payment', 'critical'];
    const statement = claim.statement.toLowerCase();
    
    if (criticalKeywords.some(keyword => statement.includes(keyword))) {
      return 'high';
    }
    if (claim.type === 'conclusion') {
      return 'medium';
    }
    return 'low';
  }

  private suggestValidationMethod(claim: AuditedClaim): string {
    if (claim.statement.includes('performance')) {
      return 'Performance testing and benchmarking';
    }
    if (claim.statement.includes('security')) {
      return 'Security audit and penetration testing';
    }
    if (claim.statement.includes('user')) {
      return 'User testing and feedback collection';
    }
    return 'Empirical testing and measurement';
  }

  private assessImpact(claim: AuditedClaim): string {
    if (claim.type === 'conclusion') {
      return 'High - affects decision making';
    }
    if (claim.type === 'assumption') {
      return 'Medium - may affect implementation';
    }
    return 'Low - informational';
  }

  private findInformationGaps(
    claims: AuditedClaim[],
    evidence: Evidence[],
    assumptions: Assumption[]
  ): InformationGap[] {
    const gaps: InformationGap[] = [];
    
    // Check for claims without evidence
    const unverifiedClaims = claims.filter(c => c.evidence.length === 0);
    if (unverifiedClaims.length > 0) {
      gaps.push({
        area: 'Evidence Coverage',
        description: `${unverifiedClaims.length} claims lack supporting evidence`,
        severity: unverifiedClaims.some(c => c.type === 'fact') ? 'critical' : 'moderate',
        suggestedAction: 'Gather additional evidence through testing or documentation',
        requiredEvidence: unverifiedClaims.map(c => c.statement)
      });
    }
    
    // Check for high-risk assumptions
    const highRiskAssumptions = assumptions.filter(a => a.risk === 'high');
    if (highRiskAssumptions.length > 0) {
      gaps.push({
        area: 'Critical Assumptions',
        description: `${highRiskAssumptions.length} high-risk assumptions need validation`,
        severity: 'critical',
        suggestedAction: 'Validate assumptions through testing or expert review',
        requiredEvidence: highRiskAssumptions.map(a => a.validationMethod || '')
      });
    }
    
    // Check for contradictory evidence
    const contradictions = evidence.filter(e => e.contradictsClaims && e.contradictsClaims.length > 0);
    if (contradictions.length > 0) {
      gaps.push({
        area: 'Contradictory Information',
        description: 'Found conflicting evidence that needs resolution',
        severity: 'moderate',
        suggestedAction: 'Investigate and resolve contradictions',
        requiredEvidence: ['Additional verification', 'Expert consultation']
      });
    }
    
    return gaps;
  }

  private async verifyClaims(
    claims: AuditedClaim[],
    evidence: Evidence[],
    model: string,
    maxTokens: number
  ): Promise<AuditedClaim[]> {
    const auditedClaims: AuditedClaim[] = [];
    
    for (const claim of claims) {
      const supportingEvidence = evidence.filter(e => 
        e.supportsClaims.includes(claim.id)
      );
      const contradictingEvidence = evidence.filter(e => 
        e.contradictsClaims?.includes(claim.id)
      );
      
      let status: AuditedClaim['verificationStatus'];
      let confidence: number;
      
      if (contradictingEvidence.length > 0) {
        status = 'disputed';
        confidence = 0.3;
      } else if (supportingEvidence.length >= 2) {
        status = 'verified';
        confidence = Math.min(0.9, supportingEvidence.reduce((sum, e) => sum + e.reliability, 0) / supportingEvidence.length);
      } else if (supportingEvidence.length === 1) {
        status = 'unverified';
        confidence = supportingEvidence[0].reliability * 0.7;
      } else {
        status = 'insufficient_evidence';
        confidence = 0.1;
      }
      
      auditedClaims.push({
        ...claim,
        verificationStatus: status,
        confidence,
        evidence: supportingEvidence.map(e => e.id),
        contradictions: contradictingEvidence.length > 0 ? 
          contradictingEvidence.map(e => e.id) : undefined
      });
    }
    
    return auditedClaims;
  }

  private calculateVerificationStatus(claims: AuditedClaim[]): VerificationStatus {
    const total = claims.length;
    const verified = claims.filter(c => c.verificationStatus === 'verified').length;
    const unverified = claims.filter(c => c.verificationStatus === 'unverified').length;
    const disputed = claims.filter(c => c.verificationStatus === 'disputed').length;
    
    const avgConfidence = claims.reduce((sum, c) => sum + c.confidence, 0) / total;
    const completeness = (verified + unverified * 0.5) / total;
    
    return {
      totalClaims: total,
      verified,
      unverified,
      disputed,
      confidenceScore: avgConfidence,
      completeness
    };
  }

  private async generateSynthesis(
    claims: AuditedClaim[],
    evidence: Evidence[],
    assumptions: Assumption[],
    gaps: InformationGap[],
    status: VerificationStatus,
    maxTokens: number
  ): Promise<string> {
    let synthesis = `## Audit Summary\n\n`;
    
    synthesis += `### Verification Status\n`;
    synthesis += `- **Total Claims**: ${status.totalClaims}\n`;
    synthesis += `- **Verified**: ${status.verified} (${(status.verified/status.totalClaims*100).toFixed(1)}%)\n`;
    synthesis += `- **Disputed**: ${status.disputed}\n`;
    synthesis += `- **Confidence Score**: ${(status.confidenceScore*100).toFixed(1)}%\n\n`;
    
    synthesis += `### Key Findings\n`;
    
    // Highlight verified facts
    const verifiedFacts = claims.filter(c => c.verificationStatus === 'verified' && c.type === 'fact');
    if (verifiedFacts.length > 0) {
      synthesis += `**Verified Facts**:\n`;
      verifiedFacts.slice(0, 3).forEach(fact => {
        synthesis += `✓ ${fact.statement}\n`;
      });
      synthesis += '\n';
    }
    
    // Highlight disputed claims
    const disputed = claims.filter(c => c.verificationStatus === 'disputed');
    if (disputed.length > 0) {
      synthesis += `**Disputed Claims** ⚠️:\n`;
      disputed.forEach(claim => {
        synthesis += `✗ ${claim.statement}\n`;
      });
      synthesis += '\n';
    }
    
    // Critical assumptions
    const criticalAssumptions = assumptions.filter(a => a.risk === 'high');
    if (criticalAssumptions.length > 0) {
      synthesis += `**Critical Assumptions** 🔴:\n`;
      criticalAssumptions.forEach(assumption => {
        synthesis += `- ${assumption.description}\n`;
        synthesis += `  Validation: ${assumption.validationMethod}\n`;
      });
      synthesis += '\n';
    }
    
    // Information gaps
    if (gaps.length > 0) {
      synthesis += `### Information Gaps\n`;
      gaps.forEach(gap => {
        synthesis += `- **${gap.area}** (${gap.severity}): ${gap.description}\n`;
        synthesis += `  Action: ${gap.suggestedAction}\n`;
      });
    }
    
    return synthesis;
  }

  private contextToText(context: any): string {
    if (typeof context === 'string') return context;
    if (context && typeof context === 'object') {
      if (context.query) return context.query;
      if (context.text) return context.text;
      if (context.content) return context.content;
      return JSON.stringify(context);
    }
    return '';
  }
}