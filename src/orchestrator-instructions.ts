import { MCPClient, ToolInstruction } from './mcp-client.js';
import { WorkflowDefinition, WorkflowType } from './types.js';
import { workflows } from './workflows.js';
import { PromptEngineerLite } from './prompt-engineer-lite.js';

export interface OrchestrationPlan {
  workflow: WorkflowDefinition;
  instructions: ToolInstruction[];
  visualGuide: string;
}

export class InstructionOrchestrator {
  private mcpClient: MCPClient;
  private promptEngineer: PromptEngineerLite;
  private workflowTemplates: Map<WorkflowType, WorkflowDefinition>;
  
  constructor() {
    this.mcpClient = new MCPClient();
    this.promptEngineer = new PromptEngineerLite();
    this.workflowTemplates = new Map(
      Object.entries(workflows) as [WorkflowType, WorkflowDefinition][]
    );
  }

  async initialize(): Promise<void> {
    await this.mcpClient.connect();
  }

  generateOrchestrationPlan(
    mode: string, 
    query: string,
    context?: string
  ): OrchestrationPlan {
    // Select workflow
    const workflowType = this.analyzeQueryIntent(mode, query);
    const workflow = this.workflowTemplates.get(workflowType);
    
    if (!workflow) {
      throw new Error(`No workflow found for mode: ${mode}`);
    }

    // Generate instructions for each step
    const instructions: ToolInstruction[] = [];
    const toolSequence: string[] = [];
    
    workflow.steps.forEach((step, index) => {
      // Apply prompt engineering
      const enhancedPrompt = this.promptEngineer.applyTechnique(
        step.tool,
        step.promptTechnique,
        query,
        [] // In real execution, previous results would be passed
      );
      
      // Map to MCP tool name
      const mcpToolName = this.getToolMapping(step.tool);
      
      // Generate instruction
      const instruction = this.mcpClient.generateToolInstructions(
        mcpToolName,
        { prompt: enhancedPrompt, context, query, thought: enhancedPrompt }
      );
      
      instructions.push(instruction);
      toolSequence.push(step.tool);
    });

    // Create visual guide
    const visualGuide = this.createVisualGuide(workflow, toolSequence);

    return {
      workflow,
      instructions,
      visualGuide
    };
  }

  private analyzeQueryIntent(mode: string, query: string): WorkflowType {
    const modeMap: Record<string, WorkflowType> = {
      // Creative modes
      'creative': WorkflowType.CREATIVE_DISCOVERY,
      'brainstorm': WorkflowType.CREATIVE_DISCOVERY,
      'ideate': WorkflowType.CREATIVE_DISCOVERY,
      
      // Research modes
      'research': WorkflowType.DEEP_RESEARCH,
      'investigate': WorkflowType.DEEP_RESEARCH,
      
      // Problem solving modes
      'solve': WorkflowType.PROBLEM_SOLVING,
      'analyze': WorkflowType.PROBLEM_SOLVING,
      'reason': WorkflowType.PROBLEM_SOLVING,
      
      // Synthesis modes
      'synthesis': WorkflowType.SYNTHESIS,
      'integrate': WorkflowType.SYNTHESIS,
      
      // Fact check modes
      'fact-check': WorkflowType.FACT_CHECK,
      'verify': WorkflowType.FACT_CHECK,
      'validate': WorkflowType.FACT_CHECK,
    };

    return modeMap[mode] || WorkflowType.CREATIVE_DISCOVERY;
  }

  private getToolMapping(toolName: string): string {
    const toolMap: Record<string, string> = {
      'gemini_brainstorm': 'mcp__gemini__gemini-brainstorm',
      'perplexity_research': 'mcp__perplexity-ask__perplexity_research',
      'openai_reason': 'mcp__openai-mcp__openai_gpt5_reason',
      'openai_brainstorm': 'mcp__openai-mcp__openai_brainstorm',
      'think': 'mcp__think-mcp-server__think',
    };
    
    return toolMap[toolName] || toolName;
  }

  private createVisualGuide(workflow: WorkflowDefinition, tools: string[]): string {
    const guide = [
      `## ${workflow.name} Orchestration Plan`,
      '',
      '### Execution Sequence:',
      ...tools.map((tool, i) => `${i + 1}. **${tool}** - ${this.getStepDescription(workflow.steps[i])}`),
      '',
      '### Visual Flow:',
      '```',
      tools.map(t => t.substring(0, 8)).join(' → '),
      '```',
      '',
      '### Instructions for Claude:',
      '1. Execute each tool in sequence',
      '2. Pass results from each step to inform the next',
      '3. After all tools complete, synthesize the insights',
      '',
      '💡 **Tip**: You can call focus again with `mode="reflect"` to synthesize all results'
    ];

    return guide.join('\n');
  }

  private getStepDescription(step: any): string {
    const descriptions: Record<string, string> = {
      'what_if_speculation': 'Explore wild possibilities',
      'alternative_perspectives': 'Multiple viewpoints',
      'comprehensive_investigation': 'Deep research',
      'evidence_gathering': 'Find supporting data',
      'systematic_analysis': 'Structured analysis',
      'first_principles': 'Fundamental reasoning',
      'quick_reflection': 'Pattern recognition',
      'innovative_solutions': 'Creative solutions'
    };
    
    return descriptions[step.promptTechnique] || step.promptTechnique;
  }

  // Generate a formatted instruction set for display
  formatInstructions(plan: OrchestrationPlan): string {
    const formatted = [
      plan.visualGuide,
      '',
      '### Ready to Execute:',
      ''
    ];

    plan.instructions.forEach((inst, i) => {
      formatted.push(`#### Step ${i + 1}: ${inst.description}`);
      formatted.push('```');
      formatted.push(`Tool: ${inst.tool}`);
      formatted.push(`Parameters: ${JSON.stringify(inst.parameters, null, 2)}`);
      formatted.push('```');
      formatted.push('');
    });

    return formatted.join('\n');
  }
}