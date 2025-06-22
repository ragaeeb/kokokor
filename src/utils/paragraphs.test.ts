import { beforeEach, describe, expect, it, jest } from 'bun:test';

import { flipAndAlignObservations, mapObservationsToTextLines, mapTextLinesToParagraphs } from './paragraphs';

describe('paragraphs', () => {
    describe('flipAndAlignObservations', () => {
        it('should return empty array when no observations provided', () => {
            const log = jest.fn();
            const result = flipAndAlignObservations([], 800, 72, { log });
            expect(result).toEqual([]);

            expect(log).not.toHaveBeenCalled();
        });

        it('should return empty array when all observations are filtered out', () => {
            const log = jest.fn();
            const result = flipAndAlignObservations([{ text: 'A' }], 800, 72);
            expect(result).toEqual([]);

            expect(log).not.toHaveBeenCalled();
        });

        it('should flip x-coordinates from RTL and align them when they are close', () => {
            const log = jest.fn();

            const result = flipAndAlignObservations(
                [
                    { bbox: { height: 20, width: 700, x: 0, y: 0 }, text: 'AB' },
                    {
                        bbox: {
                            height: 20,
                            width: 700,
                            x: 3,
                            y: 100,
                        },
                        text: 'CD',
                    },
                ],
                800,
                72,
                { log },
            );
            expect(result).toEqual([
                {
                    bbox: {
                        height: 20,
                        width: 700,
                        x: 97,
                        y: 0,
                    },
                    text: 'AB',
                },
                {
                    bbox: {
                        height: 20,
                        width: 700,
                        x: 97,
                        y: 100,
                    },
                    text: 'CD',
                },
            ]);

            expect(log).toHaveBeenCalledTimes(2);
        });
    });

    describe('mapObservationsToTextLines', () => {
        let defaultDpi;

        beforeEach(() => {
            defaultDpi = {
                height: 1200,
                width: 800,
                x: 72,
                y: 72,
            };
        });

        it('should map to text lines without additional metadata', () => {
            const log = jest.fn();

            const actual = mapObservationsToTextLines(
                [
                    { bbox: { height: 20, width: 700, x: 0, y: 0 }, text: 'AB' },
                    {
                        bbox: {
                            height: 20,
                            width: 700,
                            x: 3,
                            y: 100,
                        },
                        text: 'CD',
                    },
                ],
                defaultDpi,
                { log },
            );

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 20,
                        width: 700,
                        x: 97,
                        y: 0,
                    },
                    text: 'AB',
                },
                {
                    bbox: {
                        height: 20,
                        width: 700,
                        x: 97,
                        y: 100,
                    },
                    text: 'CD',
                },
            ]);

            expect(log).toHaveBeenCalledTimes(4);
        });

        it('should map the observation as a footnote', () => {
            const actual = mapObservationsToTextLines(
                [{ bbox: { height: 20, width: 700, x: 0, y: 100 }, text: 'AB' }],
                defaultDpi,
                { horizontalLines: [{ height: 2, width: 800, x: 0, y: 90 }] },
            );

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 20,
                        width: 700,
                        x: 100,
                        y: 100,
                    },
                    isFootnote: true,
                    text: 'AB',
                },
            ]);
        });

        it('should use the very last horizontal line to detect footnote', () => {
            const actual = mapObservationsToTextLines(
                [
                    { bbox: { height: 20, width: 700, x: 0, y: 10 }, text: 'AB' },
                    { bbox: { height: 20, width: 700, x: 0, y: 100 }, text: 'CD' },
                ],
                defaultDpi,
                {
                    horizontalLines: [
                        { height: 2, width: 800, x: 0, y: 2 },
                        { height: 2, width: 800, x: 0, y: 90 },
                    ],
                },
            );

            expect(actual).toEqual([
                { bbox: { height: 20, width: 700, x: 100, y: 10 }, text: 'AB' },
                {
                    bbox: {
                        height: 20,
                        width: 700,
                        x: 100,
                        y: 100,
                    },
                    isFootnote: true,
                    text: 'CD',
                },
            ]);
        });

        it('should ignore the horizontal lines that are part of the rectangle', () => {
            const actual = mapObservationsToTextLines(
                [{ bbox: { height: 20, width: 700, x: 0, y: 250 }, text: 'AB' }],
                defaultDpi,
                {
                    horizontalLines: [
                        { height: 2, width: 800, x: 0, y: 2 },
                        { height: 2, width: 800, x: 0, y: 200 },
                        { height: 2, width: 800, x: 0, y: 98 },
                    ],
                    rectangles: [{ height: 100, width: 800, x: 0, y: 0 }],
                },
            );

            expect(actual).toEqual([
                { bbox: { height: 20, width: 700, x: 100, y: 250 }, isFootnote: true, text: 'AB' },
            ]);
        });

        it('should map the observation as a heading', () => {
            const actual = mapObservationsToTextLines(
                [{ bbox: { height: 20, width: 700, x: 0, y: 10 }, text: 'AB' }],
                defaultDpi,
                { rectangles: [{ height: 100, width: 800, x: 0, y: 0 }] },
            );

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 20,
                        width: 700,
                        x: 100,
                        y: 10,
                    },
                    isHeading: true,
                    text: 'AB',
                },
            ]);
        });

        it('should detect that observation was centered', () => {
            const actual = mapObservationsToTextLines(
                [{ bbox: { height: 20, width: 20, x: 390, y: 10 }, text: 'AB' }],
                defaultDpi,
            );

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 20,
                        width: 20,
                        x: 390,
                        y: 10,
                    },
                    isCentered: true,
                    text: 'AB',
                },
            ]);
        });

        it('should merge a pair of poetry lines', () => {
            defaultDpi.width = 2480;

            const actual = mapObservationsToTextLines(
                [
                    { bbox: { height: 20, width: 600, x: 479, y: 0 }, text: 'A B C D' },
                    { bbox: { height: 20, width: 600, x: 1260, y: 0 }, text: 'E F G H' },
                ],
                defaultDpi,
            );

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 20,
                        width: 1381,
                        x: 620,
                        y: 0,
                    },
                    isPoetic: true,
                    text: 'E F G H A B C D',
                },
            ]);
        });

        it('should merge lines that were broken up by OCR engine', () => {
            const actual = mapObservationsToTextLines(
                [
                    { bbox: { height: 20, width: 300, x: 0, y: 0 }, text: 'AB' },
                    { bbox: { height: 20, width: 200, x: 500, y: 5 }, text: 'CD' },
                ],
                defaultDpi,
            );

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 25,
                        width: 700,
                        x: 100,
                        y: 0,
                    },
                    text: 'CD AB',
                },
            ]);
        });
    });

    describe('mapTextLinesToParagraphs', () => {
        it('should keep existing properties', () => {
            const textLines = [
                {
                    bbox: { height: 10, width: 10, x: 0, y: 0 },
                    isCentered: true,
                    isFootnote: true,
                    isHeading: true,
                    isPoetic: true,
                    text: 'A',
                },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            expect(actual).toEqual(textLines);
        });

        it('should use custom verticalJumpFactor and widthTolerance parameters', () => {
            const textLines = [
                { bbox: { height: 10, width: 100, x: 0, y: 0 }, text: 'Line 1' },
                { bbox: { height: 10, width: 100, x: 0, y: 20 }, text: 'Line 2' },
            ];

            // Test with different parameters
            const actual = mapTextLinesToParagraphs(textLines, 1.5, 0.9);

            expect(actual).toHaveLength(1);
            expect(actual[0].text).toContain('Line');
        });
        it('should handle empty input array', () => {
            const actual = mapTextLinesToParagraphs([]);
            expect(actual).toEqual([]);
        });

        it('should separate body content from footnotes', () => {
            const textLines = [
                { bbox: { height: 10, width: 100, x: 0, y: 0 }, text: 'Body line 1' },
                { bbox: { height: 10, width: 100, x: 0, y: 20 }, text: 'Body line 2' },
                { bbox: { height: 10, width: 80, x: 0, y: 200 }, isFootnote: true, text: 'Footnote 1' },
                { bbox: { height: 10, width: 80, x: 0, y: 220 }, isFootnote: true, text: 'Footnote 2' },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            // Should have body content followed by footnotes
            expect(actual).toHaveLength(2);
            expect(actual[0].text).toContain('Body line');
            expect(actual[1].text).toContain('Footnote');
        });

        it('should handle only footnotes', () => {
            const textLines = [
                { bbox: { height: 10, width: 80, x: 0, y: 200 }, isFootnote: true, text: 'Footnote 1' },
                { bbox: { height: 10, width: 80, x: 0, y: 220 }, isFootnote: true, text: 'Footnote 2' },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            expect(actual).toHaveLength(1);
            expect(actual[0].text).toContain('Footnote');
            expect(actual[0].isFootnote).toBe(true);
        });

        it('should handle only body content without footnotes', () => {
            const textLines = [
                { bbox: { height: 10, width: 100, x: 0, y: 0 }, text: 'Body line 1' },
                { bbox: { height: 10, width: 100, x: 0, y: 20 }, text: 'Body line 2' },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 30,
                        width: 100,
                        x: 0,
                        y: 0,
                    },
                    text: 'Body line 1 Body line 2',
                },
            ]);
        });

        it('should preserve poetic lines individually', () => {
            const textLines = [
                { bbox: { height: 10, width: 100, x: 0, y: 0 }, text: 'Prose line 1' },
                { bbox: { height: 10, width: 100, x: 0, y: 20 }, isPoetic: true, text: 'Poetry line 1' },
                { bbox: { height: 10, width: 100, x: 0, y: 40 }, isPoetic: true, text: 'Poetry line 2' },
                { bbox: { height: 10, width: 100, x: 0, y: 60 }, text: 'Prose line 2' },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            expect(actual).toHaveLength(4); // 1 prose paragraph + 2 individual poetry lines + 1 prose paragraph
            expect(actual[0].text).toBe('Prose line 1');
            expect(actual[1].text).toBe('Poetry line 1');
            expect(actual[1].isPoetic).toBe(true);
            expect(actual[2].text).toBe('Poetry line 2');
            expect(actual[2].isPoetic).toBe(true);
            expect(actual[3].text).toBe('Prose line 2');
        });

        it('should handle multiple consecutive poetic lines', () => {
            const textLines = [
                { bbox: { height: 10, width: 100, x: 0, y: 0 }, isPoetic: true, text: 'Poetry line 1' },
                { bbox: { height: 10, width: 100, x: 0, y: 20 }, isPoetic: true, text: 'Poetry line 2' },
                { bbox: { height: 10, width: 100, x: 0, y: 40 }, isPoetic: true, text: 'Poetry line 3' },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            expect(actual).toHaveLength(3);
            expect(actual[0].text).toBe('Poetry line 1');
            expect(actual[0].isPoetic).toBe(true);
            expect(actual[1].text).toBe('Poetry line 2');
            expect(actual[1].isPoetic).toBe(true);
            expect(actual[2].text).toBe('Poetry line 3');
            expect(actual[2].isPoetic).toBe(true);
        });

        it('should group prose lines then flush when encountering poetry', () => {
            const textLines = [
                { bbox: { height: 10, width: 100, x: 0, y: 0 }, text: 'Prose line 1' },
                { bbox: { height: 10, width: 100, x: 0, y: 20 }, text: 'Prose line 2' },
                { bbox: { height: 10, width: 100, x: 0, y: 40 }, text: 'Prose line 3' },
                { bbox: { height: 10, width: 100, x: 0, y: 60 }, isPoetic: true, text: 'Poetry line' },
                { bbox: { height: 10, width: 100, x: 0, y: 80 }, text: 'More prose 1' },
                { bbox: { height: 10, width: 100, x: 0, y: 100 }, text: 'More prose 2' },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 50,
                        width: 100,
                        x: 0,
                        y: 0,
                    },
                    text: 'Prose line 1 Prose line 2 Prose line 3',
                },
                {
                    bbox: {
                        height: 10,
                        width: 100,
                        x: 0,
                        y: 60,
                    },
                    isPoetic: true,
                    text: 'Poetry line',
                },
                {
                    bbox: {
                        height: 30,
                        width: 100,
                        x: 0,
                        y: 80,
                    },
                    text: 'More prose 1 More prose 2',
                },
            ]);
        });

        it('should flush remaining prose lines at the end', () => {
            const textLines = [
                { bbox: { height: 10, width: 100, x: 0, y: 0 }, isPoetic: true, text: 'Poetry line' },
                { bbox: { height: 10, width: 100, x: 0, y: 20 }, text: 'Prose line 1' },
                { bbox: { height: 10, width: 100, x: 0, y: 40 }, text: 'Prose line 2' },
                { bbox: { height: 10, width: 100, x: 0, y: 60 }, text: 'Prose line 3' },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 10,
                        width: 100,
                        x: 0,
                        y: 0,
                    },
                    isPoetic: true,
                    text: 'Poetry line',
                },
                {
                    bbox: {
                        height: 50,
                        width: 100,
                        x: 0,
                        y: 20,
                    },
                    text: 'Prose line 1 Prose line 2 Prose line 3',
                },
            ]);
        });

        it('should handle all prose lines without poetry', () => {
            const textLines = [
                { bbox: { height: 10, width: 100, x: 0, y: 0 }, text: 'Prose line 1' },
                { bbox: { height: 10, width: 100, x: 0, y: 20 }, text: 'Prose line 2' },
                { bbox: { height: 10, width: 100, x: 0, y: 40 }, text: 'Prose line 3' },
                { bbox: { height: 10, width: 100, x: 0, y: 60 }, text: 'Prose line 4' },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 70,
                        width: 100,
                        x: 0,
                        y: 0,
                    },
                    text: 'Prose line 1 Prose line 2 Prose line 3 Prose line 4',
                },
            ]);
        });

        it('should handle mixed footnotes with body content including poetry', () => {
            const textLines = [
                { bbox: { height: 10, width: 100, x: 0, y: 0 }, text: 'Body prose 1' },
                { bbox: { height: 10, width: 100, x: 0, y: 20 }, isPoetic: true, text: 'Body poetry' },
                { bbox: { height: 10, width: 100, x: 0, y: 40 }, text: 'Body prose 2' },
                { bbox: { height: 10, width: 80, x: 0, y: 200 }, isFootnote: true, text: 'Footnote prose 1' },
                {
                    bbox: { height: 10, width: 80, x: 0, y: 220 },
                    isFootnote: true,
                    isPoetic: true,
                    text: 'Footnote poetry',
                },
                { bbox: { height: 10, width: 80, x: 0, y: 240 }, isFootnote: true, text: 'Footnote prose 2' },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 10,
                        width: 100,
                        x: 0,
                        y: 0,
                    },
                    text: 'Body prose 1',
                },
                {
                    bbox: {
                        height: 10,
                        width: 100,
                        x: 0,
                        y: 20,
                    },
                    isPoetic: true,
                    text: 'Body poetry',
                },
                {
                    bbox: {
                        height: 10,
                        width: 100,
                        x: 0,
                        y: 40,
                    },
                    text: 'Body prose 2',
                },
                {
                    bbox: {
                        height: 10,
                        width: 80,
                        x: 0,
                        y: 200,
                    },
                    isFootnote: true,
                    text: 'Footnote prose 1',
                },
                {
                    bbox: {
                        height: 10,
                        width: 80,
                        x: 0,
                        y: 220,
                    },
                    isFootnote: true,
                    isPoetic: true,
                    text: 'Footnote poetry',
                },
                {
                    bbox: {
                        height: 10,
                        width: 80,
                        x: 0,
                        y: 240,
                    },
                    isFootnote: true,
                    text: 'Footnote prose 2',
                },
            ]);
        });
    });
});
