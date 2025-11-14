/**
 * Verifier Unit Tests
 *
 * Tests the consensus algorithm logic.
 * Edge cases and structure validation are handled by TypeScript compiler.
 */

import { Verifier } from '../verifier.js';

describe('Verifier', () => {
  let verifier: Verifier;

  beforeEach(() => {
    verifier = new Verifier();
  });

  describe('Consensus Algorithm', () => {
    it('should calculate consensus as majority_count / total_responses', async () => {
      const query = 'Test consensus calculation';

      const result = await verifier.verify(query, {
        model: ['gpt-5-mini', 'gemini-2.5-flash']
      });

      expect(result.consensus).toBeGreaterThanOrEqual(0);
      expect(result.consensus).toBeLessThanOrEqual(1);

      // Verify the math: consensus = majority / total
      const majoritySize = result.responses.filter(
        r => r.conclusion === result.majority
      ).length;
      const expectedConsensus = majoritySize / result.responses.length;

      expect(result.consensus).toBeCloseTo(expectedConsensus, 2);
    });

    it('should ensure outliers + majority = total responses', async () => {
      const query = 'Test majority and outliers';

      const result = await verifier.verify(query, {
        model: ['gpt-5-mini', 'gemini-2.5-flash', 'qwen/qwen3-coder-plus']
      });

      expect(result.majority).toBeDefined();
      expect(result.outliers).toBeDefined();

      // Verify the math: outliers + majority = total
      const majorityCount = result.responses.filter(
        r => r.conclusion === result.majority
      ).length;
      const outlierCount = result.outliers.length;

      expect(majorityCount + outlierCount).toBe(result.responses.length);
    });
  });
});
