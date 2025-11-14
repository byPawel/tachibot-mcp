import { WorkflowDefinition, ToolStatus, ToolResult } from './types.js';
import { getStatusIndicator } from './workflows.js';
import { PromptEngineer } from './prompt-engineer.js';

export class WorkflowVisualizer {
  private currentDisplay: string = '';
  private promptEngineer: PromptEngineer;
  private animationFrames: Map<string, string[]> = new Map();
  
  constructor() {
    this.promptEngineer = new PromptEngineer();
    this.initializeAnimations();
  }

  private initializeAnimations() {
    // Processing animations for each tool
    this.animationFrames.set('processing', [
      '.', '..', '...', '..', '.'
    ]);
    
    this.animationFrames.set('thinking', [
      '~', '≈', '~', '∞', '~'
    ]);
  }

  async renderWorkflow(
    workflow: WorkflowDefinition, 
    toolStates: Map<string, ToolStatus>
  ): Promise<string> {
    // Initialize states if empty
    if (toolStates.size === 0) {
      workflow.steps.forEach(step => {
        toolStates.set(step.tool, ToolStatus.IDLE);
      });
    }

    // Build the display from the template
    let display = workflow.visualTemplate;
    
    // Replace placeholders with actual states
    workflow.steps.forEach(step => {
      const status = toolStates.get(step.tool) || ToolStatus.IDLE;
      const indicator = getStatusIndicator(status);
      
      // Replace status indicators in template
      switch (step.tool) {
        case 'gemini_brainstorm':
          display = display.replace('{g}', indicator);
          break;
        case 'openai_brainstorm':
        case 'openai_reason':
          display = display.replace('{o}', indicator);
          break;
        case 'think':
          display = display.replace('{t}', indicator);
          break;
        case 'perplexity_research':
          display = display.replace('{p}', indicator);
          break;
        case 'reason':
          display = display.replace('{r}', indicator);
          break;
      }
    });
    
    // Calculate overall progress
    const completed = Array.from(toolStates.values()).filter(s => s === ToolStatus.COMPLETE).length;
    const total = workflow.steps.length;
    const progress = Math.round((completed / total) * 100);
    
    // Create progress bar
    const progressBar = this.createProgressBar(progress);
    display = display.replace('{progress}', progressBar);
    
    // Add current technique and activity
    const currentTool = this.getCurrentTool(workflow, toolStates);
    if (currentTool) {
      const technique = this.promptEngineer.getTechniqueDescription(currentTool.promptTechnique);
      display = display.replace('{technique}', technique);
      display = display.replace('{current}', `Processing with ${currentTool.tool}...`);
    } else {
      display = display.replace('{technique}', 'Initializing workflow...');
      display = display.replace('{current}', 'Starting orchestration...');
    }
    
    this.currentDisplay = display;
    console.error('\n' + display + '\n');
    return display;
  }

  async updateProgress(toolName: string, status: ToolStatus): Promise<void> {
    // This would normally update just the relevant part of the display
    // For now, we'll log the update
    const statusEmoji = {
      [ToolStatus.IDLE]: '⏸️',
      [ToolStatus.PROCESSING]: '⚙️',
      [ToolStatus.COMPLETE]: '✅',
      [ToolStatus.ERROR]: '❌'
    };
    
    console.error(`\n${statusEmoji[status]} ${toolName}: ${status}\n`);
    
    // If processing, show animation
    if (status === ToolStatus.PROCESSING) {
      await this.animateProcessing(toolName);
    }
  }

  private async animateProcessing(toolName: string): Promise<void> {
    // Show a simple animation for processing
    const frames = this.animationFrames.get('processing') || ['.'];
    console.error(`🔄 ${toolName} is thinking${frames[0]}`);
  }

  async showCompletion(workflow: WorkflowDefinition, results: ToolResult[]): Promise<void> {
    const duration = results[results.length - 1]?.duration || 0;
    const toolsUsed = results.map(r => r.tool).join(' → ');
    
    const completion = `
╔═══════════════════════════════════════════════════╗
║          🎉 Workflow Complete! 🎉                 ║
╠═══════════════════════════════════════════════════╣
║ Workflow: ${workflow.name.padEnd(39)}║
║ Duration: ${(duration / 1000).toFixed(2)}s${' '.repeat(40 - (duration / 1000).toFixed(2).length - 1)}║
║ Tools: ${toolsUsed.substring(0, 42).padEnd(42)}║
╚═══════════════════════════════════════════════════╝

     @@@@@@@@@
     @  ● ●  @
     @   ◡   @  Mission accomplished!
     @@@@@@@@@
`;
    
    console.error(completion);
  }

  private createProgressBar(percentage: number): string {
    const width = 20;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    return `[${'='.repeat(filled)}${' '.repeat(empty)}] ${percentage}%`;
  }

  private getCurrentTool(
    workflow: WorkflowDefinition, 
    toolStates: Map<string, ToolStatus>
  ) {
    // Find the currently processing tool
    for (const step of workflow.steps) {
      const status = toolStates.get(step.tool);
      if (status === ToolStatus.PROCESSING) {
        return step;
      }
    }
    
    // If none processing, find the first incomplete
    for (const step of workflow.steps) {
      const status = toolStates.get(step.tool);
      if (status !== ToolStatus.COMPLETE && status !== ToolStatus.ERROR) {
        return step;
      }
    }
    
    return null;
  }

  // Special animations for different phases
  async showCreativeExplosion(): Promise<void> {
    const explosion = `
         ✨ ★ ✨
       ★  💡  ★
     ✨  🎨  ✨
       ★    ★
         ✨
    Creative breakthrough!
`;
    console.error(explosion);
  }

  async showResearchDiscovery(): Promise<void> {
    const discovery = `
    📚 → 🔍 → 💎
    
    Found valuable insights!
`;
    console.error(discovery);
  }

  async showProblemSolved(): Promise<void> {
    const solved = `
    🧩 + 🧩 + 🧩 = ✅
    
    Problem decomposed and solved!
`;
    console.error(solved);
  }

  async showSynthesisComplete(): Promise<void> {
    const synthesis = `
    🎯 All perspectives integrated!
    
    ╱│╲
    ─●─  Unified insight achieved
    ╲│╱
`;
    console.error(synthesis);
  }

  // Get current display for external use
  getCurrentDisplay(): string {
    return this.currentDisplay;
  }
}