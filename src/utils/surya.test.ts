import { describe, expect, it } from 'bun:test';

import { mapSuryaPageResultToObservations } from './surya';

describe('surya', () => {
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
});
