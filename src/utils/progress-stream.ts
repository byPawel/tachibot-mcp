/**
 * Progress Streaming Utilities
 *
 * Provides real-time progress updates for long-running MCP operations.
 * Users see incremental output instead of waiting for final result.
 */

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

  constructor(totalSteps: number = 1) {
    this.startTime = new Date();
    this.totalSteps = totalSteps;
  }

  /**
   * Emit progress update to stderr (visible to user in real-time)
   */
  private emit(update: ProgressUpdate): void {
    this.updates.push(update);

    // Format for CLI output
    const elapsed = Math.floor((update.timestamp.getTime() - this.startTime.getTime()) / 1000);
    const timeStr = `[${elapsed}s]`;

    let output = '';
    switch (update.type) {
      case 'start':
        output = `\n🚀 ${update.message}`;
        break;
      case 'progress':
        const progressBar = this.renderProgressBar(update.percentage || 0);
        output = `\r${timeStr} ${progressBar} ${update.message}`;
        break;
      case 'step':
        output = `\n${timeStr} ⚙️  Step ${this.currentStep}/${this.totalSteps}: ${update.message}`;
        break;
      case 'complete':
        output = `\n\n✅ ${update.message} (completed in ${elapsed}s)`;
        break;
      case 'error':
        output = `\n\n❌ ${update.message}`;
        break;
    }

    // Write to stderr so it doesn't interfere with MCP JSON-RPC on stdout
    console.error(output);
  }

  /**
   * Render ASCII progress bar
   */
  private renderProgressBar(percentage: number): string {
    const width = 20;
    const filled = Math.floor(width * (percentage / 100));
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage.toFixed(0)}%`;
  }

  /**
   * Mark operation start
   */
  start(message: string): void {
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
      const percentage = (step / total) * 100;

      this.emit({
        type: 'progress',
        message,
        percentage,
        timestamp: new Date()
      });
    } else {
      this.emit({
        type: 'progress',
        message,
        percentage: undefined,
        timestamp: new Date()
      });
    }
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
 */
export class MultiModelProgressReporter {
  private stream: ProgressStream;
  private models: string[];
  private results: Map<string, { status: 'pending' | 'running' | 'complete' | 'error', output?: string }>;

  constructor(models: string[], operationName: string) {
    this.models = models;
    this.stream = new ProgressStream(models.length);
    this.results = new Map(models.map(m => [m, { status: 'pending' }]));

    this.stream.start(`${operationName} with ${models.length} models`);
    this.printModelTable();
  }

  /**
   * Print table of models and their status
   */
  private printModelTable(): void {
    console.error('\n📊 Model Status:');
    console.error('┌' + '─'.repeat(50) + '┐');
    this.models.forEach(model => {
      const status = this.results.get(model)?.status || 'pending';
      const icon = this.getStatusIcon(status);
      const padding = ' '.repeat(Math.max(0, 40 - model.length));
      console.error(`│ ${icon} ${model}${padding} │`);
    });
    console.error('└' + '─'.repeat(50) + '┘\n');
  }

  /**
   * Get icon for status
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'pending': return '⏳';
      case 'running': return '🔄';
      case 'complete': return '✅';
      case 'error': return '❌';
      default: return '�';
    }
  }

  /**
   * Mark model as running
   */
  modelStarted(model: string): void {
    const result = this.results.get(model);
    if (result) {
      result.status = 'running';
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
      this.stream.progress(`${completed}/${this.models.length} models completed`, completed, this.models.length);

      // Show preview of output
      const preview = output.substring(0, 100).replace(/\n/g, ' ');
      console.error(`   📝 Preview: ${preview}${output.length > 100 ? '...' : ''}`);
    }
  }

  /**
   * Mark model as error
   */
  modelFailed(model: string, error: string): void {
    const result = this.results.get(model);
    if (result) {
      result.status = 'error';
      console.error(`   ⚠️  ${model} failed: ${error}`);
    }
  }

  /**
   * Complete all operations
   */
  complete(message?: string): void {
    const completed = Array.from(this.results.values()).filter(r => r.status === 'complete').length;
    const failed = Array.from(this.results.values()).filter(r => r.status === 'error').length;

    const summary = message || `${completed} models completed${failed > 0 ? `, ${failed} failed` : ''}`;
    this.stream.complete(summary);

    // Print final table
    this.printModelTable();
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
