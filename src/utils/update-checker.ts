/**
 * Update Checker - Notifies users when a new version is available
 *
 * Modern TypeScript implementation:
 * - Native fetch (Node 18+)
 * - fs/promises for async I/O
 * - AbortController for timeouts
 * - XDG Base Directory spec for config
 * - Non-blocking, fail silently
 * - Opt-out via NO_UPDATE_CHECK=1
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// --- Constants ---
const PKG_NAME = 'tachibot-mcp';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 1500; // 1.5s timeout

// --- Types ---
interface NpmRegistryResponse {
  'dist-tags': {
    latest: string;
    [key: string]: string;
  };
}

interface UpdateCache {
  lastChecked: number;
  latestVersion: string;
  hasUpdate: boolean;
}

// --- Utilities ---

/** Get XDG-compliant config directory */
const getConfigDir = (): string => {
  const configDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configDir, PKG_NAME);
};

/** Get cache file path */
const getCacheFilePath = (): string => path.join(getConfigDir(), 'update-cache.json');

/** Get local version from package.json */
const getLocalVersion = (): string => {
  try {
    const pkg = require('../../../package.json');
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
};

/** Simple semver comparison (without external deps) */
const isNewerVersion = (latest: string, current: string): boolean => {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const [l, c] = [parse(latest), parse(current)];

  for (let i = 0; i < 3; i++) {
    if ((l[i] || 0) > (c[i] || 0)) return true;
    if ((l[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
};

// --- Cache Operations ---

async function readCache(): Promise<UpdateCache | null> {
  try {
    const data = await fs.readFile(getCacheFilePath(), 'utf-8');
    return JSON.parse(data) as UpdateCache;
  } catch {
    return null;
  }
}

async function writeCache(cache: UpdateCache): Promise<void> {
  try {
    const cacheDir = getConfigDir();
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(getCacheFilePath(), JSON.stringify(cache, null, 2));
  } catch {
    // Ignore write errors (permissions, disk full, etc.)
  }
}

// --- Network Operations ---

async function fetchLatestVersion(): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`https://registry.npmjs.org/${PKG_NAME}`, {
      signal: controller.signal,
      headers: {
        // Fetch abbreviated manifest (smaller payload)
        'Accept': 'application/vnd.npm.install-v1+json'
      }
    });

    if (!res.ok) return null;

    const data = await res.json() as NpmRegistryResponse;
    return data['dist-tags']?.latest || null;
  } catch {
    return null; // Network error, timeout, or aborted
  } finally {
    clearTimeout(timeout);
  }
}

// --- Public API ---

/**
 * Check for updates and display notification if available.
 * Non-blocking, fails silently.
 */
export async function checkForUpdates(): Promise<void> {
  // Opt-out check
  if (process.env.NO_UPDATE_CHECK === '1' || process.env.NO_UPDATE_CHECK === 'true') {
    return;
  }

  try {
    const localVersion = getLocalVersion();
    const now = Date.now();
    let cache = await readCache();

    // Refresh cache if stale
    if (!cache || (now - cache.lastChecked > CACHE_TTL_MS)) {
      const latestVersion = await fetchLatestVersion();
      if (latestVersion) {
        cache = {
          lastChecked: now,
          latestVersion,
          hasUpdate: isNewerVersion(latestVersion, localVersion)
        };
        await writeCache(cache);
      }
    }

    // Show update notification
    if (cache?.hasUpdate) {
      console.error('');
      console.error(`\x1b[33m🦾 🤖 🎮 TachiBot leveled up! ${localVersion} → ${cache.latestVersion}\x1b[0m`);
      console.error(`\x1b[90m   npm update -g ${PKG_NAME}  ← unlock new powers\x1b[0m`);
      console.error('');
    }
  } catch {
    // Fail silently - update check should never break the tool
  }
}

/**
 * Get update status for programmatic use (e.g., status command)
 */
export async function getUpdateStatus(): Promise<{
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  lastChecked: Date | null;
}> {
  const localVersion = getLocalVersion();
  const now = Date.now();
  let cache = await readCache();

  // Refresh cache if stale
  if (!cache || (now - cache.lastChecked > CACHE_TTL_MS)) {
    const latestVersion = await fetchLatestVersion();
    if (latestVersion) {
      cache = {
        lastChecked: now,
        latestVersion,
        hasUpdate: isNewerVersion(latestVersion, localVersion)
      };
      await writeCache(cache);
    }
  }

  return {
    currentVersion: localVersion,
    latestVersion: cache?.latestVersion || null,
    updateAvailable: cache?.hasUpdate || false,
    lastChecked: cache?.lastChecked ? new Date(cache.lastChecked) : null
  };
}
