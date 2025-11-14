export default {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest/presets/default-esm',

  // Test environment
  testEnvironment: 'node',

  // Setup file for global mocks
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Handle ES modules
  extensionsToTreatAsEsm: ['.ts', '.tsx'],

  // Don't transform node_modules except for our setup file
  transformIgnorePatterns: [],

  // Module name mapper for ES module imports
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // Transform TypeScript files
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          // Ensure Jest can parse TypeScript syntax
          allowSyntheticDefaultImports: true,
          esModuleInterop: true,
          module: 'ESNext',
          moduleResolution: 'node',
        },
      },
    ],
  },

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts',
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],

  // Module file extensions
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
};
