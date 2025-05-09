import { describe, expect, it, mock } from 'bun:test';

import { applyFooter, mapOcrResultToRTLObservations, normalizeObservationsX } from './normalization';

describe('normalization', () => {
    describe('mapOcrResultToRTLObservations', () => {
        it('should correct the x-coordinates to be from the right', () => {
            const actual = mapOcrResultToRTLObservations(
                [{ bbox: { height: 1, width: 50, x: 0, y: 0 }, text: 'Ewwo' }],
                100,
            );

            expect(actual).toEqual([{ bbox: { height: 1, width: 50, x: 50, y: 0 }, text: 'Ewwo' }]);
        });

        it('should handle multiple observations', () => {
            const observations = [
                { bbox: { height: 10, width: 30, x: 10, y: 5 }, text: 'Text 1' },
                { bbox: { height: 15, width: 40, x: 50, y: 20 }, text: 'Text 2' },
            ];
            const imageWidth = 200;

            const result = mapOcrResultToRTLObservations(observations, imageWidth);

            expect(result).toEqual([
                { bbox: { height: 10, width: 30, x: 160, y: 5 }, text: 'Text 1' },
                { bbox: { height: 15, width: 40, x: 110, y: 20 }, text: 'Text 2' },
            ]);
        });

        it('should handle an empty observations array', () => {
            const result = mapOcrResultToRTLObservations([], 100);
            expect(result).toEqual([]);
        });
    });

    describe('normalizeObservationsX', () => {
        it('should normalize the x-coordinates based on the margins and threshold', () => {
            const actual = normalizeObservationsX(
                [
                    { bbox: { height: 5, width: 10, x: 22, y: 0 }, text: 'Text 1' },
                    { bbox: { height: 5, width: 15, x: 25, y: 10 }, text: 'Text 2' },
                    { bbox: { height: 5, width: 20, x: 28, y: 20 }, text: 'Text 3' },
                    { bbox: { height: 5, width: 25, x: 26, y: 30 }, text: 'Text 4' },
                    { bbox: { height: 5, width: 30, x: 219.99, y: 40 }, text: 'Text 5' },
                ],
                72,
                300,
            );

            expect(actual).toEqual([
                { bbox: { height: 5, width: 10, x: 22, y: 0 }, text: 'Text 1' },
                { bbox: { height: 5, width: 15, x: 22, y: 10 }, text: 'Text 2' },
                { bbox: { height: 5, width: 20, x: 22, y: 20 }, text: 'Text 3' },
                { bbox: { height: 5, width: 25, x: 22, y: 30 }, text: 'Text 4' },
                { bbox: { height: 5, width: 30, x: 219.99, y: 40 }, text: 'Text 5' },
            ]);
        });

        it('should handle empty observations array', () => {
            const result = normalizeObservationsX([], 72, 300);
            expect(result).toEqual([]);
        });

        it('should normalize the x-coordinates based on the margins and threshold', () => {
            const actual = normalizeObservationsX(
                [
                    {
                        bbox: {
                            x: 22,
                        },
                    },
                    {
                        bbox: {
                            x: 25,
                        },
                    },
                    {
                        bbox: {
                            x: 28,
                        },
                    },
                    {
                        bbox: {
                            x: 26,
                        },
                    },
                    {
                        bbox: {
                            x: 219.99,
                        },
                    },
                ],
                72,
                300,
            );

            expect(actual).toEqual([
                {
                    bbox: {
                        x: 22,
                    },
                },
                {
                    bbox: {
                        x: 22,
                    },
                },
                {
                    bbox: {
                        x: 22,
                    },
                },
                {
                    bbox: {
                        x: 22,
                    },
                },
                {
                    bbox: {
                        x: 219.99,
                    },
                },
            ]);
        });
    });

    describe('applyFooter', () => {
        it('should insert footer after the last observation with y less than footer.y', () => {
            const observations = [
                { bbox: { height: 10, width: 50, x: 20, y: 100 }, text: 'Paragraph 1' },
                { bbox: { height: 10, width: 50, x: 20, y: 200 }, text: 'Paragraph 2' },
                { bbox: { height: 10, width: 50, x: 20, y: 300 }, text: 'Paragraph 3' },
            ];

            const footer = { bbox: { height: 5, width: 100, x: 20, y: 250 }, text: 'Footer' };

            const result = applyFooter(observations, footer);

            expect(result).toEqual([
                { bbox: { height: 10, width: 50, x: 20, y: 100 }, text: 'Paragraph 1' },
                { bbox: { height: 10, width: 50, x: 20, y: 200 }, text: 'Paragraph 2' },
                { bbox: { height: 5, width: 100, x: 20, y: 250 }, text: 'Footer' },
                { bbox: { height: 10, width: 50, x: 20, y: 300 }, text: 'Paragraph 3' },
            ]);
        });

        it('should not insert footer if no observation has y less than footer.y', () => {
            const observations = [
                { bbox: { height: 10, width: 50, x: 20, y: 300 }, text: 'Paragraph 1' },
                { bbox: { height: 10, width: 50, x: 20, y: 400 }, text: 'Paragraph 2' },
            ];

            const footer = { bbox: { height: 5, width: 100, x: 20, y: 200 }, text: 'Footer' };

            // Mock console.warn to verify it's called
            const originalWarn = console.warn;
            const mockWarn = mock(() => {});
            console.warn = mockWarn;

            const result = applyFooter(observations, footer);

            expect(result).toEqual(observations);
            expect(mockWarn).toHaveBeenCalledWith('Footer not found');

            // Restore original console.warn
            console.warn = originalWarn;
        });

        it('should handle empty observations array', () => {
            const observations = [];
            const footer = { bbox: { height: 5, width: 100, x: 20, y: 200 }, text: 'Footer' };

            // Mock console.warn
            const originalWarn = console.warn;
            const mockWarn = mock(() => {});
            console.warn = mockWarn;

            const result = applyFooter(observations, footer);

            expect(result).toEqual([]);
            expect(mockWarn).toHaveBeenCalledWith('Footer not found');

            // Restore original console.warn
            console.warn = originalWarn;
        });
    });
});
