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
    });
});
