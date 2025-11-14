export enum WorkflowType {
  CREATIVE_DISCOVERY = 'creative_discovery',
  DEEP_RESEARCH = 'deep_research',
  PROBLEM_SOLVING = 'problem_solving',
  SYNTHESIS = 'synthesis',
  FACT_CHECK = 'fact_check',
  // New Developer-Focused Workflows
  RAPID_PROTOTYPE = 'rapid_prototype',
  CODE_QUALITY = 'code_quality',
  SECURE_DEPLOYMENT = 'secure_deployment',
  FULL_STACK_DEVELOPMENT = 'full_stack_development',
  TEST_DRIVEN_DEVELOPMENT = 'test_driven_development',
  CODE_REVIEW_WORKFLOW = 'code_review_workflow',
  DOCUMENTATION_GENERATION = 'documentation_generation'
}

export enum ToolStatus {
  IDLE = 'idle',
  PROCESSING = 'processing',
  COMPLETE = 'complete',
  ERROR = 'error'
}

export interface WorkflowStep {
  tool: string;
  promptTechnique: string;
  optional?: boolean;
  adaptationCheck?: boolean;
  adaptationThreshold?: number;
}

export interface WorkflowDefinition {
  name: string;
  type: WorkflowType;
  description: string;
  steps: WorkflowStep[];
  visualTemplate: string;
}

export interface ToolResult {
  tool: string;
  output: string;
  timestamp: number;
  duration: number;
}

export interface PromptTechnique {
  name: string;
  template: string;
  variables: string[];
}

export interface ASCIIFrame {
  frame: string;
  duration: number;
}

export interface VisualizationState {
  workflow: WorkflowDefinition;
  toolStates: Map<string, ToolStatus>;
  currentTool?: string;
  progress: number;
}

export interface MCPToolCall {
  tool: string;
  parameters: Record<string, any>;
}

export interface MCPResponse {
  content: string;
  error?: string;
}