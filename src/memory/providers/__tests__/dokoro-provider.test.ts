/**
 * DokoroProvider — file-backed dokoro workspace integration.
 *
 * Verifies:
 *   1. store() writes a real markdown file with YAML frontmatter into
 *      <dokoroPath>/sessions/ following the dokoro naming convention.
 *   2. retrieve() finds items via case-insensitive text search over
 *      title + body, and reads files from daily/ too.
 *   3. update()/delete() operate on the underlying files.
 *   4. Initialization falls back to in-memory storage when the workspace
 *      path is not writable (graceful degradation, no throw).
 */

import { DokoroProvider } from '../dokoro-provider.js';
import { MemoryItem } from '../../memory-config.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';

function makeItem(overrides: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    content: 'Decided to use file-backed storage for dokoro memories.',
    tier: 'session',
    timestamp: new Date(),
    metadata: { title: 'Storage decision' },
    tags: ['architecture'],
    ...overrides
  };
}

describe('DokoroProvider (file-backed)', () => {
  let workspace: string;
  let provider: DokoroProvider;

  beforeEach(async () => {
    workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'dokoro-provider-test-'));
    provider = new DokoroProvider({ connectionString: workspace });
    await provider.initialize();
  });

  afterEach(async () => {
    await provider.close();
    await fs.rm(workspace, { recursive: true, force: true });
  });

  it('store() writes a markdown file with YAML frontmatter into sessions/', async () => {
    const id = await provider.store(makeItem());

    const filePath = path.join(workspace, 'sessions', `${id}.md`);
    const raw = await fs.readFile(filePath, 'utf-8');

    expect(id).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}h\d{2}m-[a-z]+-memory-/);

    const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
    expect(match).not.toBeNull();
    const frontmatter = yaml.parse(match![1]);

    expect(frontmatter.title).toBe('Storage decision');
    expect(frontmatter.type).toBe('memory');
    expect(frontmatter.provider).toBe('tachibot');
    expect(frontmatter.tier).toBe('session');
    expect(frontmatter.tags).toContain('tachibot');
    expect(frontmatter.tags).toContain('architecture');
    expect(new Date(frontmatter.date).getTime()).not.toBeNaN();
    expect(raw).toContain('Decided to use file-backed storage');
  });

  it('retrieve() finds stored items by case-insensitive text search', async () => {
    await provider.store(makeItem({ content: 'Refactored the embedding pipeline.' }));
    await provider.store(makeItem({
      content: 'Unrelated note about lunch.',
      metadata: { title: 'Lunch' }
    }));

    const results = await provider.retrieve({ text: 'EMBEDDING' });
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('embedding pipeline');

    // Title is searched too
    const byTitle = await provider.retrieve({ text: 'lunch' });
    expect(byTitle.length).toBeGreaterThanOrEqual(1);
  });

  it('retrieve() includes markdown files from daily/', async () => {
    const dailyDir = path.join(workspace, 'daily');
    await fs.mkdir(dailyDir, { recursive: true });
    await fs.writeFile(
      path.join(dailyDir, '2026-06-11-10h00m-thursday-plan-test.md'),
      '---\ntitle: "Plan: test"\ndate: "2026-06-11T10:00:00.000Z"\ntype: "plan"\ntags:\n  type: plan\n---\n\nPlan body about quaternions.\n',
      'utf-8'
    );

    const results = await provider.retrieve({ text: 'quaternions' });
    expect(results).toHaveLength(1);
    expect(results[0].tags).toContain('type:plan');
  });

  it('update() rewrites the underlying file and delete() removes it', async () => {
    const id = await provider.store(makeItem());
    const filePath = path.join(workspace, 'sessions', `${id}.md`);

    expect(await provider.update(id, { content: 'Updated content here.' })).toBe(true);
    expect(await fs.readFile(filePath, 'utf-8')).toContain('Updated content here.');

    expect(await provider.delete(id)).toBe(true);
    await expect(fs.access(filePath)).rejects.toThrow();
    expect(await provider.delete(id)).toBe(false);
  });

  it('falls back to in-memory storage when the workspace is unwritable', async () => {
    // A file (not a directory) at the workspace path makes mkdir fail
    const blocked = path.join(workspace, 'blocked');
    await fs.writeFile(blocked, 'not a directory', 'utf-8');

    const degraded = new DokoroProvider({ connectionString: blocked });
    await expect(degraded.initialize()).resolves.toBeUndefined();

    const id = await degraded.store(makeItem({ content: 'fallback item' }));
    expect(id).toBeTruthy();
    const results = await degraded.retrieve({ text: 'fallback' });
    expect(results).toHaveLength(1);

    await degraded.close();
  });
});
