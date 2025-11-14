import { MCPClient } from './mcp-client.js';
import { WorkflowDefinition, WorkflowType, ToolResult, ToolStatus } from './types.js';
import { workflows } from './workflows.js';
import { PromptEngineer } from './prompt-engineer.js';
import { PromptEngineerLite } from './prompt-engineer-lite.js';
import { WorkflowVisualizer } from './visualizer.js';
import { WorkflowVisualizerLite } from './visualizer-lite.js';

export interface OrchestratorOptions {
  tokenEfficient?: boolean;
}

export class FocusOrchestratorLite {
  private mcpClient: MCPClient;
  private promptEngineer: PromptEngineer | PromptEngineerLite;
  private visualizer: WorkflowVisualizer | WorkflowVisualizerLite;
  private workflowTemplates: Map<WorkflowType, WorkflowDefinition>;
  private tokenEfficient: boolean;
  
  constructor(options: OrchestratorOptions = {}) {
    this.tokenEfficient = options.tokenEfficient ?? false;
    this.mcpClient = new MCPClient();
    
    // Use lite versions if token efficient mode
    if (this.tokenEfficient) {
      this.promptEngineer = new PromptEngineerLite();
      this.visualizer = new WorkflowVisualizerLite();
    } else {
      this.promptEngineer = new PromptEngineer();
      this.visualizer = new WorkflowVisualizer();
    }
    
    this.workflowTemplates = new Map(
      Object.entries(workflows) as [WorkflowType, WorkflowDefinition][]
    );
  }

  async initialize(): Promise<void> {
    await this.mcpClient.connect();
  }

  selectWorkflow(mode: string, query: string): WorkflowDefinition {
    const workflowType = this.analyzeQueryIntent(mode, query);
    const workflow = this.workflowTemplates.get(workflowType);
    
    if (!workflow) {
      throw new Error(`No workflow found for type: ${workflowType}`);
    }
    
    return workflow;
  }

  private analyzeQueryIntent(mode: string, query: string): WorkflowType {
    const modeMap: Record<string, WorkflowType> = {
      'creative': WorkflowType.CREATIVE_DISCOVERY,
      'research': WorkflowType.DEEP_RESEARCH,
      'solve': WorkflowType.PROBLEM_SOLVING,
      'synthesis': WorkflowType.SYNTHESIS,
      'brainstorm': WorkflowType.CREATIVE_DISCOVERY,
      'reason': WorkflowType.PROBLEM_SOLVING,
    };

    return modeMap[mode] || WorkflowType.CREATIVE_DISCOVERY;
  }

  async executeWorkflow(
    workflow: WorkflowDefinition, 
    query: string,
    context?: string
  ): Promise<string> {
    const results: ToolResult[] = [];
    const startTime = Date.now();
    
    await this.visualizer.renderWorkflow(workflow, new Map());
    
    for (const [index, step] of workflow.steps.entries()) {
      await this.visualizer.updateProgress(step.tool, ToolStatus.PROCESSING);
      
      try {
        const enhancedPrompt = this.promptEngineer.applyTechnique(
          step.tool,
          step.promptTechnique,
          query,
          results
        );
        
        const result = await this.executeTool(
          step.tool,
          enhancedPrompt,
          context
        );
        
        results.push({
          tool: step.tool,
          output: result,
          timestamp: Date.now(),
          duration: Date.now() - startTime
        });
        
        await this.visualizer.updateProgress(step.tool, ToolStatus.COMPLETE);
        
        if (step.adaptationCheck && this.shouldAdapt(result)) {
          await this.adaptWorkflow(workflow, results, index);
        }
        
      } catch (error) {
        await this.visualizer.updateProgress(step.tool, ToolStatus.ERROR);
        
        if (step.optional) {
          console.error(`Optional tool ${step.tool} failed:`, error);
          continue;
        } else {
          throw error;
        }
      }
    }
    
    const synthesis = await this.synthesizeResults(results, workflow);
    await this.visualizer.showCompletion(workflow, results);
    
    return synthesis;
  }

  private async executeTool(
    toolName: string,
    prompt: string,
    context?: string
  ): Promise<string> {
    const toolMap: Record<string, string> = {
      'gemini_brainstorm': 'mcp__gemini__gemini-brainstorm',
      'perplexity_research': 'mcp__perplexity-ask__perplexity_research',
      'openai_reason': 'mcp__openai-mcp__openai_gpt5_reason',
      'openai_brainstorm': 'mcp__openai-mcp__openai_brainstorm',
      'think': 'mcp__think-mcp-server__think',
    };
    
    const mcpToolName = toolMap[toolName] || toolName;
    
    return await this.mcpClient.executeTool(mcpToolName, {
      prompt,
      context,
      query: prompt,
      thought: prompt,
    });
  }

  private shouldAdapt(result: string): boolean {
    return result.includes('insufficient data') || 
           result.includes('need more information') ||
           result.length < 100;
  }

  private async adaptWorkflow(
    workflow: WorkflowDefinition,
    results: ToolResult[],
    currentIndex: number
  ): Promise<void> {
    if (results.some(r => r.output.includes('insufficient data'))) {
      workflow.steps.splice(currentIndex + 1, 0, {
        tool: 'perplexity_research',
        promptTechnique: 'evidence_gathering',
        optional: true
      });
    }
  }

  private async synthesizeResults(
    results: ToolResult[],
    workflow: WorkflowDefinition
  ): Promise<string> {
    if (this.tokenEfficient) {
      // Compact synthesis for token efficiency
      const insights = results.map(r => 
        `${r.tool}: ${r.output.split('\n')[0].substring(0, 100)}...`
      ).join('\n');
      
      return `## ${workflow.name}\n${insights}\n\nDuration: ${
        (results[results.length - 1].duration / 1000).toFixed(1)
      }s`;
    }
    
    // Full synthesis (original code)
    const synthesis = [`## ${workflow.name} Results\n`];
    synthesis.push(`**Duration**: ${results[results.length - 1].duration}ms`);
    synthesis.push(`**Tools**: ${results.map(r => r.tool).join(' → ')}\n`);
    synthesis.push('### Key Insights\n');
    
    for (const result of results) {
      const keyPoints = this.extractKeyPoints(result.output, result.tool);
      if (keyPoints.length > 0) {
        synthesis.push(`**${result.tool}:**`);
        keyPoints.forEach(point => synthesis.push(`- ${point}`));
        synthesis.push('');
      }
    }
    
    return synthesis.join('\n');
  }

  private extractKeyPoints(output: string, tool: string): string[] {
    const points: string[] = [];
    const bulletPoints = output.match(/^[-*•]\s+(.+)$/gm);
    if (bulletPoints) {
      points.push(...bulletPoints.map(p => p.replace(/^[-*•]\s+/, '')));
    }
    return points.slice(0, 3);
  }
}