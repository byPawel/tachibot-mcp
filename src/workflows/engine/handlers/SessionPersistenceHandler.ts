/**
 * Session Persistence Handler
 * Handles workflow session checkpointing and restoration
 * Subscribes to state change events for automatic persistence
 */

import * as fs from 'fs';
import * as path from 'path';
import { WorkflowEventBus, WorkflowEvents } from '../events/WorkflowEventBus.js';
import { WorkflowState } from '../state/interfaces/IStateMachine.js';

export interface SessionCheckpoint {
  workflowId: string;
  workflowName: string;
  state: WorkflowState;
  currentStepIndex: number;
  variables: Record<string, unknown>;
  stepOutputs: Record<string, unknown>;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export class SessionPersistenceHandler {
  private eventBus: WorkflowEventBus;
  private checkpointDir: string;
  private autoSaveEnabled: boolean;

  constructor(
    eventBus: WorkflowEventBus,
    options: {
      checkpointDir?: string;
      autoSave?: boolean;
    } = {}
  ) {
    this.eventBus = eventBus;
    this.checkpointDir = options.checkpointDir || './.workflow-checkpoints';
    this.autoSaveEnabled = options.autoSave !== false; // Default: true

    // Ensure checkpoint directory exists
    this.ensureCheckpointDir();

    // Subscribe to events for auto-save
    if (this.autoSaveEnabled) {
      this.setupAutoSave();
    }
  }

  private ensureCheckpointDir(): void {
    if (!fs.existsSync(this.checkpointDir)) {
      fs.mkdirSync(this.checkpointDir, { recursive: true });
      console.error(`[SessionPersistence] Created checkpoint directory: ${this.checkpointDir}`);
    }
  }

  private setupAutoSave(): void {
    // Save checkpoint after each step completes
    this.eventBus.subscribe(
      WorkflowEvents.STEP_COMPLETED,
      this.handleStepCompleted.bind(this)
    );

    // Save checkpoint when workflow completes
    this.eventBus.subscribe(
      WorkflowEvents.WORKFLOW_COMPLETED,
      this.handleWorkflowCompleted.bind(this)
    );

    // Save checkpoint before failure
    this.eventBus.subscribe(
      WorkflowEvents.WORKFLOW_FAILED,
      this.handleWorkflowFailed.bind(this)
    );
  }

  private async handleStepCompleted(event: { stepName: string; [key: string]: unknown }): Promise<void> {
    // Auto-save checkpoint after each step
    console.error(`[SessionPersistence] Auto-saving checkpoint after step: ${event.stepName}`);

    // Publish checkpoint event
    await this.eventBus.publish(WorkflowEvents.SESSION_CHECKPOINT, {
      stepName: event.stepName,
      reason: 'step_completed'
    });
  }

  private async handleWorkflowCompleted(event: { workflowId: string; workflowName: string }): Promise<void> {
    console.error(
      `[SessionPersistence] Workflow ${event.workflowName} completed - saving final checkpoint`
    );

    await this.eventBus.publish(WorkflowEvents.SESSION_CHECKPOINT, {
      workflowId: event.workflowId,
      reason: 'workflow_completed'
    });
  }

  private async handleWorkflowFailed(event: { workflowId: string; workflowName: string; error: Error }): Promise<void> {
    console.error(
      `[SessionPersistence] Workflow ${event.workflowName} failed - saving error checkpoint`
    );

    await this.eventBus.publish(WorkflowEvents.SESSION_CHECKPOINT, {
      workflowId: event.workflowId,
      reason: 'workflow_failed',
      error: event.error.message
    });
  }

  /**
   * Save workflow checkpoint to disk
   */
  async saveCheckpoint(checkpoint: SessionCheckpoint): Promise<string> {
    const filename = this.getCheckpointFilename(checkpoint.workflowId);
    const filepath = path.join(this.checkpointDir, filename);

    try {
      const data = JSON.stringify(checkpoint, null, 2);
      await fs.promises.writeFile(filepath, data, 'utf-8');

      console.error(`[SessionPersistence] Checkpoint saved: ${filepath}`);
      return filepath;
    } catch (error) {
      console.error(`[SessionPersistence] Error saving checkpoint:`, error);
      throw error;
    }
  }

  /**
   * Load workflow checkpoint from disk
   */
  async loadCheckpoint(workflowId: string): Promise<SessionCheckpoint | null> {
    const filename = this.getCheckpointFilename(workflowId);
    const filepath = path.join(this.checkpointDir, filename);

    try {
      if (!fs.existsSync(filepath)) {
        return null;
      }

      const data = await fs.promises.readFile(filepath, 'utf-8');
      const checkpoint = JSON.parse(data) as SessionCheckpoint;

      console.error(`[SessionPersistence] Checkpoint loaded: ${filepath}`);

      // Publish restore event
      await this.eventBus.publish(WorkflowEvents.SESSION_RESTORED, {
        workflowId: checkpoint.workflowId,
        workflowName: checkpoint.workflowName,
        state: checkpoint.state
      });

      return checkpoint;
    } catch (error) {
      console.error(`[SessionPersistence] Error loading checkpoint:`, error);
      return null;
    }
  }

  /**
   * List all checkpoints for a workflow
   */
  listCheckpoints(workflowName?: string): string[] {
    try {
      const files = fs.readdirSync(this.checkpointDir);

      if (workflowName) {
        return files.filter((f) => f.includes(workflowName) && f.endsWith('.json'));
      }

      return files.filter((f) => f.endsWith('.json'));
    } catch (error) {
      console.error(`[SessionPersistence] Error listing checkpoints:`, error);
      return [];
    }
  }

  /**
   * Delete checkpoint file
   */
  async deleteCheckpoint(workflowId: string): Promise<boolean> {
    const filename = this.getCheckpointFilename(workflowId);
    const filepath = path.join(this.checkpointDir, filename);

    try {
      if (fs.existsSync(filepath)) {
        await fs.promises.unlink(filepath);
        console.error(`[SessionPersistence] Checkpoint deleted: ${filepath}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`[SessionPersistence] Error deleting checkpoint:`, error);
      return false;
    }
  }

  /**
   * Get checkpoint filename for workflow ID
   */
  private getCheckpointFilename(workflowId: string): string {
    return `checkpoint-${workflowId}.json`;
  }

  /**
   * Clean up old checkpoints (older than specified days)
   */
  async cleanupOldCheckpoints(daysOld: number = 7): Promise<number> {
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    try {
      const files = this.listCheckpoints();

      for (const file of files) {
        const filepath = path.join(this.checkpointDir, file);
        const stats = fs.statSync(filepath);

        if (stats.mtimeMs < cutoffTime) {
          await fs.promises.unlink(filepath);
          deletedCount++;
        }
      }

      console.error(
        `[SessionPersistence] Cleaned up ${deletedCount} old checkpoints (>${daysOld} days)`
      );
      return deletedCount;
    } catch (error) {
      console.error(`[SessionPersistence] Error cleaning up checkpoints:`, error);
      return deletedCount;
    }
  }
}
