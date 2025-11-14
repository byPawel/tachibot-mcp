/**
 * Tool configuration manager with profile support
 * Allows disabling specific tools via config file or environment variables
 *
 * Precedence (highest to lowest):
 * 1. customProfile.enabled = true in tools.config.json
 * 2. TACHIBOT_PROFILE environment variable
 * 3. activeProfile in tools.config.json
 * 4. Fallback: all tools enabled
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ToolConfig {
  description?: string;
  activeProfile?: string;
  profiles?: Record<string, ProfileConfig>;
  customProfile?: CustomProfileConfig;
  tools?: Record<string, boolean>;
}

interface ProfileConfig {
  description?: string;
  tools: Record<string, boolean>;
}

interface CustomProfileConfig {
  description?: string;
  enabled: boolean;
  tools: Record<string, boolean>;
}

let toolConfig: ToolConfig = { tools: {} };
let activeTools: Record<string, boolean> = {};
let profileSource: string = 'default';

/**
 * Load a profile from the profiles/ directory
 */
function loadProfileFromFile(profileName: string): ProfileConfig | null {
  try {
    const profilePath = join(__dirname, '../../../profiles', `${profileName}.json`);
    if (existsSync(profilePath)) {
      const content = readFileSync(profilePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn(`⚠️ Could not load profile '${profileName}' from profiles/ directory`);
  }
  return null;
}

// Load config once at startup
try {
  // Use __dirname to find config relative to source code location, not cwd
  // When built: dist/src/utils/tool-config.js -> go up 3 levels to project root
  const configPath = join(__dirname, '../../../tools.config.json');
  if (existsSync(configPath)) {
    const configContent = readFileSync(configPath, 'utf-8');
    toolConfig = JSON.parse(configContent);

    // Priority 1: Custom profile enabled in tools.config.json
    if (toolConfig.customProfile?.enabled) {
      activeTools = toolConfig.customProfile.tools;
      profileSource = 'custom';
      console.error(`📋 Using custom profile from tools.config.json`);
    }
    // Priority 2: TACHIBOT_PROFILE environment variable
    else if (process.env.TACHIBOT_PROFILE) {
      const envProfile = process.env.TACHIBOT_PROFILE;
      const profile = loadProfileFromFile(envProfile);
      if (profile) {
        activeTools = profile.tools;
        profileSource = envProfile;
        console.error(`📋 Using profile '${envProfile}' from TACHIBOT_PROFILE env var`);
        console.error(`   ${profile.description}`);
      } else {
        console.warn(`⚠️ Profile '${envProfile}' not found, falling back to activeProfile`);
        // Fall through to next priority
      }
    }

    // Priority 3: activeProfile in tools.config.json
    if (!activeTools || Object.keys(activeTools).length === 0) {
      if (toolConfig.activeProfile) {
        // Try to load from profiles/ directory first (new structure)
        const profile = loadProfileFromFile(toolConfig.activeProfile);
        if (profile) {
          activeTools = profile.tools;
          profileSource = toolConfig.activeProfile;
          console.error(`📋 Using profile '${toolConfig.activeProfile}': ${profile.description}`);
        }
        // Fall back to embedded profile in tools.config.json (legacy)
        else if (toolConfig.profiles?.[toolConfig.activeProfile]) {
          const profile = toolConfig.profiles[toolConfig.activeProfile];
          activeTools = profile.tools;
          profileSource = toolConfig.activeProfile;
          console.error(`📋 Using profile '${toolConfig.activeProfile}' from tools.config.json (legacy)`);
          console.error(`   ${profile.description}`);
        }
      } else if (toolConfig.tools) {
        // Fallback to legacy flat tools config
        activeTools = toolConfig.tools;
        profileSource = 'legacy';
        console.error(`📋 Using legacy flat configuration from tools.config.json`);
      }
    }
  }

  // Final fallback: all tools enabled
  if (!activeTools || Object.keys(activeTools).length === 0) {
    console.warn(`⚠️ No valid configuration found, all tools enabled by default`);
    profileSource = 'default';
  }
} catch (error) {
  console.warn(`⚠️ Could not load tools.config.json, all tools enabled by default`);
  profileSource = 'default';
}

/**
 * Check if a tool should be registered
 * Priority: Environment variables > Profile config > Default (enabled)
 */
export function isToolEnabled(toolName: string): boolean {
  // Environment variable override (highest priority)
  const envEnable = process.env[`ENABLE_TOOL_${toolName.toUpperCase()}`];
  if (envEnable === 'true') return true;

  const envDisable = process.env[`DISABLE_TOOL_${toolName.toUpperCase()}`];
  if (envDisable === 'true') return false;

  // Check if globally disabled
  if (process.env.DISABLE_ALL_TOOLS === 'true') return false;

  // Check active profile
  const toolStatus = activeTools[toolName];

  // If no profile loaded (default mode), enable all tools
  if (profileSource === 'default') {
    return true;
  }

  // Simple rule: If tool not in profile config, it's DISABLED
  // Profiles are explicit allowlists - if it's not listed, it's off
  if (toolStatus === undefined) {
    return false;
  }

  // Use the config value
  if (!toolStatus) {
    console.error(`   ⏭️  Skipping ${toolName} (disabled in profile)`);
  }

  return toolStatus;
}

/**
 * Get list of disabled tools for logging
 */
export function getDisabledTools(): string[] {
  if (!activeTools) return [];

  return Object.entries(activeTools)
    .filter(([_, enabled]) => !enabled)
    .map(([name]) => name);
}

/**
 * Get list of enabled tools for logging
 */
export function getEnabledTools(): string[] {
  if (!activeTools) return [];

  return Object.entries(activeTools)
    .filter(([_, enabled]) => enabled)
    .map(([name]) => name);
}

/**
 * Get active profile info
 */
export function getActiveProfile(): { name: string; description?: string } | null {
  if (profileSource === 'default') {
    return null;
  }

  if (profileSource === 'custom') {
    return {
      name: 'custom',
      description: toolConfig.customProfile?.description
    };
  }

  if (profileSource === 'legacy') {
    return {
      name: 'legacy',
      description: 'Legacy flat configuration'
    };
  }

  // For named profiles, try to get description
  const profile = loadProfileFromFile(profileSource);
  return {
    name: profileSource,
    description: profile?.description
  };
}

/**
 * Log configuration summary
 */
export function logToolConfiguration(): void {
  const profile = getActiveProfile();
  if (profile) {
    console.error(`🎯 Active profile: ${profile.name}`);
    if (profile.description) {
      console.error(`   ${profile.description}`);
    }
  }

  const disabled = getDisabledTools();
  if (disabled.length > 0) {
    console.error(`🚫 Disabled tools: ${disabled.join(', ')}`);
  }

  // Check for environment overrides
  const envVars = Object.keys(process.env);
  const toolOverrides = envVars.filter(key =>
    key.startsWith('ENABLE_TOOL_') || key.startsWith('DISABLE_TOOL_')
  );

  if (toolOverrides.length > 0) {
    console.error(`🔧 Environment overrides active: ${toolOverrides.join(', ')}`);
  }
}
