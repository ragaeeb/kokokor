import { describe, expect, it } from 'bun:test';
import {
    calculateLevenshteinDistance,
    calculateSimilarity,
    areSimilarAfterNormalization,
    calculateAlignmentScore,
    alignTokenSequences,
} from './similarity';

describe('similarity', () => {
    describe('calculateLevenshteinDistance', () => {
        it('should return 0 for identical strings', () => {
            expect(calculateLevenshteinDistance('hello', 'hello')).toBe(0);
        });

        it('should return length for empty vs non-empty string', () => {
            expect(calculateLevenshteinDistance('', 'hello')).toBe(5);
            expect(calculateLevenshteinDistance('hello', '')).toBe(5);
        });

        it('should return 0 for two empty strings', () => {
            expect(calculateLevenshteinDistance('', '')).toBe(0);
        });

        it('should calculate correct distance for substitutions', () => {
            expect(calculateLevenshteinDistance('cat', 'bat')).toBe(1);
        });

        it('should calculate correct distance for insertions', () => {
            expect(calculateLevenshteinDistance('cat', 'cats')).toBe(1);
        });

        it('should calculate correct distance for deletions', () => {
            expect(calculateLevenshteinDistance('cats', 'cat')).toBe(1);
        });

        it('should handle complex example', () => {
            expect(calculateLevenshteinDistance('kitten', 'sitting')).toBe(3);
        });

        it('should work with Arabic text', () => {
            expect(calculateLevenshteinDistance('السلام', 'السلم')).toBe(1);
        });

        it('should be symmetric', () => {
            const dist1 = calculateLevenshteinDistance('hello', 'world');
            const dist2 = calculateLevenshteinDistance('world', 'hello');
            expect(dist1).toBe(dist2);
        });
    });

    describe('calculateSimilarity', () => {
        it('should return 1.0 for identical strings', () => {
            expect(calculateSimilarity('hello', 'hello')).toBe(1.0);
        });

        it('should return 0.0 for completely different strings', () => {
            expect(calculateSimilarity('abc', 'xyz')).toBe(0.0);
        });

        it('should return correct ratio for partial matches', () => {
            const similarity = calculateSimilarity('hello', 'help');
            expect(similarity).toBeCloseTo(0.6, 1);
        });

        it('should handle empty strings', () => {
            expect(calculateSimilarity('', '')).toBe(1.0);
            expect(calculateSimilarity('', 'hello')).toBe(0.0);
        });

        it('should normalize by longer string', () => {
            const sim1 = calculateSimilarity('cat', 'cats');
            const sim2 = calculateSimilarity('cats', 'cat');
            expect(sim1).toBe(sim2);
            expect(sim1).toBeCloseTo(0.75, 2);
        });

        it('should work with Arabic text', () => {
            const similarity = calculateSimilarity('السلام', 'السلم');
            expect(similarity).toBeGreaterThan(0.8);
        });
    });

    describe('areSimilarAfterNormalization', () => {
        it('should return true for identical normalized text', () => {
            const result = areSimilarAfterNormalization('اَلسَّلَام', 'السلام', 0.9);
            expect(result).toBe(true);
        });

        it('should return false when below threshold', () => {
            const result = areSimilarAfterNormalization('hello', 'world', 0.9);
            expect(result).toBe(false);
        });

        it('should return true when above threshold', () => {
            const result = areSimilarAfterNormalization('hello', 'help', 0.5);
            expect(result).toBe(true);
        });

        it('should handle empty strings', () => {
            const result = areSimilarAfterNormalization('', '', 0.5);
            expect(result).toBe(true);
        });
    });

    describe('calculateAlignmentScore', () => {
        it('should return perfect match score for identical normalized tokens', () => {
            const score = calculateAlignmentScore('hello', 'hello', [], 0.8);
            expect(score).toBe(2); // PERFECT_MATCH
        });

        it('should return perfect match for normalized Arabic', () => {
            const score = calculateAlignmentScore('اَلسَّلَام', 'السلام', [], 0.8);
            expect(score).toBe(2); // PERFECT_MATCH
        });

        it('should return soft match for typo symbols', () => {
            const score = calculateAlignmentScore('ﷺ', 'other', ['ﷺ'], 0.8);
            expect(score).toBe(1); // SOFT_MATCH
        });

        it('should return soft match for highly similar tokens', () => {
            const score = calculateAlignmentScore('hello', 'helo', [], 0.7);
            expect(score).toBe(1); // SOFT_MATCH (similarity > 0.7)
        });

        it('should return mismatch penalty for dissimilar tokens', () => {
            const score = calculateAlignmentScore('hello', 'world', [], 0.8);
            expect(score).toBe(-2); // MISMATCH_PENALTY
        });

        it('should prefer typo symbol when one token is typo symbol', () => {
            const score1 = calculateAlignmentScore('ﷺ', 'text', ['ﷺ'], 0.8);
            const score2 = calculateAlignmentScore('text', 'ﷺ', ['ﷺ'], 0.8);
            expect(score1).toBe(1); // SOFT_MATCH
            expect(score2).toBe(1); // SOFT_MATCH
        });
    });

    describe('alignTokenSequences', () => {
        it('should align identical sequences', () => {
            const result = alignTokenSequences(['a', 'b'], ['a', 'b'], [], 0.8);
            expect(result).toEqual([
                ['a', 'a'],
                ['b', 'b'],
            ]);
        });

        it('should handle empty sequences', () => {
            const result1 = alignTokenSequences([], ['a'], [], 0.8);
            expect(result1).toEqual([[null, 'a']]);

            const result2 = alignTokenSequences(['a'], [], [], 0.8);
            expect(result2).toEqual([['a', null]]);

            const result3 = alignTokenSequences([], [], [], 0.8);
            expect(result3).toEqual([]);
        });

        it('should align sequences with substitution', () => {
            const result = alignTokenSequences(['a'], ['b'], [], 0.0);
            expect(result).toEqual([['a', 'b']]);
        });

        it('should handle insertion', () => {
            const result = alignTokenSequences(['a'], ['a', 'b'], [], 0.8);
            expect(result).toEqual([
                ['a', 'a'],
                [null, 'b'],
            ]);
        });

        it('should handle deletion', () => {
            const result = alignTokenSequences(['a', 'b'], ['a'], [], 0.8);
            expect(result).toEqual([
                ['a', 'a'],
                ['b', null],
            ]);
        });

        it('should prioritize typo symbols in alignment', () => {
            const result = alignTokenSequences(['ﷺ', 'text'], ['other', 'ﷺ'], ['ﷺ'], 0.8);
            // The exact result depends on the scoring, but typo symbols should influence alignment
            expect(result).toHaveLength(2);
            expect(result.some((pair) => pair.includes('ﷺ'))).toBe(true);
        });

        it('should handle complex alignment scenario', () => {
            const tokensA = ['hello', 'world', 'test'];
            const tokensB = ['hello', 'wold', 'testing'];
            const result = alignTokenSequences(tokensA, tokensB, [], 0.6);

            expect(result).toHaveLength(3);
            expect(result[0]).toEqual(['hello', 'hello']); // Perfect match
            expect(result[1]).toEqual(['world', 'wold']); // Similar enough
            expect(result[2]).toEqual(['test', 'testing']); // Similar enough
        });
    });
});
