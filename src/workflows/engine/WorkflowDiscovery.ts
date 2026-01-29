/**
 * Workflow Discovery
 * Handles loading workflows from filesystem (built-in, user, project locations)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { getConfigDir } from '../../utils/paths.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Workflow } from '../workflow-types.js';

export interface ValidationError {
  file: string;
  source: string;
  error: string;
}

export interface WorkflowDiscoveryOptions {
  packageRoot: string;
  workflowSchema: any; // Zod schema
  preprocessVariables: (data: any, variables: Record<string, any>) => any;
}

export class WorkflowDiscovery {
  private workflows: Map<string, Workflow> = new Map();
  private validationErrors: ValidationError[] = [];
  private options: WorkflowDiscoveryOptions;

  constructor(options: WorkflowDiscoveryOptions) {
    this.options = options;
  }

  /**
   * Load workflows from all discovery locations
   * Priority: Built-in → User → Project (later overrides earlier)
   */
  discoverWorkflows(): { workflows: Map<string, Workflow>; errors: ValidationError[] } {
    const configDirs = [
      // Priority 1: Built-in workflows (shipped with package)
      {
        path: path.join(this.options.packageRoot, 'workflows'),
        label: 'Built-in',
      },

      // Priority 2: User personal (survives updates) — XDG Base Directory compliant
      {
        path: path.join(getConfigDir(), 'workflows'),
        label: 'User',
      },

      // Priority 3: Project-specific (git-committed, team-shared)
      {
        path: path.join(process.cwd(), '.tachibot', 'workflows'),
        label: 'Project',
      },
    ];

    for (const { path: dir, label } of configDirs) {
      if (!fs.existsSync(dir)) {
        console.error(`📂 [${label}] Skipping: ${dir} (not found)`);
        continue;
      }

      console.error(`📂 [${label}] Loading workflows from: ${dir}`);
      this.loadWorkflowsFromDirectory(dir, label, 0);
    }

    console.error(`✅ Total workflows loaded: ${this.workflows.size}`);

    return {
      workflows: this.workflows,
      errors: this.validationErrors
    };
  }

  /**
   * Recursively load workflows from directory (max 4 levels deep)
   */
  private loadWorkflowsFromDirectory(
    dir: string,
    source: string,
    depth: number,
    maxDepth: number = 4
  ): void {
    if (depth >= maxDepth) {
      console.error(`⚠️  [${source}] Max depth (${maxDepth}) reached in: ${dir}`);
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recurse into subdirectories
        this.loadWorkflowsFromDirectory(fullPath, source, depth + 1, maxDepth);
      } else if (entry.isFile() && entry.name.match(/\.(yaml|yml|json)$/)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const data = entry.name.endsWith('.json')
            ? JSON.parse(content)
            : yaml.parse(content);

          const variables = data.variables || {};
          const preprocessed = this.options.preprocessVariables(data, variables);
          const workflow = this.options.workflowSchema.parse(preprocessed);

          // Later sources override earlier ones (Project > User > Built-in)
          if (this.workflows.has(workflow.name)) {
            console.error(`🔄 [${source}] Overriding: ${workflow.name}`);
          }

          this.workflows.set(workflow.name, workflow);
          console.error(`✅ [${source}] Loaded: ${workflow.name} from ${entry.name}`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.validationErrors.push({
            file: entry.name,
            source,
            error: errorMsg,
          });
          console.error(`❌ [${source}] Failed to load ${entry.name}:`, error);
        }
      }
    }
  }

  /**
   * Load workflow from arbitrary file path
   */
  loadWorkflowFile(filePath: string): Workflow {
    // Resolve relative paths
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Workflow file not found: ${resolvedPath}`);
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const data = resolvedPath.endsWith('.json')
      ? JSON.parse(content)
      : yaml.parse(content);

    const variables = data.variables || {};
    const preprocessed = this.options.preprocessVariables(data, variables);
    const workflow = this.options.workflowSchema.parse(preprocessed);

    return workflow;
  }

  /**
   * Get package root from import.meta.url
   */
  static getPackageRoot(): string {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // Up to tachibot-mcp/ (dist/src/workflows/engine -> dist/src/workflows -> dist/src -> dist -> root)
    return path.join(__dirname, '..', '..', '..', '..');
  }
}
