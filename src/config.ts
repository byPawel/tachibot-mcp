import { config } from 'dotenv';
import { TechnicalDomain } from './reasoning-chain.js';
import { getGrokApiKey } from './utils/api-keys.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the correct path (project root)
// When built: dist/src/config.js -> need to go up 2 levels to reach .env
config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Configuration loader for Focus MCP Server
 * Handles both Claude Code and Standalone modes
 */

export interface FocusConfig {
  // Mode detection
  isClaudeCode: boolean;
  claudeModel?: string;
  
  // API Keys (optional)
  apiKeys: {
    anthropic?: string;
    openai?: string;
    openrouter?: string;
    gemini?: string;
    deepseek?: string;
    perplexity?: string;
    grok?: string;
    qwen?: string;
  };
  
  // Preferences (with defaults)
  preferences: {
    defaultDomain?: TechnicalDomain;
    enableVisuals: boolean;
    costOptimization: boolean;
    maxReasoningRounds: number;
    maxPingPongRounds: number; // Maximum rounds for ping-pong brainstorming (user configurable)
    debug: boolean;
  };
  
  // Session Configuration
  session: {
    enableLogging: boolean;
    autoSave: boolean;
    defaultVerbose: boolean;
    sessionDir: string;
    outputFormat: 'markdown' | 'json' | 'html';
    includeMetadata: boolean;
    maxHistory: number;
  };

  // Workflow Configuration
  workflow: {
    outputDir: string; // Base directory for all workflow outputs
  };
}

/**
 * Detect if running in Claude Code environment
 */
function detectClaudeCode(): boolean {
  return !!(
    process.env.CLAUDE_CODE_SESSION ||
    process.env.ANTHROPIC_SESSION_ID ||
    process.env.CLAUDE_CODE_ACTIVE ||
    process.env.CLAUDE_PROJECT_ROOT ||
    process.env.CLAUDE_WORKSPACE ||
    // Check if we're in Claude Code by looking for specific patterns
    (process.env.USER?.includes('claude') && process.env.HOME?.includes('claude'))
  );
}

/**
 * Detect active Claude model
 */
function detectClaudeModel(): string | undefined {
  const model = process.env.CLAUDE_MODEL || 
                process.env.ANTHROPIC_MODEL ||
                process.env.CLAUDE_CODE_MODEL;
  
  if (model) {
    if (model.includes('opus')) return 'opus-4.1';
    if (model.includes('sonnet')) return 'sonnet-4';
  }
  
  return undefined;
}

/**
 * Parse technical domain from string
 */
function parseDomain(domain?: string): TechnicalDomain | undefined {
  if (!domain) return undefined;
  
  const domainMap: Record<string, TechnicalDomain> = {
    'architecture': TechnicalDomain.ARCHITECTURE,
    'algorithms': TechnicalDomain.ALGORITHMS,
    'debugging': TechnicalDomain.DEBUGGING,
    'security': TechnicalDomain.SECURITY,
    'performance': TechnicalDomain.PERFORMANCE,
    'api_design': TechnicalDomain.API_DESIGN,
    'database': TechnicalDomain.DATABASE,
    'frontend': TechnicalDomain.FRONTEND,
    'backend': TechnicalDomain.BACKEND,
    'devops': TechnicalDomain.DEVOPS,
    'testing': TechnicalDomain.TESTING
  };
  
  return domainMap[domain.toLowerCase()];
}

/**
 * Load configuration from environment
 */
export function loadConfig(): FocusConfig {
  const isClaudeCode = detectClaudeCode();
  const claudeModel = detectClaudeModel();
  
  return {
    isClaudeCode,
    claudeModel,
    
    apiKeys: {
      anthropic: process.env.ANTHROPIC_API_KEY,
      openai: process.env.OPENAI_API_KEY,
      openrouter: process.env.OPENROUTER_API_KEY,
      gemini: process.env.GOOGLE_API_KEY,
      deepseek: process.env.DEEPSEEK_API_KEY,
      perplexity: process.env.PERPLEXITY_API_KEY,
      grok: getGrokApiKey(),
      qwen: process.env.QWEN_API_KEY,
    },
    
    preferences: {
      defaultDomain: parseDomain(process.env.DEFAULT_DOMAIN),
      enableVisuals: process.env.ENABLE_VISUALS !== 'false',
      costOptimization: process.env.COST_OPTIMIZATION !== 'false',
      maxReasoningRounds: parseInt(process.env.MAX_REASONING_ROUNDS || '5', 10),
      maxPingPongRounds: parseInt(process.env.MAX_PINGPONG_ROUNDS || '24', 10), // Default 24 (divisible by 6 models), users can increase if needed
      debug: process.env.DEBUG === 'true'
    },
    
    session: {
      enableLogging: process.env.ENABLE_SESSION_LOGGING !== 'false',
      autoSave: process.env.SESSION_AUTO_SAVE === 'true',
      defaultVerbose: process.env.SESSION_DEFAULT_VERBOSE === 'true',
      sessionDir: process.env.SESSION_OUTPUT_DIR || './workflow-output/sessions',
      outputFormat: (process.env.SESSION_DEFAULT_FORMAT as 'markdown' | 'json' | 'html') || 'markdown',
      includeMetadata: process.env.SESSION_INCLUDE_METADATA !== 'false',
      maxHistory: parseInt(process.env.SESSION_MAX_HISTORY || '100', 10)
    },

    workflow: {
      outputDir: process.env.WORKFLOW_OUTPUT_DIR || './workflow-output'
    }
  };
}

/**
 * Get available models based on configuration
 */
export function getAvailableModels(config: FocusConfig): string[] {
  const models: string[] = [];
  
  // Claude Code mode - always available
  if (config.isClaudeCode && config.claudeModel) {
    models.push(`claude-code-${config.claudeModel}`);
  }
  
  // API-based models
  if (config.apiKeys.anthropic) {
    models.push('claude-sonnet-4-api', 'claude-opus-4.1-api');
  }
  if (config.apiKeys.openai) {
    // GPT-5 models (require ENABLE_GPT5=true flag)
    if (process.env.ENABLE_GPT5 === 'true') {
      models.push('gpt-5', 'gpt-5-mini', 'gpt-5-nano');
    }
  }
  if (config.apiKeys.gemini) {
    // Use Gemini 3 Pro Preview (RAW POWER)
    models.push('gemini-3-pro-preview');
  }
  if (config.apiKeys.deepseek) {
    models.push('deepseek-r1');
  }
  if (config.apiKeys.perplexity) {
    models.push('sonar-pro', 'sonar-reasoning-pro', 'sonar-deep-research');
  }
  if (config.apiKeys.grok) {
    models.push('grok-3', 'grok-3-fast', 'grok-4-0709');
  }
  if (config.apiKeys.openrouter) {
    models.push('qwen3-coder', 'qwq-32b', 'qwen3-32b');
  }
  if (config.apiKeys.qwen) {
    models.push('qwen-max');
  }
  
  return models;
}

/**
 * Get configuration status for debugging
 */
export function getConfigStatus(config: FocusConfig): string {
  const models = getAvailableModels(config);
  
  let status = `🔧 Focus MCP Configuration\n\n`;
  status += `**Mode**: ${config.isClaudeCode ? 'Claude Code' : 'Standalone'}\n`;
  
  if (config.isClaudeCode) {
    status += `**Active Model**: ${config.claudeModel || 'Not detected'}\n`;
  }
  
  status += `\n**Available Models** (${models.length}):\n`;
  models.forEach(model => {
    status += `  • ${model}\n`;
  });
  
  status += `\n**Preferences**:\n`;
  status += `  • Default Domain: ${config.preferences.defaultDomain || 'None set'}\n`;
  status += `  • Visuals: ${config.preferences.enableVisuals ? 'Enabled' : 'Disabled'}\n`;
  status += `  • Cost Optimization: ${config.preferences.costOptimization ? 'Enabled' : 'Disabled'}\n`;
  status += `  • Max Reasoning Rounds: ${config.preferences.maxReasoningRounds}\n`;
  status += `  • Max Ping-Pong Rounds: ${config.preferences.maxPingPongRounds} (configurable via MAX_PINGPONG_ROUNDS)\n`;
  status += `  • Debug Mode: ${config.preferences.debug ? 'On' : 'Off'}\n`;
  
  status += `\n**Session Configuration**:\n`;
  status += `  • Logging: ${config.session.enableLogging ? 'Enabled' : 'Disabled'}\n`;
  status += `  • Auto-save: ${config.session.autoSave ? 'On' : 'Off'}\n`;
  status += `  • Verbose by default: ${config.session.defaultVerbose ? 'Yes' : 'No'}\n`;
  status += `  • Session Directory: ${config.session.sessionDir}\n`;
  status += `  • Output Format: ${config.session.outputFormat}\n`;
  status += `  • Include Metadata: ${config.session.includeMetadata ? 'Yes' : 'No'}\n`;
  status += `  • Max History: ${config.session.maxHistory} sessions\n`;
  
  if (!config.isClaudeCode && models.length === 0) {
    status += `\n⚠️ **Warning**: No API keys configured. Add keys to .env file for full functionality.\n`;
  }
  
  return status;
}