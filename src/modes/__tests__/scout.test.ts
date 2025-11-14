/**
 * Scout Unit Tests
 *
 * Currently no algorithmic logic to test - all validation done by TypeScript.
 * Edge cases require real API responses to be meaningful.
 */

import { Scout } from '../scout.js';

describe('Scout', () => {
  let scout: Scout;

  beforeEach(() => {
    scout = new Scout();
  });

  describe('Basic Execution', () => {
    it('should execute without errors with mocked APIs', async () => {
      const query = 'Test basic execution';

      const result = await scout.scout(query);

      // With mocked APIs, we can only verify it doesn't crash
      expect(result).toBeDefined();
      expect(result.synthesis).toBeDefined();
    });
  });
});
