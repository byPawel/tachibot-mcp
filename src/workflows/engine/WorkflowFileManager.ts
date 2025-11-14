/**
 * Workflow File Manager
 * Handles file references, output saving, and manifest management
 */

import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import {
  IWorkflowFileManager,
  WorkflowManifest,
  CreateFileReferenceOptions
} from './interfaces/IWorkflowFileManager.js';
import { FileReference } from './interfaces/IVariableInterpolator.js';

export class WorkflowFileManager implements IWorkflowFileManager {
  /**
   * Extracts a summary from content (first 200 chars)
   */
  extractSummary(result: unknown): string {
    // Handle null/undefined explicitly
    if (result === null) return '[null]';
    if (result === undefined) return '[undefined]';

    // Handle primitives (including falsy: 0, false, "")
    if (typeof result === 'string') {
      return this.truncateString(result, 200);
    }
    if (typeof result === 'number' || typeof result === 'boolean') {
      return String(result);
    }

    // Handle objects with summary property
    if (result && typeof result === 'object' && 'summary' in result) {
      const summary = (result as any).summary;
      if (typeof summary === 'string') {
        return this.truncateString(summary, 200);
      }
      // If summary is not a string, JSON.stringify it
      try {
        const summaryStr = JSON.stringify(summary, this.getCircularReplacer());
        return this.truncateString(summaryStr, 200);
      } catch (error) {
        return '[Summary unavailable]';
      }
    }

    // Default: JSON.stringify with circular ref handling
    try {
      const resultStr = JSON.stringify(result, this.getCircularReplacer());
      return this.truncateString(resultStr, 200);
    } catch (error) {
      return '[Summary unavailable]';
    }
  }

  /**
   * Creates a file reference for step output
   */
  async createFileReference(
    options: CreateFileReferenceOptions
  ): Promise<FileReference> {
    const {
      stepName,
      content,
      workflowId,
      workflowName,
      saveToFile: initialSaveToFile,
      outputDir,
      stepNumber,
      modelName
    } = options;

    const id = `${workflowId}-${stepName}-${Date.now()}`;
    const summary = this.extractSummary(content);
    const sizeBytes = Buffer.byteLength(content, 'utf-8');

    let filePath: string | null = null;
    let _inMemoryContent: string | undefined = undefined;
    let saveToFile = initialSaveToFile;

    // Auto-promote large in-memory results to file (>1MB)
    if (!saveToFile && sizeBytes > 1_000_000) {
      console.error(`⚠️  Step ${stepName} output is ${sizeBytes} bytes - forcing file save`);
      saveToFile = true;
    }

    if (saveToFile && outputDir) {
      // Save to file with step number and datetime
      const safeStepName = stepName.replace(/[^a-zA-Z0-9_-]/g, '_');

      // Generate datetime string: YYYY-MM-DD-HH-MM-SS-DayName
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[now.getDay()];
      const datetime = `${year}-${month}-${day}-${hours}-${minutes}-${seconds}-${dayName}`;

      // Sanitize model name for filename (remove special chars, keep alphanumeric and hyphens)
      const safeModelName = modelName ? modelName.replace(/[^a-zA-Z0-9-]/g, '-') : undefined;

      // Build filename: {stepNumber}-{stepName}-{modelName}-{datetime}.md
      const filenamePrefix = stepNumber ? `${stepNumber}-` : '';
      const modelSuffix = safeModelName ? `-${safeModelName}` : '';
      const filename = `${filenamePrefix}${safeStepName}${modelSuffix}-${datetime}.md`;
      filePath = path.join(outputDir, filename);

      try {
        // Format as markdown with metadata
        const metadataLines = [
          `# ${stepName}`,
          '',
          `**Workflow:** ${workflowName}`,
          `**Workflow ID:** ${workflowId}`,
          `**Timestamp:** ${new Date().toISOString()}`,
          `**Size:** ${sizeBytes} bytes`,
          ...(modelName ? [`**Model:** ${modelName}`] : []),
          '',
          '## Output',
          '',
          content,
          ''
        ];

        await fsPromises.writeFile(filePath, metadataLines.join('\n'));
        console.error(`💾 Saved step output to: ${filePath}`);
      } catch (error) {
        console.error(`⚠️  File save failed for ${stepName}, falling back to in-memory:`, error);
        filePath = null;
        _inMemoryContent = content;
      }
    } else {
      // Keep in memory
      _inMemoryContent = content;
    }

    // Create lazy loader with caching
    let _cachedContent: string | null = null;
    const getContent = async (): Promise<string> => {
      // Return cached content if available
      if (_cachedContent) return _cachedContent;

      if (filePath) {
        try {
          const markdown = await fsPromises.readFile(filePath, 'utf-8');
          // Extract content from markdown (skip metadata)
          const outputMatch = markdown.match(/## Output\s*\n\n([\s\S]*)/);
          _cachedContent = outputMatch ? outputMatch[1].trim() : markdown;
          return _cachedContent;
        } catch (error) {
          throw new Error(`Failed to load content from ${filePath}: ${error}`);
        }
      }
      if (_inMemoryContent !== undefined) {
        _cachedContent = _inMemoryContent;
        return _cachedContent;
      }
      throw new Error(`No content available for step ${stepName}`);
    };

    return {
      id,
      stepName,
      summary,
      filePath,
      sizeBytes,
      getContent,
      _inMemoryContent
    };
  }

  /**
   * Initializes output directory for workflow execution
   */
  async initializeOutputDirectory(
    workflowName: string,
    workflowId: string,
    query: string
  ): Promise<string> {
    const outputDir = path.join(process.cwd(), 'workflow-output', workflowName, workflowId);

    try {
      await fsPromises.mkdir(outputDir, { recursive: true });

      // Create initial manifest
      const manifest: WorkflowManifest = {
        workflowId,
        workflowName,
        startTime: new Date().toISOString(),
        endTime: null,
        status: 'running',
        query,
        steps: []
      };

      await fsPromises.writeFile(
        path.join(outputDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
      );

      console.error(`📁 Workflow output directory: ${outputDir}`);
      return outputDir;
    } catch (error) {
      console.error('⚠️  Failed to initialize workflow directory:', error);
      throw error;
    }
  }

  /**
   * Updates workflow manifest with step status
   */
  async updateManifest(
    outputDir: string,
    stepId: string,
    status: 'running' | 'completed' | 'failed',
    outputFile?: string,
    error?: string
  ): Promise<void> {
    const manifestPath = path.join(outputDir, 'manifest.json');

    try {
      const data = await fsPromises.readFile(manifestPath, 'utf-8');
      const manifest: WorkflowManifest = JSON.parse(data);

      // Update or add step
      const existingIdx = manifest.steps.findIndex(s => s.id === stepId);
      const stepData = {
        id: stepId,
        status,
        outputFile,
        error,
        timestamp: new Date().toISOString()
      };

      if (existingIdx >= 0) {
        manifest.steps[existingIdx] = stepData;
      } else {
        manifest.steps.push(stepData);
      }

      // Update workflow status
      const allCompleted = manifest.steps.every(s => s.status === 'completed');
      const anyFailed = manifest.steps.some(s => s.status === 'failed');

      if (anyFailed) {
        manifest.status = 'failed';
        manifest.endTime = new Date().toISOString();
      } else if (allCompleted) {
        manifest.status = 'completed';
        manifest.endTime = new Date().toISOString();
      }

      await fsPromises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    } catch (error) {
      console.error('Failed to update manifest:', error);
      // Don't throw - manifest updates are not critical
    }
  }

  /**
   * Unicode-safe truncation helper
   */
  private truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
      return str;
    }

    // Use Array.from() for Unicode safety (handles emoji, multi-byte chars)
    const chars = Array.from(str);
    if (chars.length <= maxLength) {
      return str;
    }

    return chars.slice(0, maxLength).join('') + '...';
  }

  /**
   * Circular reference replacer for JSON.stringify
   */
  private getCircularReplacer() {
    const seen = new WeakSet();
    return (key: string, value: any) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    };
  }
}
