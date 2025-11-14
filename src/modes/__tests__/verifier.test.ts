/**
 * Verifier Tests
 *
 * Tests for the Verifier class which provides multi-model parallel verification with consensus analysis.
 * These tests verify that the tool calls real APIs and validates parameter handling.
 */

import { Verifier, VerifyOptions, VerifierResult } from '../verifier.js';

describe('Verifier', () => {
  let verifier: Verifier;

  beforeEach(() => {
    verifier = new Verifier();
  });

  describe('Parameter Validation', () => {
    it('should use default parameters (quick_verify variant)', async () => {
      const query = 'Is the Earth approximately 4.5 billion years old?';
      const result = await verifier.verify(query);

      expect(result).toBeDefined();
      expect(result.consensus).toBeDefined();
      expect(result.responses.length).toBeGreaterThan(0);
    });

    it('should accept variant parameter', async () => {
      const query = 'Test query';
      const options: VerifyOptions = {
        variant: 'deep_verify'
      };

      const result = await verifier.verify(query, options);
      expect(result).toBeDefined();
    });

    it('should accept custom model array', async () => {
      const query = 'Test with custom models';
      const options: VerifyOptions = {
        model: ['gpt-5-mini', 'gemini-2.5-flash']
      };

      const result = await verifier.verify(query, options);
      expect(result).toBeDefined();
      expect(result.responses.length).toBeGreaterThanOrEqual(1); // At least one should succeed
    });

    it('should accept single custom model', async () => {
      const query = 'Test with single model';
      const options: VerifyOptions = {
        model: 'gpt-5-mini'
      };

      const result = await verifier.verify(query, options);
      expect(result).toBeDefined();
    });

    it('should accept maxTokens parameter', async () => {
      const query = 'Test with token limit';
      const options: VerifyOptions = {
        maxTokens: 1000
      };

      const result = await verifier.verify(query, options);
      expect(result).toBeDefined();
    });

    it('should accept timeout parameter', async () => {
      const query = 'Test with timeout';
      const options: VerifyOptions = {
        timeout: 5000
      };

      const result = await verifier.verify(query, options);
      expect(result).toBeDefined();
    });

    it('should accept includeSources parameter', async () => {
      const query = 'Test with sources';
      const options: VerifyOptions = {
        includeSources: true,
        variant: 'fact_check'
      };

      const result = await verifier.verify(query, options);
      expect(result).toBeDefined();
    });
  });

  describe('Variants', () => {
    it('should use quick_verify variant (default)', async () => {
      const query = '2 + 2 = 4';
      const result = await verifier.verify(query, { variant: 'quick_verify' });

      expect(result).toBeDefined();
      expect(result.responses.length).toBeGreaterThan(0);
      expect(result.synthesis).toBeDefined();
    });

    it('should use deep_verify variant', async () => {
      const query = 'What are the implications of quantum computing?';
      const result = await verifier.verify(query, { variant: 'deep_verify' });

      expect(result).toBeDefined();
      // Deep verify uses more sophisticated models
      expect(result.responses.length).toBeGreaterThan(0);
    });

    it('should use fact_check variant with sources', async () => {
      const query = 'The speed of light is approximately 299,792,458 meters per second';
      const result = await verifier.verify(query, {
        variant: 'fact_check',
        includeSources: true
      });

      expect(result).toBeDefined();
      expect(result.responses.length).toBeGreaterThan(0);
    });

    it('should use code_verify variant', async () => {
      const query = `
        Is this code correct?
        function add(a, b) { return a + b; }
      `;
      const result = await verifier.verify(query, { variant: 'code_verify' });

      expect(result).toBeDefined();
    });

    it('should use security_verify variant', async () => {
      const query = `
        Is this SQL query safe from injection?
        SELECT * FROM users WHERE id = \${userId}
      `;
      const result = await verifier.verify(query, { variant: 'security_verify' });

      expect(result).toBeDefined();
    });
  });

  describe('API Integration Tests', () => {
    it('should call real APIs and return consensus', async () => {
      const query = 'Is Python a programming language?';

      const result = await verifier.verify(query, {
        variant: 'quick_verify'
      });

      expect(result).toBeDefined();
      expect(result.responses.length).toBeGreaterThan(0);
      expect(result.consensus).toBeGreaterThanOrEqual(0);
      expect(result.consensus).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.synthesis).toBeTruthy();
    });

    it('should reach high consensus on factual statements', async () => {
      const query = 'Water boils at 100°C at sea level';

      const result = await verifier.verify(query);

      expect(result.consensus).toBeGreaterThan(0.5); // Should have good agreement
    });

    it('should identify outliers when models disagree', async () => {
      const query = 'A controversial statement that might get mixed responses';

      const result = await verifier.verify(query, {
        model: ['gpt-5-mini', 'gemini-2.5-flash', 'qwen3-30b']
      });

      expect(result).toBeDefined();
      expect(result.outliers).toBeDefined();
      expect(Array.isArray(result.outliers)).toBe(true);
    });

    it('should return shouldTerminate flag for high consensus', async () => {
      const query = '1 + 1 = 2';

      const result = await verifier.verify(query);

      // Very likely to have high consensus on this
      if (result.consensus >= 0.8) {
        expect(result.shouldTerminate).toBe(true);
      }
    });
  });

  describe('Multi-Model Support', () => {
    it('should work with Gemini models', async () => {
      const query = 'Test Gemini';

      const result = await verifier.verify(query, {
        model: ['gemini-2.5-flash']
      });

      expect(result).toBeDefined();
      expect(result.responses.length).toBeGreaterThan(0);
    });

    it('should work with OpenAI models', async () => {
      const query = 'Test OpenAI';

      const result = await verifier.verify(query, {
        model: ['gpt-5-mini']
      });

      expect(result).toBeDefined();
      expect(result.responses.length).toBeGreaterThan(0);
    });

    it('should handle mixed model providers', async () => {
      const query = 'Test mixed providers';

      const result = await verifier.verify(query, {
        model: ['gpt-5-mini', 'gemini-2.5-flash', 'qwen3-30b']
      });

      expect(result).toBeDefined();
      expect(result.responses.length).toBeGreaterThan(0);
    });

    // Note: Uncomment if you have Grok and Perplexity API keys configured
    /*
    it('should work with Grok models', async () => {
      const query = 'Test Grok';

      const result = await verifier.verify(query, {
        model: ['grok-4']
      });

      expect(result).toBeDefined();
    });

    it('should work with Perplexity models', async () => {
      const query = 'Test Perplexity';

      const result = await verifier.verify(query, {
        model: ['perplexity-sonar-pro']
      });

      expect(result).toBeDefined();
    });
    */
  });

  describe('Consensus Analysis', () => {
    it('should calculate consensus correctly', async () => {
      const query = 'Basic factual question';

      const result = await verifier.verify(query, {
        model: ['gpt-5-mini', 'gemini-2.5-flash']
      });

      expect(result.consensus).toBeGreaterThanOrEqual(0);
      expect(result.consensus).toBeLessThanOrEqual(1);

      // Consensus should match the proportion of models agreeing
      const majoritySize = result.responses.filter(
        r => r.conclusion === result.majority
      ).length;
      const expectedConsensus = majoritySize / result.responses.length;

      expect(result.consensus).toBeCloseTo(expectedConsensus, 2);
    });

    it('should identify majority and outliers', async () => {
      const query = 'Test consensus identification';

      const result = await verifier.verify(query, {
        model: ['gpt-5-mini', 'gemini-2.5-flash', 'qwen3-30b']
      });

      expect(result.majority).toBeDefined();
      expect(result.outliers).toBeDefined();

      // Outliers + majority should equal total responses
      const majorityCount = result.responses.filter(
        r => r.conclusion === result.majority
      ).length;
      const outlierCount = result.outliers.length;

      expect(majorityCount + outlierCount).toBe(result.responses.length);
    });
  });

  describe('Edge Cases', () => {
    it('should handle timeout gracefully', async () => {
      const query = 'Test timeout handling';

      const result = await verifier.verify(query, {
        timeout: 1 // Very short timeout
      });

      // Should still return a result, even if some models timeout
      expect(result).toBeDefined();
    });

    it('should handle empty query', async () => {
      const query = '';

      const result = await verifier.verify(query);

      expect(result).toBeDefined();
    });

    it('should handle very long query', async () => {
      const query = 'A'.repeat(5000);

      const result = await verifier.verify(query, {
        maxTokens: 500
      });

      expect(result).toBeDefined();
    });

    it('should handle model failure gracefully', async () => {
      const query = 'Test error handling';

      const result = await verifier.verify(query, {
        model: ['invalid-model-that-does-not-exist', 'gpt-5-mini']
      });

      // Should still succeed with at least one working model
      expect(result).toBeDefined();
      expect(result.responses.length).toBeGreaterThan(0);
    });
  });

  describe('Result Structure', () => {
    it('should return properly structured result', async () => {
      const query = 'Test result structure';

      const result = await verifier.verify(query);

      expect(result).toHaveProperty('consensus');
      expect(result).toHaveProperty('majority');
      expect(result).toHaveProperty('outliers');
      expect(result).toHaveProperty('responses');
      expect(result).toHaveProperty('synthesis');
      expect(result).toHaveProperty('confidence');

      expect(typeof result.consensus).toBe('number');
      expect(Array.isArray(result.outliers)).toBe(true);
      expect(Array.isArray(result.responses)).toBe(true);
      expect(typeof result.synthesis).toBe('string');
      expect(typeof result.confidence).toBe('number');
    });

    it('should include model response metadata', async () => {
      const query = 'Test response metadata';

      const result = await verifier.verify(query);

      expect(result.responses.length).toBeGreaterThan(0);
      result.responses.forEach(response => {
        expect(response).toHaveProperty('model');
        expect(response).toHaveProperty('response');
        expect(response).toHaveProperty('conclusion');
        expect(typeof response.model).toBe('string');
      });
    });

    it('should generate synthesis from responses', async () => {
      const query = 'Generate synthesis test';

      const result = await verifier.verify(query);

      expect(result.synthesis).toBeTruthy();
      expect(result.synthesis.length).toBeGreaterThan(0);
      expect(result.synthesis).toContain('consensus');
    });
  });
});
