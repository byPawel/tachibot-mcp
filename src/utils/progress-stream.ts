/**
 * Progress Streaming Utilities - React Ink Version
 *
 * Provides real-time progress updates for long-running MCP operations.
 * Uses React Ink for beautiful colored output to stderr.
 */

// import { renderProgressBanner, renderCompactProgress } from './workflow-ink-renderer.js';
// Ink disabled - using plain text functions that return empty strings
const renderProgressBanner = (_opts: {
  workflowName: string;
  currentStep: number;
  totalSteps: number;
  stepName: string;
  status: string;
  elapsedTime: number;
  modelUsed?: string;
}): string => '';
const renderCompactProgress = (_opts: unknown): string => '';

export interface ProgressUpdate {
  type: 'start' | 'progress' | 'step' | 'complete' | 'error';
  message: string;
  percentage?: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export class ProgressStream {
  private updates: ProgressUpdate[] = [];
  private startTime: Date;
  private totalSteps: number;
  private currentStep: number = 0;
  private workflowName: string = 'Operation';
  private modelUsed?: string;

  constructor(totalSteps: number = 1) {
    this.startTime = new Date();
    this.totalSteps = totalSteps;
  }

  /**
   * Emit progress update to stderr using React Ink
   */
  private emit(update: ProgressUpdate): void {
    this.updates.push(update);

    const elapsed = Date.now() - this.startTime.getTime();

    // Use Ink banner for beautiful output
    const banner = renderProgressBanner({
      workflowName: this.workflowName,
      currentStep: this.currentStep,
      totalSteps: this.totalSteps,
      stepName: update.message,
      status: this.mapTypeToStatus(update.type),
      elapsedTime: elapsed,
      modelUsed: this.modelUsed,
    });

    console.error(banner);
  }

  /**
   * Map update type to status
   */
  private mapTypeToStatus(type: ProgressUpdate['type']): 'starting' | 'running' | 'completed' | 'failed' {
    switch (type) {
      case 'start': return 'starting';
      case 'progress':
      case 'step': return 'running';
      case 'complete': return 'completed';
      case 'error': return 'failed';
      default: return 'running';
    }
  }

  /**
   * Mark operation start
   */
  start(message: string): void {
    this.workflowName = message;
    this.emit({
      type: 'start',
      message,
      timestamp: new Date()
    });
  }

  /**
   * Update progress
   */
  progress(message: string, step?: number, total?: number): void {
    if (step !== undefined && total !== undefined) {
      this.currentStep = step;
      this.totalSteps = total;
    }

    this.emit({
      type: 'progress',
      message,
      percentage: total ? (this.currentStep / total) * 100 : undefined,
      timestamp: new Date()
    });
  }

  /**
   * Mark step completion
   */
  step(message: string, stepNumber?: number): void {
    if (stepNumber !== undefined) {
      this.currentStep = stepNumber;
    } else {
      this.currentStep++;
    }

    this.emit({
      type: 'step',
      message,
      metadata: { stepNumber: this.currentStep, totalSteps: this.totalSteps },
      timestamp: new Date()
    });
  }

  /**
   * Mark operation complete
   */
  complete(message: string): void {
    this.currentStep = this.totalSteps;
    this.emit({
      type: 'complete',
      message,
      timestamp: new Date()
    });
  }

  /**
   * Mark operation error
   */
  error(message: string): void {
    this.emit({
      type: 'error',
      message,
      timestamp: new Date()
    });
  }

  /**
   * Set model being used (for display)
   */
  setModel(model: string): void {
    this.modelUsed = model;
  }

  /**
   * Get all updates
   */
  getUpdates(): ProgressUpdate[] {
    return [...this.updates];
  }

  /**
   * Get duration in seconds
   */
  getDuration(): number {
    return Math.floor((new Date().getTime() - this.startTime.getTime()) / 1000);
  }
}

/**
 * Create progress stream for operation
 */
export function createProgressStream(totalSteps: number = 1): ProgressStream {
  return new ProgressStream(totalSteps);
}

/**
 * Wrap async operation with progress tracking
 */
export async function withProgress<T>(
  operation: (stream: ProgressStream) => Promise<T>,
  operationName: string,
  totalSteps?: number
): Promise<T> {
  const stream = new ProgressStream(totalSteps || 1);
  stream.start(operationName);

  try {
    const result = await operation(stream);
    stream.complete(`${operationName} finished`);
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    stream.error(`${operationName} failed: ${errorMsg}`);
    throw error;
  }
}

/**
 * Progress reporter for multi-model operations
 * Uses compact Ink progress lines for model status
 */
export class MultiModelProgressReporter {
  private stream: ProgressStream;
  private models: string[];
  private results: Map<string, { status: 'pending' | 'running' | 'complete' | 'error', output?: string }>;

  constructor(models: string[], operationName: string) {
    this.models = models;
    this.stream = new ProgressStream(models.length);
    this.results = new Map(models.map(m => [m, { status: 'pending' }]));

    this.stream.start(`${operationName} (${models.length} models)`);
  }

  /**
   * Mark model as running
   */
  modelStarted(model: string): void {
    const result = this.results.get(model);
    if (result) {
      result.status = 'running';
      this.stream.setModel(model);
      this.stream.step(`${model} processing...`);
    }
  }

  /**
   * Mark model as complete
   */
  modelCompleted(model: string, output: string): void {
    const result = this.results.get(model);
    if (result) {
      result.status = 'complete';
      result.output = output;

      const completed = Array.from(this.results.values()).filter(r => r.status === 'complete').length;
      this.stream.progress(`${model} done`, completed, this.models.length);
    }
  }

  /**
   * Mark model as error
   */
  modelFailed(model: string, error: string): void {
    const result = this.results.get(model);
    if (result) {
      result.status = 'error';
      this.stream.error(`${model}: ${error}`);
    }
  }

  /**
   * Complete all operations
   */
  complete(message?: string): void {
    const completed = Array.from(this.results.values()).filter(r => r.status === 'complete').length;
    const failed = Array.from(this.results.values()).filter(r => r.status === 'error').length;

    const summary = message || `${completed}/${this.models.length} models done${failed > 0 ? ` (${failed} failed)` : ''}`;
    this.stream.complete(summary);
  }

  /**
   * Get progress stream
   */
  getStream(): ProgressStream {
    return this.stream;
  }
}

/**
 * Create progress reporter for multi-model operation
 */
export function createMultiModelReporter(
  models: string[],
  operationName: string
): MultiModelProgressReporter {
  return new MultiModelProgressReporter(models, operationName);
}
