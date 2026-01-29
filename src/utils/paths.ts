/**
 * Centralized cross-platform path resolution.
 * Single source of truth for all tachibot home directory paths.
 *
 * Uses env-paths for platform-native directories:
 * - Linux:   ~/.config/tachibot, ~/.local/share/tachibot, ~/.cache/tachibot
 * - macOS:   ~/Library/Preferences/tachibot, ~/Library/Application Support/tachibot
 * - Windows: %APPDATA%/tachibot, %LOCALAPPDATA%/tachibot
 *
 * XDG env vars (XDG_CONFIG_HOME, XDG_DATA_HOME, XDG_CACHE_HOME) override on all platforms.
 */

import envPaths from 'env-paths';

const paths = envPaths('tachibot', { suffix: '' });

/** User config dir — settings, workflows, profiles */
export function getConfigDir(): string {
  return paths.config;
}

/** User data dir — usage stats, session history */
export function getDataDir(): string {
  return paths.data;
}

/** User cache dir — temporary/disposable data */
export function getCacheDir(): string {
  return paths.cache;
}
