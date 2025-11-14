import { WorkflowDefinition, ToolStatus, ToolResult } from './types.js';
import { PromptEngineerLite } from './prompt-engineer-lite.js';

export class WorkflowVisualizerLite {
  private pe = new PromptEngineerLite();
  
  private faces: Record<string, string[]> = {
    idle: ['  ● ●  ', '   ◡   '],
    work: ['  ◉ ◉  ', '   ~   '],
    done: ['  ★ ★  ', ' \\___//'],
    err:  ['  x x  ', '   ⌒   ']
  };

  private getCompactDisplay(workflow: WorkflowDefinition, states: Map<string, ToolStatus>): string {
    const tools = workflow.steps.map(s => s.tool.substring(0, 3));
    const statuses = workflow.steps.map(s => {
      const st = states.get(s.tool) || ToolStatus.IDLE;
      return st === ToolStatus.COMPLETE ? '✓' : 
             st === ToolStatus.PROCESSING ? '◉' : 
             st === ToolStatus.ERROR ? '!' : '○';
    });
    
    const progress = Math.round((statuses.filter(s => s === '✓').length / tools.length) * 100);
    const current = workflow.steps.find(s => states.get(s.tool) === ToolStatus.PROCESSING);
    
    return `${workflow.name} [${statuses.join('→')}] ${progress}%${
      current ? ` | ${this.pe.getTechniqueDescription(current.promptTechnique)}` : ''
    }`;
  }

  async renderWorkflow(workflow: WorkflowDefinition, states: Map<string, ToolStatus>): Promise<string> {
    if (states.size === 0) {
      workflow.steps.forEach(s => states.set(s.tool, ToolStatus.IDLE));
    }
    
    const display = this.getCompactDisplay(workflow, states);
    console.error(`\n${display}\n`);
    return display;
  }

  async updateProgress(tool: string, status: ToolStatus): Promise<void> {
    const emoji = { idle: '⏸️', processing: '⚙️', complete: '✅', error: '❌' };
    console.error(`${emoji[status]} ${tool}: ${status}`);
  }

  async showCompletion(workflow: WorkflowDefinition, results: ToolResult[]): Promise<void> {
    const dur = ((results[results.length - 1]?.duration || 0) / 1000).toFixed(1);
    const face = this.faces.done;
    console.error(`\n✨ ${workflow.name} Complete in ${dur}s\n @@@@@@@\n @ ${face[0]} @\n @ ${face[1]} @\n @@@@@@@`);
  }
}