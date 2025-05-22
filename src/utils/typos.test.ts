import { describe, expect, it } from 'bun:test';

import { findAndFixTypos, mapSuryaPageResultToObservations } from './typos';

describe('typos', () => {
    describe('mapSuryaPageResultToObservations', () => {
        it('should map the surya results to observations', () => {
            const actual = mapSuryaPageResultToObservations({
                text_lines: [{ chars: [], text: 'A', bbox: [27, 13, 483, 33] }],
            });

            expect(actual).toEqual([
                {
                    bbox: {
                        x: 27,
                        y: 13,
                        width: 456,
                        height: 20,
                    },
                    text: 'A',
                },
            ]);
        });

        it('should map multiple surya results', () => {
            const input = {
                text_lines: [
                    { chars: [], text: 'First line', bbox: [10, 20, 100, 40] },
                    { chars: [], text: 'Second line', bbox: [10, 50, 120, 70] },
                ],
            };

            const result = mapSuryaPageResultToObservations(input);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                bbox: { x: 10, y: 20, width: 90, height: 20 },
                text: 'First line',
            });
            expect(result[1]).toEqual({
                bbox: { x: 10, y: 50, width: 110, height: 20 },
                text: 'Second line',
            });
        });

        it('should handle empty text_lines array', () => {
            const result = mapSuryaPageResultToObservations({ text_lines: [] });
            expect(result).toEqual([]);
        });

        it('should handle Arabic text', () => {
            const result = mapSuryaPageResultToObservations({
                text_lines: [{ chars: [], text: 'النص العربي', bbox: [0, 0, 100, 20] }],
            });

            expect(result[0].text).toBe('النص العربي');
        });

        it('should calculate correct dimensions from coordinates', () => {
            const result = mapSuryaPageResultToObservations({
                text_lines: [{ chars: [], text: 'test', bbox: [50, 30, 150, 80] }],
            });

            expect(result[0].bbox).toEqual({
                x: 50,
                y: 30,
                width: 100, // 150 - 50
                height: 50, // 80 - 30
            });
        });
    });

    describe('findAndFixTypos', () => {
        const defaultOptions = {
            typoSymbols: ['ﷺ'],
            similarityThreshold: 0.7,
            highSimilarityThreshold: 0.9,
        };

        const createObservation = (text: string) => ({
            bbox: { x: 0, y: 0, width: 100, height: 20 },
            text,
        });

        it('should throw error for mismatched array lengths', () => {
            const suryaObs = [createObservation('test')];
            const originalObs = [createObservation('test'), createObservation('another')];

            expect(() => findAndFixTypos(suryaObs, originalObs, defaultOptions)).toThrow(
                'The two observation arrays must have the same length',
            );
        });

        it('should return original observation when no typo symbols present', () => {
            const suryaObs = [createObservation('normal text')];
            const originalObs = [createObservation('normal text')];

            const result = findAndFixTypos(suryaObs, originalObs, defaultOptions);

            expect(result).toEqual(originalObs);
        });

        it('should fix typos when typo symbols are present', () => {
            const suryaObs = [createObservation('محمد ﷺ رسول الله')];
            const originalObs = [createObservation('محمد صلى الله عليه وسلم رسول الله')];

            const result = findAndFixTypos(suryaObs, originalObs, defaultOptions);

            expect(result[0].text).toContain('ﷺ');
            expect(result[0].bbox).toEqual(originalObs[0].bbox); // Preserve original bbox
        });

        it('should handle multiple observations', () => {
            const suryaObs = [createObservation('normal text'), createObservation('text with ﷺ symbol')];
            const originalObs = [
                createObservation('normal text'),
                createObservation('text with صلى الله عليه وسلم symbol'),
            ];

            const result = findAndFixTypos(suryaObs, originalObs, defaultOptions);

            expect(result).toHaveLength(2);
            expect(result[0].text).toBe('normal text'); // No change
            expect(result[1].text).toContain('ﷺ'); // Fixed
        });

        it('should preserve original bbox and only modify text', () => {
            const originalBbox = { x: 10, y: 20, width: 200, height: 30 };
            const suryaObs = [{ bbox: { x: 0, y: 0, width: 100, height: 20 }, text: 'text ﷺ' }];
            const originalObs = [{ bbox: originalBbox, text: 'text symbol' }];

            const result = findAndFixTypos(suryaObs, originalObs, defaultOptions);

            expect(result[0].bbox).toEqual(originalBbox);
            expect(result[0].text).not.toBe('text symbol');
        });

        it('should handle empty observation arrays', () => {
            const result = findAndFixTypos([], [], defaultOptions);
            expect(result).toEqual([]);
        });

        it('should work with different typo symbols', () => {
            const options = {
                typoSymbols: ['﷽', 'ﷻ'],
                similarityThreshold: 0.7,
                highSimilarityThreshold: 0.9,
            };

            const suryaObs = [createObservation('بسم ﷽ الله ﷻ')];
            const originalObs = [createObservation('بسم الله الرحمن الرحيم الله جل جلاله')];

            const result = findAndFixTypos(suryaObs, originalObs, options);

            expect(result[0].text).toContain('﷽');
            expect(result[0].text).toContain('ﷻ');
        });

        it('should handle similarity threshold edge cases', () => {
            const options = {
                typoSymbols: ['ﷺ'],
                similarityThreshold: 0.1, // Very low threshold
                highSimilarityThreshold: 0.9,
            };

            const suryaObs = [createObservation('completely different ﷺ text')];
            const originalObs = [createObservation('totally other words')];

            const result = findAndFixTypos(suryaObs, originalObs, options);

            // Should still process because typo symbol is present
            expect(result[0].text).not.toBe(originalObs[0].text);
        });

        it('should preserve diacritics when appropriate', () => {
            const suryaObs = [createObservation('النَّص ﷺ العَرَبي')];
            const originalObs = [createObservation('النص صلى الله عليه وسلم العربي')];

            const result = findAndFixTypos(suryaObs, originalObs, defaultOptions);

            // Should use typo symbol but may preserve other diacritics
            expect(result[0].text).toContain('ﷺ');
        });
    });
});
