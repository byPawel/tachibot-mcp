/**
 * Memory Configuration System
 * Flexible memory backend configuration with support for mem0, DevLog, local, and hybrid modes
 */

export type MemoryProvider = 'mem0' | 'devlog' | 'local' | 'hybrid' | 'none';
export type MemoryTier = 'session' | 'working' | 'project' | 'team' | 'global';
export type StorageType = 'sqlite' | 'json' | 'leveldb';

/**
 * Mem0 specific configuration
 */
export interface Mem0Config {
  apiKey?: string;
  endpoint?: string;
  userId?: string;
  enableVectorSearch?: boolean;
  enableGraphMemory?: boolean;
  maxTokens?: number;
}

/**
 * DevLog integration configuration
 */
export interface DevLogConfig {
  connectionString?: string;
  workspace?: string;
  projectId?: string;
  enableSync?: boolean;
}

/**
 * Local storage configuration
 */
export interface LocalStorageConfig {
  storageType: StorageType;
  path: string;
  maxSizeMB?: number;
  enableCompression?: boolean;
}

/**
 * Hybrid mode configuration
 */
export interface HybridConfig {
  primary: Exclude<MemoryProvider, 'hybrid' | 'none'>;
  fallback: Exclude<MemoryProvider, 'hybrid' | 'none'>;
  syncInterval?: number; // milliseconds
  preferPrimaryFor?: MemoryTier[];
}

/**
 * Memory tier configuration
 */
export interface MemoryTierConfig {
  session: boolean;      // 15-30 min lifetime
  working: boolean;      // 1-2 hours lifetime
  project: boolean;      // Project lifetime
  team: boolean;         // Team/organization lifetime
  global: boolean;       // Cross-project, permanent
}

/**
 * Main memory configuration
 */
export interface MemoryConfig {
  provider: MemoryProvider;
  mem0?: Mem0Config;
  devlog?: DevLogConfig;
  local?: LocalStorageConfig;
  hybrid?: HybridConfig;
  tiers: MemoryTierConfig;
  
  // Advanced options
  maxMemoryItems?: number;
  ttlMinutes?: Record<MemoryTier, number>;
  enableAutoCleanup?: boolean;
  enableMetrics?: boolean;
  encryptionKey?: string;
}

/**
 * Memory item structure
 */
export interface MemoryItem {
  id: string;
  content: string;
  tier: MemoryTier;
  userId?: string;
  projectId?: string;
  teamId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  tags?: string[];
  embedding?: number[]; // For vector search
  relationships?: string[]; // For graph memory
  ttl?: number; // Time to live in minutes
  accessCount?: number;
  lastAccessed?: Date;
}

/**
 * Memory query structure
 */
export interface MemoryQuery {
  text?: string;
  userId?: string;
  projectId?: string;
  teamId?: string;
  tiers?: MemoryTier[];
  tags?: string[];
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
  includeEmbeddings?: boolean;
  semanticThreshold?: number; // For similarity search (0-1)
}

/**
 * Context query for hierarchical retrieval
 */
export interface ContextQuery extends MemoryQuery {
  contextWindow?: number; // Max tokens to retrieve
  priorityWeights?: {
    recency: number;
    relevance: number;
    frequency: number;
  };
}

/**
 * Contextual memory result
 */
export interface ContextualMemory {
  items: MemoryItem[];
  synthesis?: string;
  relevanceScore: number;
  tokenCount: number;
  sources: {
    session: number;
    working: number;
    project: number;
    team: number;
    global: number;
  };
}

/**
 * Memory metrics
 */
export interface MemoryMetrics {
  totalItems: number;
  itemsByTier: Record<MemoryTier, number>;
  totalTokens: number;
  avgRetrievalTime: number;
  hitRate: number;
  storageUsedMB: number;
}

/**
 * Default configuration
 */
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  provider: 'local',
  local: {
    storageType: 'json',
    path: './.focus-memory',
    maxSizeMB: 100,
    enableCompression: true
  },
  tiers: {
    session: true,
    working: true,
    project: true,
    team: false,
    global: false
  },
  maxMemoryItems: 10000,
  ttlMinutes: {
    session: 30,
    working: 120,
    project: 43200, // 30 days
    team: 129600, // 90 days
    global: -1 // Never expires
  },
  enableAutoCleanup: true,
  enableMetrics: false
};

/**
 * Load configuration from environment variables
 */
export function loadMemoryConfigFromEnv(): Partial<MemoryConfig> {
  const config: Partial<MemoryConfig> = {};
  
  // Provider selection
  const provider = process.env.MEMORY_PROVIDER as MemoryProvider;
  if (provider) {
    config.provider = provider;
  }
  
  // Mem0 configuration
  if (process.env.MEM0_API_KEY) {
    config.mem0 = {
      apiKey: process.env.MEM0_API_KEY,
      endpoint: process.env.MEM0_ENDPOINT,
      userId: process.env.MEM0_USER_ID,
      enableVectorSearch: process.env.MEM0_ENABLE_VECTOR !== 'false',
      enableGraphMemory: process.env.MEM0_ENABLE_GRAPH !== 'false'
    };
  }
  
  // DevLog configuration
  if (process.env.DEVLOG_CONNECTION) {
    config.devlog = {
      connectionString: process.env.DEVLOG_CONNECTION,
      workspace: process.env.DEVLOG_WORKSPACE,
      projectId: process.env.DEVLOG_PROJECT,
      enableSync: process.env.DEVLOG_SYNC !== 'false'
    };
  }
  
  // Local storage configuration
  if (process.env.LOCAL_STORAGE_PATH) {
    config.local = {
      storageType: (process.env.LOCAL_STORAGE_TYPE as StorageType) || 'json',
      path: process.env.LOCAL_STORAGE_PATH,
      maxSizeMB: parseInt(process.env.LOCAL_STORAGE_MAX_MB || '100'),
      enableCompression: process.env.LOCAL_STORAGE_COMPRESS !== 'false'
    };
  }
  
  // Tier configuration
  config.tiers = {
    session: process.env.ENABLE_SESSION_MEMORY !== 'false',
    working: process.env.ENABLE_WORKING_MEMORY !== 'false',
    project: process.env.ENABLE_PROJECT_MEMORY !== 'false',
    team: process.env.ENABLE_TEAM_MEMORY === 'true',
    global: process.env.ENABLE_GLOBAL_MEMORY === 'true'
  };
  
  return config;
}

/**
 * Merge configurations with defaults
 */
export function mergeMemoryConfig(
  userConfig: Partial<MemoryConfig>,
  envConfig: Partial<MemoryConfig> = loadMemoryConfigFromEnv()
): MemoryConfig {
  // Priority: userConfig > envConfig > DEFAULT_MEMORY_CONFIG
  return {
    ...DEFAULT_MEMORY_CONFIG,
    ...envConfig,
    ...userConfig,
    tiers: {
      ...DEFAULT_MEMORY_CONFIG.tiers,
      ...(envConfig.tiers || {}),
      ...(userConfig.tiers || {})
    },
    ttlMinutes: {
      ...DEFAULT_MEMORY_CONFIG.ttlMinutes,
      ...(envConfig.ttlMinutes || {}),
      ...(userConfig.ttlMinutes || {})
    }
  } as MemoryConfig;
}

/**
 * Validate memory configuration
 */
export function validateMemoryConfig(config: MemoryConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate provider-specific requirements
  if (config.provider === 'mem0' && !config.mem0?.apiKey && !process.env.MEM0_API_KEY) {
    errors.push('Mem0 provider requires API key (MEM0_API_KEY or config.mem0.apiKey)');
  }
  
  if (config.provider === 'devlog' && !config.devlog?.connectionString && !process.env.DEVLOG_CONNECTION) {
    errors.push('DevLog provider requires connection string');
  }
  
  if (config.provider === 'local' && !config.local?.path) {
    errors.push('Local provider requires storage path');
  }
  
  if (config.provider === 'hybrid') {
    if (!config.hybrid?.primary || !config.hybrid?.fallback) {
      errors.push('Hybrid provider requires both primary and fallback providers');
    }
    if (config.hybrid?.primary === config.hybrid?.fallback) {
      errors.push('Hybrid primary and fallback must be different');
    }
  }
  
  // Validate at least one tier is enabled
  const tiersEnabled = Object.values(config.tiers).some(v => v);
  if (!tiersEnabled && config.provider !== 'none') {
    errors.push('At least one memory tier must be enabled');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}