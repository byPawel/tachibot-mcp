/**
 * Dokoro Memory Provider
 *
 * File-backed integration with a dokoro workspace. dokoro is a local-first,
 * per-project agent-memory system: there is no client library and no network
 * endpoint — its workspace is a folder of markdown files with YAML frontmatter.
 *
 * Resolution convention (same as planner-tools.ts):
 *   connectionString (treated as DOKORO_PATH override)
 *   || process.env.DOKORO_PATH
 *   || {cwd}/dokoro
 *
 * Memories are written to <dokoroPath>/sessions/ as markdown files; reads
 * cover both <dokoroPath>/sessions/ and <dokoroPath>/daily/.
 *
 * If the workspace folder cannot be created/written, the provider degrades
 * to an in-memory store (never throws out of the provider for storage issues).
 */

import { BaseMemoryProvider } from '../memory-interface.js';
import {
  MemoryItem,
  MemoryQuery,
  DokoroConfig,
  MemoryTier
} from '../memory-config.js';
import * as fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

const MEMORY_TIERS: MemoryTier[] = ['session', 'working', 'project', 'team', 'global'];

/**
 * Dokoro provider implementation (file-backed)
 */
export class DokoroProvider extends BaseMemoryProvider {
  readonly name = 'dokoro';
  private config: DokoroConfig;
  private dokoroPath: string;
  private sessionsDir: string;
  private dailyDir: string;
  private fileBacked: boolean = false;
  private fallbackStore: Map<string, MemoryItem> = new Map();

  constructor(config: DokoroConfig) {
    super();
    this.config = {
      connectionString: config.connectionString || process.env.DOKORO_CONNECTION,
      workspace: config.workspace || process.env.DOKORO_WORKSPACE || 'default',
      projectId: config.projectId || process.env.DOKORO_PROJECT,
      enableSync: config.enableSync !== false,
      ...config
    };

    // connectionString acts as a DOKORO_PATH override; same resolution
    // convention as planner-tools.ts getDokoroDailyDir().
    this.dokoroPath = path.resolve(
      this.config.connectionString ||
      process.env.DOKORO_PATH ||
      path.join(process.cwd(), 'dokoro')
    );
    this.sessionsDir = path.join(this.dokoroPath, 'sessions');
    this.dailyDir = path.join(this.dokoroPath, 'daily');
  }

  protected async doInitialize(): Promise<void> {
    try {
      await fs.mkdir(this.sessionsDir, { recursive: true });
      await fs.access(this.sessionsDir, fsConstants.W_OK);
      this.fileBacked = true;
      console.error(`Dokoro provider: file-backed at ${this.dokoroPath}`);
    } catch (error) {
      this.fileBacked = false;
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `Dokoro provider: workspace unavailable at ${this.dokoroPath}, using in-memory fallback (${message})`
      );
    }
  }

  async store(item: MemoryItem): Promise<string> {
    if (!item.id) {
      item.id = this.generateId();
    }
    if (!item.timestamp) {
      item.timestamp = new Date();
    }

    if (this.fileBacked) {
      try {
        const filePath = await this.writeMemoryFile(item);
        this.metrics.totalItems++;
        this.metrics.itemsByTier[item.tier]++;
        // The file basename (without .md) is the durable id for file-backed items
        return path.basename(filePath, '.md');
      } catch (error) {
        console.error('Dokoro provider: failed to write memory file, storing in memory:', error);
      }
    }

    this.fallbackStore.set(item.id, item);
    this.metrics.totalItems++;
    this.metrics.itemsByTier[item.tier]++;
    return item.id;
  }

  async retrieve(query: MemoryQuery): Promise<MemoryItem[]> {
    const startTime = Date.now();

    const items = this.fileBacked
      ? await this.readAllMemoryFiles()
      : Array.from(this.fallbackStore.values());

    const results = this.applyQuery(items, query);

    // Update metrics
    const retrievalTime = Date.now() - startTime;
    this.metrics.avgRetrievalTime =
      (this.metrics.avgRetrievalTime + retrievalTime) / 2;

    // Update access counts (in-memory only; not persisted back to files)
    results.forEach(item => {
      item.accessCount = (item.accessCount || 0) + 1;
      item.lastAccessed = new Date();
    });

    return results;
  }

  async update(id: string, updates: Partial<MemoryItem>): Promise<boolean> {
    if (!this.fileBacked) {
      const item = this.fallbackStore.get(id);
      if (!item) return false;
      Object.assign(item, updates, { id: item.id });
      return true;
    }

    try {
      const filePath = await this.findFileById(id);
      if (!filePath) return false;

      const item = await this.parseMemoryFile(filePath);
      if (!item) return false;

      Object.assign(item, updates, { id: item.id });
      await this.writeMemoryFile(item, filePath);
      return true;
    } catch (error) {
      console.error('Dokoro provider: failed to update memory file:', error);
      return false;
    }
  }

  async delete(id: string): Promise<boolean> {
    if (!this.fileBacked) {
      const item = this.fallbackStore.get(id);
      if (!item) return false;
      this.fallbackStore.delete(id);
      this.metrics.totalItems--;
      this.metrics.itemsByTier[item.tier]--;
      return true;
    }

    try {
      const filePath = await this.findFileById(id);
      if (!filePath) return false;

      const item = await this.parseMemoryFile(filePath);
      await fs.unlink(filePath);
      this.metrics.totalItems--;
      if (item) {
        this.metrics.itemsByTier[item.tier]--;
      }
      return true;
    } catch (error) {
      console.error('Dokoro provider: failed to delete memory file:', error);
      return false;
    }
  }

  async cleanup(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    const items = await this.export();
    for (const item of items) {
      if (item.ttl && item.ttl > 0) {
        const expiryTime = item.timestamp.getTime() + (item.ttl * 60 * 1000);
        if (now > expiryTime) {
          if (await this.delete(item.id)) {
            cleaned++;
          }
        }
      }
    }

    return cleaned;
  }

  async export(): Promise<MemoryItem[]> {
    if (this.fileBacked) {
      return await this.readAllMemoryFiles();
    }
    return Array.from(this.fallbackStore.values());
  }

  async import(items: MemoryItem[]): Promise<number> {
    let imported = 0;

    for (const item of items) {
      try {
        await this.store(item);
        imported++;
      } catch (error) {
        console.error(`Failed to import item ${item.id}:`, error);
      }
    }

    return imported;
  }

  async isAvailable(): Promise<boolean> {
    return this.initialized;
  }

  async close(): Promise<void> {
    this.fallbackStore.clear();
    await super.close();
  }

  /**
   * File helpers
   */

  /**
   * Write a MemoryItem as a dokoro markdown file (YAML frontmatter + body).
   * If targetPath is given, overwrites that file (update); otherwise a new
   * file is created in sessions/ with a collision-safe name.
   */
  private async writeMemoryFile(item: MemoryItem, targetPath?: string): Promise<string> {
    const filePath = targetPath || await this.nextAvailablePath(item);

    const tags = Array.from(new Set(['tachibot', ...(item.tags || [])]));
    const frontmatter: Record<string, unknown> = {
      title: this.titleFor(item),
      date: item.timestamp.toISOString(),
      type: (item.metadata?.kind as string) || 'memory',
      status: 'active',
      provider: 'tachibot',
      tier: item.tier,
      memoryId: item.id,
      tags
    };
    if (item.userId) frontmatter.userId = item.userId;
    if (item.projectId || this.config.projectId) {
      frontmatter.projectId = item.projectId || this.config.projectId;
    }
    if (item.teamId) frontmatter.teamId = item.teamId;
    if (item.ttl !== undefined) frontmatter.ttl = item.ttl;
    if (item.accessCount !== undefined) frontmatter.accessCount = item.accessCount;
    if (item.metadata && Object.keys(item.metadata).length > 0) {
      frontmatter.metadata = item.metadata;
    }

    const content = `---\n${yaml.stringify(frontmatter)}---\n\n${item.content}\n`;

    // Write to temp file then rename (atomic, mirrors local-provider.ts)
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, content, 'utf-8');
    await fs.rename(tempPath, filePath);

    return filePath;
  }

  /**
   * Build a collision-safe sessions/ path:
   * YYYY-MM-DD-HHhMMm-dayname-memory-<slug>.md (dokoro naming convention,
   * same pattern as planner-tools.ts generatePlanFilename).
   */
  private async nextAvailablePath(item: MemoryItem): Promise<string> {
    const ts = item.timestamp;
    const year = ts.getFullYear();
    const month = String(ts.getMonth() + 1).padStart(2, '0');
    const day = String(ts.getDate()).padStart(2, '0');
    const hours = String(ts.getHours()).padStart(2, '0');
    const minutes = String(ts.getMinutes()).padStart(2, '0');
    const dayName = ts.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    const slug = this.slugify(
      (item.metadata?.title as string) ||
      (item.metadata?.kind as string) ||
      item.content ||
      item.tier
    );

    const base = `${year}-${month}-${day}-${hours}h${minutes}m-${dayName}-memory-${slug}`;

    let candidate = path.join(this.sessionsDir, `${base}.md`);
    let counter = 2;
    while (await this.fileExists(candidate)) {
      candidate = path.join(this.sessionsDir, `${base}-${counter}.md`);
      counter++;
    }
    return candidate;
  }

  private slugify(text: string): string {
    return (
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 40) || 'item'
    );
  }

  private titleFor(item: MemoryItem): string {
    if (item.metadata?.title) return String(item.metadata.title);
    const firstLine = item.content.split('\n')[0].trim();
    if (firstLine) {
      return firstLine.length > 80 ? `${firstLine.substring(0, 77)}...` : firstLine;
    }
    return `Memory (${item.tier})`;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all markdown files in sessions/ and daily/.
   */
  private async listMemoryFiles(): Promise<string[]> {
    const files: string[] = [];
    for (const dir of [this.sessionsDir, this.dailyDir]) {
      try {
        const entries = await fs.readdir(dir);
        for (const entry of entries) {
          if (entry.endsWith('.md')) {
            files.push(path.join(dir, entry));
          }
        }
      } catch {
        // Directory missing (e.g. no daily/ yet) — skip silently
      }
    }
    return files;
  }

  private async readAllMemoryFiles(): Promise<MemoryItem[]> {
    const files = await this.listMemoryFiles();
    const items: MemoryItem[] = [];
    for (const filePath of files) {
      const item = await this.parseMemoryFile(filePath);
      if (item) {
        items.push(item);
      }
    }
    return items;
  }

  /**
   * Resolve a stored id (file basename without .md) back to its path.
   */
  private async findFileById(id: string): Promise<string | null> {
    const fileName = `${id}.md`;
    for (const dir of [this.sessionsDir, this.dailyDir]) {
      const candidate = path.join(dir, fileName);
      if (await this.fileExists(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  /**
   * Parse a dokoro markdown file (YAML frontmatter + body) into a MemoryItem.
   * Files without frontmatter are treated as plain content.
   */
  private async parseMemoryFile(filePath: string): Promise<MemoryItem | null> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      let frontmatter: Record<string, any> = {};
      let body = raw;

      const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
      if (match) {
        try {
          frontmatter = yaml.parse(match[1]) || {};
        } catch {
          frontmatter = {};
        }
        body = raw.slice(match[0].length);
      }

      const tier: MemoryTier = MEMORY_TIERS.includes(frontmatter.tier)
        ? frontmatter.tier
        : 'session';

      let timestamp: Date;
      if (frontmatter.date && !isNaN(Date.parse(frontmatter.date))) {
        timestamp = new Date(frontmatter.date);
      } else {
        const stats = await fs.stat(filePath);
        timestamp = stats.mtime;
      }

      const metadata: Record<string, any> = {
        ...(typeof frontmatter.metadata === 'object' && frontmatter.metadata !== null
          ? frontmatter.metadata
          : {}),
        sourceFile: filePath
      };
      if (frontmatter.title && metadata.title === undefined) {
        metadata.title = frontmatter.title;
      }
      if (frontmatter.type) metadata.kind = frontmatter.type;

      return {
        id: path.basename(filePath, '.md'),
        content: body.trim(),
        tier,
        userId: frontmatter.userId,
        projectId: frontmatter.projectId || this.config.projectId,
        teamId: frontmatter.teamId,
        timestamp,
        metadata,
        tags: this.normalizeTags(frontmatter.tags),
        ttl: typeof frontmatter.ttl === 'number' ? frontmatter.ttl : undefined,
        accessCount: typeof frontmatter.accessCount === 'number' ? frontmatter.accessCount : 0,
        lastAccessed: undefined
      };
    } catch (error) {
      console.error(`Dokoro provider: failed to parse ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Tags in dokoro files may be a YAML list or a map (e.g. plans use
   * `tags:\n  type: plan`). Normalize both to string arrays.
   */
  private normalizeTags(tags: unknown): string[] | undefined {
    if (Array.isArray(tags)) {
      return tags.map(t => String(t));
    }
    if (tags && typeof tags === 'object') {
      return Object.entries(tags).map(([key, value]) => `${key}:${value}`);
    }
    return undefined;
  }

  /**
   * Query filtering shared by file-backed and fallback modes.
   * Field filters (project/user/team) are lenient: items without the field
   * (e.g. plans in daily/ not written by tachibot) are not excluded.
   */
  private applyQuery(items: MemoryItem[], query: MemoryQuery): MemoryItem[] {
    let results = items;

    if (query.tiers && query.tiers.length > 0) {
      results = results.filter(item => query.tiers!.includes(item.tier));
    }

    if (query.projectId) {
      results = results.filter(item => !item.projectId || item.projectId === query.projectId);
    }
    if (query.userId) {
      results = results.filter(item => !item.userId || item.userId === query.userId);
    }
    if (query.teamId) {
      results = results.filter(item => !item.teamId || item.teamId === query.teamId);
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter(item =>
        item.tags && query.tags!.some(tag => item.tags!.includes(tag))
      );
    }

    if (query.startDate) {
      results = results.filter(item => item.timestamp >= query.startDate!);
    }
    if (query.endDate) {
      results = results.filter(item => item.timestamp <= query.endDate!);
    }

    // Case-insensitive substring match over title + body
    if (query.text) {
      const searchText = query.text.toLowerCase();
      results = results.filter(item => {
        const title = String(item.metadata?.title || '').toLowerCase();
        return (
          item.content.toLowerCase().includes(searchText) ||
          title.includes(searchText)
        );
      });
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (query.offset) {
      results = results.slice(query.offset);
    }
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }
}

/**
 * Factory function to create Dokoro provider
 */
export async function createDokoroProvider(config: DokoroConfig): Promise<DokoroProvider | null> {
  try {
    const provider = new DokoroProvider(config);
    await provider.initialize();
    return provider;
  } catch (error) {
    console.error('Failed to create Dokoro provider:', error);
    return null;
  }
}
