/**
 * Workflow Event Bus
 * Central pub/sub event bus for workflow coordination
 * Extends EventEmitter pattern from MessageQueue
 */

import { EventEmitter } from 'events';
import { IEventBus, EventHandler } from './interfaces/IEventBus.js';

/**
 * Standard workflow event topics
 */
export const WorkflowEvents = {
  // Workflow lifecycle
  WORKFLOW_STARTED: 'workflow.started',
  WORKFLOW_VALIDATING: 'workflow.validating',
  WORKFLOW_COMPLETED: 'workflow.completed',
  WORKFLOW_FAILED: 'workflow.failed',
  WORKFLOW_PAUSED: 'workflow.paused',
  WORKFLOW_RESUMED: 'workflow.resumed',

  // Step lifecycle
  STEP_READY: 'workflow.step.ready',
  STEP_STARTED: 'workflow.step.started',
  STEP_COMPLETED: 'workflow.step.completed',
  STEP_FAILED: 'workflow.step.failed',
  STEP_SKIPPED: 'workflow.step.skipped',
  STEP_RETRYING: 'workflow.step.retrying',

  // Tool invocation
  TOOL_BEFORE_INVOKE: 'workflow.tool.before_invoke',
  TOOL_INVOKED: 'workflow.tool.invoked',
  TOOL_SUCCESS: 'workflow.tool.success',
  TOOL_FAILURE: 'workflow.tool.failure',

  // Variable & file operations
  VARIABLE_RESOLVED: 'workflow.variable.resolved',
  FILE_CREATED: 'workflow.file.created',
  FILE_REFERENCE_CREATED: 'workflow.file_reference.created',

  // Synthesis
  SYNTHESIS_STARTED: 'workflow.synthesis.started',
  SYNTHESIS_COMPLETED: 'workflow.synthesis.completed',

  // Session management
  SESSION_CHECKPOINT: 'workflow.session.checkpoint',
  SESSION_RESTORED: 'workflow.session.restored',

  // Error handling
  ERROR_OCCURRED: 'workflow.error.occurred',
  ERROR_RECOVERED: 'workflow.error.recovered'
} as const;

export type WorkflowEventTopic = typeof WorkflowEvents[keyof typeof WorkflowEvents];

export class WorkflowEventBus extends EventEmitter implements IEventBus {
  private static instance: WorkflowEventBus;

  constructor() {
    super();
    // Increase max listeners for complex workflows
    this.setMaxListeners(100);
  }

  /**
   * Singleton instance (optional - can also use new WorkflowEventBus())
   */
  static getInstance(): WorkflowEventBus {
    if (!WorkflowEventBus.instance) {
      WorkflowEventBus.instance = new WorkflowEventBus();
    }
    return WorkflowEventBus.instance;
  }

  subscribe<T = any>(topic: string, handler: EventHandler<T>): () => void {
    this.on(topic, handler);

    // Return unsubscribe function
    return () => {
      this.off(topic, handler);
    };
  }

  async publish<T = any>(topic: string, data: T): Promise<void> {
    // Log event for debugging (can be disabled in production)
    if (process.env.DEBUG_WORKFLOW_EVENTS === 'true') {
      console.error(`[EventBus] ${topic}:`, JSON.stringify(data, null, 2));
    }

    // Emit to all synchronous listeners
    this.emit(topic, data);

    // Get all listeners for this topic
    const listeners = this.listeners(topic);

    // Execute async handlers
    const asyncHandlers = listeners.filter(
      (listener) => listener.constructor.name === 'AsyncFunction'
    );

    if (asyncHandlers.length > 0) {
      await Promise.all(
        asyncHandlers.map((handler) => Promise.resolve(handler(data)))
      );
    }
  }

  clear(topic: string): void {
    this.removeAllListeners(topic);
  }

  clearAll(): void {
    this.removeAllListeners();
  }

  listenerCount(topic: string): number {
    return super.listenerCount(topic);
  }

  /**
   * Subscribe to multiple topics with same handler
   */
  subscribeMultiple<T = any>(topics: string[], handler: EventHandler<T>): () => void {
    const unsubscribers = topics.map((topic) => this.subscribe(topic, handler));

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }

  /**
   * Wait for a specific event to occur (Promise-based)
   */
  async waitFor<T = any>(topic: string, timeout: number = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(topic, handler);
        reject(new Error(`Timeout waiting for event: ${topic}`));
      }, timeout);

      const handler = (data: T) => {
        clearTimeout(timer);
        resolve(data);
      };

      this.once(topic, handler);
    });
  }

  /**
   * Publish with error handling
   */
  async publishSafe<T = any>(topic: string, data: T): Promise<void> {
    try {
      await this.publish(topic, data);
    } catch (error) {
      console.error(`[EventBus] Error publishing to ${topic}:`, error);
      // Emit error event for monitoring
      this.emit(WorkflowEvents.ERROR_OCCURRED, {
        topic,
        error,
        data
      });
    }
  }
}
