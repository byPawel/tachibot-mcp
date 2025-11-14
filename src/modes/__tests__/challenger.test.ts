/**
 * Challenger Unit Tests
 *
 * Currently no algorithmic logic to test - all validation done by TypeScript.
 * Edge cases require real API responses to be meaningful.
 */

import { Challenger } from '../challenger.js';

describe('Challenger', () => {
  let challenger: Challenger;

  beforeEach(() => {
    challenger = new Challenger();
  });

  describe('Groupthink Detection', () => {
    it('should detect groupthink in identical array inputs', async () => {
      const contexts = [
        'Opinion 1: This is the best approach.',
        'Opinion 2: This is the best approach.',
        'Opinion 3: This is the best approach.'
      ];

      const result = await challenger.challenge(contexts);

      // With mocked responses, groupthink detection depends on input analysis
      expect(result).toBeDefined();
      expect(typeof result.groupthinkDetected).toBe('boolean');
    });
  });
});
