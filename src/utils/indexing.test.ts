import { describe, expect, it } from 'bun:test';

import { indexObservationsAsLines, indexObservationsAsParagraphs } from './indexing';

describe('indexing', () => {
    describe('indexObservationsAsLines', () => {
        it('should assign the same line index to observations within vertical threshold', () => {
            const observations = [
                { bbox: { height: 20, width: 100, x: 10, y: 10 }, text: 'First line part 1' },
                { bbox: { height: 20, width: 100, x: 120, y: 12 }, text: 'First line part 2' }, // Close to first, should be same line
                { bbox: { height: 20, width: 100, x: 10, y: 50 }, text: 'Second line' }, // Far from first, should be new line
                { bbox: { height: 20, width: 100, x: 10, y: 52 }, text: 'Still second line' }, // Close to previous, same line
            ];

            const indexed = indexObservationsAsLines(observations, 72, 5);

            expect(indexed[0].index).toBe(0);
            expect(indexed[1].index).toBe(0); // Same line as first
            expect(indexed[2].index).toBe(1); // New line
            expect(indexed[3].index).toBe(1); // Same line as third
        });

        it('should handle single observation', () => {
            const observations = [{ bbox: { height: 20, width: 100, x: 10, y: 10 }, text: 'Single observation' }];

            const result = indexObservationsAsLines(observations, 72, 5);
            expect(result).toEqual([
                { bbox: { height: 20, width: 100, x: 10, y: 10 }, index: 0, text: 'Single observation' },
            ]);
        });

        it('should consider height of observation for threshold calculation', () => {
            const observations = [
                { bbox: { height: 10, width: 100, x: 10, y: 10 }, text: 'Small height' },
                { bbox: { height: 40, width: 100, x: 120, y: 30 }, text: 'Large height' }, // Within threshold due to large height
                { bbox: { height: 10, width: 100, x: 10, y: 60 }, text: 'Far from previous' }, // Beyond threshold
            ];

            const indexed = indexObservationsAsLines(observations, 72, 5);

            expect(indexed[0].index).toBe(0);
            expect(indexed[1].index).toBe(0); // Same line due to tall height
            expect(indexed[2].index).toBe(1); // New line
        });

        it('should sort result by line and then y-coordinate', () => {
            const observations = [
                { bbox: { height: 20, width: 100, x: 10, y: 20 }, text: 'First line, second y' },
                { bbox: { height: 20, width: 100, x: 120, y: 10 }, text: 'First line, first y' },
                { bbox: { height: 20, width: 100, x: 10, y: 90 }, text: 'Second line, second y' },
                { bbox: { height: 20, width: 100, x: 120, y: 80 }, text: 'Second line, first y' },
            ];

            const indexed = indexObservationsAsLines(observations, 72, 5);

            // Should be sorted by line then y
            expect(indexed[0].text).toBe('First line, first y');
            expect(indexed[1].text).toBe('First line, second y');
            expect(indexed[2].text).toBe('Second line, first y');
            expect(indexed[3].text).toBe('Second line, second y');
        });
    });

    describe('indexObservationsAsParagraphs', () => {
        it('should group observations into paragraphs based on vertical gaps', () => {
            const observations = [
                { bbox: { height: 20, width: 500, x: 10, y: 10 }, text: 'First paragraph line 1' },
                { bbox: { height: 20, width: 500, x: 10, y: 40 }, text: 'First paragraph line 2' },
                { bbox: { height: 20, width: 500, x: 10, y: 120 }, text: 'Second paragraph line 1' }, // Big jump = new paragraph
                { bbox: { height: 20, width: 500, x: 10, y: 150 }, text: 'Second paragraph line 2' },
            ];

            const paragraphs = indexObservationsAsParagraphs(observations, 2, 0.85);

            expect(paragraphs[0].index).toBe(0);
            expect(paragraphs[1].index).toBe(0); // Same paragraph
            expect(paragraphs[2].index).toBe(1); // New paragraph due to big jump
            expect(paragraphs[3].index).toBe(1); // Same paragraph
        });

        it('should create new paragraph after short lines', () => {
            const observations = [
                { bbox: { height: 20, width: 500, x: 10, y: 10 }, text: 'Full width line' },
                { bbox: { height: 20, width: 250, x: 10, y: 40 }, text: 'Short line' }, // Short line should end paragraph
                { bbox: { height: 20, width: 500, x: 10, y: 70 }, text: 'Next paragraph' }, // Should be new paragraph
            ];

            const paragraphs = indexObservationsAsParagraphs(observations, 2, 0.85);

            expect(paragraphs[0].index).toBe(0);
            expect(paragraphs[1].index).toBe(0); // Same paragraph
            expect(paragraphs[2].index).toBe(1); // New paragraph after short line
        });

        it('should handle empty array', () => {
            const result = indexObservationsAsParagraphs([], 2, 0.85);
            expect(result).toEqual([]);
        });

        it('should handle single observation', () => {
            const observations = [{ bbox: { height: 20, width: 100, x: 10, y: 10 }, text: 'Single observation' }];

            const result = indexObservationsAsParagraphs(observations, 2, 0.85);
            expect(result).toEqual([
                { bbox: { height: 20, width: 100, x: 10, y: 10 }, index: 0, text: 'Single observation' },
            ]);
        });

        it('should detect paragraph breaks based on increasing gap size patterns', () => {
            const observations = [
                { bbox: { height: 20, width: 500, x: 10, y: 10 }, text: 'Line 1' },
                { bbox: { height: 20, width: 500, x: 10, y: 40 }, text: 'Line 2' }, // Gap of 30
                { bbox: { height: 20, width: 500, x: 10, y: 70 }, text: 'Line 3' }, // Gap of 30
                { bbox: { height: 20, width: 500, x: 10, y: 160 }, text: 'Line 4' }, // Gap of 90 (> 30*2)
            ];

            const paragraphs = indexObservationsAsParagraphs(observations, 2, 0.85);

            expect(paragraphs[0].index).toBe(0);
            expect(paragraphs[1].index).toBe(0);
            expect(paragraphs[2].index).toBe(0);
            expect(paragraphs[3].index).toBe(1); // New paragraph due to gap increase
        });

        it('should create new paragraph for significant vertical jumps', () => {
            const observations = [
                { bbox: { height: 10, width: 200, x: 10, y: 10 }, index: 0, text: 'Line 1' },
                { bbox: { height: 10, width: 200, x: 10, y: 30 }, index: 1, text: 'Line 2' },
                // Huge vertical jump
                { bbox: { height: 10, width: 200, x: 10, y: 150 }, index: 2, text: 'Line 3' },
            ];

            const result = indexObservationsAsParagraphs(observations, 2, 0.85);

            expect(result[0].index).toBe(result[1].index);
            expect(result[1].index).not.toBe(result[2].index);
        });

        it('should sort result by paragraph and then y-coordinate', () => {
            const observations = [
                { bbox: { height: 20, width: 500, x: 10, y: 40 }, text: 'Para 1 line 2' },
                { bbox: { height: 20, width: 500, x: 10, y: 10 }, text: 'Para 1 line 1' },
                { bbox: { height: 20, width: 500, x: 10, y: 140 }, text: 'Para 2 line 2' },
                { bbox: { height: 20, width: 500, x: 10, y: 110 }, text: 'Para 2 line 1' },
            ];

            const paragraphs = indexObservationsAsParagraphs(observations, 2, 0.85);

            // Should be sorted by paragraph then y
            expect(paragraphs[0].text).toBe('Para 1 line 1');
            expect(paragraphs[1].text).toBe('Para 1 line 2');
            expect(paragraphs[2].text).toBe('Para 2 line 1');
            expect(paragraphs[3].text).toBe('Para 2 line 2');
        });

        it('should create new paragraph for lines with width below tolerance', () => {
            const observations = [
                { bbox: { height: 10, width: 200, x: 10, y: 10 }, index: 0, text: 'Line 1' },
                { bbox: { height: 10, width: 160, x: 10, y: 30 }, index: 1, text: 'Line 2' }, // Width within tolerance
                { bbox: { height: 10, width: 50, x: 10, y: 50 }, index: 2, text: 'Line 3' }, // Width below tolerance
            ];

            const result = indexObservationsAsParagraphs(observations, 2, 0.85);

            expect(result[0].index).toBe(result[1].index); // Same paragraph
            expect(result[1].index).not.toBe(result[2].index); // New paragraph
        });
    });
});
