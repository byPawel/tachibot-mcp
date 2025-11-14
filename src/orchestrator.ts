import { MCPClient } from './mcp-client.js';
import { WorkflowDefinition, WorkflowType, ToolResult, ToolStatus } from './types.js';
import { workflows } from './workflows.js';
import { PromptEngineer } from './prompt-engineer.js';
import { WorkflowVisualizer } from './visualizer.js';

export class FocusOrchestrator {
  private mcpClient: MCPClient;
  private promptEngineer: PromptEngineer;
  private visualizer: WorkflowVisualizer;
  private workflowTemplates: Map<WorkflowType, WorkflowDefinition>;
  
  constructor() {
    this.mcpClient = new MCPClient();
    this.promptEngineer = new PromptEngineer();
    this.visualizer = new WorkflowVisualizer();
    this.workflowTemplates = new Map(
      Object.entries(workflows) as [WorkflowType, WorkflowDefinition][]
    );
  }

  async initialize(): Promise<void> {
    await this.mcpClient.connect();
  }

  selectWorkflow(mode: string, query: string): WorkflowDefinition {
    // Intelligent workflow selection based on mode and query analysis
    const workflowType = this.analyzeQueryIntent(mode, query);
    const workflow = this.workflowTemplates.get(workflowType);
    
    if (!workflow) {
      throw new Error(`No workflow found for type: ${workflowType}`);
    }
    
    return workflow;
  }

  private analyzeQueryIntent(mode: string, query: string): WorkflowType {
    // Simple mapping for now, can be enhanced with NLP
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
    
    // Show initial workflow visualization
    await this.visualizer.renderWorkflow(workflow, new Map());
    
    // Execute each step in the workflow
    for (const [index, step] of workflow.steps.entries()) {
      // Update visual progress
      await this.visualizer.updateProgress(step.tool, ToolStatus.PROCESSING);
      
      try {
        // Apply prompt engineering for this tool
        const enhancedPrompt = this.promptEngineer.applyTechnique(
          step.tool,
          step.promptTechnique,
          query,
          results // Pass previous results for context
        );
        
        // Execute the tool
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
        
        // Update visual progress
        await this.visualizer.updateProgress(step.tool, ToolStatus.COMPLETE);
        
        // Check if we should adapt the workflow based on results
        if (step.adaptationCheck) {
          const shouldAdapt = await this.evaluateAdaptation(result, step);
          if (shouldAdapt) {
            await this.adaptWorkflow(workflow, results, index);
          }
        }
        
      } catch (error) {
        await this.visualizer.updateProgress(step.tool, ToolStatus.ERROR);
        
        // Handle errors gracefully
        if (step.optional) {
          console.error(`Optional tool ${step.tool} failed:`, error);
          continue;
        } else {
          throw error;
        }
      }
    }
    
    // Synthesize all results
    const synthesis = await this.synthesizeResults(results, workflow);
    
    // Show completion
    await this.visualizer.showCompletion(workflow, results);
    
    return synthesis;
  }

  private async executeTool(
    toolName: string,
    prompt: string,
    context?: string
  ): Promise<string> {
    // Map internal tool names to MCP tool names
    const toolMap: Record<string, string> = {
      'gemini_brainstorm': 'mcp__gemini__gemini-brainstorm',
      'perplexity_research': 'mcp__perplexity-ask__perplexity_research',
      'openai_reason': 'mcp__openai-mcp__openai_gpt5_reason',
      'openai_brainstorm': 'mcp__openai-mcp__openai_brainstorm',
      'think': 'mcp__think-mcp-server__think',
    };
    
    const mcpToolName = toolMap[toolName] || toolName;
    
    // Execute via MCP client
    return await this.mcpClient.executeTool(mcpToolName, {
      prompt,
      context,
      query: prompt, // Some tools use 'query' instead of 'prompt'
      thought: prompt, // think-mcp uses 'thought'
    });
  }

  private async evaluateAdaptation(
    result: string,
    step: any
  ): Promise<boolean> {
    // Simple heuristics for workflow adaptation
    // Can be enhanced with more sophisticated logic
    
    if (result.includes('insufficient data') || result.includes('need more information')) {
      return true;
    }
    
    if (step.adaptationThreshold && result.length < step.adaptationThreshold) {
      return true;
    }
    
    return false;
  }

  private async adaptWorkflow(
    workflow: WorkflowDefinition,
    results: ToolResult[],
    currentIndex: number
  ): Promise<void> {
    // Add additional research step if needed
    if (results.some(r => r.output.includes('insufficient data'))) {
      workflow.steps.splice(currentIndex + 1, 0, {
        tool: 'perplexity_research',
        promptTechnique: 'deep_investigation',
        optional: true
      });
    }
  }

  private async synthesizeResults(
    results: ToolResult[],
    workflow: WorkflowDefinition
  ): Promise<string> {
    // Create a comprehensive synthesis of all tool outputs
    const synthesis = [`## ${workflow.name} Results\n`];
    
    // Add workflow metadata
    synthesis.push(`**Workflow Duration**: ${results[results.length - 1].duration}ms`);
    synthesis.push(`**Tools Used**: ${results.map(r => r.tool).join(' → ')}\n`);
    
    // Key insights section
    synthesis.push('### Key Insights\n');
    
    // Extract key points from each tool result
    for (const result of results) {
      const keyPoints = this.extractKeyPoints(result.output, result.tool);
      if (keyPoints.length > 0) {
        synthesis.push(`**From ${result.tool}:**`);
        keyPoints.forEach(point => synthesis.push(`- ${point}`));
        synthesis.push('');
      }
    }
    
    // Synthesis section
    synthesis.push('### Synthesis\n');
    
    // Use think-mcp for final synthesis if available
    if (this.mcpClient.hasTools(['mcp__think-mcp-server__think'])) {
      const synthesisPrompt = `Synthesize these insights into a coherent conclusion:\n${
        results.map(r => `${r.tool}: ${this.summarize(r.output)}`).join('\n')
      }`;
      
      const finalThought = await this.executeTool('think', synthesisPrompt);
      synthesis.push(finalThought);
    } else {
      // Fallback synthesis
      synthesis.push(this.createFallbackSynthesis(results));
    }
    
    return synthesis.join('\n');
  }

  private extractKeyPoints(output: string, tool: string): string[] {
    // Extract key points based on tool type
    const points: string[] = [];
    
    // Look for bullet points
    const bulletPoints = output.match(/^[-*•]\s+(.+)$/gm);
    if (bulletPoints) {
      points.push(...bulletPoints.map(p => p.replace(/^[-*•]\s+/, '')));
    }
    
    // Look for numbered lists
    const numberedPoints = output.match(/^\d+\.\s+(.+)$/gm);
    if (numberedPoints) {
      points.push(...numberedPoints.map(p => p.replace(/^\d+\.\s+/, '')));
    }
    
    // Tool-specific extraction
    if (tool === 'gemini_brainstorm' && points.length === 0) {
      // Extract creative ideas
      const ideas = output.match(/(?:idea|concept|possibility):\s*([^.!?]+[.!?])/gi);
      if (ideas) {
        points.push(...ideas.map(i => i.replace(/^(?:idea|concept|possibility):\s*/i, '')));
      }
    }
    
    return points.slice(0, 3); // Limit to top 3 points per tool
  }

  private summarize(text: string, maxLength: number = 200): string {
    // Simple summarization - take first paragraph or N characters
    const firstParagraph = text.split('\n\n')[0];
    if (firstParagraph.length <= maxLength) {
      return firstParagraph;
    }
    return firstParagraph.substring(0, maxLength) + '...';
  }

  private createFallbackSynthesis(results: ToolResult[]): string {
    const insights = results.map(r => this.summarize(r.output, 100));
    return `Based on the analysis from ${results.length} different perspectives:\n\n${
      insights.join('\n\n')
    }\n\nThese insights suggest a multi-faceted understanding of the query.`;
  }
}