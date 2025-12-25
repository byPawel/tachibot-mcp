import { EventEmitter } from 'events';
import { modelPreferences } from '../config/model-preferences.js';

// Tool Registry with capabilities and metadata
export interface ToolCapability {
  id: string;
  name: string;
  description: string;
  category: 'analysis' | 'reasoning' | 'validation' | 'research' | 'generation' | 'testing' | 'coordination';
  capabilities: string[];
  strengths: string[];
  weaknesses: string[];
  bestFor: string[];
  costLevel: 'low' | 'medium' | 'high';
  timeComplexity: 'fast' | 'medium' | 'slow';
  reliability: number; // 0-1 score
  prerequisites?: string[];
  outputs: string[];
}

// Available Tachibot-MCP tools with their capabilities
export const FOCUS_MCP_TOOLS: Record<string, ToolCapability> = {
  // PRIMARY STABLE MODELS (Use these first)
  gpt5_mini: {
    id: 'gpt5_mini',
    name: 'GPT-5-mini',
    description: 'Cost-effective GPT-5 reasoning variant with balanced performance',
    category: 'reasoning',
    capabilities: ['advanced_reasoning', 'multi_step_analysis', 'rapid_adaptation'],
    strengths: ['flagship_quality', 'fast_response', 'cost_effective'],
    weaknesses: ['none'],
    bestFor: ['production_reasoning', 'stable_workflows', 'cost_effective_tasks'],
    costLevel: 'low',
    timeComplexity: 'fast',
    reliability: 0.92,
    outputs: ['reasoning', 'analysis', 'structured_output']
  },

  gemini_25_pro: {
    id: 'gemini_25_pro',
    name: 'Gemini 2.5 Pro',
    description: 'Alternative provider for diversified reasoning',
    category: 'reasoning',
    capabilities: ['large_context', 'multi_modal', 'comprehensive_analysis'],
    strengths: ['different_provider', 'large_context_window', 'visual_understanding'],
    weaknesses: ['different_api', 'may_have_different_behavior'],
    bestFor: ['alternative_perspective', 'large_context_tasks', 'multi_modal_analysis'],
    costLevel: 'medium',
    timeComplexity: 'medium',
    reliability: 0.85,
    outputs: ['comprehensive_analysis', 'multi_modal_output', 'reasoning']
  },

  gpt5: {
    id: 'gpt5',
    name: 'GPT-5 Flagship',
    description: 'Primary flagship reasoning model for advanced tasks',
    category: 'reasoning',
    capabilities: ['flagship_reasoning', 'long_horizon_planning', 'multi_domain_synthesis'],
    strengths: ['highest_accuracy', 'deep_context_integration', 'strategic_reasoning'],
    weaknesses: ['premium_cost'],
    bestFor: ['critical_reasoning', 'high_stakes_analysis', 'executive_briefings'],
    costLevel: 'high',
    timeComplexity: 'medium',
    reliability: 0.92,
    outputs: ['reasoning', 'analysis', 'strategic_plan']
  },

  // Core Focus Tools
  think: {
    id: 'think',
    name: 'Think Tool',
    description: 'Simple thinking and reasoning cache',
    category: 'reasoning',
    capabilities: ['reflection', 'memory', 'quick_reasoning'],
    strengths: ['fast', 'lightweight', 'good_for_simple_reasoning'],
    weaknesses: ['no_research', 'limited_complexity'],
    bestFor: ['quick_thoughts', 'memory_aid', 'simple_logic'],
    costLevel: 'low',
    timeComplexity: 'fast',
    reliability: 0.9,
    outputs: ['thought', 'reflection']
  },

  focus: {
    id: 'focus',
    name: 'Focus Deep Reasoning',
    description: 'Multi-AI collaborative reasoning with specialized modes',
    category: 'reasoning',
    capabilities: ['deep_reasoning', 'multi_model', 'collaborative', 'specialized_modes'],
    strengths: ['comprehensive_analysis', 'multiple_perspectives', 'domain_specific'],
    weaknesses: ['high_cost', 'slow', 'token_heavy'],
    bestFor: ['complex_problems', 'multi_perspective_analysis', 'technical_domains'],
    costLevel: 'high',
    timeComplexity: 'slow',
    reliability: 0.95,
    outputs: ['reasoning_chain', 'consensus', 'multiple_perspectives']
  },

  nextThought: {
    id: 'nextThought',
    name: 'Sequential Thinking',
    description: 'Step-by-step sequential reasoning with branching',
    category: 'reasoning',
    capabilities: ['sequential_thinking', 'branching', 'iteration', 'revision'],
    strengths: ['structured_thinking', 'iterative_improvement', 'revision_capability'],
    weaknesses: ['linear_approach', 'no_research'],
    bestFor: ['step_by_step_problems', 'iterative_reasoning', 'structured_analysis'],
    costLevel: 'medium',
    timeComplexity: 'medium',
    reliability: 0.85,
    outputs: ['thought_sequence', 'reasoning_steps', 'final_conclusion']
  },

  // Research Tools - Different Variants for Different Needs
  scout: {
    id: 'scout',
    name: 'Scout Research Tool',
    description: 'Quick hybrid intelligence gathering for initial context (uses research_scout variant)',
    category: 'research',
    capabilities: ['quick_research', 'context_discovery', 'initial_exploration', 'problem_scouting'],
    strengths: ['fast_context', 'good_starting_point', 'broad_overview'],
    weaknesses: ['surface_level', 'not_comprehensive'],
    bestFor: ['initial_exploration', 'context_gathering', 'problem_understanding', 'quick_overview'],
    costLevel: 'low',
    timeComplexity: 'fast',
    reliability: 0.8,
    outputs: ['initial_findings', 'context_overview', 'problem_landscape']
  },

  perplexity_ask: {
    id: 'perplexity_ask',
    name: 'Perplexity Direct Ask',
    description: 'Direct web search and information retrieval using Perplexity Sonar Pro',
    category: 'research',
    capabilities: ['web_search', 'current_information', 'direct_answers', 'fact_retrieval'],
    strengths: ['current_data', 'direct_answers', 'fast_results'],
    weaknesses: ['single_query_focus', 'limited_depth'],
    bestFor: ['specific_questions', 'current_events', 'fact_checking', 'quick_answers'],
    costLevel: 'medium',
    timeComplexity: 'fast',
    reliability: 0.9,
    outputs: ['direct_answer', 'sources', 'current_information']
  },

  perplexity_research: {
    id: 'perplexity_research',
    name: 'Perplexity Deep Research',
    description: 'Comprehensive research with evidence gathering and synthesis',
    category: 'research',
    capabilities: ['deep_research', 'evidence_synthesis', 'comprehensive_investigation', 'multi_query'],
    strengths: ['comprehensive_coverage', 'evidence_based', 'thorough_analysis'],
    weaknesses: ['expensive', 'time_consuming', 'may_be_overwhelming'],
    bestFor: ['research_projects', 'comprehensive_analysis', 'evidence_gathering', 'academic_research'],
    costLevel: 'high',
    timeComplexity: 'slow',
    reliability: 0.95,
    outputs: ['research_report', 'evidence_collection', 'comprehensive_findings']
  },

  perplexity_reason: {
    id: 'perplexity_reason',
    name: 'Perplexity Reasoning Pro',
    description: 'Complex reasoning using Perplexity Sonar Reasoning Pro model with web data',
    category: 'reasoning',
    capabilities: ['reasoning_with_data', 'evidence_based_reasoning', 'analytical_reasoning', 'data_synthesis'],
    strengths: ['data_informed_reasoning', 'current_information', 'analytical_approach'],
    weaknesses: ['research_dependent', 'may_be_biased_to_web_sources'],
    bestFor: ['data_driven_decisions', 'evidence_based_reasoning', 'analytical_problems'],
    costLevel: 'high',
    timeComplexity: 'medium',
    reliability: 0.9,
    outputs: ['reasoned_analysis', 'data_supported_conclusions', 'evidence_chain']
  },

  focus_deep_research: {
    id: 'focus_deep_research',
    name: 'Focus Deep Research Workflow',
    description: 'Multi-AI comprehensive investigation with evidence gathering (Focus workflow)',
    category: 'research',
    capabilities: ['multi_ai_research', 'comprehensive_investigation', 'pattern_recognition', 'systematic_analysis'],
    strengths: ['multiple_perspectives', 'thorough_coverage', 'systematic_approach'],
    weaknesses: ['very_expensive', 'very_slow', 'complex_output'],
    bestFor: ['complex_research_projects', 'multi_perspective_analysis', 'systematic_investigation'],
    costLevel: 'high',
    timeComplexity: 'slow',
    reliability: 0.95,
    outputs: ['multi_perspective_research', 'comprehensive_analysis', 'research_synthesis']
  },

  challenger: {
    id: 'challenger',
    name: 'Critical Challenger',
    description: 'Critical thinking and echo chamber prevention with counter-arguments',
    category: 'validation',
    capabilities: ['critical_analysis', 'counter_arguments', 'assumption_challenging', 'bias_detection'],
    strengths: ['critical_thinking', 'bias_detection', 'alternative_perspectives'],
    weaknesses: ['potentially_negative', 'no_solutions_offered'],
    bestFor: ['validation', 'assumption_testing', 'bias_checking', 'critical_review'],
    costLevel: 'medium',
    timeComplexity: 'medium',
    reliability: 0.85,
    outputs: ['challenges', 'counter_arguments', 'assumptions_questioned']
  },

  verifier: {
    id: 'verifier',
    name: 'Multi-Model Verifier',
    description: 'Multi-model parallel verification with consensus analysis',
    category: 'validation',
    capabilities: ['consensus_building', 'multi_model_verification', 'fact_checking', 'validation'],
    strengths: ['consensus_approach', 'multiple_models', 'reliability'],
    weaknesses: ['expensive', 'slow', 'may_not_reach_consensus'],
    bestFor: ['final_validation', 'consensus_building', 'fact_verification', 'quality_assurance'],
    costLevel: 'high',
    timeComplexity: 'slow',
    reliability: 0.95,
    outputs: ['consensus_score', 'verification_result', 'model_agreement']
  },

  auditor: {
    id: 'auditor',
    name: 'Evidence Auditor',
    description: 'Evidence-based verification and systematic assumption checking',
    category: 'validation',
    capabilities: ['evidence_verification', 'assumption_checking', 'systematic_analysis', 'quality_audit'],
    strengths: ['evidence_based', 'systematic', 'thorough_checking'],
    weaknesses: ['requires_evidence', 'may_be_overly_critical'],
    bestFor: ['quality_assurance', 'evidence_validation', 'systematic_checking'],
    costLevel: 'medium',
    timeComplexity: 'medium',
    reliability: 0.9,
    outputs: ['audit_results', 'evidence_assessment', 'quality_score']
  },

  commit_guardian: {
    id: 'commit_guardian',
    name: 'Commit Guardian',
    description: 'Pre-commit validation for security, quality, and tests',
    category: 'validation',
    capabilities: ['pre_commit_validation', 'security_check', 'quality_check', 'test_validation'],
    strengths: ['comprehensive_validation', 'security_focused', 'code_quality'],
    weaknesses: ['development_specific', 'strict_criteria'],
    bestFor: ['code_validation', 'pre_deployment', 'quality_gates'],
    costLevel: 'medium',
    timeComplexity: 'medium',
    reliability: 0.85,
    outputs: ['validation_results', 'security_assessment', 'quality_metrics']
  },

  architect: {
    id: 'architect',
    name: 'System Architect',
    description: 'Full codebase analysis with Gemini 2.5 Pro and specialized verification',
    category: 'analysis',
    capabilities: ['system_design', 'architecture_analysis', 'codebase_analysis', 'design_patterns'],
    strengths: ['holistic_view', 'system_thinking', 'design_expertise'],
    weaknesses: ['high_level_focus', 'may_miss_details'],
    bestFor: ['system_design', 'architecture_review', 'high_level_planning'],
    costLevel: 'high',
    timeComplexity: 'slow',
    reliability: 0.9,
    outputs: ['architecture_design', 'system_analysis', 'design_recommendations']
  },

  // Helper tools from modes directory
  code_reviewer: {
    id: 'code_reviewer',
    name: 'Code Reviewer',
    description: 'Comprehensive code review with Socratic questioning',
    category: 'analysis',
    capabilities: ['code_review', 'socratic_questioning', 'issue_detection', 'improvement_suggestions'],
    strengths: ['thorough_analysis', 'educational_approach', 'improvement_focused'],
    weaknesses: ['code_specific', 'may_be_overwhelming'],
    bestFor: ['code_quality', 'learning', 'improvement_suggestions'],
    costLevel: 'medium',
    timeComplexity: 'medium',
    reliability: 0.85,
    outputs: ['review_results', 'issues', 'suggestions', 'questions']
  },

  test_architect: {
    id: 'test_architect',
    name: 'Test Architect',
    description: 'Comprehensive test suite design with edge cases and mocking',
    category: 'testing',
    capabilities: ['test_design', 'edge_case_generation', 'mock_generation', 'test_architecture'],
    strengths: ['comprehensive_testing', 'edge_case_coverage', 'testing_strategy'],
    weaknesses: ['testing_focused', 'implementation_required'],
    bestFor: ['test_planning', 'quality_assurance', 'edge_case_identification'],
    costLevel: 'medium',
    timeComplexity: 'medium',
    reliability: 0.8,
    outputs: ['test_suite', 'test_cases', 'mocks', 'test_strategy']
  },

  documentation_writer: {
    id: 'documentation_writer',
    name: 'Documentation Writer',
    description: 'Auto-generates README, API docs, inline comments, narrative docs',
    category: 'generation',
    capabilities: ['documentation_generation', 'readme_creation', 'api_docs', 'narrative_docs'],
    strengths: ['comprehensive_docs', 'multiple_formats', 'narrative_style'],
    weaknesses: ['generic_output', 'requires_refinement'],
    bestFor: ['documentation', 'readme_generation', 'api_documentation'],
    costLevel: 'medium',
    timeComplexity: 'medium',
    reliability: 0.75,
    outputs: ['readme', 'api_docs', 'comments', 'documentation']
  }
};

// Task categorization for intelligent tool selection
export interface TaskAnalysis {
  category: 'research' | 'analysis' | 'reasoning' | 'validation' | 'generation' | 'testing' | 'coordination';
  complexity: 'simple' | 'medium' | 'complex';
  domain: 'general' | 'technical' | 'creative' | 'analytical';
  timeConstraint: 'urgent' | 'normal' | 'flexible';
  qualityRequirement: 'basic' | 'high' | 'critical';
  costBudget: 'low' | 'medium' | 'high';
  keywords: string[];
}

export class ToolOrchestrator extends EventEmitter {
  private availableTools: Map<string, ToolCapability> = new Map();
  private usageStats: Map<string, { uses: number; successes: number; failures: number }> = new Map();
  private performanceHistory: Map<string, number[]> = new Map(); // Response times
  private failureStreaks: Map<string, number> = new Map();
  private demotedModels: Set<string> = new Set();

  constructor() {
    super();
    this.initializeTools();
  }

  private initializeTools(): void {
    Object.values(FOCUS_MCP_TOOLS).forEach(tool => {
      this.availableTools.set(tool.id, tool);
      this.usageStats.set(tool.id, { uses: 0, successes: 0, failures: 0 });
      this.performanceHistory.set(tool.id, []);
      this.failureStreaks.set(tool.id, 0);
    });
  }

  // Analyze task to determine requirements
  analyzeTask(query: string, context?: string): TaskAnalysis {
    const fullText = `${query} ${context || ''}`.toLowerCase();
    
    // Keyword analysis
    const keywords = this.extractKeywords(fullText);
    
    // Category detection
    const category = this.detectCategory(fullText, keywords);
    
    // Complexity assessment
    const complexity = this.assessComplexity(fullText, keywords);
    
    // Domain detection
    const domain = this.detectDomain(fullText, keywords);
    
    // Requirements extraction
    const timeConstraint = this.detectTimeConstraint(fullText);
    const qualityRequirement = this.detectQualityRequirement(fullText);
    const costBudget = this.detectCostBudget(fullText);

    return {
      category,
      complexity,
      domain,
      timeConstraint,
      qualityRequirement,
      costBudget,
      keywords
    };
  }

  // Main orchestration method: choose best tools for task
  orchestrateTools(analysis: TaskAnalysis, maxTools: number = 3): string[] {
    const candidateTools = Array.from(this.availableTools.values());
    
    // Score each tool for this task
    const scoredTools = candidateTools.map(tool => ({
      ...tool,
      score: this.calculateToolScore(tool, analysis)
    }));

    // Sort by score and select top tools
    const selectedTools = scoredTools
      .sort((a, b) => b.score - a.score)
      .slice(0, maxTools)
      .filter(tool => tool.score > 0.3) // Minimum threshold
      .map(tool => tool.id);

    this.emit('tools-selected', { analysis, selectedTools, scores: scoredTools });
    
    return selectedTools;
  }

  // Calculate tool fitness score for specific task
  private calculateToolScore(tool: ToolCapability, analysis: TaskAnalysis): number {
    let score = 0;

    // Category match (most important)
    if (tool.category === analysis.category) score += 0.4;
    else if (this.isRelatedCategory(tool.category, analysis.category)) score += 0.2;

    // Capability match
    const capabilityMatch = this.calculateCapabilityMatch(tool, analysis);
    score += capabilityMatch * 0.3;

    // Cost/time constraints
    const constraintMatch = this.calculateConstraintMatch(tool, analysis);
    score += constraintMatch * 0.2;

    // Historical performance
    const performanceScore = this.calculatePerformanceScore(tool.id);
    score += performanceScore * 0.1;

    return Math.min(score, 1.0);
  }

  private calculateCapabilityMatch(tool: ToolCapability, analysis: TaskAnalysis): number {
    const relevantCapabilities = analysis.keywords.filter(keyword =>
      tool.capabilities.some(cap => cap.includes(keyword)) ||
      tool.bestFor.some(use => use.includes(keyword)) ||
      tool.strengths.some(strength => strength.includes(keyword))
    );
    
    return relevantCapabilities.length / Math.max(analysis.keywords.length, 1);
  }

  private calculateConstraintMatch(tool: ToolCapability, analysis: TaskAnalysis): number {
    let match = 1.0;

    // Time constraint penalty
    if (analysis.timeConstraint === 'urgent' && tool.timeComplexity === 'slow') match -= 0.5;
    if (analysis.timeConstraint === 'flexible' && tool.timeComplexity === 'fast') match += 0.1;

    // Cost constraint penalty
    if (analysis.costBudget === 'low' && tool.costLevel === 'high') match -= 0.6;
    if (analysis.costBudget === 'medium' && tool.costLevel === 'high') match -= 0.3;

    // Quality requirement bonus
    if (analysis.qualityRequirement === 'critical' && tool.reliability > 0.9) match += 0.2;

    return Math.max(match, 0);
  }

  private calculatePerformanceScore(toolId: string): number {
    const stats = this.usageStats.get(toolId);
    if (!stats || stats.uses === 0) return 0.5; // Neutral for unused tools
    
    return stats.successes / stats.uses; // Success rate
  }

  // Smart workflow composition: suggest tool sequences using user preferences
  composeWorkflow(analysis: TaskAnalysis): { toolId: string; reason: string }[] {
    const workflow: { toolId: string; reason: string }[] = [];
    const allowExpensive = analysis.costBudget === 'high' || modelPreferences.isModelAvailable('grok_heavy');

    // Research phase - intelligent selection
    if (analysis.category === 'research' || analysis.complexity === 'complex') {
      const researchModel = modelPreferences.getBestModelForTask('research', allowExpensive);
      if (researchModel) {
        workflow.push({
          toolId: researchModel,
          reason: `User-preferred research model: ${researchModel}`
        });
      } else {
        const researchTool = this.selectResearchTool(analysis);
        workflow.push(researchTool);
      }
    }

    // Analysis phase - use user preferences
    if (analysis.category === 'analysis' || analysis.domain === 'technical') {
      const analysisModel = modelPreferences.getBestModelForTask('analysis', allowExpensive);
      if (analysisModel) {
        workflow.push({
          toolId: analysisModel,
          reason: `User-preferred analysis model: ${analysisModel}`
        });
      } else {
        workflow.push({
          toolId: 'gpt5_mini',
          reason: 'Default analysis model'
        });
      }
      
      if (analysis.keywords.includes('code') || analysis.keywords.includes('system')) {
        const codeModel = modelPreferences.getBestModelForTask('code', allowExpensive);
        if (codeModel) {
          workflow.push({
            toolId: codeModel,
            reason: `User-preferred code analysis: ${codeModel}`
          });
        } else {
          workflow.push({
            toolId: 'architect',
            reason: 'System-level analysis and design'
          });
        }
      }
    }

    // Reasoning phase - prioritize user preferences
    const reasoningModel = modelPreferences.getBestModelForTask('reasoning', allowExpensive);
    
    if (analysis.complexity === 'complex' || analysis.qualityRequirement === 'critical') {
      // Use user's preferred reasoning model
      if (reasoningModel) {
        workflow.push({
          toolId: reasoningModel,
          reason: `PRIMARY: User-preferred reasoning model (${reasoningModel})`
        });
        
        // Add fallback chain
        const fallbacks = modelPreferences.getFallbackChain(reasoningModel);
        if (fallbacks.length > 0 && analysis.qualityRequirement === 'critical') {
          workflow.push({
            toolId: fallbacks[0],
            reason: `Backup reasoning model: ${fallbacks[0]}`
          });
        }
      } else {
        // Fallback to default stable model
        const defaultFlagship = modelPreferences.isModelAvailable('gpt5') ? 'gpt5' : 'gpt-5-mini';
        workflow.push({
          toolId: defaultFlagship,
          reason: defaultFlagship === 'gpt5'
            ? 'Default flagship reasoning model'
            : 'Default GPT-5 Mini reasoning model'
        });
      }
      
      // Add collaborative reasoning for critical tasks if user has tokens
      if (analysis.qualityRequirement === 'critical' && allowExpensive) {
        // Check for specific high-end models
        if (modelPreferences.isModelAvailable('grok_heavy')) {
          workflow.push({
            toolId: 'grok_heavy',
            reason: 'Grok Heavy - 256k context deep reasoning (user has tokens)'
          });
        }
        if (modelPreferences.isModelAvailable('gpt5_reason')) {
          workflow.push({
            toolId: 'gpt5_reason',
            reason: 'GPT-5 - Advanced mathematical/scientific reasoning'
          });
        }
      }
    } else if (analysis.complexity === 'medium') {
      // Use preferred model or default
      if (reasoningModel) {
        workflow.push({
          toolId: reasoningModel,
          reason: `User-preferred reasoning: ${reasoningModel}`
        });
      } else {
        const defaultFlagship = modelPreferences.isModelAvailable('gpt5_mini')
          ? 'gpt5_mini'
          : modelPreferences.isModelAvailable('gpt5')
            ? 'gpt5'
            : 'gpt-5-mini';
        workflow.push({
          toolId: defaultFlagship,
          reason: 'Default GPT-5 reasoning for medium complexity'
        });
      }
      
      // Add sequential thinking if needed
      if (analysis.keywords.includes('step') || analysis.keywords.includes('sequential')) {
        workflow.push({
          toolId: 'nextThought',
          reason: 'Structured sequential thinking supplement'
        });
      }
    } else {
      // Simple tasks - use lightweight model unless user prefers otherwise
      if (reasoningModel && modelPreferences.getModelConfig(reasoningModel)?.priority! <= 5) {
        workflow.push({
          toolId: reasoningModel,
          reason: `User-preferred quick reasoning: ${reasoningModel}`
        });
      } else {
        workflow.push({
          toolId: 'think',
          reason: 'Simple reasoning cache and reflection'
        });
      }
    }

    // Alternative perspective - check for diverse models
    if (analysis.qualityRequirement === 'critical' || analysis.keywords.includes('perspective')) {
      // Add different provider models for perspective
      if (modelPreferences.isModelAvailable('gemini_25_pro')) {
        workflow.push({
          toolId: 'gemini_25_pro',
          reason: 'Gemini perspective for diversity'
        });
      }
      if (modelPreferences.isModelAvailable('qwq_reason')) {
        workflow.push({
          toolId: 'qwq_reason',
          reason: 'QwQ reasoning for alternative approach'
        });
      }
    }

    // Validation phase
    if (analysis.qualityRequirement === 'critical') {
      workflow.push({
        toolId: 'challenger',
        reason: 'Challenge assumptions and find weaknesses'
      });
      workflow.push({
        toolId: 'verifier',
        reason: 'Multi-model consensus validation'
      });
    } else if (analysis.qualityRequirement === 'high') {
      workflow.push({
        toolId: 'challenger',
        reason: 'Critical evaluation'
      });
    }

    // Filter out disabled models
    return workflow.filter(step => {
      // Skip if model is explicitly disabled
      const config = modelPreferences.getModelConfig(step.toolId);
      if (config && !config.enabled) return false;
      
      // Skip GPT-5 variants unless explicitly enabled
      if (step.toolId.includes('gpt5') && !modelPreferences.isModelAvailable(step.toolId)) {
        return false;
      }
      
      return true;
    });
  }

  // Update tool performance based on execution results
  updateToolPerformance(toolId: string, success: boolean, responseTime: number): void {
    const stats = this.usageStats.get(toolId);
    if (stats) {
      stats.uses++;
      if (success) stats.successes++;
      else stats.failures++;
    }

    if (success) {
      this.failureStreaks.set(toolId, 0);
      if (this.demotedModels.has(toolId)) {
        const restoredPriority = toolId === 'gpt5' ? 0 : toolId === 'gpt5_mini' ? 1 : undefined;
        modelPreferences.setModelPreference(toolId, {
          enabled: true,
          ...(restoredPriority !== undefined ? { priority: restoredPriority } : {})
        });
        this.demotedModels.delete(toolId);
      }
    } else {
      const streak = (this.failureStreaks.get(toolId) || 0) + 1;
      this.failureStreaks.set(toolId, streak);
      this.handleModelDemotion(toolId, streak);
    }

    const history = this.performanceHistory.get(toolId);
    if (history) {
      history.push(responseTime);
      if (history.length > 100) history.shift(); // Keep only recent 100 records
    }

    this.emit('tool-performance-updated', { toolId, success, responseTime });
  }

  private handleModelDemotion(toolId: string, streak: number): void {
    const isGPT5Family = toolId === 'gpt5' || toolId === 'gpt5_mini';
    if (!isGPT5Family) {
      return;
    }

    const demotionThreshold = toolId === 'gpt5' ? 2 : 3;
    if (streak < demotionThreshold || this.demotedModels.has(toolId)) {
      return;
    }

    modelPreferences.setModelPreference(toolId, { enabled: false, priority: 99 });
    this.demotedModels.add(toolId);
    this.emit('model-demoted', {
      model: toolId,
      reason: `Automatic demotion after ${streak} consecutive failures`
    });
  }

  // Get tool recommendations with explanations
  recommendTools(query: string, context?: string): {
    primary: { toolId: string; reason: string }[];
    workflow: { toolId: string; reason: string }[];
    analysis: TaskAnalysis;
  } {
    const analysis = this.analyzeTask(query, context);
    const primaryTools = this.orchestrateTools(analysis, 2);
    const workflow = this.composeWorkflow(analysis);

    return {
      primary: primaryTools.map(toolId => ({
        toolId,
        reason: this.explainToolChoice(toolId, analysis)
      })),
      workflow,
      analysis
    };
  }

  private explainToolChoice(toolId: string, analysis: TaskAnalysis): string {
    const tool = this.availableTools.get(toolId);
    if (!tool) return 'Unknown tool';

    const reasons: string[] = [];
    
    if (tool.category === analysis.category) {
      reasons.push(`Perfect category match (${analysis.category})`);
    }
    
    if (analysis.complexity === 'complex' && tool.reliability > 0.9) {
      reasons.push('High reliability for complex task');
    }
    
    if (analysis.timeConstraint === 'urgent' && tool.timeComplexity === 'fast') {
      reasons.push('Fast execution for urgent task');
    }
    
    if (tool.bestFor.some(use => analysis.keywords.some(keyword => use.includes(keyword)))) {
      reasons.push('Specialized for your specific needs');
    }

    return reasons.join('; ') || 'Good general fit';
  }

  // Intelligent research tool selection
  private selectResearchTool(analysis: TaskAnalysis): { toolId: string; reason: string } {
    const text = analysis.keywords.join(' ').toLowerCase();
    
    // Quick fact-checking or simple questions
    if (analysis.complexity === 'simple' && 
        (text.includes('what') || text.includes('when') || text.includes('who'))) {
      return {
        toolId: 'perplexity_ask',
        reason: 'Quick fact-checking for simple question'
      };
    }
    
    // Initial exploration and context gathering
    if (analysis.keywords.includes('understand') || 
        analysis.keywords.includes('explore') ||
        analysis.timeConstraint === 'urgent') {
      return {
        toolId: 'scout',
        reason: 'Fast initial exploration and context gathering'
      };
    }
    
    // Comprehensive research projects
    if (analysis.complexity === 'complex' && 
        (analysis.qualityRequirement === 'critical' || 
         text.includes('comprehensive') || 
         text.includes('thorough'))) {
      
      // Multi-AI research for most critical projects
      if (analysis.costBudget === 'high' && analysis.qualityRequirement === 'critical') {
        return {
          toolId: 'focus_deep_research',
          reason: 'Multi-AI comprehensive research for critical project'
        };
      }
      
      // Deep Perplexity research for thorough investigation
      return {
        toolId: 'perplexity_research',
        reason: 'Comprehensive research with evidence gathering'
      };
    }
    
    // Data-driven reasoning tasks
    if (analysis.category === 'reasoning' && 
        (text.includes('analyze') || text.includes('decide') || text.includes('compare'))) {
      return {
        toolId: 'perplexity_reason',
        reason: 'Evidence-based reasoning with current data'
      };
    }
    
    // Default: scout for general exploration
    return {
      toolId: 'scout',
      reason: 'General context exploration and information gathering'
    };
  }

  // Helper methods for task analysis
  private extractKeywords(text: string): string[] {
    const commonKeywords = [
      'code', 'system', 'design', 'architecture', 'test', 'debug', 'analyze',
      'research', 'validate', 'review', 'optimize', 'security', 'performance',
      'documentation', 'api', 'database', 'algorithm', 'reasoning', 'problem'
    ];
    
    return commonKeywords.filter(keyword => text.includes(keyword));
  }

  private detectCategory(text: string, keywords: string[]): TaskAnalysis['category'] {
    if (keywords.some(k => ['research', 'investigate', 'find'].includes(k))) return 'research';
    if (keywords.some(k => ['analyze', 'review', 'examine'].includes(k))) return 'analysis';
    if (keywords.some(k => ['think', 'reason', 'solve'].includes(k))) return 'reasoning';
    if (keywords.some(k => ['validate', 'verify', 'check'].includes(k))) return 'validation';
    if (keywords.some(k => ['create', 'generate', 'build'].includes(k))) return 'generation';
    if (keywords.some(k => ['test', 'debug'].includes(k))) return 'testing';
    return 'reasoning';
  }

  private assessComplexity(text: string, keywords: string[]): TaskAnalysis['complexity'] {
    if (text.length > 500 || keywords.length > 5) return 'complex';
    if (text.length > 200 || keywords.length > 3) return 'medium';
    return 'simple';
  }

  private detectDomain(text: string, keywords: string[]): TaskAnalysis['domain'] {
    if (keywords.some(k => ['code', 'system', 'api', 'architecture'].includes(k))) return 'technical';
    if (keywords.some(k => ['creative', 'design', 'innovative'].includes(k))) return 'creative';
    if (keywords.some(k => ['analyze', 'data', 'metrics'].includes(k))) return 'analytical';
    return 'general';
  }

  private detectTimeConstraint(text: string): TaskAnalysis['timeConstraint'] {
    if (text.includes('urgent') || text.includes('quickly') || text.includes('asap')) return 'urgent';
    if (text.includes('when possible') || text.includes('no rush')) return 'flexible';
    return 'normal';
  }

  private detectQualityRequirement(text: string): TaskAnalysis['qualityRequirement'] {
    if (text.includes('critical') || text.includes('production') || text.includes('important')) return 'critical';
    if (text.includes('thorough') || text.includes('comprehensive')) return 'high';
    return 'basic';
  }

  private detectCostBudget(text: string): TaskAnalysis['costBudget'] {
    if (text.includes('expensive') || text.includes('comprehensive')) return 'high';
    if (text.includes('quick') || text.includes('simple')) return 'low';
    return 'medium';
  }

  private isRelatedCategory(toolCategory: string, taskCategory: string): boolean {
    const related: Record<string, string[]> = {
      'analysis': ['reasoning', 'validation'],
      'reasoning': ['analysis', 'validation'],
      'validation': ['analysis', 'reasoning'],
      'research': ['analysis'],
      'generation': ['reasoning'],
      'testing': ['validation', 'analysis']
    };
    
    return related[toolCategory]?.includes(taskCategory) || false;
  }

  // Get orchestrator status and capabilities
  getStatus(): {
    availableTools: string[];
    categories: string[];
    totalTools: number;
    performanceStats: Record<string, { successRate: number; avgResponseTime: number }>;
  } {
    const performanceStats: Record<string, { successRate: number; avgResponseTime: number }> = {};
    
    for (const [toolId, stats] of this.usageStats.entries()) {
      const history = this.performanceHistory.get(toolId) || [];
      performanceStats[toolId] = {
        successRate: stats.uses > 0 ? stats.successes / stats.uses : 0,
        avgResponseTime: history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : 0
      };
    }

    return {
      availableTools: Array.from(this.availableTools.keys()),
      categories: [...new Set(Array.from(this.availableTools.values()).map(t => t.category))],
      totalTools: this.availableTools.size,
      performanceStats
    };
  }
}
