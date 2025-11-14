import { EventEmitter } from 'events';

/**
 * Message Queue Integration for Claude → Subagent Communication
 * Handles burst loads, enables fault-tolerant delivery, and decouples components
 */

export interface Message {
  id: string;
  topic: string;
  payload: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  headers?: Record<string, string>;
}

export interface QueueConfig {
  maxSize: number;
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
  flushInterval: number;
  deadLetterQueue: boolean;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetter: number;
  avgProcessingTime: number;
  throughput: number;
}

/**
 * In-memory message queue implementation
 * Can be replaced with Kafka/RabbitMQ for production
 */
export class MessageQueue extends EventEmitter {
  private queues = new Map<string, Message[]>();
  private processing = new Map<string, Set<string>>();
  private deadLetterQueue: Message[] = [];
  private stats = new Map<string, QueueStats>();
  private handlers = new Map<string, ((message: Message) => Promise<any>)[]>();
  private config: QueueConfig;
  private flushTimer?: NodeJS.Timeout;

  constructor(config: Partial<QueueConfig> = {}) {
    super();
    this.config = {
      maxSize: 10000,
      maxRetries: 3,
      retryDelay: 1000,
      batchSize: 10,
      flushInterval: 100,
      deadLetterQueue: true,
      ...config
    };
    
    this.startFlushTimer();
  }

  /**
   * Send a message to a topic
   */
  async send(topic: string, payload: any, options: Partial<Message> = {}): Promise<string> {
    const messageId = this.generateMessageId();
    const message: Message = {
      id: messageId,
      topic,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: options.maxRetries || this.config.maxRetries,
      priority: options.priority || 'normal',
      headers: options.headers
    };

    // Check queue size limit
    const queue = this.getQueue(topic);
    if (queue.length >= this.config.maxSize) {
      throw new Error(`Queue ${topic} is full (max: ${this.config.maxSize})`);
    }

    // Add to queue based on priority
    this.addToQueue(topic, message);
    this.emit('message-sent', { topic, messageId });
    
    // Update stats
    this.updateStats(topic, 'pending', 1);

    return messageId;
  }

  /**
   * Send a batch of messages
   */
  async sendBatch(topic: string, payloads: any[], options: Partial<Message> = {}): Promise<string[]> {
    const messageIds: string[] = [];
    
    for (const payload of payloads) {
      const id = await this.send(topic, payload, options);
      messageIds.push(id);
    }
    
    return messageIds;
  }

  /**
   * Subscribe to a topic
   */
  subscribe(topic: string, handler: (message: Message) => Promise<any>): void {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, []);
    }
    
    this.handlers.get(topic)!.push(handler);
    this.emit('subscription-added', { topic });
    
    // Process any pending messages
    this.processQueue(topic);
  }

  /**
   * Process messages in a queue
   */
  private async processQueue(topic: string): Promise<void> {
    const queue = this.getQueue(topic);
    const handlers = this.handlers.get(topic) || [];
    
    if (queue.length === 0 || handlers.length === 0) {
      return;
    }

    // Get batch of messages
    const batch = this.getNextBatch(topic);
    
    for (const message of batch) {
      // Skip if already processing
      if (this.isProcessing(topic, message.id)) {
        continue;
      }
      
      this.markProcessing(topic, message.id);
      
      // Process message with all handlers
      this.processMessage(topic, message, handlers);
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(
    topic: string,
    message: Message,
    handlers: ((message: Message) => Promise<any>)[]
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Execute all handlers in parallel
      const results = await Promise.allSettled(
        handlers.map(handler => handler(message))
      );
      
      // Check if any handler failed
      const failures = results.filter(r => r.status === 'rejected');
      
      if (failures.length > 0) {
        throw new Error(`${failures.length} handlers failed`);
      }
      
      // Success - remove from queue
      this.removeFromQueue(topic, message.id);
      this.markComplete(topic, message.id);
      
      // Update stats
      const processingTime = Date.now() - startTime;
      this.updateStats(topic, 'completed', 1);
      this.updateProcessingTime(topic, processingTime);
      
      this.emit('message-processed', { topic, messageId: message.id, processingTime });
      
    } catch (error) {
      // Handle failure
      await this.handleFailure(topic, message, error as Error);
    }
  }

  /**
   * Handle message processing failure
   */
  private async handleFailure(topic: string, message: Message, error: Error): Promise<void> {
    message.retryCount++;
    this.markComplete(topic, message.id); // Remove from processing
    
    if (message.retryCount < message.maxRetries) {
      // Retry with delay
      setTimeout(() => {
        this.addToQueue(topic, message);
        this.emit('message-retry', { 
          topic, 
          messageId: message.id, 
          retryCount: message.retryCount 
        });
      }, this.config.retryDelay * message.retryCount);
      
    } else {
      // Move to dead letter queue
      if (this.config.deadLetterQueue) {
        this.deadLetterQueue.push(message);
        this.updateStats(topic, 'deadLetter', 1);
        this.emit('message-dead-letter', { 
          topic, 
          messageId: message.id, 
          error: error.message 
        });
      } else {
        this.updateStats(topic, 'failed', 1);
        this.emit('message-failed', { 
          topic, 
          messageId: message.id, 
          error: error.message 
        });
      }
      
      // Remove from queue
      this.removeFromQueue(topic, message.id);
    }
  }

  /**
   * Get next batch of messages to process
   */
  private getNextBatch(topic: string): Message[] {
    const queue = this.getQueue(topic);
    
    // Sort by priority and timestamp
    const sorted = queue.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });
    
    return sorted.slice(0, this.config.batchSize);
  }

  /**
   * Add message to queue based on priority
   */
  private addToQueue(topic: string, message: Message): void {
    const queue = this.getQueue(topic);
    
    if (message.priority === 'critical' || message.priority === 'high') {
      // Add to front for high priority
      queue.unshift(message);
    } else {
      // Add to back for normal/low priority
      queue.push(message);
    }
  }

  /**
   * Remove message from queue
   */
  private removeFromQueue(topic: string, messageId: string): void {
    const queue = this.getQueue(topic);
    const index = queue.findIndex(m => m.id === messageId);
    
    if (index >= 0) {
      queue.splice(index, 1);
    }
  }

  /**
   * Get or create queue for topic
   */
  private getQueue(topic: string): Message[] {
    if (!this.queues.has(topic)) {
      this.queues.set(topic, []);
      this.processing.set(topic, new Set());
      this.initStats(topic);
    }
    
    return this.queues.get(topic)!;
  }

  /**
   * Check if message is being processed
   */
  private isProcessing(topic: string, messageId: string): boolean {
    return this.processing.get(topic)?.has(messageId) || false;
  }

  /**
   * Mark message as processing
   */
  private markProcessing(topic: string, messageId: string): void {
    if (!this.processing.has(topic)) {
      this.processing.set(topic, new Set());
    }
    this.processing.get(topic)!.add(messageId);
    this.updateStats(topic, 'processing', 1);
    this.updateStats(topic, 'pending', -1);
  }

  /**
   * Mark message as complete
   */
  private markComplete(topic: string, messageId: string): void {
    this.processing.get(topic)?.delete(messageId);
    this.updateStats(topic, 'processing', -1);
  }

  /**
   * Start flush timer to process queues periodically
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      for (const topic of this.queues.keys()) {
        this.processQueue(topic);
      }
    }, this.config.flushInterval);
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize stats for a topic
   */
  private initStats(topic: string): void {
    this.stats.set(topic, {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      deadLetter: 0,
      avgProcessingTime: 0,
      throughput: 0
    });
  }

  /**
   * Update stats for a topic
   */
  private updateStats(topic: string, field: keyof QueueStats, delta: number): void {
    const stats = this.stats.get(topic);
    if (stats) {
      (stats as any)[field] += delta;
    }
  }

  /**
   * Update processing time stats
   */
  private updateProcessingTime(topic: string, time: number): void {
    const stats = this.stats.get(topic);
    if (stats) {
      // Calculate moving average
      const alpha = 0.1; // Smoothing factor
      stats.avgProcessingTime = alpha * time + (1 - alpha) * stats.avgProcessingTime;
      
      // Calculate throughput (messages per second)
      stats.throughput = 1000 / stats.avgProcessingTime;
    }
  }

  /**
   * Get stats for a topic
   */
  getStats(topic?: string): QueueStats | Map<string, QueueStats> {
    if (topic) {
      return this.stats.get(topic) || this.initStats(topic) || this.stats.get(topic)!;
    }
    return new Map(this.stats);
  }

  /**
   * Get dead letter queue
   */
  getDeadLetterQueue(): Message[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Retry dead letter messages
   */
  async retryDeadLetters(topic?: string): Promise<number> {
    const messages = topic 
      ? this.deadLetterQueue.filter(m => m.topic === topic)
      : [...this.deadLetterQueue];
    
    let retried = 0;
    
    for (const message of messages) {
      message.retryCount = 0; // Reset retry count
      this.addToQueue(message.topic, message);
      
      // Remove from dead letter queue
      const index = this.deadLetterQueue.indexOf(message);
      if (index >= 0) {
        this.deadLetterQueue.splice(index, 1);
      }
      
      retried++;
    }
    
    this.emit('dead-letters-retried', { count: retried, topic });
    return retried;
  }

  /**
   * Clear a queue
   */
  clearQueue(topic: string): void {
    this.queues.set(topic, []);
    this.processing.set(topic, new Set());
    this.initStats(topic);
    this.emit('queue-cleared', { topic });
  }

  /**
   * Cleanup and stop processing
   */
  cleanup(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    // Clear all queues
    for (const topic of this.queues.keys()) {
      this.clearQueue(topic);
    }
    
    this.deadLetterQueue = [];
    this.removeAllListeners();
  }
}

/**
 * Subagent request/response handling
 */
export interface SubagentRequest {
  id: string;
  type: string;
  config: any;
  payload: any;
  timeout?: number;
}

export interface SubagentResponse {
  id: string;
  requestId: string;
  result?: any;
  error?: string;
  processingTime: number;
}

/**
 * Message Queue Orchestrator for Claude → Subagent communication
 */
export class MessageQueueOrchestrator extends EventEmitter {
  private queue: MessageQueue;
  private pendingRequests = new Map<string, {
    resolve: (value: SubagentResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor(queueConfig?: Partial<QueueConfig>) {
    super();
    this.queue = new MessageQueue(queueConfig);
    this.setupResponseHandler();
  }

  /**
   * Delegate task to subagent via message queue
   */
  async delegateToSubagent(request: SubagentRequest): Promise<SubagentResponse> {
    const timeout = request.timeout || 30000;
    
    return new Promise((resolve, reject) => {
      // Store pending request
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Subagent request ${request.id} timed out after ${timeout}ms`));
      }, timeout);
      
      this.pendingRequests.set(request.id, { resolve, reject, timeout: timeoutHandle });
      
      // Send to message queue
      this.queue.send('subagent-requests', request, {
        priority: 'normal',
        headers: {
          'request-id': request.id,
          'request-type': request.type,
          'timeout': timeout.toString()
        }
      }).catch(error => {
        this.pendingRequests.delete(request.id);
        clearTimeout(timeoutHandle);
        reject(error);
      });
    });
  }

  /**
   * Spawn ephemeral subagent
   */
  async spawnEphemeralSubagent(type: string, config: any): Promise<string> {
    const subagentId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const request: SubagentRequest = {
      id: this.generateRequestId(),
      type: 'spawn-subagent',
      config: {
        subagentId,
        type,
        ...config
      },
      payload: {}
    };
    
    const response = await this.delegateToSubagent(request);
    
    if (response.error) {
      throw new Error(`Failed to spawn subagent: ${response.error}`);
    }
    
    return subagentId;
  }

  /**
   * Setup response handler
   */
  private setupResponseHandler(): void {
    this.queue.subscribe('subagent-responses', async (message: Message) => {
      const response = message.payload as SubagentResponse;
      const pending = this.pendingRequests.get(response.requestId);
      
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.requestId);
        
        if (response.error) {
          pending.reject(new Error(response.error));
        } else {
          pending.resolve(response);
        }
      }
    });
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get queue statistics
   */
  getStats(): Map<string, QueueStats> {
    return this.queue.getStats() as Map<string, QueueStats>;
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    // Clear pending requests
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Orchestrator shutting down'));
    }
    this.pendingRequests.clear();
    
    // Cleanup queue
    this.queue.cleanup();
    this.removeAllListeners();
  }
}

// Export singleton instances
export const messageQueue = new MessageQueue();
export const mqOrchestrator = new MessageQueueOrchestrator();