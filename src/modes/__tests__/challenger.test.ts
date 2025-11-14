/**
 * Challenger Tests
 *
 * Tests for the Challenger class which provides critical thinking and echo chamber prevention.
 * These tests verify that the tool calls real APIs and validates parameter handling.
 */

import { Challenger, ChallengeOptions, ChallengeResult } from '../challenger.js';

describe('Challenger', () => {
  let challenger: Challenger;

  beforeEach(() => {
    challenger = new Challenger();
  });

  describe('Parameter Validation', () => {
    it('should use default parameters when none provided', async () => {
      const context = 'AI will revolutionize everything and there are no downsides.';
      const result = await challenger.challenge(context);

      expect(result).toBeDefined();
      expect(result.claims).toBeDefined();
      expect(result.challenges).toBeDefined();
      expect(result.synthesis).toBeDefined();
    });

    it('should accept custom model parameter', async () => {
      const context = 'Testing with custom model';
      const options: ChallengeOptions = {
        model: 'gpt-5-mini'
      };

      const result = await challenger.challenge(context, options);
      expect(result).toBeDefined();
    });

    it('should accept custom temperature parameter', async () => {
      const context = 'Testing with custom temperature';
      const options: ChallengeOptions = {
        temperature: 0.5
      };

      const result = await challenger.challenge(context, options);
      expect(result).toBeDefined();
    });

    it('should accept custom maxTokens parameter', async () => {
      const context = 'Testing with custom token limit';
      const options: ChallengeOptions = {
        maxTokens: 1000
      };

      const result = await challenger.challenge(context, options);
      expect(result).toBeDefined();
    });

    it('should accept all parameters combined', async () => {
      const context = 'Testing with all parameters';
      const options: ChallengeOptions = {
        model: 'gemini-2.5-flash',
        temperature: 0.8,
        maxTokens: 1500
      };

      const result = await challenger.challenge(context, options);
      expect(result).toBeDefined();
    });
  });

  describe('API Integration Tests', () => {
    it('should call real API and return valid challenge result', async () => {
      const context = 'Climate change is a hoax created by scientists for funding.';

      const result = await challenger.challenge(context, {
        model: 'gpt-5-mini', // Fast model for testing
        maxTokens: 500
      });

      expect(result).toBeDefined();
      expect(result.claims.length).toBeGreaterThan(0);
      expect(result.challenges.length).toBeGreaterThan(0);
      expect(result.synthesis).toContain('Challenge');
      expect(typeof result.groupthinkDetected).toBe('boolean');
      expect(Array.isArray(result.alternativePerspectives)).toBe(true);
    });

    it('should generate counter-arguments from real model', async () => {
      const context = 'All experts agree that technology has only positive effects on society.';

      const result = await challenger.challenge(context, {
        temperature: 0.9 // Higher temperature for more creative challenges
      });

      expect(result.challenges.length).toBeGreaterThan(0);
      result.challenges.forEach(challenge => {
        expect(challenge.challenge).toBeDefined();
        expect(challenge.challenge.length).toBeGreaterThan(0);
        expect(['low', 'medium', 'high']).toContain(challenge.severity);
      });
    });

    it('should detect groupthink in consensus statements', async () => {
      const context = 'Everyone agrees that this approach is perfect. There is unanimous consensus.';

      const result = await challenger.challenge(context);

      expect(result.groupthinkDetected).toBe(true);
    });

    it('should extract and categorize claims correctly', async () => {
      const context = `
        I believe AI will transform healthcare.
        Studies show that AI diagnostics are 95% accurate.
        Therefore, we should immediately replace all doctors with AI.
        AI might help with administrative tasks.
      `;

      const result = await challenger.challenge(context);

      expect(result.claims.length).toBeGreaterThan(0);

      const hasOpinion = result.claims.some(c => c.type === 'opinion');
      const hasFact = result.claims.some(c => c.type === 'fact');
      const hasConclusion = result.claims.some(c => c.type === 'conclusion');

      expect(hasOpinion || hasFact || hasConclusion).toBe(true);
    });
  });

  describe('Model Support', () => {
    it('should work with Gemini models', async () => {
      const context = 'Testing Gemini model support';

      const result = await challenger.challenge(context, {
        model: 'gemini-2.5-flash',
        maxTokens: 300
      });

      expect(result).toBeDefined();
      expect(result.synthesis).toBeDefined();
    });

    it('should work with OpenAI models', async () => {
      const context = 'Testing OpenAI model support';

      const result = await challenger.challenge(context, {
        model: 'gpt-5-mini',
        maxTokens: 300
      });

      expect(result).toBeDefined();
      expect(result.synthesis).toBeDefined();
    });

    // Note: Uncomment if you have Grok and Perplexity API keys configured
    /*
    it('should work with Grok models', async () => {
      const context = 'Testing Grok model support';

      const result = await challenger.challenge(context, {
        model: 'grok-4',
        maxTokens: 300
      });

      expect(result).toBeDefined();
    });

    it('should work with Perplexity models', async () => {
      const context = 'Testing Perplexity model support';

      const result = await challenger.challenge(context, {
        model: 'sonar-pro',
        maxTokens: 300
      });

      expect(result).toBeDefined();
    });
    */
  });

  describe('Edge Cases', () => {
    it('should handle empty context gracefully', async () => {
      const context = '';

      const result = await challenger.challenge(context);

      expect(result).toBeDefined();
      expect(result.claims.length).toBe(0);
    });

    it('should handle very short context', async () => {
      const context = 'AI is good.';

      const result = await challenger.challenge(context);

      expect(result).toBeDefined();
    });

    it('should handle context as object', async () => {
      const context = {
        query: 'Social media is entirely beneficial for mental health.',
        text: 'Everyone should use social media all the time.'
      };

      const result = await challenger.challenge(context);

      expect(result).toBeDefined();
      expect(result.claims.length).toBeGreaterThan(0);
    });

    it('should handle array of contexts', async () => {
      const contexts = [
        'Opinion 1: This is the best approach.',
        'Opinion 2: This is the best approach.',
        'Opinion 3: This is the best approach.'
      ];

      const result = await challenger.challenge(contexts);

      // Should detect groupthink with identical opinions
      expect(result.groupthinkDetected).toBe(true);
    });
  });

  describe('Result Structure', () => {
    it('should return properly structured result', async () => {
      const context = 'Testing result structure';

      const result = await challenger.challenge(context);

      expect(result).toHaveProperty('claims');
      expect(result).toHaveProperty('challenges');
      expect(result).toHaveProperty('groupthinkDetected');
      expect(result).toHaveProperty('alternativePerspectives');
      expect(result).toHaveProperty('synthesis');

      expect(Array.isArray(result.claims)).toBe(true);
      expect(Array.isArray(result.challenges)).toBe(true);
      expect(typeof result.groupthinkDetected).toBe('boolean');
      expect(Array.isArray(result.alternativePerspectives)).toBe(true);
      expect(typeof result.synthesis).toBe('string');
    });

    it('should include severity levels in challenges', async () => {
      const context = 'False claim that needs challenging.';

      const result = await challenger.challenge(context);

      if (result.challenges.length > 0) {
        result.challenges.forEach(challenge => {
          expect(['low', 'medium', 'high']).toContain(challenge.severity);
        });
      }
    });

    it('should include claim metadata', async () => {
      const context = 'I believe this is true. Studies show this is accurate.';

      const result = await challenger.challenge(context);

      expect(result.claims.length).toBeGreaterThan(0);
      result.claims.forEach(claim => {
        expect(claim).toHaveProperty('id');
        expect(claim).toHaveProperty('text');
        expect(claim).toHaveProperty('confidence');
        expect(claim).toHaveProperty('type');
        expect(['fact', 'opinion', 'assumption', 'conclusion']).toContain(claim.type);
        expect(claim.confidence).toBeGreaterThanOrEqual(0);
        expect(claim.confidence).toBeLessThanOrEqual(1);
      });
    });
  });
});
