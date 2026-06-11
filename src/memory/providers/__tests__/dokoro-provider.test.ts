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
  let savedDokoroProject: string | undefined;
  let savedDokoroConnection: string | undefined;

  beforeAll(() => {
    // DOKORO_PROJECT would inject a projectId into untagged files (skewing
    // the project-filter assertions) and DOKORO_CONNECTION would override
    // DOKORO_PATH in the env-resolution test
    savedDokoroProject = process.env.DOKORO_PROJECT;
    savedDokoroConnection = process.env.DOKORO_CONNECTION;
    delete process.env.DOKORO_PROJECT;
    delete process.env.DOKORO_CONNECTION;
  });

  afterAll(() => {
    if (savedDokoroProject !== undefined) {
      process.env.DOKORO_PROJECT = savedDokoroProject;
    }
    if (savedDokoroConnection !== undefined) {
      process.env.DOKORO_CONNECTION = savedDokoroConnection;
    }
  });

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

  it('store() syncs the file-backed id onto the caller\'s item', async () => {
    const item = makeItem();
    const preStoreId = item.id;

    const returnedId = await provider.store(item);

    expect(item.id).toBe(returnedId);
    expect(item.id).not.toBe(preStoreId);

    // Callers holding the item (not the return value) can update/delete
    expect(await provider.update(item.id, { content: 'Synced-id update.' })).toBe(true);
    const filePath = path.join(workspace, 'sessions', `${item.id}.md`);
    expect(await fs.readFile(filePath, 'utf-8')).toContain('Synced-id update.');

    expect(await provider.delete(item.id)).toBe(true);
    await expect(fs.access(filePath)).rejects.toThrow();
  });

  it('flips to in-memory mode when a write fails mid-session', async () => {
    // Stub the write helper (chmod-based simulation is flaky on CI)
    (provider as any).writeMemoryFile = async () => {
      throw new Error('disk full (simulated)');
    };

    const item = makeItem({ content: 'survives the simulated disk failure' });
    const id = await provider.store(item);
    expect(id).toBe(item.id);

    // retrieve() must switch modes together with store(): the item is
    // findable, and no file was written
    const results = await provider.retrieve({ text: 'simulated disk failure' });
    expect(results).toHaveLength(1);
    const files = await fs.readdir(path.join(workspace, 'sessions'));
    expect(files).toHaveLength(0);

    // update/delete operate on the fallback store too
    expect(await provider.update(id, { content: 'updated in fallback' })).toBe(true);
    expect(await provider.delete(id)).toBe(true);
  });

  it('project filter is lenient by default and exact-match with strictProjectFilter', async () => {
    await provider.store(makeItem({ content: 'tagged alpha memory', projectId: 'alpha' }));
    await provider.store(makeItem({ content: 'tagged beta memory', projectId: 'beta' }));
    await provider.store(makeItem({ content: 'untagged workspace note' }));

    // Lenient default: matching project + untagged files; other projects excluded
    const lenient = await provider.retrieve({ projectId: 'alpha' });
    const lenientContents = lenient.map(i => i.content);
    expect(lenientContents).toEqual(
      expect.arrayContaining(['tagged alpha memory', 'untagged workspace note'])
    );
    expect(lenientContents).not.toContain('tagged beta memory');

    // Strict mode: exact match only
    const strict = new DokoroProvider({ connectionString: workspace, strictProjectFilter: true });
    await strict.initialize();
    const strictResults = await strict.retrieve({ projectId: 'alpha' });
    expect(strictResults.map(i => i.content)).toEqual(['tagged alpha memory']);
    await strict.close();
  });

  it('explicit-undefined config fields do not clobber env/default resolution', async () => {
    const saved = process.env.DOKORO_PATH;
    process.env.DOKORO_PATH = workspace;
    try {
      const fromEnv = new DokoroProvider({ connectionString: undefined, workspace: undefined });
      await fromEnv.initialize();

      const id = await fromEnv.store(makeItem({ content: 'resolved via env' }));
      await expect(
        fs.access(path.join(workspace, 'sessions', `${id}.md`))
      ).resolves.toBeUndefined();
      await fromEnv.close();
    } finally {
      if (saved !== undefined) {
        process.env.DOKORO_PATH = saved;
      } else {
        delete process.env.DOKORO_PATH;
      }
    }
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
