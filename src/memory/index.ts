/**
 * Memory System Module
 * Exports all memory-related components
 */

// Core exports
export * from './memory-config.js';
export * from './memory-interface.js';
export * from './memory-manager.js';

// Provider exports
export * from './providers/local-provider.js';
export * from './providers/mem0-provider.js';
// export * from './providers/devlog-provider.js';
// export * from './providers/hybrid-provider.js';

// Main API
export { 
  getMemoryManager,
  resetMemoryManager,
  HierarchicalMemoryManager 
} from './memory-manager.js';

export {
  DEFAULT_MEMORY_CONFIG,
  loadMemoryConfigFromEnv,
  mergeMemoryConfig,
  validateMemoryConfig
} from './memory-config.js';

// Type exports for convenience
export type {
  MemoryProvider,
  MemoryTier,
  StorageType,
  MemoryItem,
  MemoryQuery,
  ContextQuery,
  ContextualMemory,
  MemoryMetrics,
  MemoryConfig,
  Mem0Config,
  DevLogConfig,
  LocalStorageConfig,
  HybridConfig,
  MemoryTierConfig
} from './memory-config.js';

export type {
  IMemoryProvider
} from './memory-interface.js';

export {
  BaseMemoryProvider
} from './memory-interface.js';