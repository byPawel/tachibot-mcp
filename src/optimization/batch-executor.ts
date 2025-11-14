export interface BatchTask {
  id: string;
  type: string;
  fn: () => Promise<any>;
  priority?: number;
  timeout?: number;
  dependencies?: string[];
}

export interface BatchResult {
  id: string;
  result?: any;
  error?: Error;
  duration: number;
  status: 'success' | 'error' | 'timeout';
}

export interface BatchExecutionReport {
  totalTasks: number;
  successful: number;
  failed: number;
  timeouts: number;
  totalDuration: number;
  parallelGroups: number;
}

export class BatchExecutor {
  private maxConcurrency: number = 5;
  private defaultTimeout: number = 30000;

  constructor(maxConcurrency?: number, defaultTimeout?: number) {
    if (maxConcurrency) this.maxConcurrency = maxConcurrency;
    if (defaultTimeout) this.defaultTimeout = defaultTimeout;
  }

  async execute(tasks: BatchTask[]): Promise<BatchResult[]> {
    const groups = this.groupTasksByDependencies(tasks);
    const results: BatchResult[] = [];

    for (const group of groups) {
      const groupResults = await this.executeGroup(group);
      results.push(...groupResults);
    }

    return results;
  }

  async executeParallel(
    tasks: BatchTask[],
    maxConcurrency?: number
  ): Promise<BatchResult[]> {
    const concurrency = maxConcurrency || this.maxConcurrency;
    const results: BatchResult[] = [];
    const queue = [...tasks].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    while (queue.length > 0) {
      const batch = queue.splice(0, concurrency);
      const batchResults = await Promise.all(
        batch.map(task => this.executeTask(task))
      );
      results.push(...batchResults);
    }

    return results;
  }

  private async executeGroup(tasks: BatchTask[]): Promise<BatchResult[]> {
    const promises = tasks.map(task => this.executeTask(task));
    return Promise.all(promises);
  }

  private async executeTask(task: BatchTask): Promise<BatchResult> {
    const startTime = Date.now();
    const timeout = task.timeout || this.defaultTimeout;

    try {
      const result = await Promise.race([
        task.fn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]);

      return {
        id: task.id,
        result,
        duration: Date.now() - startTime,
        status: 'success'
      };
    } catch (error) {
      const isTimeout = error instanceof Error && error.message === 'Timeout';
      return {
        id: task.id,
        error: error as Error,
        duration: Date.now() - startTime,
        status: isTimeout ? 'timeout' : 'error'
      };
    }
  }

  private groupTasksByDependencies(tasks: BatchTask[]): BatchTask[][] {
    const groups: BatchTask[][] = [];
    const completed = new Set<string>();
    const remaining = [...tasks];

    while (remaining.length > 0) {
      const group: BatchTask[] = [];
      
      for (let i = remaining.length - 1; i >= 0; i--) {
        const task = remaining[i];
        const ready = !task.dependencies || 
          task.dependencies.every(dep => completed.has(dep));
        
        if (ready) {
          group.push(task);
          remaining.splice(i, 1);
        }
      }

      if (group.length === 0 && remaining.length > 0) {
        throw new Error('Circular dependency detected in batch tasks');
      }

      groups.push(group);
      group.forEach(task => completed.add(task.id));
    }

    return groups;
  }

  generateReport(results: BatchResult[]): BatchExecutionReport {
    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;
    const timeouts = results.filter(r => r.status === 'timeout').length;
    const totalDuration = Math.max(...results.map(r => r.duration));

    return {
      totalTasks: results.length,
      successful,
      failed,
      timeouts,
      totalDuration,
      parallelGroups: Math.ceil(results.length / this.maxConcurrency)
    };
  }

  async executeWithRetry(
    task: BatchTask,
    maxRetries: number = 3,
    backoff: number = 1000
  ): Promise<BatchResult> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, backoff * attempt));
      }
      
      const result = await this.executeTask(task);
      if (result.status === 'success') {
        return result;
      }
      
      lastError = result.error;
    }

    return {
      id: task.id,
      error: lastError || new Error('Max retries exceeded'),
      duration: 0,
      status: 'error'
    };
  }

  setMaxConcurrency(max: number): void {
    this.maxConcurrency = max;
  }

  setDefaultTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }
}