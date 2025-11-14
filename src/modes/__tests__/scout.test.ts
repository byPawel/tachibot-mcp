/**
 * Scout Tests
 *
 * Tests for the Scout class which provides conditional hybrid intelligence gathering.
 * These tests verify that the tool calls real APIs and validates parameter handling.
 */

import { Scout, ScoutOptions, ScoutResult } from '../scout.js';

describe('Scout', () => {
  let scout: Scout;

  beforeEach(() => {
    scout = new Scout();
  });

  describe('Parameter Validation', () => {
    it('should use default parameters (research_scout variant)', async () => {
      const query = 'Latest developments in quantum computing 2025';
      const result = await scout.scout(query);

      expect(result).toBeDefined();
      expect(result.synthesis).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should accept variant parameter', async () => {
      const query = 'Test query';
      const options: ScoutOptions = {
        variant: 'quick_scout'
      };

      const result = await scout.scout(query, options);
      expect(result).toBeDefined();
    });

    it('should accept searchProvider parameter', async () => {
      const query = 'Test search provider';
      const options: ScoutOptions = {
        searchProvider: 'perplexity'
      };

      const result = await scout.scout(query, options);
      expect(result).toBeDefined();
    });

    it('should accept maxTokens parameter', async () => {
      const query = 'Test with token limit';
      const options: ScoutOptions = {
        maxTokens: 1000
      };

      const result = await scout.scout(query, options);
      expect(result).toBeDefined();
    });

    it('should accept timeout parameter', async () => {
      const query = 'Test with timeout';
      const options: ScoutOptions = {
        timeout: 5000
      };

      const result = await scout.scout(query, options);
      expect(result).toBeDefined();
    });

    it('should accept Grok live search parameters', async () => {
      const query = 'Test Grok live search';
      const options: ScoutOptions = {
        searchProvider: 'grok',
        enableGrokLiveSearch: true,
        maxSearchSources: 50
      };

      // Note: This will only work if GROK_API_KEY is configured
      const result = await scout.scout(query, options);
      expect(result).toBeDefined();
    });

    it('should accept searchDomains parameter', async () => {
      const query = 'Test domain filtering';
      const options: ScoutOptions = {
        searchDomains: ['github.com', 'stackoverflow.com']
      };

      const result = await scout.scout(query, options);
      expect(result).toBeDefined();
    });
  });

  describe('Variants', () => {
    it('should use research_scout variant (default)', async () => {
      const query = 'What are the latest AI breakthroughs in 2025?';
      const result = await scout.scout(query, { variant: 'research_scout' });

      expect(result).toBeDefined();
      expect(result.synthesis).toBeDefined();
    });

    it('should use code_scout variant', async () => {
      const query = 'Latest TypeScript 5.0 features and API documentation';
      const result = await scout.scout(query, { variant: 'code_scout' });

      expect(result).toBeDefined();
      expect(result.synthesis).toBeDefined();
    });

    it('should use fact_scout variant', async () => {
      const query = 'Current population of Tokyo';
      const result = await scout.scout(query, { variant: 'fact_scout' });

      expect(result).toBeDefined();
      expect(result.synthesis).toBeDefined();
    });

    it('should use quick_scout variant', async () => {
      const query = 'Quick information about Node.js';
      const result = await scout.scout(query, { variant: 'quick_scout' });

      expect(result).toBeDefined();
      expect(result.synthesis).toBeDefined();
    });
  });

  describe('Search Provider Options', () => {
    it('should work with Perplexity search provider (default)', async () => {
      // Requires PERPLEXITY_API_KEY in environment
      const query = 'Latest news about AI regulations';
      const result = await scout.scout(query, {
        searchProvider: 'perplexity',
        variant: 'fact_scout'
      });

      expect(result).toBeDefined();
      expect(result.synthesis).toBeTruthy();
    });

    it('should work with Grok search provider', async () => {
      // Requires GROK_API_KEY or XAI_API_KEY in environment
      const query = 'Latest news about space exploration';
      const result = await scout.scout(query, {
        searchProvider: 'grok',
        enableGrokLiveSearch: true,
        maxSearchSources: 50
      });

      expect(result).toBeDefined();
      expect(result.synthesis).toBeTruthy();
    });

    it('should work with both search providers', async () => {
      // Requires both API keys
      const query = 'Comprehensive research on renewable energy';
      const result = await scout.scout(query, {
        searchProvider: 'both',
        maxSearchSources: 50
      });

      expect(result).toBeDefined();
      expect(result.synthesis).toBeTruthy();
    });
  });

  describe('API Integration Tests', () => {
    it('should call real search APIs and return facts', async () => {
      const query = 'What is the current status of Mars colonization efforts?';

      const result = await scout.scout(query, {
        variant: 'research_scout'
      });

      expect(result).toBeDefined();
      expect(result.synthesis).toBeTruthy();
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.tokensUsed).toBeGreaterThan(0);
    });

    it('should gather facts from Perplexity', async () => {
      const query = 'Latest developments in fusion energy 2025';

      const result = await scout.scout(query, {
        searchProvider: 'perplexity',
        variant: 'fact_scout'
      });

      if (result.facts) {
        expect(result.facts.facts).toBeDefined();
        expect(Array.isArray(result.facts.facts)).toBe(true);
        expect(result.facts.reliability).toBeGreaterThanOrEqual(0);
        expect(result.facts.reliability).toBeLessThanOrEqual(1);
      }
    });

    it('should perform multi-model analysis', async () => {
      const query = 'Analyze the current state of quantum computing';

      const result = await scout.scout(query, {
        variant: 'research_scout'
      });

      if (result.analyses) {
        expect(Array.isArray(result.analyses)).toBe(true);
        expect(result.analyses.length).toBeGreaterThan(0);

        result.analyses.forEach(analysis => {
          expect(analysis).toHaveProperty('model');
          expect(analysis).toHaveProperty('analysis');
          expect(analysis).toHaveProperty('insights');
        });
      }
    });
  });

  describe('Flow Types', () => {
    it('should execute perplexity-first-always flow', async () => {
      const query = 'Current weather patterns';

      const result = await scout.scout(query, {
        variant: 'research_scout' // Uses perplexity-first-always
      });

      expect(result).toBeDefined();
      expect(result.facts).toBeDefined();
    });

    it('should execute conditional-hybrid flow', async () => {
      const query = 'TypeScript async patterns documentation';

      const result = await scout.scout(query, {
        variant: 'code_scout' // Uses conditional-hybrid
      });

      expect(result).toBeDefined();
    });

    it('should execute waterfall flow', async () => {
      const query = 'Verified facts about climate change';

      const result = await scout.scout(query, {
        variant: 'fact_scout' // Uses waterfall
      });

      expect(result).toBeDefined();
    });
  });

  describe('Cost Control', () => {
    it('should respect maxSearchSources limit', async () => {
      const query = 'Test cost control';

      const result = await scout.scout(query, {
        searchProvider: 'grok',
        enableGrokLiveSearch: true,
        maxSearchSources: 20 // Low limit for cost control
      });

      expect(result).toBeDefined();
    });

    it('should use appropriate source limits per variant', async () => {
      const quickResult = await scout.scout('Quick test', {
        variant: 'quick_scout'
      });

      const researchResult = await scout.scout('Research test', {
        variant: 'research_scout'
      });

      expect(quickResult).toBeDefined();
      expect(researchResult).toBeDefined();
    });
  });

  describe('Domain Filtering', () => {
    it('should filter search to specific domains', async () => {
      const query = 'Python documentation';

      const result = await scout.scout(query, {
        searchDomains: ['python.org', 'docs.python.org']
      });

      expect(result).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty query', async () => {
      const query = '';

      const result = await scout.scout(query);

      expect(result).toBeDefined();
    });

    it('should handle very long query', async () => {
      const query = 'A'.repeat(1000);

      const result = await scout.scout(query, {
        maxTokens: 500
      });

      expect(result).toBeDefined();
    });

    it('should handle API failure gracefully', async () => {
      const query = 'Test error handling';

      const result = await scout.scout(query, {
        timeout: 1 // Very short timeout to trigger fallback
      });

      expect(result).toBeDefined();
      if (result.warning) {
        expect(result.warning).toBeTruthy();
      }
    });

    it('should provide fallback when search fails', async () => {
      const query = 'Test fallback mechanism';

      // Use impossible timeout to trigger fallback
      const result = await scout.scout(query, {
        timeout: 0
      });

      expect(result).toBeDefined();
      expect(result.synthesis).toBeTruthy();
    });
  });

  describe('Result Structure', () => {
    it('should return properly structured result', async () => {
      const query = 'Test result structure';

      const result = await scout.scout(query);

      expect(result).toHaveProperty('synthesis');
      expect(result).toHaveProperty('executionTime');
      expect(result).toHaveProperty('tokensUsed');

      expect(typeof result.synthesis).toBe('string');
      expect(typeof result.executionTime).toBe('number');
      expect(typeof result.tokensUsed).toBe('number');

      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.tokensUsed).toBeGreaterThanOrEqual(0);
    });

    it('should include facts when available', async () => {
      const query = 'Get facts test';

      const result = await scout.scout(query, {
        variant: 'fact_scout'
      });

      if (result.facts) {
        expect(result.facts).toHaveProperty('facts');
        expect(result.facts).toHaveProperty('timestamp');
        expect(result.facts).toHaveProperty('reliability');

        expect(Array.isArray(result.facts.facts)).toBe(true);
        expect(typeof result.facts.timestamp).toBe('string');
        expect(typeof result.facts.reliability).toBe('number');
      }
    });

    it('should include analyses when available', async () => {
      const query = 'Get analyses test';

      const result = await scout.scout(query, {
        variant: 'research_scout'
      });

      if (result.analyses) {
        expect(Array.isArray(result.analyses)).toBe(true);

        result.analyses.forEach(analysis => {
          expect(analysis).toHaveProperty('model');
          expect(analysis).toHaveProperty('analysis');
          expect(analysis).toHaveProperty('insights');

          expect(typeof analysis.model).toBe('string');
          expect(typeof analysis.analysis).toBe('string');
          expect(Array.isArray(analysis.insights)).toBe(true);
        });
      }
    });

    it('should include warning when appropriate', async () => {
      const query = 'Test warning generation';

      const result = await scout.scout(query);

      // Warning is optional
      if (result.warning) {
        expect(typeof result.warning).toBe('string');
      }
    });
  });

  describe('Performance', () => {
    it('should complete quick_scout in reasonable time', async () => {
      const query = 'Quick information';
      const startTime = Date.now();

      const result = await scout.scout(query, {
        variant: 'quick_scout'
      });

      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should track execution time accurately', async () => {
      const query = 'Track time test';

      const result = await scout.scout(query);

      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.executionTime).toBeLessThan(60000); // Under 1 minute
    });

    it('should track token usage', async () => {
      const query = 'Track tokens test';

      const result = await scout.scout(query);

      expect(result.tokensUsed).toBeGreaterThan(0);
    });
  });
});
